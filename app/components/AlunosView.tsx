import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Award, CheckCircle2, Camera, Plus, X, MessageSquare, CreditCard, Trash2, History } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { Student, User, Anamnesis, StudentGoal } from '../types';
import { supabase } from '../utils/supabase';
import { exportAnamnesisPDF, exportPosturePDF, exportEvolutionPDF, exportFrequencyPDF } from '../utils/pdf';
import { queueOfflineOperation, runOfflineSync } from '../utils/offline';
import CustomAlertModal from './CustomAlertModal';

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
  const [newStudent, setNewStudent] = useState({
    name: '',
    age: '',
    goal: '',
    biotype: 'Mesomorfo',
    status: 'Ativo',
    phone_number: '',
    telegram_chat_id: '',
    photo_avatar_url: ''
  });

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
    photo_avatar_url: ''
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
        showCustomAlert('Sucesso', 'Agendamento confirmado com sucesso!', 'success');
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
      queueOfflineOperation('update_schedule_status', {
        id: scheduleId,
        update: {
          status: 'Sugerido',
          suggested_date: sugDateInput,
          suggested_time: sugTimeInput
        }
      });
      showCustomAlert('Modo Offline', 'Sugestão registrada localmente! Sincronização automática pendente.', 'info');
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, status: 'Sugerido', suggested_date: sugDateInput, suggested_time: sugTimeInput } : s));
      setSuggestingScheduleId(null);
      setSugDateInput('');
      setSugTimeInput('');
      return;
    }
    try {
      const { error } = await supabase
        .from('evaluation_schedules')
        .update({
          status: 'Sugerido',
          suggested_date: sugDateInput,
          suggested_time: sugTimeInput
        })
        .eq('id', scheduleId);

      if (error) {
        showCustomAlert('Erro', 'Erro ao sugerir data: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Nova data sugerida enviada ao aluno!', 'success');
        setSuggestingScheduleId(null);
        setSugDateInput('');
        setSugTimeInput('');
        if (selectedStudent) {
          fetchStudentSchedules(selectedStudent.id);
        }
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro ao sugerir nova data.', 'error');
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
    if (!newStudent.name || !newStudent.age || !newStudent.goal) {
      return showCustomAlert('Aviso', 'Preencha os campos obrigatórios!', 'warning');
    }

    const ageNum = parseInt(newStudent.age);
    if (isNaN(ageNum) || ageNum <= 0) {
      return showCustomAlert('Aviso', 'Idade precisa ser um número válido!', 'warning');
    }

    const studentPayload = {
      name: newStudent.name,
      age: ageNum,
      goal: newStudent.goal,
      biotype: newStudent.biotype,
      status: newStudent.status,
      badges: [],
      imc: 22.5,
      phone_number: newStudent.phone_number || null,
      telegram_chat_id: newStudent.telegram_chat_id || null,
      photo_avatar_url: newStudent.photo_avatar_url || null
    };

    if (!navigator.onLine) {
      queueOfflineOperation('add_student', studentPayload);
      showCustomAlert('Modo Offline', 'Aluno cadastrado localmente! Sincronização automática pendente.', 'info');
      setShowNewStudentModal(false);
      setNewStudent({ name: '', age: '', goal: '', biotype: 'Mesomorfo', status: 'Ativo', phone_number: '', telegram_chat_id: '', photo_avatar_url: '' });
      setStudents(prev => [...prev, { ...studentPayload, id: 'temp_' + Date.now() }]);
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .insert([studentPayload]);

      if (error) {
        showCustomAlert('Erro', 'Erro ao cadastrar aluno: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Aluno cadastrado com sucesso!', 'success');
        setShowNewStudentModal(false);
        setNewStudent({ name: '', age: '', goal: '', biotype: 'Mesomorfo', status: 'Ativo', phone_number: '', telegram_chat_id: '', photo_avatar_url: '' });
        fetchStudents();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao cadastrar aluno.', 'error');
    }
  };

  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent.name || !editStudent.age || !editStudent.goal) {
      return showCustomAlert('Aviso', 'Preencha os campos obrigatórios!', 'warning');
    }

    const ageNum = parseInt(editStudent.age);
    if (isNaN(ageNum) || ageNum <= 0) {
      return showCustomAlert('Aviso', 'Idade precisa ser um número válido!', 'warning');
    }

    const updatePayload = {
      name: editStudent.name,
      age: ageNum,
      goal: editStudent.goal,
      biotype: editStudent.biotype,
      status: editStudent.status,
      phone_number: editStudent.phone_number || null,
      telegram_chat_id: editStudent.telegram_chat_id || null,
      photo_avatar_url: editStudent.photo_avatar_url || null
    };

    if (!navigator.onLine) {
      queueOfflineOperation('update_student_profile', {
        id: editStudent.id,
        update: updatePayload
      });
      showCustomAlert('Modo Offline', 'Alterações do aluno registradas localmente! Sincronização automática pendente.', 'info');
      setShowEditStudentModal(false);
      const updatedStudent = {
        ...selectedStudent!,
        name: editStudent.name,
        age: ageNum,
        goal: editStudent.goal,
        biotype: editStudent.biotype,
        status: editStudent.status,
        phone_number: editStudent.phone_number || undefined,
        telegram_chat_id: editStudent.telegram_chat_id || undefined,
        photo_avatar_url: editStudent.photo_avatar_url || undefined
      };
      setSelectedStudent(updatedStudent);
      setStudents(prev => prev.map(s => s.id.toString() === editStudent.id ? { ...s, ...updatePayload } : s));
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update(updatePayload)
        .eq('id', editStudent.id);

      if (error) {
        showCustomAlert('Erro', 'Erro ao atualizar aluno: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Dados do aluno atualizados com sucesso!', 'success');
        setShowEditStudentModal(false);
        const updatedStudent = {
          ...selectedStudent!,
          name: editStudent.name,
          age: ageNum,
          goal: editStudent.goal,
          biotype: editStudent.biotype,
          status: editStudent.status,
          phone_number: editStudent.phone_number || undefined,
          telegram_chat_id: editStudent.telegram_chat_id || undefined,
          photo_avatar_url: editStudent.photo_avatar_url || undefined
        };
        setSelectedStudent(updatedStudent);
        fetchStudents();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao atualizar aluno.', 'error');
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
                      name: selectedStudent.name,
                      age: selectedStudent.age.toString(),
                      goal: selectedStudent.goal,
                      biotype: selectedStudent.biotype,
                      status: selectedStudent.status,
                      phone_number: selectedStudent.phone_number || '',
                      telegram_chat_id: selectedStudent.telegram_chat_id || '',
                      photo_avatar_url: selectedStudent.photo_avatar_url || ''
                    });
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

            {/* Horizontal scrollability wrapper for active tabs content on mobile */}
            <div className="overflow-x-auto w-full scrollbar-none">
              <div className="min-w-[700px] md:min-w-0">
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
                                    }}
                                    className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Propor Nova Data
                                  </button>
                                  <button
                                    onClick={() => handleUpdateScheduleStatus(sch.id, 'Cancelado')}
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
                                    onClick={() => handleUpdateScheduleStatus(sch.id, 'Cancelado')}
                                    className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}

                              {sch.status === 'Confirmado' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateScheduleStatus(sch.id, 'Realizado')}
                                    className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Concluir
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSuggestingScheduleId(sch.id);
                                      setSugDateInput(sch.scheduled_date);
                                      setSugTimeInput(sch.scheduled_time.slice(0, 5));
                                    }}
                                    className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Propor Nova Data
                                  </button>
                                  <button
                                    onClick={() => handleUpdateScheduleStatus(sch.id, 'Cancelado')}
                                    className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}

                              {sch.status === 'Sugerido' && (
                                <button
                                  onClick={() => handleUpdateScheduleStatus(sch.id, 'Cancelado')}
                                  className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                >
                                  Cancelar Proposta
                                </button>
                              )}
                            </div>
                          </div>

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
                              <div className="flex justify-end gap-2 text-xs font-bold uppercase tracking-wider">
                                <button 
                                  onClick={() => handleSuggestSchedule(sch.id)}
                                  className="px-3 py-1.5 bg-primary text-black rounded hover:bg-primary-dim transition-colors text-[10px]"
                                >
                                  Enviar Proposta
                                </button>
                                <button 
                                  onClick={() => setSuggestingScheduleId(null)}
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
         {showEditStudentModal && selectedStudent && (
           <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative">
               <button onClick={() => setShowEditStudentModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
                 <X className="w-5 h-5"/>
               </button>
               <h3 className="text-xl font-heading font-bold text-white mb-6 border-b border-surface-highest pb-2">Editar Dados do Aluno</h3>
               <form onSubmit={handleEditStudentSubmit} className="space-y-4">
                 <div className="flex flex-col items-center justify-center mb-4">
                   <div className="relative group cursor-pointer w-20 h-20 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shadow-[0_0_15px_rgba(223,191,128,0.2)]">
                     {editStudent.photo_avatar_url ? (
                       <img src={editStudent.photo_avatar_url} alt="Avatar Preview" className="w-full h-full object-cover" />
                     ) : (
                       <Camera className="w-6 h-6 text-zinc-500 group-hover:text-[#dfbf80] transition-colors" />
                     )}
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                       <span className="text-[9px] text-white font-bold uppercase tracking-wider">Upload</span>
                     </div>
                     <input
                       type="file"
                       accept="image/*"
                       onChange={(e) => handleAvatarChange(e, true)}
                       className="absolute inset-0 opacity-0 cursor-pointer"
                     />
                   </div>
                   <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1.5">Foto de Perfil</span>
                 </div>
                 <div>
                   <label className="text-xs text-zinc-400 uppercase font-bold">Nome do Aluno *</label>
                   <input required type="text" value={editStudent.name} onChange={e=>setEditStudent({...editStudent, name: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: João da Silva"/>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs text-zinc-400 uppercase font-bold">Idade *</label>
                     <input required type="number" value={editStudent.age} onChange={e=>setEditStudent({...editStudent, age: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: 27"/>
                   </div>
                   <div>
                     <label className="text-xs text-zinc-400 uppercase font-bold">Biotipo</label>
                     <select value={editStudent.biotype} onChange={e=>setEditStudent({...editStudent, biotype: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary">
                       <option>Mesomorfo</option>
                       <option>Endomorfo</option>
                       <option>Ectomorfo</option>
                     </select>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs text-zinc-400 uppercase font-bold">Objetivo *</label>
                   <input required type="text" value={editStudent.goal} onChange={e=>setEditStudent({...editStudent, goal: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: Hipertrofia ou Perda de Peso"/>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs text-zinc-400 uppercase font-bold">WhatsApp (com DDD)</label>
                     <input type="text" value={editStudent.phone_number} onChange={e=>setEditStudent({...editStudent, phone_number: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: 5511999999999"/>
                   </div>
                   <div>
                     <label className="text-xs text-zinc-400 uppercase font-bold">Telegram Chat ID</label>
                     <input type="text" value={editStudent.telegram_chat_id} onChange={e=>setEditStudent({...editStudent, telegram_chat_id: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: 987654321"/>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs text-zinc-400 uppercase font-bold">Status</label>
                   <select value={editStudent.status} onChange={e=>setEditStudent({...editStudent, status: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary">
                     <option>Ativo</option>
                     <option>Inativo</option>
                   </select>
                 </div>
                 <button type="submit" className="w-full py-3 mt-4 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)]">Salvar Alterações</button>
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-white">Alunos</h2>
        <button onClick={() => setShowNewStudentModal(true)} className="px-4 py-2 bg-primary text-black font-bold rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)]">
          <Plus className="w-4 h-4" /> Novo Aluno
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm py-4 italic animate-pulse">Carregando lista de alunos...</p>
      ) : students.length === 0 ? (
        <p className="text-zinc-500 text-sm py-4 italic">Nenhum aluno cadastrado. Clique em Novo Aluno para começar!</p>
      ) : (
        <>
          {/* Desktop Table View */}
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
                    <td className="p-4">
                       <div className="font-medium text-white group-hover:text-primary transition-colors">{s.name}</div>
                       <div className={`text-xs ${s.status === 'Ativo' ? 'text-primary' : 'text-red-400'}`}>{s.status}</div>
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
                       <button className="text-zinc-400 hover:text-primary transition-colors text-xs uppercase font-bold flex items-center gap-1 ml-auto">Ver Perfil <ChevronRight className="w-3 h-3"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {students.map(s => (
              <div 
                key={s.id} 
                onClick={() => setSelectedStudent(s)}
                className="bg-surface-container border border-surface-highest p-4 rounded-xl hover:border-primary/50 transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
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
                  <span className="text-xs bg-surface-high border border-surface-highest px-2 py-1 rounded text-zinc-400 font-medium">{s.age} anos</span>
                </div>

                <div className="flex justify-between items-center border-t border-surface-highest/40 pt-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Objetivo</span>
                    <span className="px-2 py-0.5 bg-surface-high rounded border border-surface-highest text-xs text-zinc-300">{s.goal}</span>
                  </div>
                  
                  {s.badges && s.badges.length > 0 && (
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5 text-right">Badges</span>
                      <div className="flex gap-1 justify-end">
                        {s.badges.slice(0, 3).map((b, i) => (
                          <span key={i} title={b.name} className="w-6 h-6 flex items-center justify-center bg-surface-high border border-surface-highest rounded-full text-xs">{b.icon}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-1 text-right">
                  <span className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1 justify-end">
                    Ver Perfil <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New Student Modal Dialog */}
      {showNewStudentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative">
            <button onClick={() => setShowNewStudentModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
              <X className="w-5 h-5"/>
            </button>
            <h3 className="text-xl font-heading font-bold text-white mb-6 border-b border-surface-highest pb-2">Cadastrar Novo Aluno</h3>
            <form onSubmit={handleAddStudentSubmit} className="space-y-4">
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="relative group cursor-pointer w-20 h-20 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shadow-[0_0_15px_rgba(223,191,128,0.2)]">
                  {newStudent.photo_avatar_url ? (
                    <img src={newStudent.photo_avatar_url} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-zinc-500 group-hover:text-[#dfbf80] transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[9px] text-white font-bold uppercase tracking-wider">Upload</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAvatarChange(e, false)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1.5">Foto de Perfil</span>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase font-bold">Nome do Aluno *</label>
                <input required type="text" value={newStudent.name} onChange={e=>setNewStudent({...newStudent, name: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: João da Silva"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Idade *</label>
                  <input required type="number" value={newStudent.age} onChange={e=>setNewStudent({...newStudent, age: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: 27"/>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Biotipo</label>
                  <select value={newStudent.biotype} onChange={e=>setNewStudent({...newStudent, biotype: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary">
                    <option>Mesomorfo</option>
                    <option>Endomorfo</option>
                    <option>Ectomorfo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase font-bold">Objetivo *</label>
                <input required type="text" value={newStudent.goal} onChange={e=>setNewStudent({...newStudent, goal: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: Hipertrofia ou Perda de Peso"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">WhatsApp (com DDD)</label>
                  <input type="text" value={newStudent.phone_number} onChange={e=>setNewStudent({...newStudent, phone_number: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: 5511999999999"/>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Telegram Chat ID</label>
                  <input type="text" value={newStudent.telegram_chat_id} onChange={e=>setNewStudent({...newStudent, telegram_chat_id: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: 987654321"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase font-bold">Status Inicial</label>
                <select value={newStudent.status} onChange={e=>setNewStudent({...newStudent, status: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary">
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>
              <button type="submit" className="w-full py-3 mt-4 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)]">Salvar Aluno</button>
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
