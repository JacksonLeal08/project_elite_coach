import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, Scale, Heart, Info, Calendar, Sparkles, Activity } from 'lucide-react';
import ParticleEffect from './ParticleEffect';
import { supabase } from '../utils/supabase';
import { Student, User } from '../types';
import CustomAlertModal from './CustomAlertModal';

interface InspecoesViewProps {
  currentUser: User | null;
}

export default function InspecoesView({ currentUser }: InspecoesViewProps) {
  const [success, setSuccess] = useState<boolean>(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    recordName?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showCustomAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm', 
    recordName?: string,
    onConfirm?: () => void
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      recordName,
      onConfirm
    });
  };

  // Form states
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [bodyFat, setBodyFat] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [skeletalMuscle, setSkeletalMuscle] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [energy, setEnergy] = useState<string>('');
  const [sleep, setSleep] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [sendNotification, setSendNotification] = useState<boolean>(true);
  const [whatsappLink, setWhatsappLink] = useState<string>('');

  // Sidebar states
  const [lastInspection, setLastInspection] = useState<any | null>(null);
  const [loadingLastInspection, setLoadingLastInspection] = useState<boolean>(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (data) {
        setStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(data[0].id.toString());
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLastInspection = async (studentId: string) => {
    if (!studentId) return;
    setLoadingLastInspection(true);
    try {
      const { data, error } = await supabase
        .from('field_inspections')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching last inspection:', error);
        setLastInspection(null);
      } else if (data && data.length > 0) {
        setLastInspection(data[0]);
      } else {
        setLastInspection(null);
      }
    } catch (err) {
      console.error(err);
      setLastInspection(null);
    } finally {
      setLoadingLastInspection(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      fetchLastInspection(selectedStudentId);
    } else {
      setLastInspection(null);
    }
  }, [selectedStudentId]);

  const handleSave = async () => {
    if (!selectedStudentId) {
      return showCustomAlert('Aviso', 'Selecione um aluno para salvar a avaliação!', 'warning');
    }

    const student = students.find(s => s.id.toString() === selectedStudentId);
    if (!student) {
      return showCustomAlert('Erro', 'Aluno selecionado não encontrado.', 'error');
    }

    try {
      const { error } = await supabase
        .from('field_inspections')
        .insert([{
          student_id: selectedStudentId,
          body_fat: bodyFat ? parseFloat(bodyFat) : null,
          weight: weight ? parseFloat(weight) : null,
          skeletal_muscle: skeletalMuscle ? parseFloat(skeletalMuscle) : null,
          heart_rate: heartRate ? parseInt(heartRate) : null,
          energy: energy ? parseInt(energy) : null,
          sleep: sleep ? parseInt(sleep) : null,
          feedback: feedback || null
        }]);

      if (error) {
        showCustomAlert('Erro', 'Erro ao salvar avaliação: ' + error.message, 'error');
      } else {
        setSuccess(true);
        showCustomAlert('Sucesso', 'Avaliação física registrada com sucesso!', 'success');

        // Disparar notificações
        if (sendNotification) {
          if (student.telegram_chat_id) {
            let msg = `<b>Elite Coach - Nova Avaliação Física!</b>\n\n`;
            msg += `Olá, <b>${student.name}</b>! Sua avaliação física de hoje já foi registrada:\n\n`;
            if (weight) msg += `• <b>Peso:</b> ${weight} kg\n`;
            if (bodyFat) msg += `• <b>Gordura Corporal:</b> ${bodyFat}%\n`;
            if (skeletalMuscle) msg += `• <b>Massa Muscular:</b> ${skeletalMuscle} kg\n`;
            if (heartRate) msg += `• <b>Frequência Cardíaca:</b> ${heartRate} BPM\n`;
            if (energy) msg += `• <b>Nível de Energia:</b> ${energy}/10\n`;
            if (sleep) msg += `• <b>Qualidade do Sono:</b> ${sleep}/10\n`;
            if (feedback) msg += `• <b>Feedback:</b> <i>"${feedback}"</i>\n`;
            msg += `\nContinue focado nos treinos! 💪🏆`;

            try {
              fetch('/api/telegram/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: student.telegram_chat_id, message: msg })
              });
            } catch (tgErr) {
              console.error(tgErr);
            }
          }

          if (student.phone_number) {
            let waMsg = `*Elite Coach - Nova Avaliação Física!*\n\n`;
            waMsg += `Olá, *${student.name}*! Sua avaliação física de hoje já foi registrada:\n\n`;
            if (weight) waMsg += `• *Peso:* ${weight} kg\n`;
            if (bodyFat) waMsg += `• *Gordura Corporal:* ${bodyFat}%\n`;
            if (skeletalMuscle) waMsg += `• *Massa Muscular:* ${skeletalMuscle} kg\n`;
            if (heartRate) waMsg += `• *Frequência Cardíaca:* ${heartRate} BPM\n`;
            if (energy) waMsg += `• *Nível de Energia:* ${energy}/10\n`;
            if (sleep) waMsg += `• *Qualidade do Sono:* ${sleep}/10\n`;
            if (feedback) waMsg += `• *Feedback:* _"${feedback}"_\n`;
            waMsg += `\nContinue focado nos treinos! 💪🏆`;

            const encodedMsg = encodeURIComponent(waMsg);
            const cleanPhone = student.phone_number.replace(/\D/g, '');
            const url = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
            setWhatsappLink(url);
          }
        }

        setBodyFat('');
        setWeight('');
        setSkeletalMuscle('');
        setHeartRate('');
        setEnergy('');
        setSleep('');
        setFeedback('');

        fetchLastInspection(selectedStudentId);
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado: ' + err.message, 'error');
    }
  };

  const selectedStudent = students.find(s => s.id.toString() === selectedStudentId);
  const studentHeight = lastInspection?.height ? parseFloat(lastInspection.height.toString()) : null;

  const calculateIMC = (w: number, h: number) => {
    if (!w || !h) return null;
    const value = w / (h * h);
    let category = 'Normal';
    let color = 'text-emerald-400';
    let bg = 'bg-emerald-500/10 border-emerald-500/20';
    if (value < 18.5) {
      category = 'Abaixo do Peso';
      color = 'text-amber-400';
      bg = 'bg-amber-500/10 border-amber-500/20';
    } else if (value >= 25 && value < 30) {
      category = 'Sobrepeso';
      color = 'text-orange-400';
      bg = 'bg-orange-500/10 border-orange-500/20';
    } else if (value >= 30) {
      category = 'Obesidade';
      color = 'text-red-400';
      bg = 'bg-red-500/10 border-red-500/20';
    }
    return { value: value.toFixed(1), category, color, bg };
  };

  const imcData = lastInspection?.weight && studentHeight
    ? calculateIMC(parseFloat(lastInspection.weight), studentHeight)
    : null;

  return (
    <div className="space-y-6 relative">
      {success && <ParticleEffect onComplete={() => setSuccess(false)} />}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-heading font-bold text-white">Inspeção de Campo</h2>
        <button onClick={handleSave} className="px-4 py-2 bg-primary text-black font-bold uppercase tracking-wider rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)] w-full sm:w-auto justify-center">
          <Save className="w-4 h-4" /> Salvar Avaliação
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-surface-container border border-surface-highest rounded-xl p-4 md:p-8">
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Aluno Selecionado</label>
                {loading ? (
                  <p className="text-zinc-500 text-xs italic mt-1 animate-pulse">Carregando lista de alunos...</p>
                ) : students.length === 0 ? (
                  <p className="text-red-400 text-xs italic mt-1">Nenhum aluno cadastrado! Cadastre alunos na aba de Alunos antes de registrar avaliações.</p>
                ) : (
                  <select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)} className="w-full bg-surface-high border border-surface-highest text-white rounded p-3 mt-1 outline-none focus:border-primary">
                     {students.map(s => (
                       <option key={s.id} value={s.id}>{s.name} ({s.goal})</option>
                     ))}
                  </select>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2">📏 Biometria</h3>
                <div>
                  <label className="text-xs text-zinc-400">Gordura Corporal (%)</label>
                  <input type="number" step="0.1" value={bodyFat} onChange={e=>setBodyFat(e.target.value)} className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Peso Atual (kg)</label>
                  <input type="number" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)} className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Massa Muscular (kg)</label>
                  <input type="number" step="0.1" value={skeletalMuscle} onChange={e=>setSkeletalMuscle(e.target.value)} className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-bold text-primary">Frequência Cardíaca de Repouso (BPM)</label>
                  <input type="number" placeholder="Ex: 60" value={heartRate} onChange={e=>setHeartRate(e.target.value)} className="w-full bg-surface-high text-primary font-mono border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary shadow-[inset_0_0_10px_rgba(212,175,55,0.05)]"/>
                </div>
              </div>
              
              <div className="space-y-4 md:col-span-2">
                <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2">📝 Avaliação Subjetiva</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400">Nível de Energia (1-10)</label>
                    <input type="number" min="1" max="10" value={energy} onChange={e=>setEnergy(e.target.value)} className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Qualidade do Sono (1-10)</label>
                    <input type="number" min="1" max="10" value={sleep} onChange={e=>setSleep(e.target.value)} className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Feedback do Aluno / Queixas</label>
                  <textarea value={feedback} onChange={e=>setFeedback(e.target.value)} className="w-full bg-surface-high text-white border border-surface-highest rounded p-3 mt-1 h-24 resize-none outline-none focus:border-primary"></textarea>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="send_notification"
                  checked={sendNotification} 
                  onChange={e => setSendNotification(e.target.checked)} 
                  className="w-4.5 h-4.5 rounded border-surface-highest bg-surface-high text-primary focus:ring-primary accent-primary"
                />
                <label htmlFor="send_notification" className="text-sm text-zinc-300 font-medium cursor-pointer select-none">
                  Enviar Notificação ao Aluno (WhatsApp Link / Telegram Bot)
                </label>
              </div>

              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-sm text-zinc-300 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p>O sistema enviará uma notificação em segundo plano via bot do Telegram (se configurado Chat ID) e/ou exibirá um link rápido de WhatsApp.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container border border-surface-highest rounded-xl p-6 space-y-6">
          <div className="border-b border-surface-highest pb-3 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-base text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Último Registro
            </h3>
            {lastInspection && (
              <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {new Date(lastInspection.created_at || lastInspection.date).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {loadingLastInspection ? (
            <div className="space-y-4 animate-pulse py-8">
              <div className="h-4 bg-surface-high rounded w-2/3"></div>
              <div className="h-10 bg-surface-high rounded"></div>
              <div className="h-10 bg-surface-high rounded"></div>
              <div className="h-10 bg-surface-high rounded"></div>
            </div>
          ) : !lastInspection ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-high flex items-center justify-center mx-auto text-zinc-500 border border-surface-highest">
                <Info className="w-6 h-6" />
              </div>
              <p className="text-zinc-400 text-xs italic max-w-[200px] mx-auto leading-relaxed">
                Este aluno ainda não teve nenhuma avaliação de campo registrada no sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {imcData && (
                <div className={`p-4 rounded-xl border ${imcData.bg} flex items-center justify-between shadow-sm`}>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-zinc-400 uppercase font-bold block">Cálculo de IMC</span>
                    <span className={`text-base font-extrabold ${imcData.color}`}>{imcData.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-white leading-none">{imcData.value}</span>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold font-mono">kg/m²</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                {lastInspection.weight && (
                  <div className="p-3 bg-surface-high/60 border border-surface-highest/40 rounded-xl">
                    <span className="text-[9px] text-zinc-500 uppercase block font-bold mb-1">Peso</span>
                    <span className="text-white font-extrabold font-mono text-sm">{lastInspection.weight} <span className="text-[10px] text-zinc-500 font-normal">kg</span></span>
                  </div>
                )}
                {lastInspection.body_fat && (
                  <div className="p-3 bg-surface-high/60 border border-surface-highest/40 rounded-xl">
                    <span className="text-[9px] text-zinc-500 uppercase block font-bold mb-1">Gordura %</span>
                    <span className="text-white font-extrabold font-mono text-sm">{lastInspection.body_fat} <span className="text-[10px] text-zinc-500 font-normal">%</span></span>
                  </div>
                )}
                {lastInspection.skeletal_muscle && (
                  <div className="p-3 bg-surface-high/60 border border-surface-highest/40 rounded-xl col-span-2">
                    <span className="text-[9px] text-zinc-500 uppercase block font-bold mb-1">Massa Muscular</span>
                    <span className="text-white font-extrabold font-mono text-sm">{lastInspection.skeletal_muscle} <span className="text-[10px] text-zinc-500 font-normal">kg</span></span>
                  </div>
                )}
                {lastInspection.heart_rate && (
                  <div className="p-3 bg-surface-high/60 border border-surface-highest/40 rounded-xl col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase block font-bold mb-0.5">Freq. Cardíaca</span>
                      <span className="text-white font-extrabold font-mono text-sm">{lastInspection.heart_rate} <span className="text-[10px] text-zinc-500 font-normal">BPM</span></span>
                    </div>
                    <svg 
                      className="w-6 h-6 shrink-0 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ animation: 'heartbeat 1.2s infinite ease-in-out', transformOrigin: 'center' }}
                    >
                      <style>{`
                        @keyframes heartbeat {
                          0% { transform: scale(1); }
                          14% { transform: scale(1.18); }
                          28% { transform: scale(1); }
                          42% { transform: scale(1.18); }
                          70% { transform: scale(1); }
                        }
                      `}</style>
                      <defs>
                        <radialGradient id="heart3D" cx="35%" cy="35%" r="65%" fx="35%" fy="35%">
                          <stop offset="0%" stopColor="#ff5e5e" />
                          <stop offset="35%" stopColor="#e60000" />
                          <stop offset="75%" stopColor="#990000" />
                          <stop offset="100%" stopColor="#540000" />
                        </radialGradient>
                      </defs>
                      <path 
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
                        fill="url(#heart3D)"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-surface-highest/40 pt-4">
                <span className="text-[9px] text-zinc-500 uppercase block font-bold">Métricas Subjetivas</span>
                <div className="flex justify-between text-xs p-2 bg-surface-high/30 rounded-lg">
                  <span className="text-zinc-400">Qualidade do Sono</span>
                  <span className="text-[#dfbf80] font-bold font-mono">{lastInspection.sleep || 'N/A'}/10</span>
                </div>
                <div className="flex justify-between text-xs p-2 bg-surface-high/30 rounded-lg">
                  <span className="text-zinc-400">Nível de Energia</span>
                  <span className="text-[#dfbf80] font-bold font-mono">{lastInspection.energy || 'N/A'}/10</span>
                </div>
              </div>

              {lastInspection.feedback && (
                <div className="space-y-1.5 border-t border-surface-highest/40 pt-4">
                  <span className="text-[9px] text-zinc-500 uppercase block font-bold">Feedback / Queixas</span>
                  <p className="text-xs text-zinc-400 bg-surface-high/40 border border-surface-highest/30 p-3 rounded-lg italic leading-relaxed">
                    “{lastInspection.feedback}”
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {whatsappLink && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-primary/30 rounded-xl p-6 max-w-md w-full text-center space-y-4 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <h3 className="text-xl font-heading font-bold text-white">Avaliação Salva!</h3>
            <p className="text-sm text-zinc-300">Como este aluno possui WhatsApp cadastrado, você pode disparar o resumo da avaliação física clicando no botão abaixo.</p>
            <div className="flex flex-col gap-2">
              <a 
                href={whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={() => setWhatsappLink('')}
                className="w-full py-3 bg-[#25d366] text-black font-bold uppercase tracking-wider rounded hover:bg-[#20ba56] transition-colors flex items-center justify-center gap-2 text-sm font-bold"
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
