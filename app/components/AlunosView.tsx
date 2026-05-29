import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Award, CheckCircle2, Camera, Plus, X, MessageSquare, CreditCard, Trash2, History } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Student, User, Anamnesis } from '../types';
import { supabase } from '../utils/supabase';
import CustomAlertModal from './CustomAlertModal';

interface AlunosViewProps {
  currentUser: User | null;
}

export default function AlunosView({ currentUser }: AlunosViewProps) {
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  // New Student Form Modal States
  const [showNewStudentModal, setShowNewStudentModal] = useState<boolean>(false);
  const [newStudent, setNewStudent] = useState({
    name: '',
    age: '',
    goal: '',
    biotype: 'Mesomorfo',
    status: 'Ativo',
    phone_number: '',
    telegram_chat_id: ''
  });

  const [studentPhone, setStudentPhone] = useState<string>('');
  const [studentTelegramId, setStudentTelegramId] = useState<string>('');
  const [savingContacts, setSavingContacts] = useState<boolean>(false);

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loadingEvals, setLoadingEvals] = useState<boolean>(false);
  const [activeMetric, setActiveMetric] = useState<'weight' | 'body_fat' | 'heart_rate'>('weight');

  // Tab and Anamnesis State
  const [activeProfileTab, setActiveProfileTab] = useState<'general' | 'anamnesis'>('general');
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [loadingAnamnesis, setLoadingAnamnesis] = useState<boolean>(false);
  const [savingAnamnesis, setSavingAnamnesis] = useState<boolean>(false);

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
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      setPhoto(selectedStudent.photo_url || null);
      setStudentPhone(selectedStudent.phone_number || '');
      setStudentTelegramId(selectedStudent.telegram_chat_id || '');
      fetchStudentEvaluations(selectedStudent.id);
      fetchAnamnesis(selectedStudent.id);
      setActiveProfileTab('general');
    } else {
      setPhoto(null);
      setStudentPhone('');
      setStudentTelegramId('');
      setEvaluations([]);
      setAnamnesis(null);
    }
    return () => stopCamera();
  }, [selectedStudent]);

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
      if (videoRef.current) videoRef.current.srcObject = ms;
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

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.age || !newStudent.goal) {
      return showCustomAlert('Aviso', 'Preencha os campos obrigatórios!', 'warning');
    }

    const ageNum = parseInt(newStudent.age);
    if (isNaN(ageNum) || ageNum <= 0) {
      return showCustomAlert('Aviso', 'Idade precisa ser um número válido!', 'warning');
    }

    try {
      const { error } = await supabase
        .from('students')
        .insert([{
          name: newStudent.name,
          age: ageNum,
          goal: newStudent.goal,
          biotype: newStudent.biotype,
          status: newStudent.status,
          badges: [],
          imc: 22.5,
          phone_number: newStudent.phone_number || null,
          telegram_chat_id: newStudent.telegram_chat_id || null
        }]);

      if (error) {
        showCustomAlert('Erro', 'Erro ao cadastrar aluno: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Aluno cadastrado com sucesso!', 'success');
        setShowNewStudentModal(false);
        setNewStudent({ name: '', age: '', goal: '', biotype: 'Mesomorfo', status: 'Ativo', phone_number: '', telegram_chat_id: '' });
        fetchStudents();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao cadastrar aluno.', 'error');
    }
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
        
        <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
           <div className="mb-8">
             <h1 className="font-heading font-bold text-3xl text-white">{selectedStudent.name}</h1>
             <p className="text-zinc-400 capitalize mt-1 text-sm">{selectedStudent.goal} • {selectedStudent.age} anos • {selectedStudent.biotype}</p>
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
           <div className="flex border-b border-surface-highest mb-6">
             <button
               onClick={() => {
                 setActiveProfileTab('general');
                 stopCamera();
               }}
               className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
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
               className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
                 activeProfileTab === 'anamnesis'
                   ? 'text-primary border-primary bg-primary/5'
                   : 'text-zinc-400 border-transparent hover:text-white'
               }`}
             >
               Anamnese & Avaliação Postural
             </button>
           </div>

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
                           <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">WhatsApp (DDD + Número, sem símbolos)</label>
                           <input 
                              type="text" 
                              value={studentPhone} 
                              onChange={e => setStudentPhone(e.target.value)} 
                              className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-sm outline-none focus:border-primary font-mono"
                              placeholder="Ex: 5511999999999"
                           />
                        </div>
                        <div>
                           <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Telegram Chat ID (código numérico)</label>
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
                           <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl border border-surface-highest bg-black object-cover aspect-[3/4] md:aspect-video"></video>
                           <canvas ref={canvasRef} width="640" height="480" className="hidden"></canvas>
                           <div className="flex gap-2">
                              <button onClick={capturePhoto} className="flex-1 bg-gradient-to-r from-primary to-primary-dim text-black font-bold py-3 rounded hover:opacity-90 transition-opacity text-xs uppercase tracking-wider">📸 Tirar Foto</button>
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
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Restrições Médicas / Lesões / Dores</label>
                       <textarea
                         value={anamnesis.medical_restrictions || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, medical_restrictions: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Condromalácia patelar grau 1, dor lombar leve..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Histórico de Cirurgias</label>
                       <textarea
                         value={anamnesis.surgical_history || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, surgical_history: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Artroscopia no joelho direito em 2022..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Condições Cardiovasculares (Pressão, Coração)</label>
                       <textarea
                         value={anamnesis.cardio_condition || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, cardio_condition: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Hipertensão leve controlada..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Medicamentos em Uso</label>
                       <textarea
                         value={anamnesis.medications || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, medications: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Beta-bloqueador pela manhã..."
                       />
                     </div>

                     <div>
                       <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Hábitos Alimentares / Alergias</label>
                       <textarea
                         value={anamnesis.dietary_habits || ''}
                         onChange={e => setAnamnesis({ ...anamnesis, dietary_habits: e.target.value })}
                         className="w-full bg-surface border border-surface-highest rounded px-3 py-2 mt-1 text-white text-xs outline-none focus:border-primary h-16 resize-none"
                         placeholder="Ex: Alergia a frutos do mar, dieta hiperproteica..."
                       />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Consumo Diário de Água (L)</label>
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
                         <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Nível de Flexibilidade</label>
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
                         <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl border border-surface-highest bg-black object-cover aspect-[3/4]"></video>
                         <canvas ref={canvasRef} width="640" height="480" className="hidden"></canvas>
                         <div className="flex gap-2">
                           <button onClick={capturePhoto} className="flex-1 bg-gradient-to-r from-primary to-primary-dim text-black font-bold py-3 rounded hover:opacity-90 transition-opacity text-xs uppercase tracking-wider">📸 Tirar Foto</button>
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
                             <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">Grade Postural (ON/OFF)</span>
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
                                 <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
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
                                 <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
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
