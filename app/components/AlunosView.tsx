import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Award, CheckCircle2, Camera, Plus, X, MessageSquare, CreditCard, Trash2, History, LayoutGrid, List } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { Student, User, Anamnesis, StudentGoal } from '../types';
import { supabase } from '../utils/supabase';
import { exportAnamnesisPDF, exportPosturePDF, exportEvolutionPDF, exportFrequencyPDF } from '../utils/pdf';
import { queueOfflineOperation, runOfflineSync } from '../utils/offline';
import CustomAlertModal from './CustomAlertModal';
import ParticleEffect from './ParticleEffect';

const isColumnMismatchError = (error: any): boolean => {
  if (!error) return false;
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  const details = (error.details || '').toLowerCase();
  const hint = (error.hint || '').toLowerCase();
  return (
    code === '42703' ||
    message.includes('column') ||
    message.includes('not found') ||
    message.includes('does not exist') ||
    details.includes('column') ||
    details.includes('does not exist') ||
    hint.includes('column')
  );
};

const extractMissingColumn = (error: any): string | null => {
  if (!error) return null;
  const message = error.message || '';
  const match1 = message.match(/Could not find the '([^']+)' column/i);
  if (match1) return match1[1];
  const match2 = message.match(/column "([^"]+)"/i);
  if (match2) return match2[1];
  const match3 = message.match(/column '([^']+)'/i);
  if (match3) return match3[1];
  return null;
};

const safeSupabaseWrite = async (
  operation: 'insert' | 'update' | 'upsert',
  table: string,
  payload: any,
  options?: { eqColumn?: string; eqValue?: any; onConflict?: string }
): Promise<{ data: any; error: any; prunedColumns: string[] }> => {
  let currentPayload = { ...payload };
  const prunedColumns: string[] = [];
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    let queryObj: any;
    if (operation === 'insert') {
      queryObj = supabase.from(table).insert([currentPayload]).select();
    } else if (operation === 'update') {
      queryObj = supabase.from(table).update(currentPayload);
      if (options?.eqColumn && options?.eqValue !== undefined) {
        queryObj = queryObj.eq(options.eqColumn, options.eqValue);
      }
      queryObj = queryObj.select();
    } else {
      queryObj = supabase.from(table).upsert(currentPayload, { onConflict: options?.onConflict }).select();
    }

    const { data, error } = await queryObj;

    if (error && isColumnMismatchError(error)) {
      const missingCol = extractMissingColumn(error);
      if (missingCol && missingCol in currentPayload) {
        console.warn(`[Supabase Prune] Column '${missingCol}' does not exist on table '${table}'. Pruning and retrying.`);
        delete currentPayload[missingCol];
        prunedColumns.push(missingCol);
        attempts++;
        continue;
      }
    }
    return { data, error, prunedColumns };
  }

  let queryObj: any;
  if (operation === 'insert') {
    queryObj = supabase.from(table).insert([payload]);
  } else if (operation === 'update') {
    queryObj = supabase.from(table).update(payload);
    if (options?.eqColumn && options?.eqValue !== undefined) {
      queryObj = queryObj.eq(options.eqColumn, options.eqValue);
    }
  } else {
    queryObj = supabase.from(table).upsert(payload, { onConflict: options?.onConflict });
  }
  const { data, error } = await queryObj;
  return { data, error, prunedColumns };
};

const isSchedulePast = (dateStr: string, timeStr: string) => {
  try {
    const today = new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const scheduleDate = new Date(year, month - 1, day, hours, minutes);
    return scheduleDate < today;
  } catch (e) {
    return false;
  }
};


interface AlunosViewProps {
  currentUser: User | null;
  redirectStudentId?: string | number | null;
  redirectTab?: 'general' | 'anamnesis' | 'goals' | 'schedule' | 'attendance' | null;
  clearRedirect?: () => void;
}

