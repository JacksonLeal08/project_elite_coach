import { supabase } from './supabase';

export interface OfflineOperation {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export function queueOfflineOperation(type: string, payload: any) {
  if (typeof window === 'undefined') return;
  const queueStr = localStorage.getItem('elite_coach_offline_queue');
  const queue: OfflineOperation[] = queueStr ? JSON.parse(queueStr) : [];
  
  const newOp: OfflineOperation = {
    id: Math.random().toString(36).substring(2, 9),
    type,
    payload,
    timestamp: Date.now()
  };
  
  queue.push(newOp);
  localStorage.setItem('elite_coach_offline_queue', JSON.stringify(queue));
  
  // Dispatch a custom event to notify components that the queue size changed
  window.dispatchEvent(new CustomEvent('offline_queue_changed'));
}

export function getOfflineQueue(): OfflineOperation[] {
  if (typeof window === 'undefined') return [];
  const queueStr = localStorage.getItem('elite_coach_offline_queue');
  return queueStr ? JSON.parse(queueStr) : [];
}

export async function runOfflineSync(): Promise<{ success: boolean; syncedCount: number }> {
  if (typeof window === 'undefined') return { success: false, syncedCount: 0 };
  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: true, syncedCount: 0 };
  
  // If we are completely offline, don't even try
  if (!navigator.onLine) {
    return { success: false, syncedCount: 0 };
  }
  
  let syncedCount = 0;
  const remainingOps: OfflineOperation[] = [];
  
  for (const op of queue) {
    try {
      let error = null;
      
      switch (op.type) {
        case 'save_progress':
          const res1 = await supabase.rpc('save_public_workout_progress', op.payload);
          error = res1.error;
          break;
        case 'schedule_evaluation':
          const res2 = await supabase.rpc('schedule_public_evaluation', op.payload);
          error = res2.error;
          break;
        case 'respond_schedule':
          const res3 = await supabase.rpc('respond_public_schedule', op.payload);
          error = res3.error;
          break;
        case 'acknowledge_protocol':
          const res4 = await supabase.rpc('acknowledge_public_protocol', op.payload);
          error = res4.error;
          break;
        case 'update_schedule_status':
          const { error: errSch } = await supabase
            .from('evaluation_schedules')
            .update(op.payload.update)
            .eq('id', op.payload.id);
          error = errSch;
          break;
        case 'update_student_profile':
          const { error: errStud } = await supabase
            .from('students')
            .update(op.payload.update)
            .eq('id', op.payload.id);
          error = errStud;
          break;
        case 'add_student':
          const { error: errAddStud } = await supabase
            .from('students')
            .insert([op.payload]);
          error = errAddStud;
          break;
        case 'add_schedule':
          const { error: errAddSch } = await supabase
            .from('evaluation_schedules')
            .insert([op.payload]);
          error = errAddSch;
          break;
        case 'save_goals':
          const { error: errGoals } = await supabase
            .from('student_goals')
            .upsert(op.payload, { onConflict: 'student_id' });
          error = errGoals;
          break;
        case 'save_anamnesis':
          const { error: errAnam } = await supabase
            .from('anamnesis')
            .upsert(op.payload, { onConflict: 'student_id' });
          error = errAnam;
          break;
        default:
          console.warn('Unknown offline operation type:', op.type);
      }
      
      if (error) {
        console.error('Error syncing offline operation:', op.type, error);
        remainingOps.push(op);
      } else {
        syncedCount++;
      }
    } catch (err) {
      console.error('Failed to sync operation:', op.type, err);
      remainingOps.push(op);
    }
  }
  
  localStorage.setItem('elite_coach_offline_queue', JSON.stringify(remainingOps));
  window.dispatchEvent(new CustomEvent('offline_queue_changed'));
  
  return {
    success: remainingOps.length === 0,
    syncedCount
  };
}
