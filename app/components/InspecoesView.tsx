import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
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

  useEffect(() => {
    fetchStudents();
  }, []);

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
          // 1. Telegram integration
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
              }).then(res => res.json()).then(data => {
                if (!data.success) {
                  console.error('Erro ao enviar telegram:', data.error);
                }
              });
            } catch (tgErr) {
              console.error(tgErr);
            }
          }

          // 2. WhatsApp click-to-chat setup
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

        // Clear fields
        setBodyFat('');
        setWeight('');
        setSkeletalMuscle('');
        setHeartRate('');
        setEnergy('');
        setSleep('');
        setFeedback('');
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 relative">
      {success && <ParticleEffect onComplete={() => setSuccess(false)} />}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-heading font-bold text-white">Inspeção de Campo</h2>
        <button onClick={handleSave} className="px-4 py-2 bg-primary text-black font-bold uppercase tracking-wider rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)] w-full sm:w-auto justify-center">
          <Save className="w-4 h-4" /> Salvar Avaliação
        </button>
      </div>

      <div className="bg-surface-container border border-surface-highest rounded-xl p-4 md:p-8 max-w-3xl">
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
