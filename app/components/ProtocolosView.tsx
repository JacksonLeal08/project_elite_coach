import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Zap, Settings, Download, Share2, Dumbbell, Plus, Trash2, Minimize2, Maximize2, Activity, ShieldAlert, CheckCircle2, Cpu, Sparkles } from 'lucide-react';
import { generatePDFAndShare } from '../utils/pdf';
import { HistoryEntry, WorkoutData } from '../types';
import { supabase } from '../utils/supabase';

export default function ProtocolosView() {
  const loadDraft = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('elite_coach_protocol_draft');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing protocol draft', e);
        }
      }
    }
    return null;
  };

  const draft = loadDraft();

  const [student, setStudent] = useState<string>(draft?.student || '');
  const [objective, setObjective] = useState<string>(draft?.objective || '');
  const [split, setSplit] = useState<string>(draft?.split || 'ABC');
  const [days, setDays] = useState<string>(draft?.days || '3');
  const [needs, setNeeds] = useState<string>(draft?.needs || '');
  const [durationWeeks, setDurationWeeks] = useState<string>(draft?.durationWeeks || '4');
  const [weight, setWeight] = useState<string>(draft?.weight || '');
  const [height, setHeight] = useState<string>(draft?.height || '');
  const [imc, setImc] = useState<string>(draft?.imc || '');
  const [clinicalNotes, setClinicalNotes] = useState<string>(draft?.clinicalNotes || '');
  const [startDate, setStartDate] = useState<string>(draft?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(draft?.endDate || '');

  useEffect(() => {
    if (startDate && durationWeeks) {
      const weeks = parseInt(durationWeeks, 10);
      if (!isNaN(weeks) && weeks > 0) {
        const start = new Date(startDate + 'T12:00:00');
        start.setDate(start.getDate() + (weeks * 7));
        setEndDate(start.toISOString().split('T')[0]);
      }
    }
  }, [startDate, durationWeeks]);
  
  // Creation Mode & Autocomplete States
  const [creationMode, setCreationMode] = useState<'ia' | 'manual'>('ia');
  const [focusedInput, setFocusedInput] = useState<{ dayIdx: number, exIdx: number } | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showCustomAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info'
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  useEffect(() => {
    const data = { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes, startDate, endDate };
    localStorage.setItem('elite_coach_protocol_draft', JSON.stringify(data));
  }, [student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes, startDate, endDate]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isTelemetryMinimized, setIsTelemetryMinimized] = useState<boolean>(false);
  const [telemetryStep, setTelemetryStep] = useState<number>(1);
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null);
  const [activeMetadata, setActiveMetadata] = useState<{
    student: string;
    objective: string;
    durationWeeks: string;
    weight: string;
    height: string;
    imc: string;
    clinicalNotes: string;
  } | null>(draft ? {
    student: draft.student || '',
    objective: draft.objective || '',
    durationWeeks: draft.durationWeeks || '4',
    weight: draft.weight || '',
    height: draft.height || '',
    imc: draft.imc || '',
    clinicalNotes: draft.clinicalNotes || ''
  } : null);

  const handleClearParameters = () => {
    setStudent('');
    setObjective('');
    setSplit('ABC');
    setDays('3');
    setNeeds('');
    setDurationWeeks('4');
    setWeight('');
    setHeight('');
    setImc('');
    setClinicalNotes('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setWorkoutData(null);
    setSelectedStudentAnamnesis(null);
    setActiveMetadata(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('elite_coach_protocol_draft');
    }
    showCustomAlert("Limpo", "Todos os parâmetros do formulário foram limpos.", "info");
  };

  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);
  const [sendNotification, setSendNotification] = useState<boolean>(true);
  const [whatsappLink, setWhatsappLink] = useState<string>('');

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState<boolean>(false);
  const [selectedStudentAnamnesis, setSelectedStudentAnamnesis] = useState<any | null>(null);

  const fetchStudentsList = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('id, name')
        .order('name', { ascending: true });
      if (data) {
        setStudentsList(data);
      }
    } catch (e) {
      console.error('Error fetching students list:', e);
    }
  };

  const fetchExerciseLibrary = async () => {
    try {
      const { data } = await supabase
        .from('exercise_library')
        .select('*')
        .order('name', { ascending: true });
      if (data) {
        setExerciseLibrary(data);
      }
    } catch (e) {
      console.error('Error fetching exercise library:', e);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('workout_protocols')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching protocols history:', error);
      } else if (data) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          student: item.student_name,
          objective: item.objective,
          split: item.split,
          days: item.days,
          durationWeeks: item.duration_weeks,
          weight: item.weight,
          height: item.height,
          imc: item.imc,
          clinicalNotes: item.clinical_notes,
          needs: item.needs,
          workoutData: item.workout_data,
          date: item.date,
          startDate: item.start_date,
          endDate: item.end_date
        }));
        setHistory(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchExerciseLibrary();
    fetchStudentsList();
  }, []);

  const handleModeChange = (mode: 'ia' | 'manual') => {
    setCreationMode(mode);
    if (mode === 'manual' && !workoutData) {
      setWorkoutData({
        days: [
          { dayName: 'TREINO A', exercises: [{ name: '', sets: '4', reps: '10', rest: '60s', notes: '' }] }
        ]
      });
      setActiveDayIdx(0);
    }
  };

  // Workspace Actions
  const addExercise = () => {
    if (!workoutData) return;
    const newData = { ...workoutData };
    newData.days[activeDayIdx].exercises.push({
      name: '',
      sets: '4',
      reps: '10',
      rest: '60s',
      notes: ''
    });
    setWorkoutData(newData);
  };

  const removeExercise = (idx: number) => {
    if (!workoutData) return;
    const newData = { ...workoutData };
    newData.days[activeDayIdx].exercises.splice(idx, 1);
    setWorkoutData(newData);
  };

  const addDay = () => {
    if (!workoutData) return;
    const newData = { ...workoutData };
    const nextLetter = String.fromCharCode(65 + newData.days.length); // A, B, C, D...
    newData.days.push({
      dayName: `TREINO ${nextLetter}`,
      exercises: [{ name: '', sets: '4', reps: '10', rest: '60s', notes: '' }]
    });
    setWorkoutData(newData);
    setActiveDayIdx(newData.days.length - 1);
  };

  const removeDay = (idx: number) => {
    if (!workoutData || workoutData.days.length <= 1) return;
    const newData = { ...workoutData };
    newData.days.splice(idx, 1);
    
    // Rename remaining days sequentially
    newData.days.forEach((day, i) => {
      day.dayName = `TREINO ${String.fromCharCode(65 + i)}`;
    });
    
    setWorkoutData(newData);
    setActiveDayIdx(Math.max(0, idx - 1));
  };

  const handleStudentNameChange = (val: string) => {
    setStudent(val);
    setSelectedStudentAnamnesis(null);
    if (val.trim()) {
      const filtered = studentsList.filter(s => 
        s.name.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredStudents(filtered);
      setShowStudentSuggestions(true);
    } else {
      setFilteredStudents(studentsList);
      setShowStudentSuggestions(true);
    }
  };

  const loadStudentDetails = async (studentId: string) => {
    try {
      const { data: inspection } = await supabase
        .from('field_inspections')
        .select('weight, height, imc')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inspection) {
        if (inspection.weight) setWeight(inspection.weight.toString());
        if (inspection.height) setHeight(inspection.height.toString());
        if (inspection.imc) setImc(inspection.imc.toString());
      }

      const { data: anamnesis } = await supabase
        .from('anamnesis')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (anamnesis) {
        setSelectedStudentAnamnesis(anamnesis);
        if (anamnesis.medical_restrictions) {
          setClinicalNotes(prev => {
            const prefix = `Restrições médicas: ${anamnesis.medical_restrictions}`;
            return prev.includes(prefix) ? prev : prev ? `${prev}\n${prefix}` : prefix;
          });
        }
      } else {
        setSelectedStudentAnamnesis(null);
      }
    } catch (err) {
      console.error('Error loading student details:', err);
    }
  };

  const handleSelectStudent = (id: string, name: string) => {
    setStudent(name);
    setShowStudentSuggestions(false);
    loadStudentDetails(id);
  };

  // Autocomplete Handlers
  const handleExerciseNameChange = (exIdx: number, val: string) => {
    if (!workoutData) return;
    const newData = { ...workoutData };
    newData.days[activeDayIdx].exercises[exIdx].name = val;
    setWorkoutData(newData);

    if (val.trim()) {
      const filtered = exerciseLibrary.filter(ex => 
        ex.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (exIdx: number, exerciseName: string) => {
    if (!workoutData) return;
    const newData = { ...workoutData };
    newData.days[activeDayIdx].exercises[exIdx].name = exerciseName;
    setWorkoutData(newData);
    setSuggestions([]);
    setFocusedInput(null);
  };

  const saveToHistory = async (data: WorkoutData, params: any, shouldNotify: boolean) => {
    try {
      let studentId: string | null = null;
      const { data: st } = await supabase
        .from('students')
        .select('id, telegram_chat_id, phone_number')
        .eq('name', params.student)
        .limit(1)
        .maybeSingle();

      if (st) {
        studentId = st.id;
      }

      const { error } = await supabase
        .from('workout_protocols')
        .insert([{
          student_id: studentId,
          student_name: params.student,
          objective: params.objective,
          split: params.split,
          days: params.days,
          duration_weeks: params.durationWeeks,
          weight: params.weight,
          height: params.height,
          imc: params.imc,
          clinical_notes: params.clinicalNotes,
          needs: params.needs,
          workout_data: data,
          start_date: params.startDate,
          end_date: params.endDate
        }]);

      if (error) {
        console.error('Error saving protocol in DB:', error);
      } else {
        fetchHistory();

        if (shouldNotify && st) {
          if (st.telegram_chat_id) {
            let msg = `<b>Elite Coach - Novo Treino Disponível!</b>\n\n`;
            msg += `Olá, <b>${params.student}</b>! Seu treinador acabou de publicar a sua nova planilha de treinos no Elite Coach CRM.\n\n`;
            msg += `• <b>Divisão:</b> ${params.split}\n`;
            msg += `• <b>Frequência:</b> ${params.days} dias por semana\n`;
            msg += `• <b>Objetivo:</b> ${params.objective}\n`;
            msg += `• <b>Duração estimada:</b> ${params.durationWeeks} semanas\n`;
            msg += `\nPrepare-se para esmagar as metas! 💪🏋️‍♀️ Acesse o painel ou fale com o seu treinador para ver os detalhes.`;

            try {
              fetch('/api/telegram/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: st.telegram_chat_id, message: msg })
              }).then(res => res.json()).then(data => {
                if (!data.success) {
                  console.error('Erro ao enviar Telegram:', data.error);
                }
              });
            } catch (tgErr) {
              console.error(tgErr);
            }
          }

          if (st.phone_number) {
            let waMsg = `*Elite Coach - Novo Treino Disponível!*\n\n`;
            waMsg += `Olá, *${params.student}*! Seu treinador acabou de publicar a sua nova planilha de treinos no Elite Coach CRM.\n\n`;
            waMsg += `• *Divisão:* ${params.split}\n`;
            waMsg += `• *Frequência:* ${params.days} dias por semana\n`;
            waMsg += `• *Objetivo:* ${params.objective}\n`;
            waMsg += `• *Duração estimada:* ${params.durationWeeks} semanas\n`;
            waMsg += `\nPrepare-se para esmagar as metas! 💪🏋️‍♀️ Acesse o painel ou fale com o seu treinador para ver os detalhes.`;

            const encodedMsg = encodeURIComponent(waMsg);
            const cleanPhone = st.phone_number.replace(/\D/g, '');
            const url = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
            setWhatsappLink(url);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadFromHistory = (item: HistoryEntry) => {
    setStudent(item.student);
    setObjective(item.objective);
    setSplit(item.split);
    setDays(item.days);
    setNeeds(item.needs || '');
    setDurationWeeks(item.durationWeeks);
    setWorkoutData(item.workoutData);
    setWeight(item.weight || '');
    setHeight(item.height || '');
    setImc(item.imc || '');
    setClinicalNotes(item.clinicalNotes || '');
    setStartDate(item.startDate || new Date().toISOString().split('T')[0]);
    setEndDate(item.endDate || '');
    setActiveDayIdx(0);
    setActiveMetadata({
      student: item.student,
      objective: item.objective,
      durationWeeks: item.durationWeeks,
      weight: item.weight || '',
      height: item.height || '',
      imc: item.imc || '',
      clinicalNotes: item.clinicalNotes || ''
    });
  };

  const handleGenerate = async () => {
    if(!student || !objective) {
      return showCustomAlert("Parâmetros Incompletos", "Por favor, preencha o Nome do Aluno e o Objetivo Principal para gerar o treino.", "warning");
    }
    setIsGenerating(true);
    setIsTelemetryMinimized(false);
    setTelemetryStep(1);
    setWorkoutData(null);

    const t2 = setTimeout(() => setTelemetryStep(2), 1400);
    const t3 = setTimeout(() => setTelemetryStep(3), 2800);
    try {
      const studentHistory = history.filter(h => h.student.toLowerCase() === student.toLowerCase()).map(h => h.workoutData);

      let currentAnamnesis = selectedStudentAnamnesis;
      if (!currentAnamnesis && student) {
        const match = studentsList.find(s => s.name.toLowerCase().trim() === student.toLowerCase().trim());
        if (match) {
          try {
            const { data } = await supabase
              .from('anamnesis')
              .select('*')
              .eq('student_id', match.id)
              .maybeSingle();
            if (data) {
              currentAnamnesis = data;
            }
          } catch (err) {
            console.error('Error fetching anamnesis during generation:', err);
          }
        }
      }

      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          student, objective, split, days, needs, durationWeeks, 
          weight, height, imc, clinicalNotes, previousWorkouts: studentHistory,
          exerciseCatalog: exerciseLibrary.map((ex: any) => ex.name),
          anamnesis: currentAnamnesis
        })
      });
      
      let data;
      const responseText = await res.text();
      try {
         data = JSON.parse(responseText);
      } catch (e) {
         throw new Error("O servidor retornou uma resposta inesperada (provavelmente erro 500 ou 503). O serviço pode estar sobrecarregado.");
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Falha na API. O modelo pode estar sobrecarregado no momento.');
      }
      
      setWorkoutData(data);
      setActiveDayIdx(0);
      setActiveMetadata({ student, objective, durationWeeks, weight, height, imc, clinicalNotes });
      await saveToHistory(data, { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes, startDate, endDate }, sendNotification);
      
      // Auto-clear parameters
      setStudent('');
      setObjective('');
      setSplit('ABC');
      setDays('3');
      setNeeds('');
      setDurationWeeks('4');
      setWeight('');
      setHeight('');
      setImc('');
      setClinicalNotes('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setSelectedStudentAnamnesis(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('elite_coach_protocol_draft');
      }
    } catch (error: any) {
      showCustomAlert("Erro", `Erro ao gerar protocolo: ${error.message}\nTente novamente em alguns instantes.`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualSave = async () => {
    if(!student || !objective) {
      return showCustomAlert("Parâmetros Incompletos", "Preencha o Nome do Aluno e o Objetivo para salvar o protocolo!", "warning");
    }
    if(!workoutData || workoutData.days.length === 0) {
      return showCustomAlert("Planilha Vazia", "Adicione pelo menos um dia e um exercício à planilha antes de salvar!", "warning");
    }
    
    setIsGenerating(true);
    try {
      setActiveMetadata({ student, objective, durationWeeks, weight, height, imc, clinicalNotes });
      await saveToHistory(workoutData, { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes, startDate, endDate }, sendNotification);
      showCustomAlert("Sucesso", "Treino manual salvo com sucesso no histórico!", "success");
      
      // Auto-clear parameters
      setStudent('');
      setObjective('');
      setSplit('ABC');
      setDays('3');
      setNeeds('');
      setDurationWeeks('4');
      setWeight('');
      setHeight('');
      setImc('');
      setClinicalNotes('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setSelectedStudentAnamnesis(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('elite_coach_protocol_draft');
      }
    } catch (err: any) {
      showCustomAlert("Erro", "Erro ao salvar protocolo manual: " + err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!workoutData || !activeMetadata) return;
    generatePDFAndShare({ 
      student: activeMetadata.student, 
      objective: activeMetadata.objective, 
      durationWeeks: activeMetadata.durationWeeks, 
      weight: activeMetadata.weight, 
      height: activeMetadata.height, 
      imc: activeMetadata.imc, 
      clinicalNotes: activeMetadata.clinicalNotes, 
      workoutData 
    }, true, exerciseLibrary);
  };

  const shareWorkout = () => {
    if (!workoutData || !activeMetadata) return;
    generatePDFAndShare({ 
      student: activeMetadata.student, 
      objective: activeMetadata.objective, 
      durationWeeks: activeMetadata.durationWeeks, 
      weight: activeMetadata.weight, 
      height: activeMetadata.height, 
      imc: activeMetadata.imc, 
      clinicalNotes: activeMetadata.clinicalNotes, 
      workoutData 
    }, false, exerciseLibrary);
  };

  const [focusMode, setFocusMode] = useState<boolean>(false);

  return (
    <div className={focusMode ? "fixed inset-0 z-50 bg-surface overflow-y-auto p-4 md:p-12" : "space-y-6"}>
      {focusMode && (
        <button onClick={() => setFocusMode(false)} className="fixed top-4 right-4 md:top-6 md:right-8 z-50 bg-surface-highest text-white p-3 rounded-full hover:bg-zinc-700 transition">
           <X className="w-5 h-5"/>
        </button>
      )}
      
      <div className="flex items-center justify-between pointer-events-auto">
         <h2 className="text-2xl font-heading font-bold text-white">Criador de Protocolos</h2>
         <div className="flex items-center gap-4">
           <button onClick={() => setFocusMode(!focusMode)} className="text-xs bg-surface-high text-zinc-300 border border-surface-highest px-3 py-1.5 rounded font-bold uppercase tracking-widest flex items-center gap-2 hover:border-primary/50 transition">
              <Search className="w-3 h-3" /> Modo Foco
           </button>
            <div className="relative group/tooltiptop">
              <span className="text-[10px] sm:text-xs bg-primary/10 text-[#dfbf80] border border-[#dfbf80]/40 px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(212,175,55,0.25)] cursor-help transition-all hover:bg-primary/20">
                 <Zap className="w-3.5 h-3.5 fill-[#dfbf80]/30" /> IA Agent
              </span>

              {/* Tooltip ao passar o ponteiro do mouse */}
              <div className="absolute right-0 top-full mt-2 hidden group-hover/tooltiptop:flex flex-col bg-zinc-950/95 border border-[#dfbf80]/40 text-zinc-100 rounded-xl p-3 shadow-2xl z-50 min-w-[260px] max-w-[320px] backdrop-blur-md animate-in fade-in duration-200" style={{ color: '#f4f4f5' }}>
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#dfbf80] uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#dfbf80]" /> Motores de IA no Sistema
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-300">
                  <strong className="text-white">DeepSeek V3 / R1:</strong> Geração estruturada de protocolos e raciocínio para ficheiro de treino.
                </p>
                <p className="text-[11px] leading-relaxed text-zinc-300 mt-1 border-t border-zinc-800/60 pt-1">
                  <strong className="text-white">Google Gemini:</strong> Validação clínica e auditoria de lesões no <em>AI Clinical Guard</em>.
                </p>
              </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
           <h3 className="font-heading font-semibold text-lg text-white mb-4 border-b border-surface-highest pb-2">Parâmetros</h3>
           <div className="space-y-4">
              
              {/* Method Switcher */}
              <div>
                 <label className="text-xs text-zinc-400 uppercase font-bold block mb-1">Método de Criação</label>
                 <div className="flex gap-2 bg-surface-high p-1 rounded border border-surface-highest">
                   <button
                     type="button"
                     onClick={() => handleModeChange('ia')}
                     className={`flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
                       creationMode === 'ia' ? 'bg-primary text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                     }`}
                   >
                     <Zap className="w-3.5 h-3.5" /> Auxílio Total IA
                   </button>
                   <button
                     type="button"
                     onClick={() => handleModeChange('manual')}
                     className={`flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
                       creationMode === 'manual' ? 'bg-primary text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                     }`}
                   >
                     <Dumbbell className="w-3.5 h-3.5" /> Montagem Manual
                   </button>
                 </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Nome do Aluno</label>
                <div className="relative">
                  <input 
                    value={student} 
                    onChange={e => handleStudentNameChange(e.target.value)} 
                    onFocus={() => {
                      setFilteredStudents(student.trim() ? studentsList.filter(s => s.name.toLowerCase().includes(student.toLowerCase())) : studentsList);
                      setShowStudentSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => setShowStudentSuggestions(false), 250)}
                    type="text" 
                    placeholder="Ex: João Silva" 
                    className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 focus:border-primary outline-none transition-colors text-white" 
                  />
                  {showStudentSuggestions && filteredStudents.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-surface-high border border-surface-highest rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto divide-y divide-surface-highest/40 scrollbar-none font-sans">
                      {filteredStudents.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            handleSelectStudent(s.id, s.name);
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-primary/10 hover:text-primary transition-colors text-xs text-zinc-200 font-bold"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-zinc-400">Peso (kg)</label>
                  <input value={weight} onChange={e=>setWeight(e.target.value)} type="text" placeholder="Ex: 80" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Altura (cm)</label>
                  <input value={height} onChange={e=>setHeight(e.target.value)} type="text" placeholder="Ex: 180" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">IMC</label>
                  <input value={imc} onChange={e=>setImc(e.target.value)} type="text" placeholder="Ex: 24.7" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400">Divisão</label>
                  <select value={split} onChange={e=>setSplit(e.target.value)} className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 outline-none">
                    <option>Full Body</option>
                    <option>AB</option>
                    <option>ABC</option>
                    <option>ABCD</option>
                    <option>ABCDE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Dias/Semana</label>
                  <input value={days} onChange={e=>setDays(e.target.value)} type="number" min="1" max="7" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 outline-none" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs text-zinc-400">Duração (Semanas)</label>
                     <input value={durationWeeks} onChange={e=>setDurationWeeks(e.target.value)} type="number" min="1" max="16" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 focus:border-primary outline-none transition-colors" />
                  </div>
                  <div>
                     <label className="text-xs text-zinc-400">Data de Início</label>
                     <input value={startDate} onChange={e=>setStartDate(e.target.value)} type="date" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 focus:border-primary outline-none transition-colors" />
                  </div>
                  <div className="col-span-2">
                     <label className="text-xs text-zinc-400 font-bold text-zinc-300">Data de Término (Calculada)</label>
                     <input value={endDate} disabled type="date" className="w-full bg-surface border border-surface-highest text-zinc-400 rounded p-2 mt-1 outline-none opacity-60 cursor-not-allowed font-mono text-xs" />
                  </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Objetivo Principal</label>
                <input value={objective} onChange={e=>setObjective(e.target.value)} type="text" placeholder="Ex: Hipertrofia máxima" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 focus:border-primary outline-none transition-colors" />
              </div>

              <div>
                <label className="text-xs text-zinc-400">Observações Clínicas / Limitações</label>
                <textarea value={clinicalNotes} onChange={e=>setClinicalNotes(e.target.value)} placeholder="Ex: Condromalácia patelar grau 1, dor na lombar..." className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 h-16 resize-none focus:border-primary outline-none text-sm"></textarea>
              </div>

              <div>
                <label className="text-xs text-zinc-400">Foco / Necessidades Extras</label>
                <input value={needs} onChange={e=>setNeeds(e.target.value)} type="text" placeholder="Ex: Foco no quadríceps" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 focus:border-primary outline-none transition-colors" />
              </div>

              <div className="flex items-center gap-3 mt-2">
                <input 
                  type="checkbox" 
                  id="send_notification_workout"
                  checked={sendNotification} 
                  onChange={e => setSendNotification(e.target.checked)} 
                  className="w-4.5 h-4.5 rounded border-surface-highest bg-surface-high text-primary focus:ring-primary accent-primary"
                />
                <label htmlFor="send_notification_workout" className="text-xs text-zinc-300 font-semibold cursor-pointer select-none">
                  Notificar Aluno ao Salvar (WhatsApp/Telegram)
                </label>
              </div>

              {creationMode === 'ia' ? (
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating}
                  className="w-full py-3 bg-gradient-to-r from-primary to-primary-dim text-black font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 mt-4 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                >
                  {isGenerating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Settings className="w-5 h-5"/></motion.div> : <Zap className="w-5 h-5"/>}
                  {isGenerating ? 'Processando Inteligência...' : 'Gerar Protocolo com IA'}
                </button>
              ) : (
                <button 
                  onClick={handleManualSave} 
                  disabled={isGenerating || !workoutData}
                  className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 hover:bg-primary-dim transition-colors disabled:opacity-50 mt-4 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                >
                  <Download className="w-5 h-5"/>
                  {isGenerating ? 'Salvando...' : 'Salvar Protocolo Manual'}
                </button>
              )}
              <button
                type="button"
                onClick={handleClearParameters}
                disabled={isGenerating}
                className="w-full py-2.5 bg-surface hover:bg-surface-high border border-surface-highest text-zinc-400 hover:text-white font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-2 text-xs"
              >
                Limpar Parâmetros
              </button>
           </div>
        </div>

        <div className="lg:col-span-2 bg-surface-container border border-surface-highest rounded-xl p-5 sm:p-6 flex flex-col h-full min-h-[620px] max-h-[calc(100vh-170px)] shadow-lg relative">
           <div className="flex justify-between items-center mb-4 pb-3 border-b border-surface-highest/50">
              <h3 className="font-heading font-semibold text-lg text-white flex items-center gap-2">
                <span>Preview do Protocolo</span>
              </h3>
              <div className="flex gap-2">
                 <button onClick={handleExportPDF} disabled={!workoutData} className="disabled:opacity-50 px-3 py-1.5 bg-surface border border-surface-highest rounded text-zinc-300 hover:text-white transition-colors text-xs font-bold uppercase flex items-center gap-1 group">
                    <Download className="w-3 h-3 group-hover:text-primary transition-colors"/> PDF
                 </button>
                 <button onClick={shareWorkout} disabled={!workoutData} className="disabled:opacity-50 px-3 py-1.5 bg-surface border border-surface-highest rounded text-zinc-300 hover:text-white transition-colors text-xs font-bold uppercase flex items-center gap-1 group">
                    <Share2 className="w-3 h-3 group-hover:text-primary transition-colors"/> Compartilhar
                 </button>
              </div>
           </div>

           {!workoutData && !isGenerating && creationMode === 'ia' && (
             <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-surface-high/30 rounded-lg border border-dashed border-surface-highest py-16">
                <Dumbbell className="w-12 h-12 mb-3 opacity-20" />
                <p>Preencha os parâmetros e clique em Gerar com IA.</p>
             </div>
           )}

           {isGenerating && (
             <div className="flex-1 flex flex-col items-center justify-center text-primary bg-surface-high/30 rounded-lg border border-surface-highest py-16">
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <Zap className="w-12 h-12 mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]" />
                </motion.div>
                <p className="font-mono text-sm uppercase tracking-widest animate-pulse">Sintetizando variáveis biométricas...</p>
             </div>
           )}

           {workoutData && workoutData.days && !isGenerating && (
             <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 border-b border-surface-highest pb-3 overflow-x-auto scrollbar-none shrink-0">
                   {workoutData.days.map((d, i) => (
                     <div key={i} className="relative group flex items-center">
                       <button 
                         onClick={() => { setActiveDayIdx(i); setSuggestions([]); }}
                         className={`px-4 py-2 rounded font-bold uppercase tracking-wider text-xs whitespace-nowrap transition-colors ${activeDayIdx === i ? 'bg-primary text-black shadow-[0_0_10px_rgba(212,175,55,0.4)]' : 'bg-surface-high text-zinc-400 hover:text-zinc-100'}`}
                       >
                         {d.dayName}
                       </button>
                       {workoutData.days.length > 1 && (
                         <button 
                           onClick={(e) => { e.stopPropagation(); removeDay(i); }} 
                           className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                           title="Excluir Dia"
                         >
                           <X className="w-2.5 h-2.5" />
                         </button>
                       )}
                     </div>
                   ))}
                   <button 
                     onClick={addDay}
                     className="px-3 py-2 bg-surface-high border border-dashed border-surface-highest text-zinc-400 hover:text-white rounded text-xs font-bold uppercase flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                     title="Adicionar Dia"
                   >
                     <Plus className="w-3.5 h-3.5" /> Adicionar Dia
                   </button>
                </div>

                {/* Lista de Exercícios com Rolagem Interna sem cortes */}
                <div className="mt-3 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-1.5 scrollbar-thin scrollbar-thumb-surface-highest space-y-3 pb-6">
                   <AnimatePresence mode="popLayout">
                     <motion.div
                       key={activeDayIdx}
                       initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                       className="space-y-3"
                     >
                        {workoutData.days[activeDayIdx].exercises.map((ex, idx) => (
                          <div key={idx} className="bg-surface-high border border-surface-highest p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between hover:border-primary/30 transition-colors group gap-4 relative">
                             <div className="flex-1 w-full relative">
                               <label className="text-[10px] text-zinc-500 uppercase font-bold">Nome do Exercício</label>
                               <input 
                                 type="text" 
                                 value={ex.name} 
                                 placeholder="Digite para buscar..."
                                 onFocus={() => {
                                   setFocusedInput({ dayIdx: activeDayIdx, exIdx: idx });
                                   if (ex.name.trim()) {
                                     const filtered = exerciseLibrary.filter(item => 
                                       item.name.toLowerCase().includes(ex.name.toLowerCase())
                                     ).slice(0, 5);
                                     setSuggestions(filtered);
                                   } else {
                                     setSuggestions(exerciseLibrary.slice(0, 5));
                                   }
                                 }}
                                 onBlur={() => {
                                   setTimeout(() => setFocusedInput(null), 200);
                                 }}
                                 onChange={(e) => {
                                   handleExerciseNameChange(idx, e.target.value);
                                 }}
                                 className="font-bold text-white group-hover:text-primary transition-colors bg-transparent border-b border-surface-highest focus:border-primary w-full outline-none py-1 text-sm" 
                               />
                               {ex.name && exerciseLibrary.some(l => l.name.toLowerCase().trim() === ex.name.toLowerCase().trim()) && (
                                 <span className="text-[10px] text-primary flex items-center gap-1 mt-1 font-bold">
                                   🎥 Vídeo cadastrado na biblioteca
                                 </span>
                                )}

                                {/* Autocomplete Suggestions Box */}
                                {focusedInput?.dayIdx === activeDayIdx && focusedInput?.exIdx === idx && suggestions.length > 0 && (
                                  <div className="absolute left-0 top-full mt-1 w-full bg-surface-container border border-surface-highest rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                                    {suggestions.map((s, sIdx) => (
                                      <button
                                        key={sIdx}
                                        type="button"
                                        onMouseDown={() => handleSelectSuggestion(idx, s.name)}
                                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-surface-highest/40 last:border-none font-medium flex justify-between items-center"
                                      >
                                        <span>{s.name}</span>
                                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 bg-surface px-1.5 py-0.5 rounded">
                                          {s.category}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                <input 
                                  type="text" 
                                  value={ex.notes || ''} 
                                  placeholder="Notas de execução (opcional)"
                                  onChange={(e) => {
                                    if (!workoutData) return;
                                    const newData = {...workoutData};
                                    newData.days[activeDayIdx].exercises[idx].notes = e.target.value;
                                    setWorkoutData(newData);
                                  }}
                                  className="text-xs text-zinc-400 mt-2 bg-transparent border-b border-transparent focus:border-primary w-full outline-none" 
                                />
                             </div>
                             
                             <div className="flex gap-3 text-center shrink-0 items-end w-full md:w-auto justify-between md:justify-start">
                               <div>
                                 <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Séries</div>
                                 <input type="text" value={ex.sets} onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].sets = e.target.value;
                                   setWorkoutData(newData);
                                 }} className="font-mono text-white bg-surface rounded px-2 py-1.5 w-12 text-center outline-none border border-surface-highest focus:border-primary text-sm"/>
                               </div>
                               <div>
                                 <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Reps</div>
                                 <input type="text" value={ex.reps} onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].reps = e.target.value;
                                   setWorkoutData(newData);
                                 }} className="font-mono text-white bg-surface rounded px-2 py-1.5 w-16 text-center outline-none border border-surface-highest focus:border-primary text-sm"/>
                               </div>
                               <div>
                                 <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Pausa</div>
                                 <input type="text" value={ex.rest} onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].rest = e.target.value;
                                   setWorkoutData(newData);
                                 }} className="font-mono text-primary bg-primary/10 rounded px-2 py-1.5 w-16 text-center outline-none border border-surface-highest focus:border-primary text-sm"/>
                               </div>
                               <button 
                                 onClick={() => removeExercise(idx)} 
                                 className="text-zinc-500 hover:text-red-400 p-2 transition-colors self-center mt-4"
                                 title="Remover Exercício"
                               >
                                 <Trash2 className="w-4.5 h-4.5" />
                               </button>
                             </div>
                          </div>
                        ))}
                        
                        <button 
                          onClick={addExercise}
                          className="w-full py-3 bg-surface-high border border-dashed border-surface-highest text-zinc-400 hover:text-white rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition-colors mt-2"
                        >
                          <Plus className="w-4 h-4" /> Adicionar Exercício
                        </button>
                     </motion.div>
                   </AnimatePresence>
                </div>
             </div>
           )}
        </div>
      </div>

      <div className="mt-8 bg-surface-container border border-surface-highest rounded-xl p-6">
          <h3 className="font-heading font-semibold text-lg text-white mb-4 border-b border-surface-highest pb-2">Histórico de Protocolos Recentes</h3>
          {loadingHistory ? (
            <p className="text-zinc-500 text-sm py-4 italic animate-pulse">Carregando histórico do banco de dados...</p>
          ) : history.length === 0 ? (
            <p className="text-zinc-500 text-sm italic">Nenhum protocolo gerado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {history.map((item) => (
                <div key={item.id} className="bg-surface-high border border-surface-highest p-4 rounded-lg hover:border-primary/50 transition-colors">
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-sm font-bold text-white truncate max-w-[150px]">{item.student}</span>
                     <span className="text-[10px] text-zinc-500 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</span>
                   </div>
                   <p className="text-xs text-primary mb-3 truncate" title={item.objective}>{item.objective}</p>
                   <button onClick={() => loadFromHistory(item)} className="w-full py-1.5 bg-surface border border-surface-highest text-xs font-bold text-zinc-300 hover:text-white hover:border-primary/50 hover:bg-surface-highest rounded transition-colors uppercase tracking-wider">Carregar / Editar</button>
                </div>
              ))}
            </div>
          )}
      </div>

      {whatsappLink && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-primary/30 rounded-xl p-6 max-w-md w-full text-center space-y-4 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <h3 className="text-xl font-heading font-bold text-white">Treino Salvo!</h3>
            <p className="text-sm text-zinc-300">Como este aluno possui WhatsApp cadastrado, você pode disparar o aviso do novo treino clicando no botão abaixo.</p>
            <div className="flex flex-col gap-2">
              <a 
                href={whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={() => setWhatsappLink('')}
                className="w-full py-3 bg-[#25d366] text-black font-bold uppercase tracking-wider rounded hover:bg-[#20ba56] transition-colors flex items-center justify-center gap-2 text-sm font-bold animate-pulse"
              >
                 Disparar WhatsApp
              </a>
              <button 
                onClick={() => setWhatsappLink('')}
                className="w-full py-2 bg-surface border border-surface-highest text-zinc-400 hover:text-white rounded text-xs transition-colors"
              >
                Fechar Sem Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HUD de Telemetria Clínica Futurista com Checkpoints da Anamnese e Suporte a Maximizar/Minimizar */}
      <AnimatePresence>
        {isGenerating && (
          <>
            {!isTelemetryMinimized ? (
              /* MODAL COMPLETO DE TELEMETRIA (HUD) */
              <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-[98] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="bg-zinc-950/90 border border-[#dfbf80]/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-[0_0_60px_rgba(212,175,55,0.2)] relative overflow-hidden flex flex-col gap-6"
                >
                  {/* Top Bar Glow */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#dfbf80] to-yellow-300 animate-pulse" />

                  {/* Header do Modal com Ações de Minimizar/Fechar */}
                  <div className="flex items-start justify-between border-b border-surface-highest/40 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-[#dfbf80]/10 border border-[#dfbf80]/30 text-[#dfbf80] shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                        <Activity className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          🧬 TELEMETRIA CLÍNICA & SÍNTESE DE IA
                        </h3>
                        <p className="text-[10px] sm:text-xs text-[#dfbf80] font-mono font-medium">
                          Auditando anamnese e gerando treino para: <span className="text-white font-bold">{student}</span>
                        </p>
                      </div>
                    </div>

                    {/* Botões de Ação Maximizar / Minimizar (Estilo Working Scale) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsTelemetryMinimized(true)}
                        className="p-2 rounded-xl bg-surface-high hover:bg-surface border border-surface-highest text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-mono"
                        title="Minimizar para barra flutuante (Working Scale)"
                      >
                        <Minimize2 className="w-4 h-4 text-[#dfbf80]" />
                        <span className="hidden sm:inline">Minimizar</span>
                      </button>
                    </div>
                  </div>

                  {/* Scanner Biométrico Radar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-surface-dark/60 p-4 rounded-2xl border border-surface-highest/50">
                    <div className="flex items-center justify-center relative py-2">
                      {/* Círculos de Onda do Radar */}
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2.5 }}
                        className="absolute w-20 h-20 rounded-full border border-[#dfbf80]/40"
                      />
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                        className="w-16 h-16 rounded-full border-2 border-dashed border-[#dfbf80] flex items-center justify-center"
                      >
                        <Cpu className="w-7 h-7 text-[#dfbf80]" />
                      </motion.div>
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-400">Progresso da Telemetria:</span>
                        <span className="text-[#dfbf80] font-bold">
                          {telemetryStep === 1 ? '33% (Biometria)' : telemetryStep === 2 ? '66% (Anamnese & Lesões)' : '95% (Síntese Final)'}
                        </span>
                      </div>
                      {/* Barra de Progresso Gradiente */}
                      <div className="w-full bg-surface-high h-2.5 rounded-full overflow-hidden border border-surface-highest/60">
                        <motion.div
                          initial={{ width: '15%' }}
                          animate={{ 
                            width: telemetryStep === 1 ? '35%' : telemetryStep === 2 ? '70%' : '98%' 
                          }}
                          transition={{ duration: 0.8 }}
                          className="h-full bg-gradient-to-r from-amber-500 to-[#dfbf80] shadow-[0_0_12px_rgba(212,175,55,0.6)]"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 italic">
                        {telemetryStep === 1 ? 'Coletando métricas e histórico de treinos recentes...' : telemetryStep === 2 ? 'Cruzando diretrizes do AI Clinical Guard com anamnese...' : 'Finalizando treino estritamente seguro com DeepSeek V3 + Gemini...'}
                      </p>
                    </div>
                  </div>

                  {/* Feed de Checkpoints de Auditoria em Tempo Real */}
                  <div className="space-y-3 font-mono text-xs">
                    {/* Passo 1 */}
                    <div className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      telemetryStep >= 1 ? 'bg-surface-high/70 border-[#dfbf80]/30 text-white' : 'bg-surface/30 border-surface-highest/30 opacity-40'
                    }`}>
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${telemetryStep >= 1 ? 'text-[#dfbf80]' : 'text-zinc-600'}`} />
                      <div className="space-y-1 flex-1">
                        <div className="font-bold flex items-center justify-between">
                          <span>1. Auditoria de Biometria & Flexibilidade</span>
                          {telemetryStep >= 1 && <span className="text-[9px] bg-primary/20 text-[#dfbf80] px-2 py-0.5 rounded font-mono">CONCLUÍDO</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10.5px] text-zinc-300">
                          <span className="bg-surface px-2 py-0.5 rounded border border-surface-highest/60">Peso: {weight || 'N/I'} kg</span>
                          <span className="bg-surface px-2 py-0.5 rounded border border-surface-highest/60">Altura: {height || 'N/I'} m</span>
                          <span className="bg-surface px-2 py-0.5 rounded border border-surface-highest/60">IMC: {imc || 'N/I'}</span>
                          {selectedStudentAnamnesis?.flexibility_level && (
                            <span className="bg-surface px-2 py-0.5 rounded border border-surface-highest/60">Flexibilidade: {selectedStudentAnamnesis.flexibility_level}</span>
                          )}
                          {selectedStudentAnamnesis?.water_intake && (
                            <span className="bg-surface px-2 py-0.5 rounded border border-surface-highest/60">Água: {selectedStudentAnamnesis.water_intake}L/dia</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Passo 2 */}
                    <div className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      telemetryStep >= 2 ? 'bg-surface-high/70 border-amber-500/30 text-white' : 'bg-surface/30 border-surface-highest/30 opacity-40'
                    }`}>
                      <ShieldAlert className={`w-4 h-4 mt-0.5 shrink-0 ${telemetryStep >= 2 ? 'text-amber-400' : 'text-zinc-600'}`} />
                      <div className="space-y-1 flex-1">
                        <div className="font-bold flex items-center justify-between">
                          <span>2. AI Clinical Guard (Isolamento de Riscos e Lesões)</span>
                          {telemetryStep >= 2 && <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">PROCESSADO</span>}
                        </div>
                        <div className="text-[11px] text-amber-200/90 leading-relaxed bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
                          {clinicalNotes || selectedStudentAnamnesis?.medical_restrictions ? (
                            <span>
                              ⚠️ <strong>Restrições Identificadas:</strong> {clinicalNotes || selectedStudentAnamnesis?.medical_restrictions} ➔ Exercícios com risco articular foram isolados do protocolo.
                            </span>
                          ) : (
                            <span>
                              ✅ <strong>Ficha Limpa:</strong> Nenhuma restrição articular severa detectada. Aplicando carga e amplitudes de alta performance.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Passo 3 */}
                    <div className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      telemetryStep >= 3 ? 'bg-surface-high/70 border-emerald-500/30 text-white' : 'bg-surface/30 border-surface-highest/30 opacity-40'
                    }`}>
                      <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${telemetryStep >= 3 ? 'text-emerald-400' : 'text-zinc-600'}`} />
                      <div className="space-y-1 flex-1">
                        <div className="font-bold flex items-center justify-between">
                          <span>3. Seleção de Exercícios da Sua Biblioteca</span>
                          {telemetryStep >= 3 && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">SINTETIZANDO</span>}
                        </div>
                        <p className="text-[10.5px] text-zinc-300">
                          Auditando {exerciseLibrary.length} exercícios cadastrados na sua biblioteca para priorizar o catálogo do coach.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Modal: Indicação da IA Ativa no Canto Inferior Direito */}
                  <div className="flex items-center justify-between pt-2 border-t border-surface-highest/40 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Settings className="w-3 h-3 animate-spin text-[#dfbf80]" /> Aguarde a conclusão da síntese...
                    </span>

                    {/* Selo no Canto Inferior Direito informando a IA Ativa */}
                    <div className="bg-zinc-900 border border-[#dfbf80]/40 px-3 py-1 rounded-full text-[#dfbf80] font-mono font-bold flex items-center gap-1.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      🤖 Processando via: DeepSeek V3 / R1
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              /* MINI-BARRA FLUTUANTE QUANDO MINIMIZADO (PADRÃO WORKING SCALE) */
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="fixed bottom-6 right-6 z-[99] bg-zinc-950/95 border border-[#dfbf80]/60 text-white rounded-2xl p-3.5 shadow-[0_0_30px_rgba(212,175,55,0.4)] backdrop-blur-md flex items-center gap-4 max-w-md cursor-pointer"
                onClick={() => setIsTelemetryMinimized(false)}
              >
                <div className="p-2 rounded-xl bg-[#dfbf80]/15 border border-[#dfbf80]/30 text-[#dfbf80]">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                      Telemetria IA ({student})
                    </h4>
                    <span className="text-[9px] bg-primary/20 text-[#dfbf80] px-1.5 py-0.5 rounded font-mono font-bold">
                      {telemetryStep === 1 ? '33%' : telemetryStep === 2 ? '66%' : '95%'}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate font-mono">
                    🤖 DeepSeek V3 processando anamnese...
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTelemetryMinimized(false);
                  }}
                  className="p-1.5 rounded-lg bg-surface-high hover:bg-surface text-[#dfbf80] hover:text-white border border-[#dfbf80]/30 transition-colors"
                  title="Maximizar janela de telemetria"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Custom Reusable Alert Modal */}
      <AnimatePresence>
        {alertModal.isOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
                alertModal.type === 'success' ? 'from-green-500 to-emerald-400' :
                alertModal.type === 'error' ? 'from-red-600 to-rose-500' :
                alertModal.type === 'warning' ? 'from-amber-500 to-yellow-400' :
                'from-primary to-primary-dim'
              }`} />
              
              <h3 className="text-lg font-heading font-bold text-white mb-2">{alertModal.title}</h3>
              <p className="text-zinc-300 text-xs leading-relaxed mb-6">{alertModal.message}</p>
              
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setAlertModal({ ...alertModal, isOpen: false })} 
                  className="px-5 py-2 bg-primary text-black font-bold uppercase tracking-wider text-[10px] rounded hover:bg-primary-dim transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
