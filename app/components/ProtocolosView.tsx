import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Zap, Settings, Download, Share2, Dumbbell } from 'lucide-react';
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
  
  useEffect(() => {
    const data = { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes };
    localStorage.setItem('elite_coach_protocol_draft', JSON.stringify(data));
  }, [student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);
  const [sendNotification, setSendNotification] = useState<boolean>(true);
  const [whatsappLink, setWhatsappLink] = useState<string>('');

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([]);

  const fetchExerciseLibrary = async () => {
    try {
      const { data } = await supabase
        .from('exercise_library')
        .select('*');
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
        // Map database fields to our HistoryEntry format
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
          date: item.date
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
  }, []);

  const saveToHistory = async (data: WorkoutData, params: any, shouldNotify: boolean) => {
    try {
      // Look up student record to link ID and get notification settings if possible
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
          workout_data: data
        }]);

      if (error) {
        console.error('Error saving protocol in DB:', error);
      } else {
        fetchHistory();

        // Disparar notificações se configurado
        if (shouldNotify && st) {
          // 1. Telegram
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

          // 2. WhatsApp click-to-chat setup
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
    setActiveDayIdx(0);
  };

  const handleGenerate = async () => {
    if(!student || !objective) return alert("Preencha Aluno e Objetivo");
    setIsGenerating(true);
    setWorkoutData(null);
    try {
      const studentHistory = history.filter(h => h.student.toLowerCase() === student.toLowerCase()).map(h => h.workoutData);

      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          student, objective, split, days, needs, durationWeeks, 
          weight, height, imc, clinicalNotes, previousWorkouts: studentHistory 
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
      await saveToHistory(data, { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes }, sendNotification);
    } catch (error: any) {
      alert(`Erro ao gerar protocolo: ${error.message}\nTente novamente em alguns instantes.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!workoutData) return;
    generatePDFAndShare({ student, objective, durationWeeks, weight, height, imc, clinicalNotes, workoutData }, true, exerciseLibrary);
  };

  const shareWorkout = () => {
    if (!workoutData) return;
    generatePDFAndShare({ student, objective, durationWeeks, weight, height, imc, clinicalNotes, workoutData }, false, exerciseLibrary);
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
           <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-1.5 rounded font-bold uppercase tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(212,175,55,0.2)]">
              <Zap className="w-3 h-3" /> IA Agent
           </span>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
           <h3 className="font-heading font-semibold text-lg text-white mb-4 border-b border-surface-highest pb-2">Parâmetros</h3>
           <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400">Nome do Aluno</label>
                <input value={student} onChange={e=>setStudent(e.target.value)} type="text" placeholder="Ex: João Silva" className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 focus:border-primary outline-none transition-colors text-white" />
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
                  <div className="col-span-2">
                     <label className="text-xs text-zinc-400">Duração (Semanas)</label>
                     <input value={durationWeeks} onChange={e=>setDurationWeeks(e.target.value)} type="number" min="1" max="16" className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 focus:border-primary outline-none transition-colors" />
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

              <button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="w-full py-3 bg-gradient-to-r from-primary to-primary-dim text-black font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 mt-4 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
              >
                {isGenerating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Settings className="w-5 h-5"/></motion.div> : <Zap className="w-5 h-5"/>}
                {isGenerating ? 'Processando Inteligência...' : 'Gerar Protocolo'}
              </button>
           </div>
        </div>

        <div className="lg:col-span-2 bg-surface-container border border-surface-highest rounded-xl p-6 flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading font-semibold text-lg text-white">Preview do Protocolo</h3>
              <div className="flex gap-2">
                 <button onClick={handleExportPDF} disabled={!workoutData} className="disabled:opacity-50 px-3 py-1.5 bg-surface border border-surface-highest rounded text-zinc-300 hover:text-white transition-colors text-xs font-bold uppercase flex items-center gap-1 group">
                    <Download className="w-3 h-3 group-hover:text-primary transition-colors"/> PDF
                 </button>
                 <button onClick={shareWorkout} disabled={!workoutData} className="disabled:opacity-50 px-3 py-1.5 bg-surface border border-surface-highest rounded text-zinc-300 hover:text-white transition-colors text-xs font-bold uppercase flex items-center gap-1 group">
                    <Share2 className="w-3 h-3 group-hover:text-primary transition-colors"/> Compartilhar
                 </button>
              </div>
           </div>

           {!workoutData && !isGenerating && (
             <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-surface-high/30 rounded-lg border border-dashed border-surface-highest">
                <Dumbbell className="w-12 h-12 mb-3 opacity-20" />
                <p>Preencha os parâmetros e clique em Gerar.</p>
             </div>
           )}

           {isGenerating && (
             <div className="flex-1 flex flex-col items-center justify-center text-primary bg-surface-high/30 rounded-lg border border-surface-highest">
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <Zap className="w-12 h-12 mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]" />
                </motion.div>
                <p className="font-mono text-sm uppercase tracking-widest animate-pulse">Sintetizando variáveis biométricas...</p>
             </div>
           )}

           {workoutData && workoutData.days && !isGenerating && (
             <div className="flex-1 flex flex-col">
                <div className="flex gap-2 border-b border-surface-highest pb-4 overflow-x-auto">
                   {workoutData.days.map((d, i) => (
                     <button 
                       key={i} 
                       onClick={() => setActiveDayIdx(i)}
                       className={`px-4 py-2 rounded font-bold uppercase tracking-wider text-xs whitespace-nowrap transition-colors ${activeDayIdx === i ? 'bg-primary text-black shadow-[0_0_10px_rgba(212,175,55,0.4)]' : 'bg-surface-high text-zinc-400 hover:text-zinc-100'}`}
                     >
                       {d.dayName}
                     </button>
                   ))}
                </div>

                <div className="mt-4 flex-1 overflow-y-auto">
                   <AnimatePresence mode="popLayout">
                     <motion.div
                       key={activeDayIdx}
                       initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                       className="space-y-3"
                     >
                        {workoutData.days[activeDayIdx].exercises.map((ex, idx) => (
                          <div key={idx} className="bg-surface-high border border-surface-highest p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between hover:border-primary/30 transition-colors group gap-4">
                             <div className="flex-1 w-full">
                               <input 
                                 type="text" 
                                 value={ex.name} 
                                 onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].name = e.target.value;
                                   setWorkoutData(newData);
                                 }}
                                 className="font-bold text-white group-hover:text-primary transition-colors bg-transparent border-b border-transparent focus:border-primary w-full outline-none" 
                               />
                               <input 
                                 type="text" 
                                 value={ex.notes || ''} 
                                 placeholder="Notas (opcional)"
                                 onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].notes = e.target.value;
                                   setWorkoutData(newData);
                                 }}
                                 className="text-xs text-zinc-400 mt-1 bg-transparent border-b border-transparent focus:border-primary w-full outline-none" 
                               />
                             </div>
                             <div className="flex gap-4 text-center shrink-0">
                               <div>
                                 <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Séries</div>
                                 <input type="text" value={ex.sets} onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].sets = e.target.value;
                                   setWorkoutData(newData);
                                 }} className="font-mono text-white bg-surface rounded px-2 py-1 w-12 text-center outline-none border border-transparent focus:border-primary"/>
                               </div>
                               <div>
                                 <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Reps</div>
                                 <input type="text" value={ex.reps} onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].reps = e.target.value;
                                   setWorkoutData(newData);
                                 }} className="font-mono text-white bg-surface rounded px-2 py-1 w-16 text-center outline-none border border-transparent focus:border-primary"/>
                               </div>
                               <div>
                                 <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Pausa</div>
                                 <input type="text" value={ex.rest} onChange={(e) => {
                                   if (!workoutData) return;
                                   const newData = {...workoutData};
                                   newData.days[activeDayIdx].exercises[idx].rest = e.target.value;
                                   setWorkoutData(newData);
                                 }} className="font-mono text-primary bg-primary/10 rounded px-2 py-1 w-16 text-center outline-none border border-transparent focus:border-primary"/>
                               </div>
                             </div>
                          </div>
                        ))}
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
    </div>
  );
}
