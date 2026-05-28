import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Award, CheckCircle2, Camera, Plus, X, MessageSquare } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Student } from '../types';
import { supabase } from '../utils/supabase';

export default function AlunosView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
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
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      setPhoto(selectedStudent.photo_url || null);
      setStudentPhone(selectedStudent.phone_number || '');
      setStudentTelegramId(selectedStudent.telegram_chat_id || '');
      fetchStudentEvaluations(selectedStudent.id);
    } else {
      setPhoto(null);
      setStudentPhone('');
      setStudentTelegramId('');
      setEvaluations([]);
    }
    return () => stopCamera();
  }, [selectedStudent]);

  const startCamera = async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(ms);
      if (videoRef.current) videoRef.current.srcObject = ms;
    } catch (e) {
      console.error(e);
      alert("Câmera não acessível no ambiente atual ou sem permissão.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const savePhoto = async (photoData: string) => {
    if (!selectedStudent) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ photo_url: photoData })
        .eq('id', selectedStudent.id);

      if (error) {
        alert('Erro ao salvar foto de evolução: ' + error.message);
      } else {
        setSelectedStudent({ ...selectedStudent, photo_url: photoData });
        fetchStudents();
      }
    } catch (err: any) {
      console.error('Error updating photo:', err);
    }
  };

  const deletePhoto = async () => {
    if (!selectedStudent) return;
    if (!confirm('Deseja remover esta foto do histórico?')) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ photo_url: null })
        .eq('id', selectedStudent.id);

      if (error) {
        alert('Erro ao excluir foto: ' + error.message);
      } else {
        setPhoto(null);
        setSelectedStudent({ ...selectedStudent, photo_url: undefined });
        fetchStudents();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const photoData = canvasRef.current.toDataURL('image/png');
        setPhoto(photoData);
        stopCamera();
        savePhoto(photoData);
      }
    }
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.age || !newStudent.goal) {
      return alert('Preencha os campos obrigatórios!');
    }

    const ageNum = parseInt(newStudent.age);
    if (isNaN(ageNum)) {
      return alert('Idade precisa ser um número válido!');
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
        alert('Erro ao cadastrar aluno: ' + error.message);
      } else {
        alert('Aluno cadastrado com sucesso!');
        setShowNewStudentModal(false);
        setNewStudent({ name: '', age: '', goal: '', biotype: 'Mesomorfo', status: 'Ativo', phone_number: '', telegram_chat_id: '' });
        fetchStudents();
      }
    } catch (err: any) {
      console.error(err);
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
        alert('Erro ao salvar contatos: ' + error.message);
      } else {
        alert('Contatos atualizados com sucesso!');
        setSelectedStudent({
          ...selectedStudent,
          phone_number: studentPhone || undefined,
          telegram_chat_id: studentTelegramId || undefined
        });
        fetchStudents();
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro inesperado ao salvar contatos.');
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
              </div>

              <div className="space-y-8">
                 <div className="space-y-4">
                    <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2"><Camera className="w-5 h-5 text-primary"/> Evolução Visual</h3>
                    
                    {!stream && !photo && (
                       <button onClick={startCamera} className="w-full h-48 border-2 border-dashed border-surface-highest rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-primary hover:border-primary transition-colors hover:bg-primary/5">
                          <Camera className="w-8 h-8 mb-2 opacity-50" />
                          <span className="text-sm font-medium">Capturar Foto</span>
                       </button>
                    )}

                    {stream && (
                       <div className="space-y-3">
                          <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl border border-surface-highest bg-black object-cover aspect-[3/4] md:aspect-video"></video>
                          <canvas ref={canvasRef} width="640" height="480" className="hidden"></canvas>
                          <div className="flex gap-2">
                             <button onClick={capturePhoto} className="flex-1 bg-gradient-to-r from-primary to-primary-dim text-black font-bold py-3 rounded hover:opacity-90 transition-opacity">📸 Tirar Foto</button>
                             <button onClick={stopCamera} className="px-6 py-3 bg-surface border border-surface-highest text-zinc-400 rounded hover:text-white transition-colors">Cancelar</button>
                          </div>
                       </div>
                    )}

                    {photo && (
                       <div className="space-y-3 relative group w-full">
                          <span className="absolute top-2 left-2 bg-primary text-black text-[10px] uppercase font-bold px-2 py-1 rounded z-10">Hoje</span>
                          <img src={photo} alt="Progresso" className="w-full rounded-xl border-2 border-primary shadow-[0_0_15px_rgba(212,175,55,0.2)] object-cover aspect-[3/4] md:aspect-video" />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button onClick={() => {setPhoto(null); startCamera();}} className="bg-black/60 p-2 rounded flex items-center justify-center text-white hover:bg-black backdrop-blur text-xs font-bold transition-colors z-10">🔄 Refazer</button>
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
        </div>
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
                    <h4 className="font-bold text-white text-base leading-tight">{s.name}</h4>
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
    </div>
  );
}