export default function AlunosView({ currentUser, redirectStudentId, redirectTab, clearRedirect }: AlunosViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('elite_coach_alunos_view_mode') as 'table' | 'cards') || 'table';
    }
    return 'table';
  });

  const handleToggleViewMode = () => {
    const nextMode = viewMode === 'table' ? 'cards' : 'table';
    setViewMode(nextMode);
    localStorage.setItem('elite_coach_alunos_view_mode', nextMode);
  };

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    title: string;
    message?: string;
    recordName?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'info', title: '' });

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm',
    recordName?: string,
    onConfirm?: () => void
  ) => {
    setAlertModal({
      isOpen: true,
      type,
      title,
      message,
      recordName,
      onConfirm
    });
  };
  
    const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  // Callback ref to bind stream as soon as video element mounts in the DOM
  const bindVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && stream) {
      el.srcObject = stream;
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // New Student Form Modal States
  const [showNewStudentModal, setShowNewStudentModal] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [registeredStudentName, setRegisteredStudentName] = useState<string>('');
  const [newStudent, setNewStudent] = useState({
    name: '',
    age: '',
    goal: '',
    biotype: 'Mesomorfo',
    status: 'Ativo',
    phone_number: '',
    telegram_chat_id: '',
    photo_avatar_url: '',
    email: '',
    birth_date: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    is_whatsapp: true,
    activity_level: 'Levemente Ativo',
    dietary_habits: '',
    medical_history: '',
    injuries: '',
    medications: '',
    weight: '',
    height: '',
    body_fat: '',
    lean_mass: '',
    blood_pressure: '',
    waist: '',
    abdomen: '',
    hips: '',
    right_arm: '',
    left_arm: '',
    right_thigh: '',
    left_thigh: '',
    freq_target: '3',
    available_days: [] as string[],
    duration_pref: '60 min',
    training_location: 'Academia'
  });

  const resetNewStudent = () => {
    setNewStudent({
      name: '',
      age: '',
      goal: '',
      biotype: 'Mesomorfo',
      status: 'Ativo',
      phone_number: '',
      telegram_chat_id: '',
      photo_avatar_url: '',
      email: '',
      birth_date: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      is_whatsapp: true,
      activity_level: 'Levemente Ativo',
      dietary_habits: '',
      medical_history: '',
      injuries: '',
      medications: '',
      weight: '',
      height: '',
      body_fat: '',
      lean_mass: '',
      blood_pressure: '',
      waist: '',
      abdomen: '',
      hips: '',
      right_arm: '',
      left_arm: '',
      right_thigh: '',
      left_thigh: '',
      freq_target: '3',
      available_days: [],
      duration_pref: '60 min',
      training_location: 'Academia'
    });
    setWizardStep(0);
  };

  // Edit Student Form Modal States
  const [showEditStudentModal, setShowEditStudentModal] = useState<boolean>(false);
  const [editStudent, setEditStudent] = useState({
    id: '',
    name: '',
    age: '',
    goal: '',
    biotype: 'Mesomorfo',
    status: 'Ativo',
    phone_number: '',
    telegram_chat_id: '',
    photo_avatar_url: '',
    email: '',
    birth_date: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    is_whatsapp: true,
    activity_level: 'Levemente Ativo',
    dietary_habits: '',
    medical_history: '',
    injuries: '',
    medications: '',
    weight: '',
    height: '',
    body_fat: '',
    lean_mass: '',
    blood_pressure: '',
    waist: '',
    abdomen: '',
    hips: '',
    right_arm: '',
    left_arm: '',
    right_thigh: '',
    left_thigh: '',
    freq_target: '3',
    available_days: [] as string[],
    duration_pref: '60 min',
    training_location: 'Academia'
  });

  const [studentPhone, setStudentPhone] = useState<string>('');
  const [studentTelegramId, setStudentTelegramId] = useState<string>('');
  const [savingContacts, setSavingContacts] = useState<boolean>(false);

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loadingEvals, setLoadingEvals] = useState<boolean>(false);
  const [activeMetric, setActiveMetric] = useState<'weight' | 'body_fat' | 'heart_rate'>('weight');

  // Tab and Anamnesis State
  const [activeProfileTab, setActiveProfileTab] = useState<'general' | 'anamnesis' | 'goals' | 'schedule' | 'attendance'>('general');
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [loadingAnamnesis, setLoadingAnamnesis] = useState<boolean>(false);
  const [savingAnamnesis, setSavingAnamnesis] = useState<boolean>(false);

  // Schedules State
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState<boolean>(false);
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);
  const [newSchedule, setNewSchedule] = useState({ date: '', time: '', notes: '' });

  // Goals State
  const [goals, setGoals] = useState<StudentGoal | null>(null);
  const [loadingGoals, setLoadingGoals] = useState<boolean>(false);
  const [savingGoals, setSavingGoals] = useState<boolean>(false);
  const [weightTarget, setWeightTarget] = useState<string>('');
  const [bodyFatTarget, setBodyFatTarget] = useState<string>('');
  const [muscleTarget, setMuscleTarget] = useState<string>('');
  const [freqTarget, setFreqTarget] = useState<string>('');

  // Workout Progress and Latest Workout State
  const [workoutProgress, setWorkoutProgress] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [latestWorkout, setLatestWorkout] = useState<any | null>(null);

  // Custom states for avatar upload and schedule suggestions
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [sugDateInput, setSugDateInput] = useState<string>('');
  const [sugTimeInput, setSugTimeInput] = useState<string>('');
  const [suggestingScheduleId, setSuggestingScheduleId] = useState<string | null>(null);
  const [trainerMessageInput, setTrainerMessageInput] = useState<string>('');
  const [cancelingScheduleId, setCancelingScheduleId] = useState<string | null>(null);
  const [editWizardStep, setEditWizardStep] = useState<number>(0);

  // Postural Grid State
  const [activeAngle, setActiveAngle] = useState<'front' | 'back' | 'side'>('front');
  const [captureTarget, setCaptureTarget] = useState<'evolution' | 'front' | 'back' | 'side' | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridX, setGridX] = useState<number>(50);
  const [gridOpacity, setGridOpacity] = useState<number>(0.6);

  // Payments State
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [newPayment, setNewPayment] = useState({
    amount: '150',
    dueDate: '',
    planName: 'Mensal'
  });
  const [savingPayment, setSavingPayment] = useState<boolean>(false);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('due_date', { ascending: false });
      if (data) {
        setAllPayments(data);
      }
    } catch (e) {
      console.error('Error fetching payments:', e);
    }
  };

  const getStudentFinancialStatus = (studentId: string | number) => {
    const studentBills = allPayments.filter(p => p.student_id.toString() === studentId.toString());
    if (studentBills.length === 0) return { label: 'Sem Plano', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' };

    let hasOverdue = false;
    let hasPending = false;
    const today = new Date().toISOString().split('T')[0];

    studentBills.forEach(p => {
      const status = p.status === 'Pago' ? 'Pago' : (p.due_date < today ? 'Atrasado' : 'Pendente');
      if (status === 'Atrasado') hasOverdue = true;
      if (status === 'Pendente') hasPending = true;
    });

    if (hasOverdue) {
      return { label: '⚠️ Atrasado', color: 'text-red-400 bg-red-500/10 border-red-500/20 animate-pulse' };
    }

    if (hasPending) {
      return { label: '⏳ Pendente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }

    return { label: '✅ Em Dia', color: 'text-[#00ff41] bg-[#00ff41]/10 border-[#00ff41]/20' };
  };

  const handleMarkAsPaid = (paymentId: string) => {
    const payment = allPayments.find(p => p.id === paymentId);
    const planDesc = payment ? `${payment.plan_name} - R$ ${payment.amount}` : 'esta cobrança';
    showCustomAlert(
      'Confirmar Recebimento',
      `Deseja realmente marcar a cobrança "${planDesc}" como paga?`,
      'confirm',
      planDesc,
      async () => {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const { error } = await supabase
            .from('payments')
            .update({ status: 'Pago', payment_date: todayStr })
            .eq('id', paymentId);
          if (error) {
            showCustomAlert('Erro', 'Erro ao atualizar pagamento: ' + error.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Pagamento registrado com sucesso!', 'success');
            fetchPayments();
          }
        } catch (e: any) {
          console.error(e);
          showCustomAlert('Erro', 'Erro inesperado ao atualizar pagamento.', 'error');
        }
      }
    );
  };

  const handleDeletePayment = (paymentId: string) => {
    const payment = allPayments.find(p => p.id === paymentId);
    const planDesc = payment ? `${payment.plan_name} - R$ ${payment.amount}` : 'Fatura';
    showCustomAlert(
      'Confirmar Exclusão',
      '',
      'confirm',
      planDesc,
      async () => {
        try {
          const { error } = await supabase
            .from('payments')
            .delete()
            .eq('id', paymentId);
          if (error) {
            showCustomAlert('Erro', 'Erro ao excluir cobrança: ' + error.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Cobrança excluída com sucesso!', 'success');
            fetchPayments();
          }
        } catch (e: any) {
          console.error(e);
          showCustomAlert('Erro', 'Erro inesperado ao excluir cobrança.', 'error');
        }
      }
    );
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!newPayment.amount || !newPayment.dueDate) {
      return showCustomAlert('Aviso', 'Preencha o valor e a data de vencimento!', 'warning');
    }
    const amt = parseFloat(newPayment.amount);
    if (isNaN(amt) || amt <= 0) {
      return showCustomAlert('Aviso', 'O valor deve ser um número maior que zero!', 'warning');
    }

    setSavingPayment(true);
    try {
      const { error } = await supabase
        .from('payments')
        .insert([{
          student_id: selectedStudent.id,
          amount: amt,
          due_date: newPayment.dueDate,
          plan_name: newPayment.planName,
          status: new Date(newPayment.dueDate) < new Date(new Date().toISOString().split('T')[0]) ? 'Atrasado' : 'Pendente'
        }]);

      if (error) {
        showCustomAlert('Erro', 'Erro ao adicionar cobrança: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Nova cobrança gerada com sucesso!', 'success');
        setShowPaymentModal(false);
        setNewPayment({ amount: '150', dueDate: '', planName: 'Mensal' });
        fetchPayments();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao gerar cobrança.', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const handlePlanPresetChange = (preset: string) => {
    let amt = '150';
    if (preset === 'Mensal') amt = '150';
    else if (preset === 'Trimestral') amt = '400';
    else if (preset === 'Semestral') amt = '750';
    else if (preset === 'Anual') amt = '1300';
    setNewPayment(prev => ({ ...prev, planName: preset, amount: amt }));
  };


  const fetchStudentEvaluations = async (studentId: string | number) => {
    setLoadingEvals(true);
    try {
      const { data, error } = await supabase
        .from('field_inspections')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(15);

      if (!error && data) {
        setEvaluations(data);
      }
    } catch (e) {
      console.error('Error fetching evaluations:', e);
    } finally {
      setLoadingEvals(false);
    }
  };

  const analyzeOvertraining = (evals: any[]) => {
    if (evals.length < 2) {
      return {
        status: 'estavel',
        message: 'Dados históricos insuficientes para análise preditiva de overtraining. Registre pelo menos 2 avaliações físicas.'
      };
    }

    const current = evals[0];
    const previous = evals[1];

    let warnings: string[] = [];
    let isAlert = false;

    // 1. Check Energy drop
    if (current.energy !== null && previous.energy !== null) {
      const energyDiff = previous.energy - current.energy;
      if (energyDiff >= 2) {
        warnings.push(`Energia caiu de ${previous.energy}/10 para ${current.energy}/10 (queda de ${Math.round((energyDiff/previous.energy)*100)}%).`);
        if (energyDiff >= 3) isAlert = true;
      }
    }

    // 2. Check Sleep drop
    if (current.sleep !== null && previous.sleep !== null) {
      const sleepDiff = previous.sleep - current.sleep;
      if (sleepDiff >= 2) {
        warnings.push(`Sono piorou de ${previous.sleep}/10 para ${current.sleep}/10 (queda de ${Math.round((sleepDiff/previous.sleep)*100)}%).`);
        if (sleepDiff >= 3) isAlert = true;
      }
    }

    // 3. Check Heart Rate elevation
    if (current.heart_rate !== null && previous.heart_rate !== null) {
      const hrDiff = current.heart_rate - previous.heart_rate;
      if (hrDiff >= 5) {
        warnings.push(`Frequência cardíaca em repouso subiu de ${previous.heart_rate} para ${current.heart_rate} BPM (aumento de ${Math.round((hrDiff/previous.heart_rate)*100)}%).`);
        if (hrDiff >= 8) isAlert = true;
      }
    }

    if (isAlert || warnings.length >= 2) {
      return {
        status: 'alerta',
        message: `Atenção: Indicadores de fadiga crítica detectados! ${warnings.join(' ')} Risco de overtraining elevado. Recomendado reduzir volume/intensidade de treino.`
      };
    }

    if (warnings.length > 0) {
      return {
        status: 'moderado',
        message: `Fadiga moderada detectada: ${warnings.join(' ')} Recomendado acompanhar de perto nos próximos treinos.`
      };
    }

    return {
      status: 'excelente',
      message: 'Excelente! Nenhum sinal de overtraining detectado. O aluno apresenta ótimos níveis de recuperação cardiovascular, sono e energia.'
    };
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching students:', error);
      } else if (data) {
        setStudents(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchPayments();

    const handleOnline = async () => {
      const res = await runOfflineSync();
      if (res.syncedCount > 0) {
        fetchStudents();
        fetchPayments();
        if (selectedStudent) {
          fetchStudentSchedules(selectedStudent.id);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudent) {
      setPhoto(selectedStudent.photo_url || null);
      setStudentPhone(selectedStudent.phone_number || '');
      setStudentTelegramId(selectedStudent.telegram_chat_id || '');
      fetchStudentEvaluations(selectedStudent.id);
      fetchAnamnesis(selectedStudent.id);
      fetchStudentGoals(selectedStudent.id);
      fetchStudentSchedules(selectedStudent.id);
      fetchStudentProgress(selectedStudent.id);
      fetchLatestWorkout(selectedStudent.id);
      setActiveProfileTab('general');
    } else {
      setPhoto(null);
      setStudentPhone('');
      setStudentTelegramId('');
      setEvaluations([]);
      setAnamnesis(null);
      setGoals(null);
      setWeightTarget('');
      setBodyFatTarget('');
      setMuscleTarget('');
      setFreqTarget('');
      setSchedules([]);
      setWorkoutProgress([]);
      setLatestWorkout(null);
    }
    return () => stopCamera();
  }, [selectedStudent]);

  // Redirect selection handler
  useEffect(() => {
    if (redirectStudentId && students.length > 0) {
      const studentIdStr = redirectStudentId.toString();
      const found = students.find(s => s.id.toString() === studentIdStr);
      if (found) {
        setSelectedStudent(found);
        if (redirectTab) {
          setTimeout(() => {
            setActiveProfileTab(redirectTab);
          }, 50);
        }
      }
      if (clearRedirect) {
        clearRedirect();
      }
    }
  }, [redirectStudentId, redirectTab, students, clearRedirect]);

  const defaultAnamnesis = (studentId: string | number): Anamnesis => ({
    student_id: studentId.toString(),
    medical_restrictions: '',
    flexibility_level: 'Médio',
    water_intake: 2.0,
    dietary_habits: '',
    surgical_history: '',
    medications: '',
    cardio_condition: ''
  });

  const fetchAnamnesis = async (studentId: string | number) => {
    setLoadingAnamnesis(true);
    try {
      const { data, error } = await supabase
        .from('anamnesis')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching anamnesis:', error);
      } else if (data) {
        setAnamnesis(data);
      } else {
        setAnamnesis(defaultAnamnesis(studentId));
      }
    } catch (err) {
      console.error(err);
      setAnamnesis(defaultAnamnesis(studentId));
    } finally {
      setLoadingAnamnesis(false);
    }
  };

  const fetchStudentGoals = async (studentId: string | number) => {
    setLoadingGoals(true);
    try {
      const { data, error } = await supabase
        .from('student_goals')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching student goals:', error);
      } else if (data) {
        setGoals(data);
        setWeightTarget(data.weight_target ? data.weight_target.toString() : '');
        setBodyFatTarget(data.body_fat_target ? data.body_fat_target.toString() : '');
        setMuscleTarget(data.muscle_target ? data.muscle_target.toString() : '');
        setFreqTarget(data.freq_target ? data.freq_target.toString() : '');
      } else {
        setGoals(null);
        setWeightTarget('');
        setBodyFatTarget('');
        setMuscleTarget('');
        setFreqTarget('');
      }
    } catch (e) {
      console.error('Error in fetchStudentGoals:', e);
    } finally {
      setLoadingGoals(false);
    }
  };

  const handleSaveGoals = async () => {
    if (!selectedStudent) return;
    setSavingGoals(true);
    try {
      const payload = {
        student_id: selectedStudent.id,
        weight_target: weightTarget ? parseFloat(weightTarget) : null,
        body_fat_target: bodyFatTarget ? parseFloat(bodyFatTarget) : null,
        muscle_target: muscleTarget ? parseFloat(muscleTarget) : null,
        freq_target: freqTarget ? parseInt(freqTarget) : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('student_goals')
        .upsert(payload, { onConflict: 'student_id' });

      if (error) {
        showCustomAlert('Erro', 'Erro ao salvar metas: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Metas corporais salvas com sucesso!', 'success');
        setGoals(payload as any);
      }
    } catch (e: any) {
      console.error(e);
      showCustomAlert('Erro', 'Erro inesperado ao salvar metas.', 'error');
    } finally {
      setSavingGoals(false);
    }
  };

  const fetchStudentSchedules = async (studentId: string | number) => {
    setLoadingSchedules(true);
    try {
      const { data, error } = await supabase
        .from('evaluation_schedules')
        .select('*')
        .eq('student_id', studentId)
        .order('scheduled_date', { ascending: true });

      if (!error && data) {
        setSchedules(data);
      }
    } catch (e) {
      console.error('Error fetching schedules:', e);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const fetchStudentProgress = async (studentId: string | number) => {
    setLoadingProgress(true);
    try {
      const { data, error } = await supabase
        .from('student_workout_progress')
        .select('*')
        .eq('student_id', studentId)
        .order('workout_date', { ascending: true });
      if (!error && data) {
        setWorkoutProgress(data);
      } else {
        setWorkoutProgress([]);
      }
    } catch (e) {
      console.error('Error fetching progress:', e);
      setWorkoutProgress([]);
    } finally {
      setLoadingProgress(false);
    }
  };

  const fetchLatestWorkout = async (studentId: string | number) => {
    try {
      const { data, error } = await supabase
        .from('workout_protocols')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setLatestWorkout({
          id: data[0].id,
          objective: data[0].objective,
          split: data[0].split,
          days: data[0].days,
          durationWeeks: data[0].duration_weeks,
          needs: data[0].needs,
          clinicalNotes: data[0].clinical_notes,
          workoutData: data[0].workout_data,
          date: data[0].date,
          startDate: data[0].start_date,
          endDate: data[0].end_date
        });
      } else {
        setLatestWorkout(null);
      }
    } catch (e) {
      console.error('Error fetching latest workout:', e);
      setLatestWorkout(null);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!newSchedule.date || !newSchedule.time) {
      return showCustomAlert('Aviso', 'Preencha a data e o horário do retorno!', 'warning');
    }

    setSavingSchedule(true);
    try {
      const schedulePayload = {
        student_id: selectedStudent.id,
        scheduled_date: newSchedule.date,
        scheduled_time: newSchedule.time,
        status: 'Agendado',
        notes: newSchedule.notes || null
      };

      if (!navigator.onLine) {
        queueOfflineOperation('add_schedule', schedulePayload);
        showCustomAlert('Modo Offline', 'Retorno agendado localmente! Sincronização automática pendente.', 'info');
        setNewSchedule({ date: '', time: '', notes: '' });
        setSchedules(prev => [...prev, { ...schedulePayload, id: 'temp_' + Date.now(), created_at: new Date().toISOString() }]);
        setSavingSchedule(false);
        return;
      }

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('evaluation_schedules')
        .insert([schedulePayload])
        .select()
        .single();

      if (scheduleError) {
        showCustomAlert('Erro', 'Erro ao salvar agendamento: ' + scheduleError.message, 'error');
        setSavingSchedule(false);
        return;
      }

      // Create notification in the notifications table
      const dateFormatted = new Date(newSchedule.date + 'T' + newSchedule.time).toLocaleString('pt-BR');
      const { error: notifError } = await supabase
        .from('notifications')
        .insert([{
          title: 'Novo Retorno Agendado',
          message: `Retorno agendado para o aluno ${selectedStudent.name} em ${dateFormatted}.`,
          type: 'schedule',
          read: false
        }]);

      if (notifError) {
        console.error('Error inserting notification:', notifError);
      }

      // Send telegram alert to administrator if chat id is configured in system settings
      const { data: adminSettings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'telegram_admin_chat_id')
        .maybeSingle();

      if (adminSettings?.value) {
        const tgMsg = `<b>🔔 Elite Coach - Novo Retorno Agendado!</b>\n\n👤 <b>Aluno:</b> ${selectedStudent.name}\n📅 <b>Data:</b> ${newSchedule.date.split('-').reverse().join('/')}\n⏰ <b>Hora:</b> ${newSchedule.time}\n📝 <b>Notas:</b> ${newSchedule.notes || 'Sem observações'}`;
        
        try {
          await fetch('/api/telegram/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: adminSettings.value, message: tgMsg })
          });
        } catch (tgErr) {
          console.error('Error sending Telegram notification:', tgErr);
        }
      }

      showCustomAlert('Sucesso', 'Retorno agendado com sucesso!', 'success');
      setNewSchedule({ date: '', time: '', notes: '' });
      fetchStudentSchedules(selectedStudent.id);
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao agendar retorno.', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleConfirmSchedule = async (scheduleId: string) => {
    if (!navigator.onLine) {
      queueOfflineOperation('update_schedule_status', {
        id: scheduleId,
        update: { status: 'Confirmado' }
      });
      showCustomAlert('Modo Offline', 'Confirmação registrada localmente! Sincronização automática pendente.', 'info');
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, status: 'Confirmado' } : s));
      return;
    }
    try {
      const { error } = await supabase
        .from('evaluation_schedules')
        .update({ status: 'Confirmado' })
        .eq('id', scheduleId);

      if (error) {
        showCustomAlert('Erro', 'Erro ao confirmar agendamento: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Agendamento confirmado! Ambos serão lembrados com 30 minutos de antecedência.', 'success');
        if (selectedStudent) {
          fetchStudentSchedules(selectedStudent.id);
        }
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro ao confirmar agendamento.', 'error');
    }
  };

  const handleSuggestSchedule = async (scheduleId: string) => {
    if (!sugDateInput || !sugTimeInput) {
      showCustomAlert('Aviso', 'Preencha a data e o horário sugeridos!', 'warning');
      return;
    }
    if (!navigator.onLine) {
      const newNotes = `[Mensagem do Treinador]: ${trainerMessageInput}`;
      queueOfflineOperation('update_schedule_status', {
        id: scheduleId,
        update: {
          status: 'Sugerido',
          suggested_date: sugDateInput,
          suggested_time: sugTimeInput,
          notes: newNotes
        }
      });
      showCustomAlert('Modo Offline', 'Sugestão registrada localmente! Sincronização automática pendente.', 'info');
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, status: 'Sugerido', suggested_date: sugDateInput, suggested_time: sugTimeInput, notes: (s.notes || '') + '\n' + newNotes } : s));
      setSuggestingScheduleId(null);
      setSugDateInput('');
      setSugTimeInput('');
      setTrainerMessageInput('');
      return;
    }
    try {
      const { error } = await supabase
        .from('evaluation_schedules')
        .update({
          status: 'Sugerido',
          suggested_date: sugDateInput,
          suggested_time: sugTimeInput,
          trainer_message: trainerMessageInput || null
        })
        .eq('id', scheduleId);

      if (error) {
        if (isColumnMismatchError(error)) { // trainer_message column does not exist
          const sch = schedules.find(s => s.id === scheduleId);
          const newNotes = (sch?.notes ? sch.notes + '\n' : '') + `[Mensagem do Treinador]: ${trainerMessageInput}`;
          const { error: fallbackError } = await supabase
            .from('evaluation_schedules')
            .update({
              status: 'Sugerido',
              suggested_date: sugDateInput,
              suggested_time: sugTimeInput,
              notes: newNotes
            })
            .eq('id', scheduleId);

          if (fallbackError) {
            showCustomAlert('Erro', 'Erro ao sugerir data: ' + fallbackError.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Nova data sugerida enviada ao aluno!', 'success');
          }
        } else {
          showCustomAlert('Erro', 'Erro ao sugerir data: ' + error.message, 'error');
        }
      } else {
        showCustomAlert('Sucesso', 'Nova data sugerida enviada ao aluno!', 'success');
      }
      
      setSuggestingScheduleId(null);
      setSugDateInput('');
      setSugTimeInput('');
      setTrainerMessageInput('');
      if (selectedStudent) {
        fetchStudentSchedules(selectedStudent.id);
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro ao sugerir nova data.', 'error');
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    if (!trainerMessageInput) {
      showCustomAlert('Aviso', 'Preencha a justificativa!', 'warning');
      return;
    }
    if (!navigator.onLine) {
      const newNotes = `[Mensagem do Treinador]: ${trainerMessageInput}`;
      queueOfflineOperation('update_schedule_status', {
        id: scheduleId,
        update: { status: 'Cancelado', notes: newNotes }
      });
      showCustomAlert('Modo Offline', 'Cancelamento registrado localmente! Sincronização automática pendente.', 'info');
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, status: 'Cancelado', notes: (s.notes || '') + '\n' + newNotes } : s));
      setCancelingScheduleId(null);
      setTrainerMessageInput('');
      return;
    }
    try {
      const { error } = await supabase
        .from('evaluation_schedules')
        .update({ 
          status: 'Cancelado', 
          trainer_message: trainerMessageInput 
        })
        .eq('id', scheduleId);
        
      if (error) {
        if (isColumnMismatchError(error)) { // trainer_message column does not exist
          const sch = schedules.find(s => s.id === scheduleId);
          const newNotes = (sch?.notes ? sch.notes + '\n' : '') + `[Mensagem do Treinador]: ${trainerMessageInput}`;
          const { error: fallbackError } = await supabase
            .from('evaluation_schedules')
            .update({ 
              status: 'Cancelado', 
              notes: newNotes 
            })
            .eq('id', scheduleId);
            
          if (fallbackError) {
            showCustomAlert('Erro', 'Erro ao cancelar: ' + fallbackError.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Agendamento cancelado com justificativa!', 'success');
          }
        } else {
          showCustomAlert('Erro', 'Erro ao cancelar agendamento: ' + error.message, 'error');
        }
      } else {
        showCustomAlert('Sucesso', 'Agendamento cancelado com justificativa!', 'success');
      }
      
      setCancelingScheduleId(null);
      setTrainerMessageInput('');
      if (selectedStudent) {
        fetchStudentSchedules(selectedStudent.id);
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro ao cancelar agendamento.', 'error');
    }
  };

  const handleUpdateScheduleStatus = async (scheduleId: string, newStatus: 'Realizado' | 'Cancelado') => {
    if (!navigator.onLine) {
      queueOfflineOperation('update_schedule_status', {
        id: scheduleId,
        update: { status: newStatus }
      });
      showCustomAlert('Modo Offline', `Status marcado como ${newStatus.toLowerCase()} localmente! Sincronização automática pendente.`, 'info');
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, status: newStatus } : s));
      return;
    }
    try {
      const { error } = await supabase
        .from('evaluation_schedules')
        .update({ status: newStatus })
        .eq('id', scheduleId);

      if (error) {
        showCustomAlert('Erro', 'Erro ao atualizar agendamento: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', `Agendamento marcado como ${newStatus.toLowerCase()}!`, 'success');
        if (selectedStudent) {
          fetchStudentSchedules(selectedStudent.id);
        }
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao atualizar agendamento.', 'error');
    }
  };

  const handleSaveAnamnesis = async () => {
    if (!selectedStudent || !anamnesis) return;
    setSavingAnamnesis(true);
    try {
      const { error } = await supabase
        .from('anamnesis')
        .upsert({
          student_id: selectedStudent.id.toString(),
          medical_restrictions: anamnesis.medical_restrictions,
          flexibility_level: anamnesis.flexibility_level,
          water_intake: anamnesis.water_intake,
          dietary_habits: anamnesis.dietary_habits,
          surgical_history: anamnesis.surgical_history,
          medications: anamnesis.medications,
          cardio_condition: anamnesis.cardio_condition,
          updated_at: new Date().toISOString()
        }, { onConflict: 'student_id' });

      if (error) {
        showCustomAlert('Erro', 'Erro ao salvar ficha de anamnese: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Ficha de anamnese salva com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao salvar ficha de anamnese.', 'error');
    } finally {
      setSavingAnamnesis(false);
    }
  };

    const startCamera = async (target: 'evolution' | 'front' | 'back' | 'side') => {
    setCaptureTarget(target);
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(ms);
    } catch (e) {
      console.error(e);
      setCaptureTarget(null);
      showCustomAlert('Câmera Indisponível', 'Câmera não acessível no ambiente atual ou sem permissão.', 'warning');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCaptureTarget(null);
  };

  const savePhoto = async (photoData: string) => {
    if (!selectedStudent) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ photo_url: photoData })
        .eq('id', selectedStudent.id);

      if (error) {
        showCustomAlert('Erro', 'Erro ao salvar foto de evolução: ' + error.message, 'error');
      } else {
        setSelectedStudent({ ...selectedStudent, photo_url: photoData });
        fetchStudents();
      }
    } catch (err: any) {
      console.error('Error updating photo:', err);
      showCustomAlert('Erro', 'Erro inesperado ao salvar photo.', 'error');
    }
  };

  const deletePhoto = () => {
    if (!selectedStudent) return;
    const photoDesc = `Foto de evolução do aluno ${selectedStudent.name}`;
    showCustomAlert(
      'Confirmar Exclusão',
      '',
      'confirm',
      photoDesc,
      async () => {
        try {
          const { error } = await supabase
            .from('students')
            .update({ photo_url: null })
            .eq('id', selectedStudent.id);

          if (error) {
            showCustomAlert('Erro', 'Erro ao excluir foto: ' + error.message, 'error');
          } else {
            setPhoto(null);
            setSelectedStudent({ ...selectedStudent, photo_url: undefined });
            fetchStudents();
            showCustomAlert('Sucesso', 'Foto de evolução excluída com sucesso!', 'success');
          }
        } catch (err: any) {
          console.error(err);
          showCustomAlert('Erro', 'Erro ao excluir foto: ' + err.message, 'error');
        }
      }
    );
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const photoData = canvasRef.current.toDataURL('image/png');
        if (captureTarget === 'evolution') {
          setPhoto(photoData);
          savePhoto(photoData);
        } else if (captureTarget === 'front' || captureTarget === 'back' || captureTarget === 'side') {
          savePosturePhoto(captureTarget, photoData);
        }
        stopCamera();
        setCaptureTarget(null);
      }
    }
  };

  const savePosturePhoto = async (angle: 'front' | 'back' | 'side', photoData: string) => {
    if (!selectedStudent) return;
    const columnName = angle === 'front' ? 'photo_front_url' : angle === 'back' ? 'photo_back_url' : 'photo_side_url';
    try {
      const { error } = await supabase
        .from('students')
        .update({ [columnName]: photoData })
        .eq('id', selectedStudent.id);

      if (error) {
        showCustomAlert('Erro', `Erro ao salvar foto de postura: ` + error.message, 'error');
      } else {
        setSelectedStudent({ ...selectedStudent, [columnName]: photoData });
        setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, [columnName]: photoData } : s));
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao salvar foto de postura.', 'error');
    }
  };

  const deletePosturePhoto = (angle: 'front' | 'back' | 'side') => {
    if (!selectedStudent) return;
    const columnName = angle === 'front' ? 'photo_front_url' : angle === 'back' ? 'photo_back_url' : 'photo_side_url';
    const angleLabel = angle === 'front' ? 'Frente' : angle === 'back' ? 'Costas' : 'Perfil';
    const desc = `Foto postural do ângulo ${angleLabel} de ${selectedStudent.name}`;
    
    showCustomAlert(
      'Confirmar Exclusão',
      '',
      'confirm',
      desc,
      async () => {
        try {
          const { error } = await supabase
            .from('students')
            .update({ [columnName]: null })
            .eq('id', selectedStudent.id);

          if (error) {
            showCustomAlert('Erro', `Erro ao excluir foto: ` + error.message, 'error');
          } else {
            setSelectedStudent({ ...selectedStudent, [columnName]: undefined });
            setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, [columnName]: undefined } : s));
            showCustomAlert('Sucesso', `Foto postural de ${angleLabel} excluída com sucesso!`, 'success');
          }
        } catch (err: any) {
          console.error(err);
          showCustomAlert('Erro', 'Erro ao excluir foto.', 'error');
        }
      }
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'evolution' | 'front' | 'back' | 'side') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      if (target === 'evolution') {
        setPhoto(base64Data);
        savePhoto(base64Data);
      } else {
        savePosturePhoto(target, base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (isEdit) {
        setEditStudent(prev => ({ ...prev, photo_avatar_url: base64 }));
      } else {
        setNewStudent(prev => ({ ...prev, photo_avatar_url: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.goal) {
      return showCustomAlert('Aviso', 'Preencha os campos obrigatórios!', 'warning');
    }

    let ageCalculated = parseInt(newStudent.age);
    if (newStudent.birth_date) {
      const birthDateObj = new Date(newStudent.birth_date);
      const ageDifMs = Date.now() - birthDateObj.getTime();
      const ageDate = new Date(ageDifMs);
      ageCalculated = Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    if (isNaN(ageCalculated) || ageCalculated <= 0) {
      ageCalculated = 20; // default fallback age
    }

    const fullPayload = {
      name: newStudent.name,
      age: ageCalculated,
      goal: newStudent.goal,
      biotype: newStudent.biotype,
      status: newStudent.status,
      badges: [],
      imc: newStudent.weight && newStudent.height ? parseFloat((parseFloat(newStudent.weight) / Math.pow(parseFloat(newStudent.height), 2)).toFixed(1)) : 22.5,
      phone_number: newStudent.phone_number || null,
      telegram_chat_id: newStudent.telegram_chat_id || null,
      photo_avatar_url: newStudent.photo_avatar_url || null,
      email: newStudent.email || null,
      birth_date: newStudent.birth_date || null,
      street: newStudent.street || null,
      number: newStudent.number || null,
      complement: newStudent.complement || null,
      neighborhood: newStudent.neighborhood || null,
      city: newStudent.city || null,
      state: newStudent.state || null
    };

    if (!navigator.onLine) {
      queueOfflineOperation('add_student', fullPayload);
      showCustomAlert('Modo Offline', 'Aluno cadastrado localmente! Sincronização automática pendente.', 'info');
      setShowNewStudentModal(false);
      resetNewStudent();
      setStudents(prev => [...prev, { ...fullPayload, id: 'temp_' + Date.now() }]);
      return;
    }

    let insertedStudent: any = null;
    let hadMigrationError = false;

    try {
      const { data: resData, error: insertError, prunedColumns: studentPruned } = await safeSupabaseWrite(
        'insert',
        'students',
        fullPayload
      );

      if (insertError) {
        return showCustomAlert('Erro', 'Erro ao cadastrar aluno: ' + insertError.message, 'error');
      }

      insertedStudent = resData?.[0];

      if (insertedStudent) {
        // If we pruned any column other than 'is_whatsapp', we consider it a migration error
        const isCriticalPrune = studentPruned.filter(col => col !== 'is_whatsapp').length > 0;
        if (isCriticalPrune) {
          hadMigrationError = true;
        }

        // 1. Insert Anamnesis
        const anamnesisPayload = {
          student_id: insertedStudent.id,
          medical_restrictions: newStudent.medical_history || 'Nenhuma',
          flexibility_level: 'Moderada',
          water_intake: 2.0,
          dietary_habits: 'Misto',
          surgical_history: newStudent.injuries || 'Nenhuma',
          medications: newStudent.medications || 'Nenhuma',
          cardio_condition: newStudent.medical_history || 'Nenhuma',
          activity_level: newStudent.activity_level
        };

        const { error: anamnesisErr, prunedColumns: anamnesisPruned } = await safeSupabaseWrite(
          'insert',
          'anamnesis',
          anamnesisPayload
        );

        if (anamnesisErr) {
          console.error('Error inserting anamnesis:', anamnesisErr);
        }
        if (anamnesisPruned.length > 0) {
          hadMigrationError = true;
        }

        // 2. Insert Biometrics (if provided)
        if (newStudent.weight || newStudent.body_fat || newStudent.height) {
          const biometricPayload = {
            student_id: insertedStudent.id,
            weight: newStudent.weight ? parseFloat(newStudent.weight) : null,
            body_fat: newStudent.body_fat ? parseFloat(newStudent.body_fat) : null,
            skeletal_muscle: newStudent.lean_mass ? parseFloat(newStudent.lean_mass) : null,
            lean_mass: newStudent.lean_mass ? parseFloat(newStudent.lean_mass) : null,
            height: newStudent.height ? parseFloat(newStudent.height) : null,
            blood_pressure: newStudent.blood_pressure || null,
            waist: newStudent.waist ? parseFloat(newStudent.waist) : null,
            abdomen: newStudent.abdomen ? parseFloat(newStudent.abdomen) : null,
            hips: newStudent.hips ? parseFloat(newStudent.hips) : null,
            right_arm: newStudent.right_arm ? parseFloat(newStudent.right_arm) : null,
            left_arm: newStudent.left_arm ? parseFloat(newStudent.left_arm) : null,
            right_thigh: newStudent.right_thigh ? parseFloat(newStudent.right_thigh) : null,
            left_thigh: newStudent.left_thigh ? parseFloat(newStudent.left_thigh) : null,
            heart_rate: 70,
            energy: 8,
            sleep: 8,
            feedback: 'Avaliação inicial cadastrada via wizard'
          };

          const { error: bioErr, prunedColumns: bioPruned } = await safeSupabaseWrite(
            'insert',
            'field_inspections',
            biometricPayload
          );

          if (bioErr) {
            console.error('Error inserting biometrics:', bioErr);
          }
          if (bioPruned.length > 0) {
            hadMigrationError = true;
          }
        }

        // 3. Insert Student Goals
        const goalsPayload = {
          student_id: insertedStudent.id,
          weight_target: newStudent.weight ? parseFloat(newStudent.weight) : null,
          body_fat_target: newStudent.body_fat ? parseFloat(newStudent.body_fat) : null,
          muscle_target: newStudent.lean_mass ? parseFloat(newStudent.lean_mass) : null,
          freq_target: parseInt(newStudent.freq_target) || 3,
          available_days: newStudent.available_days.join(','),
          duration_pref: newStudent.duration_pref,
          training_location: newStudent.training_location
        };

        const { error: goalsErr, prunedColumns: goalsPruned } = await safeSupabaseWrite(
          'insert',
          'student_goals',
          goalsPayload
        );

        if (goalsErr) {
          console.error('Error inserting goals:', goalsErr);
        }
        if (goalsPruned.length > 0) {
          hadMigrationError = true;
        }

        // 4. Final Alert / Success modal
        if (hadMigrationError) {
          showCustomAlert('Cadastro Efetuado', 'Aluno cadastrado com sucesso! Nota: Os novos campos estendidos (endereço, circunferências, dias de treino) não foram salvos no banco. Peça para o administrador executar o script SQL de migração no Supabase.', 'info');
        } else {
          setRegisteredStudentName(newStudent.name);
          setShowSuccessModal(true);
        }
        setShowNewStudentModal(false);
        resetNewStudent();
        fetchStudents();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao cadastrar aluno.', 'error');
    }
  };

  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent.name || !editStudent.goal) {
      return showCustomAlert('Aviso', 'Preencha os campos obrigatórios!', 'warning');
    }

    let ageCalculated = parseInt(editStudent.age);
    if (editStudent.birth_date) {
      const birthDateObj = new Date(editStudent.birth_date);
      const ageDifMs = Date.now() - birthDateObj.getTime();
      const ageDate = new Date(ageDifMs);
      ageCalculated = Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    if (isNaN(ageCalculated) || ageCalculated <= 0) {
      ageCalculated = 20;
    }

    const fullPayload = {
      name: editStudent.name,
      age: ageCalculated,
      goal: editStudent.goal,
      biotype: editStudent.biotype,
      status: editStudent.status,
      phone_number: editStudent.phone_number || null,
      telegram_chat_id: editStudent.telegram_chat_id || null,
      photo_avatar_url: editStudent.photo_avatar_url || null,
      email: editStudent.email || null,
      birth_date: editStudent.birth_date || null,
      street: editStudent.street || null,
      number: editStudent.number || null,
      complement: editStudent.complement || null,
      neighborhood: editStudent.neighborhood || null,
      city: editStudent.city || null,
      state: editStudent.state || null,
      is_whatsapp: editStudent.is_whatsapp
    };

    if (!navigator.onLine) {
      queueOfflineOperation('update_student_profile', {
        id: editStudent.id,
        update: fullPayload
      });
      showCustomAlert('Modo Offline', 'Alterações registradas localmente! Sincronização pendente.', 'info');
      setShowEditStudentModal(false);
      // update state
      setSelectedStudent(prev => prev ? { ...prev, ...fullPayload } : null);
      setStudents(prev => prev.map(s => s.id.toString() === editStudent.id ? { ...s, ...fullPayload } : s));
      return;
    }

    let hadMigrationError = false;

    try {
      // 1. Update Student Table
      const { error: studentErr, prunedColumns: studentPruned } = await safeSupabaseWrite(
        'update',
        'students',
        fullPayload,
        { eqColumn: 'id', eqValue: editStudent.id }
      );

      if (studentErr) {
        return showCustomAlert('Erro', 'Erro ao atualizar dados: ' + studentErr.message, 'error');
      }

      // If we pruned any column other than 'is_whatsapp', we consider it a migration error
      const isCriticalPrune = studentPruned.filter(col => col !== 'is_whatsapp').length > 0;
      if (isCriticalPrune) {
        hadMigrationError = true;
      }

      // 2. Upsert Anamnesis
      const anamnesisPayload = {
        student_id: editStudent.id,
        medical_restrictions: editStudent.medical_history || 'Nenhuma',
        flexibility_level: anamnesis?.flexibility_level || 'Moderada',
        water_intake: anamnesis?.water_intake || 2.0,
        dietary_habits: editStudent.dietary_habits || 'Misto',
        surgical_history: editStudent.injuries || 'Nenhuma',
        medications: editStudent.medications || 'Nenhuma',
        cardio_condition: editStudent.medical_history || 'Nenhuma',
        activity_level: editStudent.activity_level
      };

      const { error: anamnesisErr, prunedColumns: anamnesisPruned } = await safeSupabaseWrite(
        'upsert',
        'anamnesis',
        anamnesisPayload,
        { onConflict: 'student_id' }
      );

      if (anamnesisErr) {
        console.error('Error upserting anamnesis:', anamnesisErr);
      }
      if (anamnesisPruned.length > 0) {
        hadMigrationError = true;
      }

      // 3. Update or Insert last field inspection (biometrics)
      if (editStudent.weight || editStudent.body_fat || editStudent.height) {
        const biometricPayload = {
          student_id: editStudent.id,
          weight: editStudent.weight ? parseFloat(editStudent.weight) : null,
          body_fat: editStudent.body_fat ? parseFloat(editStudent.body_fat) : null,
          skeletal_muscle: editStudent.lean_mass ? parseFloat(editStudent.lean_mass) : null,
          lean_mass: editStudent.lean_mass ? parseFloat(editStudent.lean_mass) : null,
          height: editStudent.height ? parseFloat(editStudent.height) : null,
          blood_pressure: editStudent.blood_pressure || null,
          waist: editStudent.waist ? parseFloat(editStudent.waist) : null,
          abdomen: editStudent.abdomen ? parseFloat(editStudent.abdomen) : null,
          hips: editStudent.hips ? parseFloat(editStudent.hips) : null,
          right_arm: editStudent.right_arm ? parseFloat(editStudent.right_arm) : null,
          left_arm: editStudent.left_arm ? parseFloat(editStudent.left_arm) : null,
          right_thigh: editStudent.right_thigh ? parseFloat(editStudent.right_thigh) : null,
          left_thigh: editStudent.left_thigh ? parseFloat(editStudent.left_thigh) : null
        };

        if (evaluations.length > 0) {
          const { error: bioErr, prunedColumns: bioPruned } = await safeSupabaseWrite(
            'update',
            'field_inspections',
            biometricPayload,
            { eqColumn: 'id', eqValue: evaluations[0].id }
          );

          if (bioErr) {
            console.error('Error updating biometrics:', bioErr);
          }
          if (bioPruned.length > 0) {
            hadMigrationError = true;
          }
        } else {
          const { error: bioErr, prunedColumns: bioPruned } = await safeSupabaseWrite(
            'insert',
            'field_inspections',
            {
              ...biometricPayload,
              heart_rate: 70,
              energy: 8,
              sleep: 8,
              feedback: 'Avaliação cadastrada via edição'
            }
          );

          if (bioErr) {
            console.error('Error inserting biometrics:', bioErr);
          }
          if (bioPruned.length > 0) {
            hadMigrationError = true;
          }
        }
      }

      // 4. Upsert Goals
      const goalsPayload = {
        student_id: editStudent.id,
        weight_target: editStudent.weight ? parseFloat(editStudent.weight) : null,
        body_fat_target: editStudent.body_fat ? parseFloat(editStudent.body_fat) : null,
        muscle_target: editStudent.lean_mass ? parseFloat(editStudent.lean_mass) : null,
        freq_target: parseInt(editStudent.freq_target) || 3,
        available_days: editStudent.available_days.join(','),
        duration_pref: editStudent.duration_pref,
        training_location: editStudent.training_location,
        updated_at: new Date().toISOString()
      };

      const { error: goalsErr, prunedColumns: goalsPruned } = await safeSupabaseWrite(
        'upsert',
        'student_goals',
        goalsPayload,
        { onConflict: 'student_id' }
      );

      if (goalsErr) {
        console.error('Error upserting goals:', goalsErr);
      }
      if (goalsPruned.length > 0) {
        hadMigrationError = true;
      }

      if (hadMigrationError) {
        showCustomAlert('Atualização Parcial', 'Perfil atualizado, porém alguns novos campos estendidos (circunferências, etc.) não puderam ser gravados por falta de migração no banco de dados.', 'info');
      } else {
        showCustomAlert('Sucesso', 'Perfil do aluno atualizado com sucesso!', 'success');
      }

      setShowEditStudentModal(false);
      
      // Reload details
      fetchStudents();
      if (selectedStudent) {
        const { data: updatedObj } = await supabase.from('students').select('*').eq('id', editStudent.id).single();
        if (updatedObj) {
          setSelectedStudent(updatedObj);
        }
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro ao atualizar dados do aluno.', 'error');
    }
  };

  const handleDeleteStudent = (studentId: string | number, studentName: string) => {
    showCustomAlert(
      'Confirmar Exclusão',
      `Você está prestes a excluir permanentemente o aluno "${studentName}". Todos os dados de treinos, biometrias, anamnese, metas e pagamentos dele serão apagados!`,
      'confirm',
      studentName,
      async () => {
        try {
          // Cascade delete manually to prevent foreign key errors in any DB configuration
          // 1. Delete goals
          await supabase.from('student_goals').delete().eq('student_id', studentId);
          // 2. Delete anamnesis
          await supabase.from('anamnesis').delete().eq('student_id', studentId);
          // 3. Delete payments
          await supabase.from('payments').delete().eq('student_id', studentId);
          // 4. Delete physical evaluations / inspections
          await supabase.from('field_inspections').delete().eq('student_id', studentId);
          // 5. Delete student
          const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', studentId);

          if (error) {
            showCustomAlert('Erro', 'Erro ao excluir aluno: ' + error.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Aluno e todos os seus registros excluídos com sucesso!', 'success');
            setSelectedStudent(null);
            fetchStudents();
          }
        } catch (e: any) {
          console.error(e);
          showCustomAlert('Erro', 'Erro inesperado ao excluir aluno.', 'error');
        }
      }
    );
  };

  const handleSaveContacts = async () => {
    if (!selectedStudent) return;
    setSavingContacts(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          phone_number: studentPhone || null,
          telegram_chat_id: studentTelegramId || null
        })
        .eq('id', selectedStudent.id);

      if (error) {
        showCustomAlert('Erro', 'Erro ao salvar contatos: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Contatos atualizados com sucesso!', 'success');
        setSelectedStudent({
          ...selectedStudent,
          phone_number: studentPhone || undefined,
          telegram_chat_id: studentTelegramId || undefined
        });
        fetchStudents();
      }
    } catch (e: any) {
      console.error(e);
      showCustomAlert('Erro', 'Erro inesperado ao salvar contatos.', 'error');
    } finally {
      setSavingContacts(false);
    }
  };

  if (selectedStudent) {
    const attendanceData = [
      { name: 'Concluídos', value: 4, color: '#d4af37' },
      { name: 'Faltas', value: 1, color: '#224233' }
    ];

    return (
      <div className="space-y-6">
        <button onClick={() => { setSelectedStudent(null); stopCamera(); setPhoto(null); }} className="text-zinc-400 hover:text-primary transition-colors flex items-center gap-2 mb-4 text-sm font-bold uppercase tracking-wider">
           <ChevronRight className="w-4 h-4 rotate-180" /> Voltar
        </button>
        
        <div className="bg-surface-container border border-surface-highest rounded-xl p-4 sm:p-6 overflow-hidden max-w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 border-b border-surface-highest/40 pb-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(223,191,128,0.2)]">
                  {selectedStudent.photo_avatar_url ? (
                    <img src={selectedStudent.photo_avatar_url} alt={selectedStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-[#dfbf80]">{selectedStudent.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h1 className="font-heading font-bold text-3xl text-white">{selectedStudent.name}</h1>
                  <p className="text-zinc-400 capitalize mt-1 text-sm">{selectedStudent.goal} • {selectedStudent.age} anos • {selectedStudent.biotype}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditStudent({
                      id: selectedStudent.id.toString(),
                      name: selectedStudent.name || '',
                      age: selectedStudent.age ? selectedStudent.age.toString() : '',
                      goal: selectedStudent.goal || '',
                      biotype: selectedStudent.biotype || 'Mesomorfo',
                      status: selectedStudent.status || 'Ativo',
                      phone_number: selectedStudent.phone_number || '',
                      telegram_chat_id: selectedStudent.telegram_chat_id || '',
                      photo_avatar_url: selectedStudent.photo_avatar_url || '',
                      email: selectedStudent.email || '',
                      birth_date: selectedStudent.birth_date || '',
                      street: selectedStudent.street || '',
                      number: selectedStudent.number || '',
                      complement: selectedStudent.complement || '',
                      neighborhood: selectedStudent.neighborhood || '',
                      city: selectedStudent.city || '',
                      state: selectedStudent.state || '',
                      is_whatsapp: selectedStudent.is_whatsapp !== false,
                      activity_level: anamnesis?.activity_level || 'Levemente Ativo',
                      dietary_habits: anamnesis?.dietary_habits || '',
                      medical_history: anamnesis?.medical_restrictions || '',
                      injuries: anamnesis?.surgical_history || '',
                      medications: anamnesis?.medications || '',
                      weight: evaluations.length > 0 ? (evaluations[0].weight?.toString() || '') : '',
                      height: evaluations.length > 0 ? (evaluations[0].height?.toString() || '') : '',
                      body_fat: evaluations.length > 0 ? (evaluations[0].body_fat?.toString() || '') : '',
                      lean_mass: evaluations.length > 0 ? (evaluations[0].skeletal_muscle?.toString() || '') : '',
                      blood_pressure: evaluations.length > 0 ? (evaluations[0].blood_pressure || '') : '',
                      waist: evaluations.length > 0 ? (evaluations[0].waist?.toString() || '') : '',
                      abdomen: evaluations.length > 0 ? (evaluations[0].abdomen?.toString() || '') : '',
                      hips: evaluations.length > 0 ? (evaluations[0].hips?.toString() || '') : '',
                      right_arm: evaluations.length > 0 ? (evaluations[0].right_arm?.toString() || '') : '',
                      left_arm: evaluations.length > 0 ? (evaluations[0].left_arm?.toString() || '') : '',
                      right_thigh: evaluations.length > 0 ? (evaluations[0].right_thigh?.toString() || '') : '',
                      left_thigh: evaluations.length > 0 ? (evaluations[0].left_thigh?.toString() || '') : '',
                      freq_target: goals?.freq_target ? goals.freq_target.toString() : '3',
                      available_days: goals?.available_days ? goals.available_days.split(',') : [],
                      duration_pref: goals?.duration_pref || '60 min',
                      training_location: goals?.training_location || 'Academia'
                    });
                    setEditWizardStep(0);
                    setShowEditStudentModal(true);
                  }}
                  className="px-4 py-2 bg-surface hover:bg-surface-high border border-surface-highest text-zinc-300 hover:text-primary rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 duration-200 active:scale-95 shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
                >
                  📝 Editar Perfil
                </button>
                <button
                  onClick={() => handleDeleteStudent(selectedStudent.id, selectedStudent.name)}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 duration-200 active:scale-95"
                >
                  🗑️ Excluir Aluno
                </button>
              </div>
            </div>

           {/* Overtraining / Recuperação AI Card */}
           {loadingEvals ? (
             <div className="mb-6 p-4 bg-surface-high border border-surface-highest rounded-xl animate-pulse text-zinc-500 text-xs italic">
               Analisando métricas de overtraining...
             </div>
           ) : (
             (() => {
               const report = analyzeOvertraining(evaluations);
               return (
                 <div className={`mb-6 p-4 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all ${
                   report.status === 'alerta' ? 'bg-red-950/20 border-red-500/30 text-red-300' :
                   report.status === 'excelente' ? 'bg-[#00ff41]/5 border-[#00ff41]/20 text-zinc-300' :
                   'bg-amber-950/20 border-amber-500/30 text-amber-300'
                 }`}>
                   <div className="space-y-1">
                     <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Análise de Recuperação & Overtraining (IA)</div>
                     <p className="text-sm leading-relaxed">{report.message}</p>
                   </div>
                   <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 text-center border ${
                     report.status === 'alerta' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                     report.status === 'excelente' ? 'bg-[#00ff41]/20 border-[#00ff41]/40 text-[#00ff41]' :
                     'bg-amber-500/20 border-amber-500/40 text-amber-400'
                   }`}>
                     {report.status === 'alerta' ? '⚠️ Risco Overtraining' :
                      report.status === 'excelente' ? '✅ Recuperação Ótima' :
                      '⚡ Recuperação Instável'}
                   </div>
                 </div>
               );
             })()
           )}
           {/* Tab Seletor Premium */}
           <div className="flex flex-row flex-nowrap border-b border-surface-highest mb-6 overflow-x-auto whitespace-nowrap scrollbar-none w-full">
             <button
               onClick={() => {
                 setActiveProfileTab('general');
                 stopCamera();
               }}
               className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 ${
                 activeProfileTab === 'general'
                   ? 'text-primary border-primary bg-primary/5'
                   : 'text-zinc-400 border-transparent hover:text-white'
               }`}
             >
               Painel Geral & Financeiro
             </button>
             <button
               onClick={() => {
                 setActiveProfileTab('anamnesis');
                 stopCamera();
               }}
               className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 ${
                 activeProfileTab === 'anamnesis'
                   ? 'text-primary border-primary bg-primary/5'
                   : 'text-zinc-400 border-transparent hover:text-white'
               }`}
             >
               Anamnese & Avaliação Postural
             </button>
             <button
                onClick={() => {
                  setActiveProfileTab('goals');
                  stopCamera();
                }}
                className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 ${
                  activeProfileTab === 'goals'
                    ? 'text-primary border-primary bg-primary/5'
                    : 'text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                Metas & Evolução Corporal
              </button>
              <button
                 onClick={() => {
                   setActiveProfileTab('schedule');
                   stopCamera();
                 }}
                 className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 ${
                   activeProfileTab === 'schedule'
                     ? 'text-primary border-primary bg-primary/5'
                     : 'text-zinc-400 border-transparent hover:text-white'
                 }`}
               >
                 Agenda de Retorno
               </button>
               <button
                  onClick={() => {
                    setActiveProfileTab('attendance');
                    stopCamera();
                  }}
                  className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap shrink-0 ${
                    activeProfileTab === 'attendance'
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-zinc-400 border-transparent hover:text-white'
                  }`}
                >
                  Assiduidade e Treinos
                </button>
           </div>

            {/* Tab content container */}
            <div className="w-full">
           {activeProfileTab === 'general' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-8">
                  <div className="space-y-4">
                     <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2"><Award className="w-5 h-5 text-primary"/> Conquistas (Badges)</h3>
                     <div className="flex flex-wrap gap-2">
                        {selectedStudent.badges && selectedStudent.badges.length > 0 ? selectedStudent.badges.map((b, i) => (
                           <div key={i} className="flex items-center gap-2 bg-surface-high border border-primary/30 shadow-[0_0_10px_rgba(212,175,55,0.1)] px-3 py-1.5 rounded-full text-sm font-medium text-zinc-200">
                              <span>{b.icon}</span> <span>{b.name}</span>
                           </div>
                        )) : <p className="text-sm text-zinc-500 italic">Nenhuma conquista ainda.</p>}
                     </div>
                  </div>

                  <div className="space-y-4">
                     <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary"/> Adesão Semanal</h3>
                     <div className="h-48 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie
                               data={attendanceData}
                               cx="50%"
                               cy="50%"
                               innerRadius={60}
                               outerRadius={80}
                               stroke="none"
                               paddingAngle={5}
                               dataKey="value"
                             >
                               {attendanceData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                               ))}
                             </Pie>
                             <RechartsTooltip 
                               contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px' }}
                               itemStyle={{ color: '#d4af37' }}
                             />
                           </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                           <span className="text-2xl font-bold font-mono text-primary z-0">{Math.round((4/5)*100)}%</span>
                           <span className="text-[10px] uppercase text-zinc-500 font-bold z-0">Adesão</span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4 bg-surface-high p-4 rounded-xl border border-surface-highest/60">
                     <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary"/> Notificações e Contatos
                     </h3>
                     <div className="space-y-3">
                        <div>
                           <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Número de WhatsApp do aluno (DDI + DDD + Número) para envios diretos de relatórios e mensagens de treino.">WhatsApp (DDD + Número, sem símbolos)</label>
                           <input 
                              type="text" 
                              value={studentPhone} 
                              onChange={e => setStudentPhone(e.target.value)} 
                              className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-sm outline-none focus:border-primary font-mono"
                              placeholder="Ex: 5511999999999"
                           />
                        </div>
                        <div>
                           <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Identificação numérica única do chat do aluno no Telegram, utilizada para o envio de alertas automatizados.">Telegram Chat ID (código numérico)</label>
                           <input 
                              type="text" 
                              value={studentTelegramId} 
                              onChange={e => setStudentTelegramId(e.target.value)} 
                              className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-sm outline-none focus:border-primary font-mono"
                              placeholder="Ex: 123456789"
                           />
                        </div>
                        <button 
                           onClick={handleSaveContacts} 
                           disabled={savingContacts}
                           className="w-full mt-2 py-2 bg-primary/20 border border-primary/40 text-primary font-bold uppercase tracking-wider text-xs rounded hover:bg-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           {savingContacts ? 'Salvando...' : 'Salvar Contatos'}
                        </button>
                     </div>
                  </div>

                  {/* Histórico Financeiro & Planos Card */}
                  <div className="space-y-4 bg-surface-high p-4 rounded-xl border border-surface-highest/60">
                     <div className="flex items-center justify-between border-b border-surface-highest pb-2">
                        <h3 className="font-heading font-semibold text-lg text-white flex items-center gap-2">
                           <CreditCard className="w-5 h-5 text-primary"/> Histórico Financeiro & Planos
                        </h3>
                        {(() => {
                           const finStatus = getStudentFinancialStatus(selectedStudent.id);
                           return (
                              <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider ${finStatus.color}`}>
                                 {finStatus.label}
                              </span>
                           );
                        })()}
                     </div>

                     {/* Payments List */}
                     <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {(() => {
                           const bills = allPayments.filter(p => p.student_id.toString() === selectedStudent.id.toString());
                           const today = new Date().toISOString().split('T')[0];
                           if (bills.length === 0) {
                              return <p className="text-zinc-500 text-xs italic text-center py-4">Nenhuma cobrança registrada.</p>;
                           }
                           return bills.map(p => {
                              const calculatedStatus = p.status === 'Pago' ? 'Pago' : (p.due_date < today ? 'Atrasado' : 'Pendente');
                              return (
                                 <div key={p.id} className="bg-surface border border-surface-highest/60 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs">
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                       <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-white uppercase tracking-wide">{p.plan_name}</span>
                                          <span className="text-zinc-500">•</span>
                                          <span className="font-mono text-primary font-bold">R$ {parseFloat(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                       </div>
                                       <div className="text-[10px] text-zinc-400 space-y-0.5">
                                          <p>Vencimento: <span className="font-mono font-medium">{p.due_date ? new Date(p.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span></p>
                                          {p.status === 'Pago' && p.payment_date && (
                                             <p className="text-[#00ff41]">Pago em: <span className="font-mono font-medium">{new Date(p.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span></p>
                                          )}
                                       </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                       <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-widest ${
                                          calculatedStatus === 'Pago' ? 'text-[#00ff41] bg-[#00ff41]/10 border-[#00ff41]/20' :
                                          calculatedStatus === 'Atrasado' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                          'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                       }`}>
                                          {calculatedStatus}
                                       </span>

                                       {calculatedStatus !== 'Pago' && (
                                          <button 
                                             onClick={() => handleMarkAsPaid(p.id)}
                                             className="px-2 py-1 bg-primary text-black font-bold uppercase tracking-wider text-[9px] rounded hover:bg-primary-dim transition-colors"
                                             title="Marcar como Pago"
                                          >
                                             Pagar
                                          </button>
                                       )}
                                       
                                       <button 
                                          onClick={() => handleDeletePayment(p.id)}
                                          className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                                          title="Excluir fatura"
                                       >
                                          <X className="w-4 h-4" />
                                       </button>
                                    </div>
                                 </div>
                              );
                           });
                        })()}
                     </div>

                     <button
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full mt-2 py-2 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded hover:bg-primary-dim transition-all shadow-[0_0_10px_rgba(212,175,55,0.15)] flex items-center justify-center gap-1.5"
                     >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Cobrança
                     </button>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="space-y-4">
                     <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2"><Camera className="w-5 h-5 text-primary"/> Evolução Visual</h3>
                     
                     {!stream && !photo && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button onClick={() => startCamera('evolution')} className="flex-1 h-36 border-2 border-dashed border-surface-highest rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-primary hover:border-primary transition-all hover:bg-primary/5">
                             <Camera className="w-6 h-6 mb-1.5 opacity-50" />
                             <span className="text-xs font-semibold uppercase tracking-wider">Tirar Foto</span>
                          </button>
                          <label className="flex-1 h-36 border-2 border-dashed border-surface-highest rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-primary hover:border-primary transition-all hover:bg-primary/5 cursor-pointer">
                             <Plus className="w-6 h-6 mb-1.5 opacity-50" />
                             <span className="text-xs font-semibold uppercase tracking-wider">Enviar Imagem</span>
                             <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'evolution')} />
                          </label>
                        </div>
                     )}

                     {stream && captureTarget === 'evolution' && (
                        <div className="space-y-3">
                           <video ref={bindVideoRef} autoPlay playsInline className="w-full rounded-xl border border-surface-highest bg-black object-cover aspect-[3/4] md:aspect-video"></video>
                           <canvas ref={canvasRef} width="640" height="480" className="hidden"></canvas>
                           <div className="flex gap-2">
                              <button onClick={capturePhoto} className="flex-1 bg-gradient-to-r from-primary to-primary-dim text-black font-bold py-3 rounded hover:opacity-90 transition-opacity text-xs uppercase tracking-wider">📸 Tirar Foto</button>
                              <label className="flex-1 bg-surface border border-surface-highest text-zinc-300 rounded hover:text-white transition-colors text-xs uppercase tracking-wider font-bold py-3 text-center cursor-pointer flex items-center justify-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> Escolher Arquivo
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { stopCamera(); handleFileUpload(e, 'evolution'); }} />
                              </label>
                              <button onClick={stopCamera} className="px-6 py-3 bg-surface border border-surface-highest text-zinc-400 rounded hover:text-white transition-colors text-xs uppercase tracking-wider">Cancelar</button>
                           </div>
                        </div>
                     )}

                     {photo && (
                        <div className="space-y-3 relative group w-full">
                           <span className="absolute top-2 left-2 bg-primary text-black text-[10px] uppercase font-bold px-2 py-1 rounded z-10">Hoje</span>
                           <img src={photo} alt="Progresso" className="w-full rounded-xl border-2 border-primary shadow-[0_0_15px_rgba(212,175,55,0.2)] object-cover aspect-[3/4] md:aspect-video" />
                           <div className="absolute top-2 right-2 flex gap-2">
                             <button onClick={() => {setPhoto(null); startCamera('evolution');}} className="bg-black/60 p-2 rounded flex items-center justify-center text-white hover:bg-black backdrop-blur text-xs font-bold transition-colors z-10">🔄 Refazer</button>
                             <button onClick={deletePhoto} className="bg-red-500/80 p-2 rounded flex items-center justify-center text-white hover:bg-red-600 backdrop-blur text-xs font-bold transition-colors z-10"><X className="w-4 h-4"/></button>
                           </div>
                        </div>
                     )}
                  </div>

                  {/* Evolução Biométrica Card */}
                  <div className="space-y-4 bg-surface-high p-4 rounded-xl border border-surface-highest/60">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-highest pb-2">
                        <h3 className="font-heading font-semibold text-base text-white flex items-center gap-2">
                           <Award className="w-5 h-5 text-primary"/> Evolução Biométrica
                        </h3>
                        <div className="flex bg-surface rounded p-1 border border-surface-highest gap-1 self-start sm:self-auto">
                           {[
                             { key: 'weight', label: 'Peso' },
                             { key: 'body_fat', label: '% Gord' },
                             { key: 'heart_rate', label: 'BPM' }
                           ].map(m => (
                             <button
                               key={m.key}
                               onClick={() => setActiveMetric(m.key as any)}
                               className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                 activeMetric === m.key ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white font-medium'
                               }`}
                             >
                               {m.label}
                             </button>
                           ))}
                        </div>
                     </div>

                     {loadingEvals ? (
                       <p className="text-zinc-500 text-sm py-8 italic animate-pulse text-center">Carregando histórico de biometria...</p>
                     ) : evaluations.length === 0 ? (
                       <div className="h-48 flex flex-col items-center justify-center border border-dashed border-surface-highest rounded-xl text-zinc-500 text-xs italic text-center p-4">
                         Nenhum registro de biometria encontrado. Registre avaliações físicas em "Inspeção de Campo" para gerar o gráfico de evolução.
                       </div>
                     ) : (
                       <div className="h-48 w-full relative pt-2">
                          <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={[...evaluations].reverse()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#8f9b95" 
                                  fontSize={9} 
                                  tickLine={false} 
                                  axisLine={false}
                                  tickFormatter={(tick) => {
                                    if (!tick) return '';
                                    const parts = tick.split('-');
                                    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : tick;
                                  }}
                                />
                                <YAxis 
                                  stroke="#8f9b95" 
                                  fontSize={9} 
                                  tickLine={false} 
                                  axisLine={false} 
                                  width={20}
                                  domain={['dataMin - 2', 'dataMax + 2']}
                                />
                                <RechartsTooltip 
                                   contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4', fontSize: '11px' }}
                                   itemStyle={{ color: '#d4af37' }}
                                   labelFormatter={(label) => `Data: ${label}`}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey={activeMetric} 
                                  name={activeMetric === 'weight' ? 'Peso (kg)' : activeMetric === 'body_fat' ? 'Gordura (%)' : 'Batimentos (BPM)'}
                                  stroke="#d4af37" 
                                  strokeWidth={3} 
                                  dot={{ r: 4, fill: '#d4af37' }} 
                                  activeDot={{ r: 6 }} 
                                />
                             </LineChart>
                          </ResponsiveContainer>
                       </div>
                     )}
                  </div>
               </div>
             </div>
           )}

           {activeProfileTab === 'anamnesis' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               
               {/* Coluna 1: Ficha de Anamnese */}
               <div className="space-y-6 bg-surface-high p-5 rounded-xl border border-surface-highest/60">
                 <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2">
                   <Award className="w-5 h-5 text-primary"/> Ficha de Anamnese
                 </h3>
                 
                 {loadingAnamnesis ? (
                   <p className="text-zinc-500 text-xs italic py-6 animate-pulse">Carregando ficha de anamnese...</p>
                 ) : !anamnesis ? (
                   <p className="text-zinc-500 text-xs italic py-6">Erro ao carregar ficha de anamnese.</p>
                 ) : (
                   <div className="space-y-4 text-xs">
                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Indique restrições médicas, patologias diagnosticadas, lesões musculoesqueléticas ou dores frequentes relatadas pelo aluno.">Restrições Médicas / Lesões / Dores</label>
                       <textarea
                         value={anamnesis.medical_restrictions || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, medical_restrictions: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Condromalácia patelar grau 1, dor lombar leve..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Procedimentos cirúrgicos anteriores realizados pelo aluno e tempo de recuperação aproximado.">Histórico de Cirurgias</label>
                       <textarea
                         value={anamnesis.surgical_history || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, surgical_history: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Artroscopia no joelho direito em 2022..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Relato de hipertensão, hipotensão, arritmias ou qualquer fator de risco cardiovascular relevante para a prática física.">Condições Cardiovasculares (Pressão, Coração)</label>
                       <textarea
                         value={anamnesis.cardio_condition || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, cardio_condition: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Hipertensão leve controlada..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Medicações de uso diário ou frequente que possam interferir na frequência cardíaca, pressão arterial ou rendimento do aluno.">Medicamentos em Uso</label>
                       <textarea
                         value={anamnesis.medications || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, medications: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Beta-bloqueador pela manhã..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Estilo de alimentação predominante, suplementação atual, alergias ou intolerâncias alimentares declaradas.">Hábitos Alimentares / Alergias</label>
                       <textarea
                         value={anamnesis.dietary_habits || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, dietary_habits: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Alergia a frutos do mar, dieta hiperproteica..."
                       />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Quantidade diária média de ingestão de água em litros informada pelo aluno.">Consumo Diário de Água (L)</label>
                         <input
                           type="number"
                           step="0.5"
                           min="0"
                           max="10"
                           value={anamnesis.water_intake || 2.0}
                           onChange={e => setAnamnesis({ ...anamnesis, water_intake: parseFloat(e.target.value) || 0 })}
                           className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white font-mono text-xs outline-none focus:border-primary"
                         />
                       </div>

                       <div>
                         <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Nível subjetivo ou testado de flexibilidade corporal geral do aluno.">Nível de Flexibilidade</label>
                         <select
                           value={anamnesis.flexibility_level || 'Médio'}
                           onChange={e => setAnamnesis({ ...anamnesis, flexibility_level: e.target.value })}
                           className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary"
                         >
                           <option>Baixo</option>
                           <option>Médio</option>
                           <option>Alto</option>
                         </select>
                       </div>
                     </div>

                     <button
                       onClick={handleSaveAnamnesis}
                       disabled={savingAnamnesis}
                       className="w-full mt-4 py-3 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded hover:bg-primary-dim transition-all shadow-[0_0_12px_rgba(212,175,55,0.15)] flex items-center justify-center gap-1.5"
                     >
                       {savingAnamnesis ? 'Salvando...' : 'Salvar Ficha de Anamnese'}
                     </button>
                   </div>
                 )}
               </div>

               {/* Coluna 2: Avaliação Postural */}
               <div className="space-y-6 bg-surface-high p-5 rounded-xl border border-surface-highest/60">
                 <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2">
                   <Camera className="w-5 h-5 text-primary"/> Avaliação Postural
                 </h3>

                 {/* Ângulos Seletor */}
                 <div className="flex bg-surface rounded p-1 border border-surface-highest gap-1">
                   {[
                     { key: 'front', label: 'Frente' },
                     { key: 'back', label: 'Costas' },
                     { key: 'side', label: 'Perfil' }
                   ].map(a => (
                     <button
                       key={a.key}
                       type="button"
                       onClick={() => {
                         setActiveAngle(a.key as any);
                         stopCamera();
                       }}
                       className={`flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                         activeAngle === a.key ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'
                       }`}
                     >
                       {a.label}
                     </button>
                   ))}
                 </div>

                 {/* Active angle content */}
                 {(() => {
                   const columnName = activeAngle === 'front' ? 'photo_front_url' : activeAngle === 'back' ? 'photo_back_url' : 'photo_side_url';
                   const activePhoto = selectedStudent[columnName];
                   const angleLabel = activeAngle === 'front' ? 'Frente' : activeAngle === 'back' ? 'Costas' : 'Perfil';

                   // Camera capture active
                   if (stream && captureTarget === activeAngle) {
                     return (
                       <div className="space-y-3">
                         <video ref={bindVideoRef} autoPlay playsInline className="w-full rounded-xl border border-surface-highest bg-black object-cover aspect-[3/4]"></video>
                         <canvas ref={canvasRef} width="640" height="480" className="hidden"></canvas>
                         <div className="flex gap-2">
                           <button onClick={capturePhoto} className="flex-1 bg-gradient-to-r from-primary to-primary-dim text-black font-bold py-3 rounded hover:opacity-90 transition-opacity text-xs uppercase tracking-wider">📸 Tirar Foto</button>
                           <label className="flex-1 bg-surface border border-surface-highest text-zinc-300 rounded hover:text-white transition-colors text-xs uppercase tracking-wider font-bold py-3 text-center cursor-pointer flex items-center justify-center gap-1.5">
                             <Plus className="w-3.5 h-3.5" /> Escolher Arquivo
                             <input type="file" accept="image/*" className="hidden" onChange={(e) => { stopCamera(); handleFileUpload(e, activeAngle); }} />
                           </label>
                           <button onClick={stopCamera} className="px-6 py-3 bg-surface border border-surface-highest text-zinc-400 rounded hover:text-white transition-colors text-xs uppercase tracking-wider">Cancelar</button>
                         </div>
                       </div>
                     );
                   }

                   // Photo exists
                   if (activePhoto) {
                     return (
                       <div className="space-y-4">
                         <div className="relative rounded-xl border-2 border-primary shadow-[0_0_15px_rgba(212,175,55,0.2)] overflow-hidden aspect-[3/4] bg-black">
                           <img src={activePhoto} alt={`Postura ${angleLabel}`} className="w-full h-full object-cover" />
                           
                           {/* Postural Grid Overlay */}
                           {showGrid && (
                             <div 
                               className="absolute inset-0 pointer-events-none transition-opacity" 
                               style={{ opacity: gridOpacity }}
                             >
                               {/* Plumb Line (vertical axis) in bright cyan/teal */}
                               <div 
                                 className="absolute top-0 bottom-0 border-l-2 border-dashed border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" 
                                 style={{ left: `${gridX}%` }}
                               />
                               
                               {/* Horizontal alignments lines */}
                               <div className="absolute top-[15%] left-0 right-0 border-t border-zinc-500/40" />
                               <div className="absolute top-[30%] left-0 right-0 border-t border-zinc-500/40" />
                               <div className="absolute top-[45%] left-0 right-0 border-t border-zinc-500/40" />
                               <div className="absolute top-[60%] left-0 right-0 border-t border-zinc-500/40" />
                               <div className="absolute top-[75%] left-0 right-0 border-t border-zinc-500/40" />
                               
                               {/* Grid ticks label */}
                               <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-mono text-cyan-300 font-bold uppercase tracking-widest border border-cyan-500/20">
                                 Grid Eixo X: {gridX}%
                               </div>
                             </div>
                           )}
                           
                           {/* Quick Action buttons */}
                           <div className="absolute top-2 right-2 flex gap-2">
                             <button 
                               onClick={() => deletePosturePhoto(activeAngle)} 
                               className="bg-red-500/80 p-2 rounded flex items-center justify-center text-white hover:bg-red-600 backdrop-blur transition-colors"
                               title="Excluir Foto"
                             >
                               <X className="w-4 h-4"/>
                             </button>
                           </div>
                         </div>

                         {/* Alignment Grid Controls */}
                         <div className="bg-surface border border-surface-highest/60 p-4 rounded-xl space-y-3.5">
                           <div className="flex items-center justify-between">
                             <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider cursor-help" title="Liga ou desliga a grade isométrica e a linha de prumo vertical sobre a foto do aluno.">Grade Postural (ON/OFF)</span>
                             <button
                               onClick={() => setShowGrid(!showGrid)}
                               className={`px-3 py-1 rounded text-[10px] font-bold uppercase border transition-all ${
                                 showGrid 
                                   ? 'bg-primary text-black border-primary' 
                                   : 'bg-surface-high border-surface-highest text-zinc-400 hover:text-white'
                               }`}
                             >
                               {showGrid ? 'Ligado' : 'Desligado'}
                             </button>
                           </div>

                           {showGrid && (
                             <>
                               <div>
                                 <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1 cursor-help" title="Desloque a linha de prumo vertical para o centro de gravidade/simetria corporal do aluno.">
                                   <span>Calibração Horizontal (Plumb Line)</span>
                                   <span className="font-mono text-cyan-400">{gridX}%</span>
                                 </div>
                                 <input
                                   type="range"
                                   min="10"
                                   max="90"
                                   value={gridX}
                                   onChange={e => setGridX(parseInt(e.target.value))}
                                   className="w-full accent-primary bg-surface-high rounded-lg appearance-none h-1.5 cursor-pointer"
                                 />
                               </div>

                               <div>
                                 <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1 cursor-help" title="Ajuste a transparência da grade sobreposta para melhor visualização das referências anatômicas.">
                                   <span>Opacidade da Grade</span>
                                   <span className="font-mono text-cyan-400">{Math.round(gridOpacity * 100)}%</span>
                                 </div>
                                 <input
                                   type="range"
                                   min="10"
                                   max="100"
                                   value={Math.round(gridOpacity * 100)}
                                   onChange={e => setGridOpacity(parseInt(e.target.value) / 100)}
                                   className="w-full accent-primary bg-surface-high rounded-lg appearance-none h-1.5 cursor-pointer"
                                 />
                               </div>
                             </>
                           )}
                         </div>

                         {/* Action Buttons to recapture/reupload */}
                         <div className="flex gap-3">
                           <button 
                             onClick={() => startCamera(activeAngle)} 
                             className="flex-1 py-2 bg-surface border border-surface-highest text-zinc-400 hover:text-white rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                           >
                             <Camera className="w-3.5 h-3.5" /> Refazer Foto
                           </button>
                           <label className="flex-1 py-2 bg-surface border border-surface-highest text-zinc-400 hover:text-white rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                             <Plus className="w-3.5 h-3.5" /> Substituir
                             <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, activeAngle)} />
                           </label>
                         </div>
                       </div>
                     );
                   }

                   // No photo
                   return (
                     <div className="flex flex-col gap-3 py-6">
                       <p className="text-zinc-500 text-xs italic text-center mb-1">Nenhuma foto cadastrada para o ângulo {angleLabel}.</p>
                       <div className="flex flex-col sm:flex-row gap-3">
                         <button onClick={() => startCamera(activeAngle)} className="flex-1 h-36 border-2 border-dashed border-surface-highest rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-primary hover:border-primary transition-all hover:bg-primary/5">
                            <Camera className="w-6 h-6 mb-1.5 opacity-50" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Tirar Foto ({angleLabel})</span>
                         </button>
                         <label className="flex-1 h-36 border-2 border-dashed border-surface-highest rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-primary hover:border-primary transition-all hover:bg-primary/5 cursor-pointer">
                            <Plus className="w-6 h-6 mb-1.5 opacity-50" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Enviar Imagem</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, activeAngle)} />
                         </label>
                       </div>
                     </div>
                   );
                 })()}
               </div>

             </div>
           )}

           {activeProfileTab === 'goals' && (
              <div className="space-y-8">
                {/* PDF Export & WhatsApp Sharing Action Panel */}
                <div className="bg-surface-high border border-surface-highest/60 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-heading font-semibold text-sm text-white uppercase tracking-wider">Exportar Relatórios e Compartilhar</h3>
                    <p className="text-[10px] text-zinc-400">Gere laudos em PDF oficiais e compartilhe direto com o aluno.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => exportAnamnesisPDF(selectedStudent, anamnesis)}
                      className="px-3 py-1.5 bg-surface border border-surface-highest text-zinc-300 hover:text-primary hover:border-primary rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      📄 Anamnese (PDF)
                    </button>
                    <button 
                      onClick={() => exportPosturePDF(selectedStudent)}
                      className="px-3 py-1.5 bg-surface border border-surface-highest text-zinc-300 hover:text-primary hover:border-primary rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      📸 Laudo Postural (PDF)
                    </button>
                    <button 
                      onClick={() => exportEvolutionPDF(selectedStudent, evaluations, goals)}
                      className="px-3 py-1.5 bg-surface border border-surface-highest text-zinc-300 hover:text-primary hover:border-primary rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      🏆 Relatório de Evolução (PDF)
                    </button>
                    <button 
                      onClick={() => {
                        if (!selectedStudent) return;
                        const wTarget = goals?.weight_target ? `${goals.weight_target} kg` : '-';
                        const fTarget = goals?.body_fat_target ? `${goals.body_fat_target}%` : '-';
                        const mTarget = goals?.muscle_target ? `${goals.muscle_target} kg` : '-';
                        const currentWeight = evaluations.length > 0 ? `${evaluations[0].weight} kg` : '-';
                        const currentFat = evaluations.length > 0 ? `${evaluations[0].body_fat}%` : '-';
                        const currentMuscle = evaluations.length > 0 ? `${evaluations[0].skeletal_muscle} kg` : '-';

                        const text = `*RELATÓRIO DE EVOLUÇÃO (Elite Coach Premium)*\n\n👤 *Aluno:* ${selectedStudent.name}\n🎯 *Objetivo:* ${selectedStudent.goal}\n\n*METAS CORPORAIS DEFINIDAS:*\n• Peso Alvo: ${wTarget}\n• Gordura Alvo: ${fTarget}\n• Massa Muscular Alvo: ${mTarget}\n\n*STATUS ATUAL:*\n• Peso: ${currentWeight}\n• Gordura: ${currentFat}\n• Massa Muscular: ${currentMuscle}\n\nContinue focado no treinamento de alta performance! 🏆`;
                        window.open(`https://wa.me/${selectedStudent.phone_number || ''}?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="px-3 py-1.5 bg-[#00ff41]/20 border border-[#00ff41]/40 text-[#00ff41] hover:bg-[#00ff41]/30 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      💬 Compartilhar WhatsApp
                    </button>
                  </div>
                </div>

                {/* Public Link Panel */}
                <div className="bg-surface-high border border-[#dfbf80]/30 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(223,191,128,0.05)]">
                  <div className="space-y-1 md:max-w-md">
                    <h3 className="font-heading font-semibold text-sm text-[#dfbf80] uppercase tracking-wider flex items-center gap-1.5">
                      🔗 Link de Consulta Pública de Evolução
                    </h3>
                    <p className="text-[10px] text-zinc-400">
                      O aluno pode visualizar este link no celular para acompanhar seu histórico, metas, gráficos e fotos posturais sem precisar de login.
                    </p>
                  </div>
                  <div className="flex-1 flex gap-2 max-w-lg w-full">
                    <input 
                      type="text" 
                      readOnly 
                      value={selectedStudent.share_token ? `${window.location.origin}/?student_token=${selectedStudent.share_token}` : 'Carregando link...'} 
                      className="flex-1 bg-surface border border-surface-highest rounded px-3 py-2 text-xs text-zinc-300 font-mono select-all outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!selectedStudent.share_token) return;
                        const url = `${window.location.origin}/?student_token=${selectedStudent.share_token}`;
                        navigator.clipboard.writeText(url);
                        showCustomAlert('Link Copiado', 'O link de acompanhamento público do aluno foi copiado para a área de transferência!', 'success');
                      }}
                      className="px-3 py-2 bg-primary text-black font-bold uppercase tracking-wider text-[10px] rounded hover:bg-primary-dim transition-colors shrink-0"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedStudent.share_token) return;
                        const url = `${window.location.origin}/?student_token=${selectedStudent.share_token}`;
                        const text = `Olá *${selectedStudent.name}*! Acompanhe toda a sua evolução física, metas, gráficos e laudos posturais diretamente pelo seu portal de aluno exclusivo:\n\n🔗 ${url}\n\nFoco nos treinos! 🏆`;
                        window.open(`https://wa.me/${selectedStudent.phone_number || ''}?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="px-3 py-2 bg-[#00ff41]/20 border border-[#00ff41]/40 text-[#00ff41] hover:bg-[#00ff41]/30 text-[10px] font-bold uppercase tracking-wider rounded transition-colors shrink-0"
                    >
                      Enviar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Form targets */}
                  <div className="bg-surface-high p-5 rounded-xl border border-surface-highest/60 space-y-6 h-fit">
                    <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2">
                      🎯 Definir Metas Corporais
                    </h3>
                    
                    {loadingGoals ? (
                      <p className="text-zinc-500 text-xs italic py-6 animate-pulse">Carregando metas do aluno...</p>
                    ) : (
                      <div className="space-y-4 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Meta de peso corporal total em quilogramas (kg) que o aluno deseja alcançar.">Peso Alvo (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="30"
                            max="250"
                            value={weightTarget}
                            onChange={e => setWeightTarget(e.target.value)}
                            className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white font-mono text-sm outline-none focus:border-primary"
                            placeholder="Ex: 75.0"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Meta ideal de percentual de gordura corporal do aluno para acompanhamento de composição corporal.">% Gordura Corporal Alvo</label>
                          <input
                            type="number"
                            step="0.1"
                            min="2"
                            max="60"
                            value={bodyFatTarget}
                            onChange={e => setBodyFatTarget(e.target.value)}
                            className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white font-mono text-sm outline-none focus:border-primary"
                            placeholder="Ex: 12.0"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Quantidade desejada de massa muscular em quilogramas (kg) a ser atingida pelo aluno.">Massa Muscular Alvo (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="10"
                            max="150"
                            value={muscleTarget}
                            onChange={e => setMuscleTarget(e.target.value)}
                            className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white font-mono text-sm outline-none focus:border-primary"
                            placeholder="Ex: 38.0"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block cursor-help" title="Frequência semanal ideal de sessões de treino planejadas e estimadas para o aluno.">Frequência Semanal Alvo (dias)</label>
                          <select
                            value={freqTarget}
                            onChange={e => setFreqTarget(e.target.value)}
                            className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-sm outline-none focus:border-primary"
                          >
                            <option value="">Selecione...</option>
                            <option value="1">1 dia / semana</option>
                            <option value="2">2 dias / semana</option>
                            <option value="3">3 dias / semana</option>
                            <option value="4">4 dias / semana</option>
                            <option value="5">5 dias / semana</option>
                            <option value="6">6 dias / semana</option>
                            <option value="7">7 dias / semana</option>
                          </select>
                        </div>

                        <button
                          onClick={handleSaveGoals}
                          disabled={savingGoals}
                          className="w-full mt-4 py-3 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded hover:bg-primary-dim transition-all shadow-[0_0_12px_rgba(212,175,55,0.15)] flex items-center justify-center gap-1.5"
                        >
                          {savingGoals ? 'Salvando...' : 'Salvar Metas'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Comparative Charts & Progression Cards */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Comparative Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Weight Card */}
                      <div className="bg-surface-high p-4 rounded-xl border border-surface-highest/60 space-y-2">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest block">Peso Corporal</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xl font-bold font-mono text-white">
                            {evaluations.length > 0 && evaluations[0].weight ? `${evaluations[0].weight} kg` : '-'}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">Meta: {goals?.weight_target ? `${goals.weight_target} kg` : '-'}</span>
                        </div>
                        {goals?.weight_target && evaluations.length > 0 && evaluations[0].weight ? (() => {
                          const diff = goals.weight_target - evaluations[0].weight;
                          if (Math.abs(diff) < 0.1) return <span className="text-[10px] text-[#00ff41] font-bold">Meta atingida! 🎉</span>;
                          return (
                            <span className={`text-[10px] font-bold ${diff < 0 ? 'text-amber-400' : 'text-[#00ff41]'}`}>
                              {diff < 0 ? `Faltam ${diff.toFixed(1)} kg` : `Meta superada! (${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg)`}
                            </span>
                          );
                        })() : <span className="text-[10px] text-zinc-500 italic">Sem dados de comparação</span>}
                      </div>

                      {/* Fat Card */}
                      <div className="bg-surface-high p-4 rounded-xl border border-surface-highest/60 space-y-2">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest block">Gordura Corporal</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xl font-bold font-mono text-white">
                            {evaluations.length > 0 && evaluations[0].body_fat ? `${evaluations[0].body_fat}%` : '-'}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">Meta: {goals?.body_fat_target ? `${goals.body_fat_target}%` : '-'}</span>
                        </div>
                        {goals?.body_fat_target && evaluations.length > 0 && evaluations[0].body_fat ? (() => {
                          const diff = goals.body_fat_target - evaluations[0].body_fat;
                          if (Math.abs(diff) < 0.1) return <span className="text-[10px] text-[#00ff41] font-bold">Meta atingida! 🎉</span>;
                          return (
                            <span className={`text-[10px] font-bold ${diff < 0 ? 'text-amber-400' : 'text-[#00ff41]'}`}>
                              {diff < 0 ? `Faltam ${diff.toFixed(1)}%` : `Meta superada! (${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)`}
                            </span>
                          );
                        })() : <span className="text-[10px] text-zinc-500 italic">Sem dados de comparação</span>}
                      </div>

                      {/* Muscle Card */}
                      <div className="bg-surface-high p-4 rounded-xl border border-surface-highest/60 space-y-2">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest block">Massa Muscular</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xl font-bold font-mono text-white">
                            {evaluations.length > 0 && evaluations[0].skeletal_muscle ? `${evaluations[0].skeletal_muscle} kg` : '-'}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">Meta: {goals?.muscle_target ? `${goals.muscle_target} kg` : '-'}</span>
                        </div>
                        {goals?.muscle_target && evaluations.length > 0 && evaluations[0].skeletal_muscle ? (() => {
                          const diff = goals.muscle_target - evaluations[0].skeletal_muscle;
                          if (Math.abs(diff) < 0.1) return <span className="text-[10px] text-[#00ff41] font-bold">Meta atingida! 🎉</span>;
                          return (
                            <span className={`text-[10px] font-bold ${diff > 0 ? 'text-amber-400' : 'text-[#00ff41]'}`}>
                              {diff > 0 ? `Faltam +${diff.toFixed(1)} kg` : `Meta superada! (${diff.toFixed(1)} kg)`}
                            </span>
                          );
                        })() : <span className="text-[10px] text-zinc-500 italic">Sem dados de comparação</span>}
                      </div>
                    </div>

                    {/* Recharts LineCharts showing progression vs target */}
                    {evaluations.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center border border-dashed border-surface-highest rounded-xl text-zinc-500 text-xs italic text-center p-4">
                        Nenhum dado biométrico cadastrado para gerar os gráficos de metas. Registre avaliações físicas em "Inspeção de Campo".
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Chart 1: Weight */}
                        <div className="bg-surface-high p-4 rounded-xl border border-surface-highest/60 space-y-3">
                          <h4 className="font-heading font-semibold text-xs text-white uppercase tracking-wider">Evolução do Peso vs Meta</h4>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={[...evaluations].reverse()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#8f9b95" 
                                  fontSize={8} 
                                  tickLine={false} 
                                  axisLine={false}
                                  tickFormatter={(tick) => {
                                    if (!tick) return '';
                                    const parts = tick.split('-');
                                    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : tick;
                                  }}
                                />
                                <YAxis 
                                  stroke="#8f9b95" 
                                  fontSize={8} 
                                  tickLine={false} 
                                  axisLine={false} 
                                  width={20}
                                  domain={['dataMin - 3', 'dataMax + 3']}
                                />
                                <RechartsTooltip 
                                  contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4', fontSize: '10px' }}
                                  itemStyle={{ color: '#d4af37' }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="weight" 
                                  name="Peso Real (kg)"
                                  stroke="#d4af37" 
                                  strokeWidth={3} 
                                  dot={{ r: 4, fill: '#d4af37' }} 
                                  activeDot={{ r: 6 }} 
                                />
                                {goals?.weight_target && (
                                  <ReferenceLine 
                                    y={goals.weight_target} 
                                    stroke="#d4af37" 
                                    strokeDasharray="4 4" 
                                    strokeWidth={1.5}
                                    label={{ value: `Meta: ${goals.weight_target} kg`, fill: '#d4af37', position: 'top', fontSize: 9, fontWeight: 'bold' }} 
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 2: Body Fat */}
                        <div className="bg-surface-high p-4 rounded-xl border border-surface-highest/60 space-y-3">
                          <h4 className="font-heading font-semibold text-xs text-white uppercase tracking-wider">Evolução do % de Gordura vs Meta</h4>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={[...evaluations].reverse()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#8f9b95" 
                                  fontSize={8} 
                                  tickLine={false} 
                                  axisLine={false}
                                  tickFormatter={(tick) => {
                                    if (!tick) return '';
                                    const parts = tick.split('-');
                                    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : tick;
                                  }}
                                />
                                <YAxis 
                                  stroke="#8f9b95" 
                                  fontSize={8} 
                                  tickLine={false} 
                                  axisLine={false} 
                                  width={20}
                                  domain={['dataMin - 2', 'dataMax + 2']}
                                />
                                <RechartsTooltip 
                                  contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4', fontSize: '10px' }}
                                  itemStyle={{ color: '#00ff41' }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="body_fat" 
                                  name="Gordura Real (%)"
                                  stroke="#00ff41" 
                                  strokeWidth={3} 
                                  dot={{ r: 4, fill: '#00ff41' }} 
                                  activeDot={{ r: 6 }} 
                                />
                                {goals?.body_fat_target && (
                                  <ReferenceLine 
                                    y={goals.body_fat_target} 
                                    stroke="#d4af37" 
                                    strokeDasharray="4 4" 
                                    strokeWidth={1.5}
                                    label={{ value: `Meta: ${goals.body_fat_target}%`, fill: '#d4af37', position: 'top', fontSize: 9, fontWeight: 'bold' }} 
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 3: Muscle */}
                        <div className="bg-surface-high p-4 rounded-xl border border-surface-highest/60 space-y-3">
                          <h4 className="font-heading font-semibold text-xs text-white uppercase tracking-wider">Evolução de Massa Muscular vs Meta</h4>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={[...evaluations].reverse()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#8f9b95" 
                                  fontSize={8} 
                                  tickLine={false} 
                                  axisLine={false}
                                  tickFormatter={(tick) => {
                                    if (!tick) return '';
                                    const parts = tick.split('-');
                                    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : tick;
                                  }}
                                />
                                <YAxis 
                                  stroke="#8f9b95" 
                                  fontSize={8} 
                                  tickLine={false} 
                                  axisLine={false} 
                                  width={20}
                                  domain={['dataMin - 2', 'dataMax + 2']}
                                />
                                <RechartsTooltip 
                                  contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4', fontSize: '10px' }}
                                  itemStyle={{ color: '#38bdf8' }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="skeletal_muscle" 
                                  name="Muscular Real (kg)"
                                  stroke="#38bdf8" 
                                  strokeWidth={3} 
                                  dot={{ r: 4, fill: '#38bdf8' }} 
                                  activeDot={{ r: 6 }} 
                                />
                                {goals?.muscle_target && (
                                  <ReferenceLine 
                                    y={goals.muscle_target} 
                                    stroke="#d4af37" 
                                    strokeDasharray="4 4" 
                                    strokeWidth={1.5}
                                    label={{ value: `Meta: ${goals.muscle_target} kg`, fill: '#d4af37', position: 'top', fontSize: 9, fontWeight: 'bold' }} 
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeProfileTab === 'schedule' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to schedule a return */}
                <div className="bg-surface-high p-5 rounded-xl border border-surface-highest/60 space-y-6 h-fit">
                  <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2">
                    📅 Agendar Retorno
                  </h3>
                  
                  <form onSubmit={handleAddSchedule} className="space-y-4 text-xs">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Data do Retorno</label>
                      <input
                        type="date"
                        value={newSchedule.date}
                        onChange={e => setNewSchedule({ ...newSchedule, date: e.target.value })}
                        className="w-full bg-surface border border-surface-highest rounded px-3 py-2.5 mt-1 text-white font-mono text-xs outline-none focus:border-primary"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Horário</label>
                      <input
                        type="time"
                        value={newSchedule.time}
                        onChange={e => setNewSchedule({ ...newSchedule, time: e.target.value })}
                        className="w-full bg-surface border border-surface-highest rounded px-3 py-2.5 mt-1 text-white font-mono text-xs outline-none focus:border-primary"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Observações / Notas</label>
                      <textarea
                        value={newSchedule.notes}
                        onChange={e => setNewSchedule({ ...newSchedule, notes: e.target.value })}
                        className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-24 resize-none"
                        placeholder="Ex: Próxima avaliação física completa para comparar evolução..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingSchedule}
                      className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded hover:bg-primary-dim transition-all shadow-[0_0_12px_rgba(212,175,55,0.15)] flex items-center justify-center gap-1.5"
                    >
                      {savingSchedule ? 'Agendando...' : 'Confirmar Agendamento'}
                    </button>
                  </form>
                </div>

                {/* List of returns */}
                <div className="bg-surface-high p-5 rounded-xl border border-surface-highest/60 lg:col-span-2 space-y-6">
                  <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2">
                    📋 Retornos Cadastrados
                  </h3>

                  {loadingSchedules ? (
                    <p className="text-zinc-500 text-xs italic py-6 animate-pulse">Carregando retornos agendados...</p>
                  ) : schedules.length === 0 ? (
                    <p className="text-zinc-500 text-xs italic py-6 text-center">Nenhum retorno agendado para este aluno.</p>
                  ) : (
                    <div className="space-y-3">
                      {schedules.map(sch => (
                        <div key={sch.id} className="bg-surface border border-surface-highest/60 p-4 rounded-xl flex flex-col justify-between gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white font-mono">
                                  {sch.scheduled_date.split('-').reverse().join('/')} às {sch.scheduled_time.slice(0, 5)}
                                </span>
                                <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-widest ${
                                  sch.status === 'Agendado' || sch.status === 'Confirmado' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                                  sch.status === 'Pendente' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                  sch.status === 'Sugerido' ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' :
                                  sch.status === 'Realizado' ? 'text-primary bg-primary/10 border-primary/20' :
                                  'text-red-400 bg-red-500/10 border-red-500/20'
                                }`}>
                                  {sch.status === 'Confirmado' ? '✓ Confirmado' : sch.status === 'Sugerido' ? '⚡ Proposta Enviada' : sch.status}
                                </span>
                                {sch.status === 'Confirmado' && sch.notes?.includes('[Aluno aceitou a sugestão de nova data]') && (
                                  <span className="px-2 py-0.5 border border-primary/20 text-primary bg-primary/5 rounded text-[9px] font-bold uppercase tracking-widest animate-pulse">
                                    🤝 Aluno Aceitou Nova Data
                                  </span>
                                )}
                              </div>
                              {sch.status === 'Sugerido' && sch.suggested_date && (
                                <p className="text-[10px] text-cyan-400 font-bold uppercase mt-1">
                                  Sugestão: {sch.suggested_date.split('-').reverse().join('/')} às {sch.suggested_time?.slice(0, 5)}
                                </p>
                              )}
                              {sch.notes && (
                                <p className="text-xs text-zinc-400 italic mt-1">“{sch.notes}”</p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto">
                              {sch.status === 'Pendente' && (
                                <>
                                  <button
                                    onClick={() => handleConfirmSchedule(sch.id)}
                                    className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSuggestingScheduleId(sch.id);
                                      setSugDateInput(sch.scheduled_date);
                                      setSugTimeInput(sch.scheduled_time.slice(0, 5));
                                      setCancelingScheduleId(null);
                                    }}
                                    className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Propor Nova Data
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCancelingScheduleId(sch.id);
                                      setSuggestingScheduleId(null);
                                    }}
                                    className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Recusar
                                  </button>
                                </>
                              )}

                              {sch.status === 'Agendado' && (
                                <>
                                  <button
                                    onClick={() => handleConfirmSchedule(sch.id)}
                                    className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSuggestingScheduleId(sch.id);
                                      setSugDateInput(sch.scheduled_date);
                                      setSugTimeInput(sch.scheduled_time.slice(0, 5));
                                      setCancelingScheduleId(null);
                                    }}
                                    className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Propor Nova Data
                                  </button>
                                  <button
                                    onClick={() => handleUpdateScheduleStatus(sch.id, 'Realizado')}
                                    className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Concluir
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCancelingScheduleId(sch.id);
                                      setSuggestingScheduleId(null);
                                    }}
                                    className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}

                              {sch.status === 'Confirmado' && (
                                <>
                                  {(() => {
                                    const pastDue = isSchedulePast(sch.scheduled_date, sch.scheduled_time);
                                    return (
                                      <button
                                        onClick={() => handleUpdateScheduleStatus(sch.id, 'Realizado')}
                                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                          pastDue
                                            ? 'bg-amber-500/20 border border-amber-500 text-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)] hover:bg-amber-500/30'
                                            : 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
                                        }`}
                                      >
                                        {pastDue ? '⚠️ Avaliação Passada / Concluir' : 'Concluir'}
                                      </button>
                                    );
                                  })()}
                                  <button
                                    disabled
                                    className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 opacity-40 cursor-not-allowed rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                    title="Não é possível propor nova data para agendamento já confirmado"
                                  >
                                    Propor Nova Data
                                  </button>
                                  <button
                                    disabled
                                    className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 opacity-40 cursor-not-allowed rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                    title="Não é possível cancelar agendamento já confirmado"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}

                              {sch.status === 'Sugerido' && (
                                <button
                                  onClick={() => {
                                    setCancelingScheduleId(sch.id);
                                    setSuggestingScheduleId(null);
                                  }}
                                  className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                >
                                  Cancelar Proposta
                                </button>
                              )}
                            </div>
                          </div>

                          {cancelingScheduleId === sch.id && (
                             <div className="mt-2 p-4 bg-surface-high border border-surface-highest rounded-xl space-y-3">
                               <h4 className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Justificar Cancelamento / Recusa</h4>
                               <div>
                                 <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">Mensagem para o Aluno *</label>
                                 <textarea 
                                   value={trainerMessageInput}
                                   onChange={e => setTrainerMessageInput(e.target.value)}
                                   placeholder="Escreva a justificativa para o aluno..."
                                   className="w-full bg-surface border border-surface-highest rounded px-3 py-1.5 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                                   required
                                 />
                                </div>
                                <div className="flex justify-end gap-2 text-xs font-bold uppercase tracking-wider">
                                  <button 
                                    onClick={() => handleCancelSchedule(sch.id)}
                                    className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded hover:bg-red-500/30 transition-colors text-[10px]"
                                  >
                                    Confirmar Cancelamento
                                  </button>
                                  <button 
                                    onClick={() => { setCancelingScheduleId(null); setTrainerMessageInput(''); }}
                                    className="px-3 py-1.5 bg-surface border border-surface-highest text-zinc-400 hover:text-white rounded transition-colors text-[10px]"
                                  >
                                    Voltar
                                  </button>
                                </div>
                              </div>
                           )}

                          {suggestingScheduleId === sch.id && (
                            <div className="mt-2 p-4 bg-surface-high border border-surface-highest rounded-xl space-y-3">
                              <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Sugerir Nova Data/Horário de Retorno</h4>
                              <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                  <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">Nova Data</label>
                                  <input 
                                    type="date" 
                                    value={sugDateInput} 
                                    onChange={e => setSugDateInput(e.target.value)} 
                                    className="w-full bg-surface border border-surface-highest rounded px-3 py-1.5 text-white font-mono text-xs outline-none focus:border-primary"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">Novo Horário</label>
                                  <input 
                                    type="time" 
                                    value={sugTimeInput} 
                                    onChange={e => setSugTimeInput(e.target.value)} 
                                    className="w-full bg-surface border border-surface-highest rounded px-3 py-1.5 text-white font-mono text-xs outline-none focus:border-primary"
                                  />
                                </div>
                              </div>
                              <div>
                                 <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">Justificativa / Mensagem para o Aluno</label>
                                 <textarea 
                                   value={trainerMessageInput}
                                   onChange={e => setTrainerMessageInput(e.target.value)}
                                   placeholder="Escreva uma observação ou justificativa para propor esta nova data..."
                                   className="w-full bg-surface border border-surface-highest rounded px-3 py-1.5 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                                 />
                               </div>
                              <div className="flex justify-end gap-2 text-xs font-bold uppercase tracking-wider">
                                <button 
                                  onClick={() => handleSuggestSchedule(sch.id)}
                                  className="px-3 py-1.5 bg-primary text-black rounded hover:bg-primary-dim transition-colors text-[10px]"
                                >
                                  Enviar Proposta
                                </button>
                                <button 
                                  onClick={() => { setSuggestingScheduleId(null); setTrainerMessageInput(''); }}
                                  className="px-3 py-1.5 bg-surface border border-surface-highest text-zinc-400 hover:text-white rounded transition-colors text-[10px]"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeProfileTab === 'attendance' && (
              <div className="space-y-6">
                {/* PDF generation panel */}
                <div className="bg-surface-high border border-surface-highest/60 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-heading font-semibold text-sm text-white uppercase tracking-wider">Histórico de Assiduidade de Treinos</h3>
                    <p className="text-[10px] text-zinc-400">Visualize e emita o extrato de frequência do aluno.</p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        if (!selectedStudent || !latestWorkout) {
                          showCustomAlert('Aviso', 'O aluno precisa de um protocolo ativo para emitir o extrato.', 'warning');
                          return;
                        }
                        exportFrequencyPDF(selectedStudent, latestWorkout, workoutProgress);
                      }}
                      className="px-4 py-2 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded hover:bg-primary-dim transition-all shadow-[0_0_10px_rgba(212,175,55,0.15)] flex items-center gap-1.5"
                    >
                      📄 Emitir Extrato de Frequência
                    </button>
                  </div>
                </div>

                {loadingProgress ? (
                  <p className="text-zinc-500 text-sm py-4 italic animate-pulse text-center">Carregando histórico de frequência...</p>
                ) : !latestWorkout ? (
                  <div className="bg-surface-high border border-surface-highest p-6 rounded-xl text-center text-zinc-500 italic text-sm">
                    Nenhum protocolo ativo encontrado para este aluno. Crie um protocolo em "Protocolos de Treino" para acompanhar a frequência.
                  </div>
                ) : (
                  (() => {
                    // Calculation of stats
                    const totalWeeks = parseInt(latestWorkout.durationWeeks || '4', 10);
                    const daysInSplit = latestWorkout.workoutData?.days?.length || 0;
                    const totalPlannedSessions = totalWeeks * daysInSplit;

                    const getDayOffsetInWeek = (d: number, totalDays: number): number => {
                      if (totalDays === 1) return 0;
                      if (totalDays === 2) return d === 0 ? 0 : 3;
                      if (totalDays === 3) return d === 0 ? 0 : d === 1 ? 2 : 4;
                      if (totalDays === 4) return d === 0 ? 0 : d === 1 ? 1 : d === 2 ? 3 : 4;
                      if (totalDays === 5) return d;
                      return d;
                    };

                    const getWorkoutDateForKey = (wIdx: number, dIdx: number) => {
                      const startStr = latestWorkout.startDate || latestWorkout.date || new Date().toISOString();
                      const start = new Date(startStr + 'T12:00:00');
                      start.setDate(start.getDate() + (wIdx * 7) + getDayOffsetInWeek(dIdx, daysInSplit));
                      return start;
                    };

                    const getWorkoutStatus = (workoutDate: Date, entry: any) => {
                      if (entry) return entry.status;
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const compareDate = new Date(workoutDate);
                      compareDate.setHours(0,0,0,0);
                      if (compareDate < today) {
                        return 'NÃO REALIZADO';
                      }
                      return 'PENDENTE';
                    };

                    let completedSessions = 0;
                    let missedSessions = 0;
                    let pendingSessions = 0;
                    const calendarWeeks: any[] = [];

                    for (let w = 0; w < totalWeeks; w++) {
                      const weekDays: any[] = [];
                      for (let d = 0; d < daysInSplit; d++) {
                        const wDate = getWorkoutDateForKey(w, d);
                        const dateKey = wDate.toISOString().split('T')[0];
                        const progressEntry = workoutProgress.find(p => p.workout_date === dateKey && p.day_name === latestWorkout.workoutData.days[d].dayName);
                        const status = getWorkoutStatus(wDate, progressEntry);

                        if (status === 'REALIZADO') completedSessions++;
                        else if (status === 'NÃO REALIZADO') missedSessions++;
                        else pendingSessions++;

                        weekDays.push({
                          date: wDate,
                          dateKey,
                          dayName: latestWorkout.workoutData.days[d].dayName,
                          status,
                          progress: progressEntry ? Math.round((progressEntry.checked_exercises?.length || 0) / (progressEntry.total_exercises || 1) * 100) : 0,
                          entry: progressEntry
                        });
                      }
                      calendarWeeks.push(weekDays);
                    }

                    const attendancePct = totalPlannedSessions > 0 ? Math.round((completedSessions / totalPlannedSessions) * 100) : 0;
                    const isGoldTheme = attendancePct >= 80;

                    return (
                      <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className={`p-4 rounded-xl border ${
                            isGoldTheme 
                              ? 'bg-gradient-to-br from-[#dfbf80]/15 to-[#dfbf80]/5 border-[#dfbf80]/40 shadow-[0_0_15px_rgba(223,191,128,0.1)]' 
                              : 'bg-surface-high border-surface-highest/60'
                          } space-y-1`}>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Assiduidade %</span>
                            <span className={`text-2xl font-bold font-mono ${isGoldTheme ? 'text-[#dfbf80] animate-pulse' : 'text-primary'}`}>
                              {attendancePct}%
                            </span>
                            {isGoldTheme && (
                              <span className="text-[9px] text-[#dfbf80] font-bold uppercase block tracking-widest mt-1">💎 Elite Premium</span>
                            )}
                          </div>
                          
                          <div className="bg-surface-high border border-surface-highest/60 p-4 rounded-xl space-y-1">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Realizados</span>
                            <span className="text-2xl font-bold font-mono text-green-400">
                              {completedSessions}
                            </span>
                          </div>

                          <div className="bg-surface-high border border-surface-highest/60 p-4 rounded-xl space-y-1">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Não Executados</span>
                            <span className="text-2xl font-bold font-mono text-red-400">
                              {missedSessions}
                            </span>
                          </div>

                          <div className="bg-surface-high border border-surface-highest/60 p-4 rounded-xl space-y-1">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Pendentes</span>
                            <span className="text-2xl font-bold font-mono text-amber-400">
                              {pendingSessions}
                            </span>
                          </div>
                        </div>

                        {/* Calendar Grid View */}
                        <div className="bg-surface-high border border-surface-highest/60 p-5 rounded-xl space-y-6">
                          <h3 className="font-heading font-semibold text-base text-white border-b border-surface-highest/60 pb-2 flex items-center gap-2">
                            📅 Cronograma Detalhado & Histórico de Treinos
                          </h3>
                          
                          <div className="space-y-6">
                            {calendarWeeks.map((week, wIdx) => (
                              <div key={wIdx} className="space-y-3">
                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Semana {wIdx + 1}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {week.map((dayItem: any, dIdx: number) => {
                                    return (
                                      <div key={dIdx} className={`p-4 rounded-xl border bg-surface flex flex-col justify-between gap-3 text-xs ${
                                        dayItem.status === 'REALIZADO' ? 'border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.05)]' :
                                        dayItem.status === 'NÃO REALIZADO' ? 'border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.05)]' :
                                        'border-surface-highest/60'
                                      }`}>
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <span className="font-bold text-white uppercase tracking-wide block">{dayItem.dayName}</span>
                                            <span className="font-mono text-zinc-500 text-[10px] mt-0.5 block">{dayItem.date.toLocaleDateString('pt-BR')}</span>
                                          </div>
                                          <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-widest ${
                                            dayItem.status === 'REALIZADO' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                                            dayItem.status === 'NÃO REALIZADO' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                            'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                          }`}>
                                            {dayItem.status}
                                          </span>
                                        </div>

                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[10px] text-zinc-400">
                                            <span>Progresso</span>
                                            <span className="font-mono">{dayItem.entry?.checked_exercises?.length || 0}/{dayItem.entry?.total_exercises || latestWorkout.workoutData.days[dIdx].exercises.length}</span>
                                          </div>
                                          <div className="w-full bg-surface-high rounded-full h-1.5 overflow-hidden">
                                            <div 
                                              className={`h-full transition-all duration-500 ${
                                                dayItem.status === 'REALIZADO' ? 'bg-green-400' :
                                                dayItem.status === 'NÃO REALIZADO' ? 'bg-red-400' :
                                                'bg-amber-400'
                                              }`} 
                                              style={{ width: `${dayItem.progress}%` }} 
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
          </div>

         {/* New Payment Modal Dialog */}
         {showPaymentModal && selectedStudent && (
           <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0, y: 20 }} 
               animate={{ opacity: 1, y: 0 }} 
               className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative"
             >
               <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
                 <X className="w-5 h-5"/>
               </button>
               <h3 className="text-xl font-heading font-bold text-white mb-6 border-b border-surface-highest pb-2">Lançar Nova Cobrança</h3>
               
               <form onSubmit={handleAddPaymentSubmit} className="space-y-4">
                 <div>
                   <label className="text-xs text-zinc-400 uppercase font-bold block mb-1">Plano / Descrição</label>
                   <div className="flex flex-wrap gap-2 mt-1">
                     {['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Personalizado'].map(preset => (
                       <button
                         type="button"
                         key={preset}
                         onClick={() => handlePlanPresetChange(preset)}
                         className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-colors ${
                           newPayment.planName === preset
                             ? 'bg-primary text-black border-primary'
                             : 'bg-surface-high border-surface-highest text-zinc-400 hover:text-white'
                         }`}
                       >
                         {preset}
                       </button>
                     ))}
                   </div>
                 </div>

                 {newPayment.planName === 'Personalizado' && (
                   <div>
                     <label className="text-xs text-zinc-400 uppercase font-bold">Nome do Plano Personalizado</label>
                     <input
                       required
                       type="text"
                       value={newPayment.planName === 'Personalizado' ? '' : newPayment.planName}
                       onChange={e => setNewPayment({ ...newPayment, planName: e.target.value })}
                       className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary"
                       placeholder="Ex: Plano Extra"
                     />
                   </div>
                 )}

                 <div>
                   <label className="text-xs text-zinc-400 uppercase font-bold">Valor (R$)</label>
                   <input 
                     required 
                     type="number" 
                     value={newPayment.amount} 
                     onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} 
                     className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary font-mono" 
                     placeholder="Ex: 150"
                   />
                 </div>

                 <div>
                   <label className="text-xs text-zinc-400 uppercase font-bold">Data de Vencimento</label>
                   <input 
                     required 
                     type="date" 
                     value={newPayment.dueDate} 
                     onChange={e => setNewPayment({ ...newPayment, dueDate: e.target.value })} 
                     className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary font-mono" 
                   />
                 </div>

                 <button 
                   type="submit" 
                   disabled={savingPayment}
                   className="w-full py-3 mt-4 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)] disabled:opacity-50"
                 >
                   {savingPayment ? 'Processando...' : 'Lançar Cobrança'}
                 </button>
               </form>
             </motion.div>
           </div>
         )}

                   {/* Edit Student Modal Dialog */}
          {showEditStudentModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-lg w-full relative flex flex-col max-h-[90vh]">
                <button onClick={() => { setShowEditStudentModal(false); }} className="absolute top-4 right-4 text-zinc-400 hover:text-white z-10">
                  <X className="w-5 h-5"/>
                </button>
                <div className="flex-shrink-0">
                  <h3 className="text-lg font-heading font-bold text-white mb-6 border-b border-surface-highest pb-2 uppercase tracking-wider">Editar Perfil do Aluno</h3>
                
                {/* Wizard Steps Progress Bar */}
                <div className="flex items-center justify-between mb-6 px-1 select-none">
                  {[
                    { label: 'Cadastro', step: 0 },
                    { label: 'Saúde', step: 1 },
                    { label: 'Biometria', step: 2 },
                    { label: 'Logística', step: 3 }
                  ].map((item, idx) => (
                    <React.Fragment key={item.step}>
                      <div className="flex flex-col items-center relative z-10">
                        <button
                          type="button"
                          onClick={() => setEditWizardStep(item.step)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase transition-all duration-300 ${
                            editWizardStep === item.step
                              ? 'bg-[#dfbf80] text-black ring-4 ring-[#dfbf80]/30 shadow-[0_0_15px_rgba(223,191,128,0.4)]'
                              : editWizardStep > item.step
                              ? 'bg-primary/20 text-[#dfbf80] border border-[#dfbf80]/40'
                              : 'bg-surface border border-surface-highest text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {item.step + 1}
                        </button>
                        <span className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 transition-colors ${
                          editWizardStep === item.step ? 'text-[#dfbf80]' : 'text-zinc-500'
                        }`}>
                          {item.label}
                        </span>
                      </div>
                      {idx < 3 && (
                        <div className="flex-1 h-[2px] mx-2 -mt-4 bg-surface-highest relative">
                          <div 
                            className="absolute inset-y-0 left-0 bg-[#dfbf80] transition-all duration-300"
                            style={{ width: editWizardStep > item.step ? '100%' : '0%' }}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                </div>

                <form onSubmit={handleEditStudentSubmit} className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-none py-1">
                  {/* Step 0: Dados Pessoais & Endereço */}
                  {editWizardStep === 0 && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center mb-2">
                        <div className="relative group cursor-pointer w-16 h-16 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shadow-[0_0_12px_rgba(223,191,128,0.2)]">
                          {editStudent.photo_avatar_url ? (
                            <img src={editStudent.photo_avatar_url} alt="Avatar Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-5 h-5 text-zinc-500 group-hover:text-[#dfbf80] transition-colors" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[8px] text-white font-bold uppercase tracking-wider">Upload</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleAvatarChange(e, true)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1">Foto de Perfil</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Nome Completo *</label>
                          <input required type="text" value={editStudent.name} onChange={e=>setEditStudent({...editStudent, name: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: João da Silva"/>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Data de Nascimento</label>
                          <input type="date" value={editStudent.birth_date} onChange={e=>setEditStudent({...editStudent, birth_date: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono"/>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">E-mail</label>
                          <input type="email" value={editStudent.email} onChange={e=>setEditStudent({...editStudent, email: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: joao@email.com"/>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Telefone / Celular</label>
                          <input type="text" value={editStudent.phone_number} onChange={e=>setEditStudent({...editStudent, phone_number: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: 5511999999999"/>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 py-1 px-1">
                        <input 
                          type="checkbox" 
                          id="edit_is_whatsapp"
                          checked={editStudent.is_whatsapp} 
                          onChange={e => setEditStudent({ ...editStudent, is_whatsapp: e.target.checked })} 
                          className="w-4 h-4 rounded border-surface-highest bg-surface-high text-primary focus:ring-primary accent-primary"
                        />
                        <label htmlFor="edit_is_whatsapp" className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider cursor-pointer select-none">
                          Este número é o mesmo do WhatsApp?
                        </label>
                      </div>

                      <div className="border-t border-surface-highest pt-3">
                        <h4 className="text-[10px] text-[#dfbf80] font-bold uppercase tracking-widest mb-3">Endereço Completo</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Rua / Avenida</label>
                            <input type="text" value={editStudent.street} onChange={e=>setEditStudent({...editStudent, street: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Rua das Flores"/>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Número</label>
                            <input type="text" value={editStudent.number} onChange={e=>setEditStudent({...editStudent, number: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: 123"/>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Complemento</label>
                            <input type="text" value={editStudent.complement} onChange={e=>setEditStudent({...editStudent, complement: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Apto 45"/>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Bairro</label>
                            <input type="text" value={editStudent.neighborhood} onChange={e=>setEditStudent({...editStudent, neighborhood: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Centro"/>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Cidade</label>
                            <input type="text" value={editStudent.city} onChange={e=>setEditStudent({...editStudent, city: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: São Paulo"/>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Estado (UF)</label>
                            <input type="text" value={editStudent.state} onChange={e=>setEditStudent({...editStudent, state: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: SP"/>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Anamnese & Histórico de Saúde */}
                  {editWizardStep === 1 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Objetivo Principal *</label>
                          <select value={editStudent.goal} onChange={e=>setEditStudent({...editStudent, goal: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                            <option value="">Selecione...</option>
                            <option>Emagrecimento</option>
                            <option>Hipertrofia</option>
                            <option>Condicionamento Físico</option>
                            <option>Reabilitação Física</option>
                            <option>Saúde e Qualidade de Vida</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Nível de Atividade Atual</label>
                          <select value={editStudent.activity_level} onChange={e=>setEditStudent({...editStudent, activity_level: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                            <option>Sedentário</option>
                            <option>Levemente Ativo</option>
                            <option>Moderadamente Ativo</option>
                            <option>Muito Ativo</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Biotipo Corporal</label>
                          <select value={editStudent.biotype} onChange={e=>setEditStudent({...editStudent, biotype: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                            <option>Mesomorfo</option>
                            <option>Endomorfo</option>
                            <option>Ectomorfo</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Status</label>
                          <select value={editStudent.status} onChange={e=>setEditStudent({...editStudent, status: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                            <option>Ativo</option>
                            <option>Inativo</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Histórico Médico (Doenças, Cardíaco, Hipertensão)</label>
                        <textarea value={editStudent.medical_history} onChange={e=>setEditStudent({...editStudent, medical_history: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs h-16 resize-none outline-none focus:border-primary" placeholder="Ex: Hipertensão leve controlada..."/>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Lesões ou Restrições Físicas (Dores, Cirurgias)</label>
                        <textarea value={editStudent.injuries} onChange={e=>setEditStudent({...editStudent, injuries: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs h-16 resize-none outline-none focus:border-primary" placeholder="Ex: Dor lombar..."/>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Uso de Medicamentos Contínuos</label>
                        <input type="text" value={editStudent.medications} onChange={e=>setEditStudent({...editStudent, medications: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Losartana 50mg/dia"/>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Hábitos Alimentares / Alergias</label>
                        <input type="text" value={editStudent.dietary_habits} onChange={e=>setEditStudent({...editStudent, dietary_habits: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Dieta hiperproteica, sem restrições..."/>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Dados Biométricos Atuais */}
                  {editWizardStep === 2 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase block">Peso Atual (kg)</label>
                          <input type="number" step="0.1" value={editStudent.weight} onChange={e=>setEditStudent({...editStudent, weight: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 82.5"/>
                        </div>
                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase block">Altura (m)</label>
                          <input type="number" step="0.01" value={editStudent.height} onChange={e=>setEditStudent({...editStudent, height: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 1.78"/>
                        </div>
                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase block">Pressão Arterial</label>
                          <input type="text" value={editStudent.blood_pressure} onChange={e=>setEditStudent({...editStudent, blood_pressure: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 120/80"/>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase block">% de Gordura (%)</label>
                          <input type="number" step="0.1" value={editStudent.body_fat} onChange={e=>setEditStudent({...editStudent, body_fat: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 16.4"/>
                        </div>
                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase block">Massa Magra (kg)</label>
                          <input type="number" step="0.1" value={editStudent.lean_mass} onChange={e=>setEditStudent({...editStudent, lean_mass: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 68.2"/>
                        </div>
                      </div>

                      <div className="border-t border-surface-highest pt-3">
                        <h4 className="text-[10px] text-[#dfbf80] font-bold uppercase tracking-widest mb-3">Circunferências Corporais (cm)</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Cintura</label>
                            <input type="number" step="0.1" value={editStudent.waist} onChange={e=>setEditStudent({...editStudent, waist: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 85"/>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Abdômen</label>
                            <input type="number" step="0.1" value={editStudent.abdomen} onChange={e=>setEditStudent({...editStudent, abdomen: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 92"/>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Quadril</label>
                            <input type="number" step="0.1" value={editStudent.hips} onChange={e=>setEditStudent({...editStudent, hips: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 104"/>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Braço Direito</label>
                            <input type="number" step="0.1" value={editStudent.right_arm} onChange={e=>setEditStudent({...editStudent, right_arm: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 34"/>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Braço Esquerdo</label>
                            <input type="number" step="0.1" value={editStudent.left_arm} onChange={e=>setEditStudent({...editStudent, left_arm: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 34.2"/>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Coxa Direita</label>
                            <input type="number" step="0.1" value={editStudent.right_thigh} onChange={e=>setEditStudent({...editStudent, right_thigh: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 58"/>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase block">Coxa Esquerda</label>
                            <input type="number" step="0.1" value={editStudent.left_thigh} onChange={e=>setEditStudent({...editStudent, left_thigh: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 57.8"/>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Planejamento & Logística de Treino */}
                  {editWizardStep === 3 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Frequência Semanal Alvo</label>
                          <select value={editStudent.freq_target} onChange={e=>setEditStudent({...editStudent, freq_target: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                            <option value="1">1x na semana</option>
                            <option value="2">2x na semana</option>
                            <option value="3">3x na semana</option>
                            <option value="4">4x na semana</option>
                            <option value="5">5x ou mais na semana</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Duração Preferencial</label>
                          <select value={editStudent.duration_pref} onChange={e=>setEditStudent({...editStudent, duration_pref: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                            <option>30 min</option>
                            <option>45 min</option>
                            <option>60 min</option>
                            <option>mais de 60 min</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Local de Treinamento</label>
                        <select value={editStudent.training_location} onChange={e=>setEditStudent({...editStudent, training_location: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                          <option>Academia</option>
                          <option>Ar Livre</option>
                          <option>Condomínio</option>
                          <option>Casa</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-2">Dias Disponíveis para Treino</label>
                        <div className="grid grid-cols-4 gap-2">
                          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => {
                            const isChecked = editStudent.available_days.includes(day);
                            return (
                              <div 
                                key={day} 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const days = isChecked
                                    ? editStudent.available_days.filter(d => d !== day)
                                    : [...editStudent.available_days, day];
                                  setEditStudent({ ...editStudent, available_days: days });
                                }}
                                className={`flex items-center justify-center p-2 rounded-lg border text-[10px] font-bold uppercase cursor-pointer select-none transition-all ${
                                  isChecked
                                    ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(212,175,55,0.1)]'
                                    : 'bg-surface-high border-surface-highest text-zinc-500 hover:text-zinc-300'
                                }`}
                              >
                                {day}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  </div>

                  {/* Wizard Navigation Footer */}
                  <div className="flex-shrink-0 flex gap-3 pt-4 border-t border-surface-highest mt-4">
                    {editWizardStep > 0 ? (
                      <button
                        type="button"
                        onClick={() => setEditWizardStep(editWizardStep - 1)}
                        className="flex-1 py-2.5 bg-surface hover:bg-surface-high text-zinc-300 font-bold uppercase tracking-wider text-[10px] rounded-lg border border-surface-highest transition-all duration-200 active:scale-95 flex items-center justify-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowEditStudentModal(false)}
                        className="flex-1 py-2.5 bg-surface hover:bg-surface-high text-zinc-400 hover:text-white font-bold uppercase tracking-wider text-[10px] rounded-lg border border-surface-highest transition-all duration-200 active:scale-95"
                      >
                        Cancelar
                      </button>
                    )}
                    
                    {editWizardStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (editWizardStep === 0 && !editStudent.name) {
                            return showCustomAlert('Aviso', 'Nome do Aluno é obrigatório!', 'warning');
                          }
                          setEditWizardStep(editWizardStep + 1);
                        }}
                        className="flex-1 py-2.5 bg-primary text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:bg-primary-dim transition-all duration-200 active:scale-95 flex items-center justify-center gap-1"
                      >
                        Avançar <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-gradient-to-r from-primary to-primary-dim text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:scale-102 transition-all duration-200 active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                      >
                        Salvar Alterações
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          <CustomAlertModal
            isOpen={alertModal.isOpen}
            type={alertModal.type}
            title={alertModal.title}
            message={alertModal.message}
            recordName={alertModal.recordName}
            currentUser={currentUser}
            onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={alertModal.onConfirm}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-heading font-bold text-white">Alunos</h2>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="hidden md:flex bg-surface rounded-lg p-0.5 border border-surface-highest">
            <button
              onClick={() => handleToggleViewMode()}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-[#dfbf80] text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Tabela
            </button>
            <button
              onClick={() => handleToggleViewMode()}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                viewMode === 'cards' ? 'bg-[#dfbf80] text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>
          <button onClick={() => setShowNewStudentModal(true)} className="px-4 py-2 bg-primary text-black font-bold rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)]">
            <Plus className="w-4 h-4" /> Novo Aluno
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm py-4 italic animate-pulse">Carregando lista de alunos...</p>
      ) : students.length === 0 ? (
        <p className="text-zinc-500 text-sm py-4 italic">Nenhum aluno cadastrado. Clique em Novo Aluno para começar!</p>
      ) : (
        <>
          {/* Desktop Table View */}
          {viewMode === 'table' && (
            <div className="hidden md:block bg-surface-container border border-surface-highest rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-high border-b border-surface-highest text-zinc-400 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="p-4 rounded-tl-xl">Aluno</th>
                    <th className="p-4">Idade</th>
                    <th className="p-4">Objetivo</th>
                    <th className="p-4">Financeiro</th>
                    <th className="p-4">Badges</th>
                    <th className="p-4 text-right rounded-tr-xl">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-highest">
                  {students.map(s => (
                    <tr key={s.id} onClick={() => setSelectedStudent(s)} className="hover:bg-surface-high/50 transition-colors cursor-pointer group text-zinc-300">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-[#dfbf80]/30 overflow-hidden bg-surface-high flex items-center justify-center shrink-0">
                          {s.photo_avatar_url ? (
                            <img src={s.photo_avatar_url} alt={s.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-[#dfbf80]">{s.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white group-hover:text-primary transition-colors">{s.name}</div>
                          <div className={`text-xs ${s.status === 'Ativo' ? 'text-primary' : 'text-red-400'}`}>{s.status}</div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-zinc-400">{s.age}</td>
                      <td className="p-4"><span className="px-2 py-1 bg-surface rounded border border-surface-highest text-xs">{s.goal}</span></td>
                      <td className="p-4">
                         {(() => {
                            const finStatus = getStudentFinancialStatus(s.id);
                            return (
                               <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${finStatus.color}`}>
                                  {finStatus.label}
                               </span>
                            );
                         })()}
                      </td>
                      <td className="p-4">
                        <div className="flex -space-x-1">
                          {s.badges && s.badges.slice(0,3).map((b, i) => (
                            <span key={i} title={b.name} className="w-6 h-6 flex items-center justify-center bg-surface border border-surface-highest rounded-full text-xs">{b.icon}</span>
                          ))}
                          {(!s.badges || s.badges.length === 0) && <span className="text-zinc-600 text-xs">-</span>}
                        </div>
                      </td>
                      <td className="p-4 text-right space-x-2">
                         <button className="text-zinc-400 hover:text-primary transition-colors text-xs uppercase font-bold flex items-center gap-1 ml-auto">Ver Perfil <ChevronRight className="w-3.5 h-3.5"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cards View (Desktop when selected, or Mobile always) */}
          <div className={`${viewMode === 'cards' ? 'grid' : 'grid md:hidden'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
            {students.map(s => (
              <div 
                key={s.id} 
                onClick={() => setSelectedStudent(s)}
                className="bg-surface-container border border-surface-highest p-4 rounded-xl hover:border-primary/50 transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border border-[#dfbf80]/30 overflow-hidden bg-surface-high flex items-center justify-center shrink-0">
                    {s.photo_avatar_url ? (
                      <img src={s.photo_avatar_url} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base font-bold text-[#dfbf80]">{s.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base leading-tight flex flex-wrap items-center gap-2">
                      {s.name}
                      {(() => {
                          const finStatus = getStudentFinancialStatus(s.id);
                          return (
                             <span className={`px-1.5 py-0.5 border rounded text-[8px] font-bold uppercase tracking-wider whitespace-nowrap ${finStatus.color}`}>
                                {finStatus.label}
                             </span>
                          );
                      })()}
                    </h4>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${s.status === 'Ativo' ? 'text-primary' : 'text-red-400'}`}>{s.status}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-surface-highest/40 pt-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Objetivo</span>
                    <span className="px-2 py-0.5 bg-surface-high rounded border border-surface-highest text-xs text-zinc-300">{s.goal}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Badges</span>
                    <div className="flex -space-x-1 justify-end">
                      {s.badges && s.badges.slice(0, 3).map((b, i) => (
                        <span key={i} title={b.name} className="w-5 h-5 flex items-center justify-center bg-surface border border-surface-highest rounded-full text-[10px]">{b.icon}</span>
                      ))}
                      {(!s.badges || s.badges.length === 0) && <span className="text-zinc-500 text-[10px]">-</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
            {/* New Student Modal Dialog */}
      {showNewStudentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-lg w-full relative flex flex-col max-h-[90vh]">
            <button onClick={() => { setShowNewStudentModal(false); resetNewStudent(); }} className="absolute top-4 right-4 text-zinc-400 hover:text-white z-10">
              <X className="w-5 h-5"/>
            </button>
            <div className="flex-shrink-0">
              <h3 className="text-lg font-heading font-bold text-white mb-6 border-b border-surface-highest pb-2 uppercase tracking-wider">Cadastrar Novo Aluno</h3>
            
            {/* Wizard Steps Progress Bar */}
            <div className="flex items-center justify-between mb-6 px-1 select-none">
              {[
                { label: 'Cadastro', step: 0 },
                { label: 'Saúde', step: 1 },
                { label: 'Biometria', step: 2 },
                { label: 'Logística', step: 3 }
              ].map((item, idx) => (
                <React.Fragment key={item.step}>
                  <div className="flex flex-col items-center relative z-10">
                    <button
                      type="button"
                      disabled={idx > wizardStep && !newStudent.name}
                      onClick={() => setWizardStep(item.step)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase transition-all duration-300 ${
                        wizardStep === item.step
                          ? 'bg-[#dfbf80] text-black ring-4 ring-[#dfbf80]/30 shadow-[0_0_15px_rgba(223,191,128,0.4)]'
                          : wizardStep > item.step
                          ? 'bg-primary/20 text-[#dfbf80] border border-[#dfbf80]/40'
                          : 'bg-surface border border-surface-highest text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {item.step + 1}
                    </button>
                    <span className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 transition-colors ${
                      wizardStep === item.step ? 'text-[#dfbf80]' : 'text-zinc-500'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className="flex-1 h-[2px] mx-2 -mt-4 bg-surface-highest relative">
                      <div 
                        className="absolute inset-y-0 left-0 bg-[#dfbf80] transition-all duration-300"
                        style={{ width: wizardStep > item.step ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-none py-1">
              {/* Step 0: Dados Pessoais & Endereço */}
              {wizardStep === 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center mb-2">
                    <div className="relative group cursor-pointer w-16 h-16 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shadow-[0_0_12px_rgba(223,191,128,0.2)]">
                      {newStudent.photo_avatar_url ? (
                        <img src={newStudent.photo_avatar_url} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-5 h-5 text-zinc-500 group-hover:text-[#dfbf80] transition-colors" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[8px] text-white font-bold uppercase tracking-wider">Upload</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAvatarChange(e, false)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1">Foto de Perfil</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Nome Completo *</label>
                      <input required type="text" value={newStudent.name} onChange={e=>setNewStudent({...newStudent, name: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: João da Silva"/>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Data de Nascimento (Cálculo de Idade)</label>
                      <input type="date" value={newStudent.birth_date} onChange={e=>setNewStudent({...newStudent, birth_date: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">E-mail</label>
                      <input type="email" value={newStudent.email} onChange={e=>setNewStudent({...newStudent, email: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: joao@email.com"/>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Telefone / Celular</label>
                      <input type="text" value={newStudent.phone_number} onChange={e=>setNewStudent({...newStudent, phone_number: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: 5511999999999"/>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1 px-1">
                    <input 
                      type="checkbox" 
                      id="is_whatsapp"
                      checked={newStudent.is_whatsapp} 
                      onChange={e => setNewStudent({ ...newStudent, is_whatsapp: e.target.checked })} 
                      className="w-4 h-4 rounded border-surface-highest bg-surface-high text-primary focus:ring-primary accent-primary"
                    />
                    <label htmlFor="is_whatsapp" className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider cursor-pointer select-none">
                      Este número é o mesmo do WhatsApp?
                    </label>
                  </div>

                  <div className="border-t border-surface-highest pt-3">
                    <h4 className="text-[10px] text-[#dfbf80] font-bold uppercase tracking-widest mb-3">Endereço Completo</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Rua / Avenida</label>
                        <input type="text" value={newStudent.street} onChange={e=>setNewStudent({...newStudent, street: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Rua das Flores"/>
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Número</label>
                        <input type="text" value={newStudent.number} onChange={e=>setNewStudent({...newStudent, number: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: 123"/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Complemento</label>
                        <input type="text" value={newStudent.complement} onChange={e=>setNewStudent({...newStudent, complement: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Apto 45"/>
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Bairro</label>
                        <input type="text" value={newStudent.neighborhood} onChange={e=>setNewStudent({...newStudent, neighborhood: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Centro"/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Cidade</label>
                        <input type="text" value={newStudent.city} onChange={e=>setNewStudent({...newStudent, city: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: São Paulo"/>
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Estado (UF)</label>
                        <input type="text" value={newStudent.state} onChange={e=>setNewStudent({...newStudent, state: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: SP"/>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Anamnese & Histórico de Saúde */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Objetivo Principal *</label>
                      <select value={newStudent.goal} onChange={e=>setNewStudent({...newStudent, goal: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                        <option value="">Selecione...</option>
                        <option>Emagrecimento</option>
                        <option>Hipertrofia</option>
                        <option>Condicionamento Físico</option>
                        <option>Reabilitação Física</option>
                        <option>Saúde e Qualidade de Vida</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Nível de Atividade Atual</label>
                      <select value={newStudent.activity_level} onChange={e=>setNewStudent({...newStudent, activity_level: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                        <option>Sedentário</option>
                        <option>Levemente Ativo</option>
                        <option>Moderadamente Ativo</option>
                        <option>Muito Ativo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Biotipo Corporal</label>
                      <select value={newStudent.biotype} onChange={e=>setNewStudent({...newStudent, biotype: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                        <option>Mesomorfo</option>
                        <option>Endomorfo</option>
                        <option>Ectomorfo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Status Inicial</label>
                      <select value={newStudent.status} onChange={e=>setNewStudent({...newStudent, status: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                        <option>Ativo</option>
                        <option>Inativo</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Histórico Médico (Doenças, Cardíaco, Hipertensão)</label>
                    <textarea value={newStudent.medical_history} onChange={e=>setNewStudent({...newStudent, medical_history: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs h-16 resize-none outline-none focus:border-primary" placeholder="Ex: Hipertensão leve controlada, histórico de asma."/>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Lesões ou Restrições Físicas (Dores, Cirurgias)</label>
                    <textarea value={newStudent.injuries} onChange={e=>setNewStudent({...newStudent, injuries: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs h-16 resize-none outline-none focus:border-primary" placeholder="Ex: Cirurgia no joelho esquerdo, dor lombar esporádica ao correr."/>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Uso de Medicamentos Contínuos</label>
                    <input type="text" value={newStudent.medications} onChange={e=>setNewStudent({...newStudent, medications: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Losartana 50mg/dia"/>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Hábitos Alimentares / Alergias</label>
                    <input type="text" value={newStudent.dietary_habits} onChange={e=>setNewStudent({...newStudent, dietary_habits: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary" placeholder="Ex: Dieta hiperproteica, sem restrições..."/>
                  </div>
                </div>
              )}

              {/* Step 2: Dados Biométricos Atuais */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase block">Peso Atual (kg)</label>
                      <input type="number" step="0.1" value={newStudent.weight} onChange={e=>setNewStudent({...newStudent, weight: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 82.5"/>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase block">Altura (m)</label>
                      <input type="number" step="0.01" value={newStudent.height} onChange={e=>setNewStudent({...newStudent, height: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 1.78"/>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase block">Pressão Arterial</label>
                      <input type="text" value={newStudent.blood_pressure} onChange={e=>setNewStudent({...newStudent, blood_pressure: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 120/80"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase block">% de Gordura (%)</label>
                      <input type="number" step="0.1" value={newStudent.body_fat} onChange={e=>setNewStudent({...newStudent, body_fat: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 16.4"/>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase block">Massa Magra (kg)</label>
                      <input type="number" step="0.1" value={newStudent.lean_mass} onChange={e=>setNewStudent({...newStudent, lean_mass: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 68.2"/>
                    </div>
                  </div>

                  <div className="border-t border-surface-highest pt-3">
                    <h4 className="text-[10px] text-[#dfbf80] font-bold uppercase tracking-widest mb-3">Circunferências Corporais (cm)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Cintura</label>
                        <input type="number" step="0.1" value={newStudent.waist} onChange={e=>setNewStudent({...newStudent, waist: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 85"/>
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Abdômen</label>
                        <input type="number" step="0.1" value={newStudent.abdomen} onChange={e=>setNewStudent({...newStudent, abdomen: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 92"/>
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Quadril</label>
                        <input type="number" step="0.1" value={newStudent.hips} onChange={e=>setNewStudent({...newStudent, hips: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 104"/>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Braço Direito</label>
                        <input type="number" step="0.1" value={newStudent.right_arm} onChange={e=>setNewStudent({...newStudent, right_arm: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 34"/>
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Braço Esquerdo</label>
                        <input type="number" step="0.1" value={newStudent.left_arm} onChange={e=>setNewStudent({...newStudent, left_arm: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 34.2"/>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Coxa Direita</label>
                        <input type="number" step="0.1" value={newStudent.right_thigh} onChange={e=>setNewStudent({...newStudent, right_thigh: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 58"/>
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-400 font-bold uppercase block">Coxa Esquerda</label>
                        <input type="number" step="0.1" value={newStudent.left_thigh} onChange={e=>setNewStudent({...newStudent, left_thigh: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary font-mono" placeholder="Ex: 57.8"/>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Planejamento & Logística de Treino */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Frequência Semanal Alvo</label>
                      <select value={newStudent.freq_target} onChange={e=>setNewStudent({...newStudent, freq_target: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                        <option value="1">1x na semana</option>
                        <option value="2">2x na semana</option>
                        <option value="3">3x na semana</option>
                        <option value="4">4x na semana</option>
                        <option value="5">5x ou mais na semana</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Duração Preferencial</label>
                      <select value={newStudent.duration_pref} onChange={e=>setNewStudent({...newStudent, duration_pref: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                        <option>30 min</option>
                        <option>45 min</option>
                        <option>60 min</option>
                        <option>mais de 60 min</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Local de Treinamento</label>
                    <select value={newStudent.training_location} onChange={e=>setNewStudent({...newStudent, training_location: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 text-white text-xs outline-none focus:border-primary">
                      <option>Academia</option>
                      <option>Ar Livre</option>
                      <option>Condomínio</option>
                      <option>Casa</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-2">Dias Disponíveis para Treino</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => {
                        const isChecked = newStudent.available_days.includes(day);
                        return (
                          <div 
                            key={day} 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const days = isChecked
                                ? newStudent.available_days.filter(d => d !== day)
                                : [...newStudent.available_days, day];
                              setNewStudent({ ...newStudent, available_days: days });
                            }}
                            className={`flex items-center justify-center p-2 rounded-lg border text-[10px] font-bold uppercase cursor-pointer select-none transition-all ${
                              isChecked
                                ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(212,175,55,0.15)]'
                                : 'bg-surface-high border-surface-highest text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              </div>

              {/* Wizard Navigation Footer */}
              <div className="flex-shrink-0 flex gap-3 pt-4 border-t border-surface-highest mt-4">
                {wizardStep > 0 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="flex-1 py-2.5 bg-surface hover:bg-surface-high text-zinc-300 font-bold uppercase tracking-wider text-[10px] rounded-lg border border-surface-highest transition-all duration-200 active:scale-95 flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewStudentModal(false)}
                    className="flex-1 py-2.5 bg-surface hover:bg-surface-high text-zinc-400 hover:text-white font-bold uppercase tracking-wider text-[10px] rounded-lg border border-surface-highest transition-all duration-200 active:scale-95"
                  >
                    Cancelar
                  </button>
                )}
                
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 0 && !newStudent.name) {
                        return showCustomAlert('Aviso', 'Nome do Aluno é obrigatório!', 'warning');
                      }
                      setWizardStep(wizardStep + 1);
                    }}
                    className="flex-1 py-2.5 bg-primary text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:bg-primary-dim transition-all duration-200 active:scale-95 flex items-center justify-center gap-1"
                  >
                    Avançar <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-primary to-primary-dim text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:scale-102 transition-all duration-200 active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                  >
                    Finalizar Cadastro
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Success Animation Modal Dialog */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-surface-container border border-[#dfbf80]/30 rounded-2xl p-8 max-w-sm w-full text-center space-y-6 shadow-[0_0_50px_rgba(223,191,128,0.2)] relative overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none">
              <ParticleEffect onComplete={() => {}} />
            </div>

            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#dfbf80]/20 to-[#dfbf80]/5 border border-[#dfbf80]/40 flex items-center justify-center text-primary mx-auto shadow-[0_0_20px_rgba(223,191,128,0.3)]">
              <CheckCircle2 className="w-8 h-8 animate-bounce text-[#dfbf80]" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-heading font-bold text-white uppercase tracking-wider">Cadastro Concluído!</h3>
              <p className="text-xs text-zinc-300">
                O perfil de evolução corporal de <strong className="text-[#dfbf80]">{registeredStudentName}</strong> está pronto para receber o primeiro plano de aula!
              </p>
            </div>

            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-3 bg-gradient-to-r from-primary to-primary-dim text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:scale-102 transition-all shadow-[0_4px_15px_rgba(212,175,55,0.3)] active:scale-98"
            >
              Vamos Começar
            </button>
          </motion.div>
        </div>
      )}



      <CustomAlertModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        recordName={alertModal.recordName}
        currentUser={currentUser}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
}
