import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Users, Settings, CheckCircle2, X, RotateCcw, Share2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { generatePDFAndShare } from '../utils/pdf';
import { User, ProfileConfig, HistoryEntry } from '../types';
import { supabase } from '../utils/supabase';

interface ConfigViewProps {
  currentUser: User | null;
}

export default function ConfigView({ currentUser }: ConfigViewProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [newUser, setNewUser] = useState<Pick<User, 'name' | 'email' | 'role'>>({ name: '', email: '', role: 'Treinador' });
  const [adding, setAdding] = useState<boolean>(false);
  
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, id: string | number | null, userTarget: User | null}>({isOpen: false, id: null, userTarget: null});

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<User | null>(null);

  const [theme, setTheme] = useState<string>(() => typeof window !== 'undefined' ? (localStorage.getItem('elite_coach_theme') || 'dark') : 'dark');

  const [botToken, setBotToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [savingToken, setSavingToken] = useState<boolean>(false);
  const [dbWarning, setDbWarning] = useState<string>('');
  
  const [profile, setProfile] = useState<ProfileConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('elite_coach_profile');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing profile', e);
        }
      }
    }
    return {
      name: 'Coach Miller',
      email: 'miller@elitecoach.com',
      specialty: 'Strength & Conditioning',
      instagram: '@coachmiller',
      whatsapp: '+55 11 99999-9999',
      logoUrl: 'https://i.ibb.co/Ld1WcP1t/NEW-LOGO-JAIRA-LEAL.png',
      pdfTemplate: '1'
    };
  });

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

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (data) {
        setUsers(data as User[]);
      }
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('workout_protocols')
        .select('*')
        .order('date', { ascending: false });

      if (data) {
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
      console.error('Error loading history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchTelegramToken = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'telegram_bot_token')
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('relation "public.system_settings" does not exist')) {
          setDbWarning('A tabela public.system_settings não existe no Supabase. Execute o script SQL no Supabase para criar.');
        } else {
          console.error('Error fetching bot token:', error);
        }
      } else if (data?.value) {
        setBotToken(data.value);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchHistory();
    fetchTelegramToken();
    fetchExerciseLibrary();
  }, []);

  const saveProfile = () => {
    localStorage.setItem('elite_coach_profile', JSON.stringify(profile));
    alert('Configurações salvas!');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('elite_coach_theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  const handleAdd = async () => {
    if(newUser.name && newUser.email) {
      try {
        // Sign up user in Supabase auth (it creates a user entry in auth.users)
        const { data, error } = await supabase.auth.signUp({
          email: newUser.email,
          password: 'ElitePassword798621!', // Temporary password
          options: {
            data: {
              name: newUser.name,
              role: newUser.role
            }
          }
        });

        if (error) {
          return alert('Erro ao registrar usuário: ' + error.message);
        }

        if (data.user) {
          // Explicitly insert into profiles in case the DB trigger is not active
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: data.user.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
              unremovable: false
            }]);

          if (profileError) {
             console.log('Skipping manual insert (DB trigger probably created profile already).');
          }
        }

        alert('Membro registrado com sucesso! Um e-mail de confirmação foi disparado.');
        setNewUser({ name: '', email: '', role: 'Treinador' });
        setAdding(false);
        fetchUsers();
      } catch (err: any) {
        alert('Erro ao registrar: ' + err.message);
      }
    }
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditForm({ ...u });
    setAdding(false);
  };
  
  const saveEdit = async () => {
    if(editForm && editForm.name && editForm.email) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: editForm.name,
            email: editForm.email,
            role: editForm.role
          })
          .eq('id', editingId);

        if (error) {
          alert('Erro ao atualizar perfil: ' + error.message);
        } else {
          setEditingId(null);
          setEditForm(null);
          fetchUsers();
        }
      } catch (err: any) {
        console.error(err);
      }
    }
  };

  const removeUser = async (id: string | number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao remover usuário: ' + error.message);
      } else {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const tryRemoveUser = (u: User) => {
    setConfirmModal({ isOpen: true, id: u.id, userTarget: u });
  };

  const handleSaveToken = async () => {
    setSavingToken(true);
    setDbWarning('');
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'telegram_bot_token', value: botToken, updated_at: new Date().toISOString() });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('relation "public.system_settings" does not exist')) {
          setDbWarning('Erro ao salvar: a tabela public.system_settings não existe no banco.');
        } else {
          alert('Erro ao salvar token: ' + error.message);
        }
      } else {
        alert('Token do Telegram salvo com sucesso!');
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro inesperado ao salvar.');
    } finally {
      setSavingToken(false);
    }
  };

  const handleTestConnection = async () => {
    if (!botToken) {
      alert('Digite o token do bot para testar.');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch('/api/telegram/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestMessage(`Conectado ao bot: @${data.bot.username}`);
      } else {
        setTestStatus('failed');
        setTestMessage(data.error || 'Falha na conexão com o bot.');
      }
    } catch (err: any) {
      setTestStatus('failed');
      setTestMessage(err.message || 'Erro de rede ao testar.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-white">Configurações e Histórico</h2>
        <div className="flex items-center gap-4 text-zinc-400">
           <button className="hover:text-white transition-colors"><Zap className="w-5 h-5"/></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8">
           <h3 className="font-heading font-semibold text-lg text-white mb-6 border-b border-surface-highest pb-2 flex items-center gap-2">
             <Users className="w-5 h-5 text-primary"/> Configurações do Perfil e Relatórios
           </h3>
           <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Nome Completo</label>
                <input type="text" value={profile.name} onChange={e=>setProfile({...profile, name: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Instagram</label>
                  <input type="text" value={profile.instagram || ''} onChange={e=>setProfile({...profile, instagram: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">WhatsApp</label>
                  <input type="text" value={profile.whatsapp || ''} onChange={e=>setProfile({...profile, whatsapp: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">URL da Logo (PDF)</label>
                <input type="text" value={profile.logoUrl || ''} onChange={e=>setProfile({...profile, logoUrl: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Modelo Visual PDF</label>
                <select value={profile.pdfTemplate} onChange={e=>setProfile({...profile, pdfTemplate: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors">
                  <option value="1">Modelo 1 - Clássico (Dourado/Branco)</option>
                  <option value="2">Modelo 2 - Moderno Escuro (Minimalista)</option>
                </select>
              </div>
              <button onClick={saveProfile} className="w-full py-3 mt-4 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)]">Salvar Configurações</button>
           </div>
        </div>

        {/* Bot Integration */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8">
           <h3 className="font-heading font-semibold text-lg text-white mb-6 border-b border-surface-highest pb-2 flex items-center gap-2">
             <Zap className="w-5 h-5 text-primary"/> Integração de Bot
           </h3>
           <p className="text-sm text-zinc-400 mb-6">Conecte seu bot do Telegram para automatizar notificações para clientes, lembretes de treinos e check-ins de progresso.</p>
           
           {dbWarning && (
             <div className="p-3 mb-4 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded">
               ⚠️ {dbWarning}
             </div>
           )}

           <div className="space-y-6">
              <div>
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Token do Bot do Telegram</label>
                <div className="relative mt-1">
                  <input 
                    type={showToken ? "text" : "password"} 
                    value={botToken} 
                    onChange={e=>setBotToken(e.target.value)} 
                    className="w-full bg-surface-high border border-surface-highest rounded p-3 pr-10 text-white text-sm outline-none focus:border-primary transition-colors font-mono" 
                    placeholder="Ex: 123456789:AABBCCDDEEFF..."
                  />
                  <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                     <Settings className="w-4 h-4"/>
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-surface-high border border-surface-highest rounded">
                 <div>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Status</div>
                    {testStatus === 'idle' && <div className="text-sm font-medium text-zinc-400">Não testado recentemente</div>}
                    {testStatus === 'testing' && <div className="text-sm font-medium text-amber-400 animate-pulse">Testando conexão...</div>}
                    {testStatus === 'success' && <div className="text-sm font-medium text-[#00ff41]">{testMessage}</div>}
                    {testStatus === 'failed' && <div className="text-sm font-medium text-red-400">{testMessage}</div>}
                 </div>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                   testStatus === 'success' ? 'bg-[#00ff41]/20 border border-[#00ff41]/40' :
                   testStatus === 'failed' ? 'bg-red-500/20 border border-red-500/40' :
                   testStatus === 'testing' ? 'bg-amber-500/20 border border-amber-500/40' :
                   'bg-zinc-800 border border-zinc-700'
                 }`}>
                    {testStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-[#00ff41]" />}
                    {testStatus === 'failed' && <X className="w-5 h-5 text-red-400" />}
                    {testStatus === 'testing' && <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />}
                    {testStatus === 'idle' && <span className="w-2 h-2 bg-zinc-500 rounded-full" />}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="w-full py-3 bg-surface border border-surface-highest text-zinc-300 hover:text-white font-bold uppercase tracking-wider rounded hover:border-primary/50 transition-colors disabled:opacity-50 text-xs"
                >
                  Testar
                </button>
                <button 
                  onClick={handleSaveToken}
                  disabled={savingToken}
                  className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors disabled:opacity-50 text-xs shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                >
                  {savingToken ? 'Salvando...' : 'Salvar Token'}
                </button>
              </div>
           </div>
        </div>

        {/* Team & Appearance */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8 col-span-1 md:col-span-2">
          <h3 className="font-heading font-semibold text-lg text-white mb-6 border-b border-surface-highest pb-2">Aparência do Sistema</h3>
          <div className="flex items-center justify-between bg-surface-high p-4 rounded-lg border border-surface-highest">
            <div>
              <p className="text-white font-medium">Tema Visual</p>
              <p className="text-zinc-400 text-sm">Alterne entre Dark Gold e Light Profissional</p>
            </div>
            <button 
              onClick={toggleTheme} 
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'light' ? 'bg-primary' : 'bg-surface-highest'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* System Users CRUD */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8 col-span-1 md:col-span-2">
           <div className="flex items-center justify-between border-b border-surface-highest pb-2 mb-6">
             <h3 className="font-heading font-semibold text-lg text-white">Usuários do Sistema</h3>
             <button onClick={() => setAdding(!adding)} className="text-xs py-1 px-3 bg-surface border border-surface-highest text-primary hover:border-primary rounded font-bold uppercase transition-colors">
               {adding ? 'Cancelar' : '+ Adicionar Membro'}
             </button>
           </div>
          
         <AnimatePresence>
            {adding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 bg-surface-high border border-primary/30 p-4 rounded-lg overflow-hidden relative">
                 <h4 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider">Novo Usuário</h4>
                 <div className="flex items-end gap-4">
                    <div className="flex-1"><label className="text-xs text-zinc-400">Nome</label><input type="text" value={newUser.name} onChange={e=>setNewUser({...newUser, name:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2 mt-1 text-white text-sm outline-none focus:border-primary" /></div>
                    <div className="flex-1"><label className="text-xs text-zinc-400">E-mail</label><input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser, email:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2 mt-1 text-white text-sm outline-none focus:border-primary" /></div>
                    <div className="w-48"><label className="text-xs text-zinc-400">Perfil de Acesso</label>
                      <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2 mt-1 text-white text-sm outline-none focus:border-primary">
                        <option>Treinador</option>
                        <option>Administrador</option>
                        <option>Desenvolvedor</option>
                      </select>
                    </div>
                    <button onClick={handleAdd} className="bg-primary text-black font-bold h-[38px] px-6 py-2 rounded hover:opacity-90">Salvar</button>
                 </div>
              </motion.div>
            )}
         </AnimatePresence>

         {loadingUsers ? (
            <p className="text-zinc-500 text-sm py-4 italic animate-pulse">Carregando membros da equipe...</p>
         ) : (
           <>
             {/* Desktop Table View */}
             <div className="hidden sm:block">
               <table className="w-full text-left text-sm text-zinc-300">
                 <thead className="bg-surface-high uppercase text-xs font-bold text-zinc-500">
                   <tr>
                     <th className="p-3 rounded-tl">Nome</th>
                     <th className="p-3">E-mail</th>
                     <th className="p-3">Acesso</th>
                     <th className="p-3 text-right rounded-tr">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-surface-highest">
                   {users.map(u => (
                     <tr key={u.id} className="hover:bg-surface-high/30">
                       <td className="p-3 font-medium text-white">
                          {editingId === u.id && editForm ? <input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary" /> : u.name}
                       </td>
                       <td className="p-3 text-zinc-400">
                          {editingId === u.id && editForm ? <input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm, email:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary" /> : u.email}
                       </td>
                       <td className="p-3">
                         {editingId === u.id && editForm && u.role !== 'Desenvolvedor' ? (
                            <select value={editForm.role} onChange={e=>setEditForm({...editForm, role:e.target.value})} className="bg-surface border border-surface-highest text-white rounded px-2 py-1 text-xs w-full outline-none focus:border-primary">
                              <option>Treinador</option>
                              <option>Administrador</option>
                            </select>
                         ) : (
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                             u.role === 'Desenvolvedor' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20' : 
                             u.role === 'Administrador' ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20' : 
                             'bg-zinc-800 text-zinc-300 border-zinc-700'
                           }`}>{u.role}</span>
                         )}
                       </td>
                       <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-4">
                            {editingId === u.id ? (
                              <>
                                 <button onClick={saveEdit} className="text-[#00ff41] hover:text-[#00ff41]/80 transition-colors uppercase text-xs font-bold tracking-wider">Salvar</button>
                                 <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-400 transition-colors uppercase text-xs font-bold tracking-wider">Canc</button>
                              </>
                            ) : (
                              <>
                                 <button onClick={() => startEdit(u)} className="text-[#d4af37] hover:text-[#d4af37]/80 transition-colors uppercase text-xs font-bold tracking-wider">Editar</button>
                                 {u.unremovable ? (
                                    <span className="text-xs text-zinc-600 italic">Protegido</span>
                                 ) : (
                                    <button onClick={() => tryRemoveUser(u)} className="text-zinc-500 hover:text-red-400 transition-colors uppercase text-xs font-bold tracking-wider flex items-center"><X className="w-3 h-3 mr-1" /> Remover</button>
                                 )}
                              </>
                            )}
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             {/* Mobile Cards View */}
             <div className="grid grid-cols-1 gap-4 sm:hidden">
               {users.map(u => (
                 <div key={u.id} className="bg-surface-high border border-surface-highest p-4 rounded-lg flex flex-col gap-3">
                   <div className="flex justify-between items-start">
                     <div>
                       {editingId === u.id && editForm ? (
                         <div className="space-y-2 mt-1">
                           <label className="text-[10px] text-zinc-500 font-bold block uppercase">Nome</label>
                           <input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary text-white" />
                           <label className="text-[10px] text-zinc-500 font-bold block uppercase">E-mail</label>
                           <input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm, email:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary text-white" />
                         </div>
                       ) : (
                         <>
                           <h4 className="font-bold text-white text-sm">{u.name}</h4>
                           <span className="text-xs text-zinc-400 block mt-0.5">{u.email}</span>
                         </>
                       )}
                     </div>
                     <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border shrink-0 ${
                       u.role === 'Desenvolvedor' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20' : 
                       u.role === 'Administrador' ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20' : 
                       'bg-zinc-800 text-zinc-300 border-zinc-700'
                     }`}>{u.role}</span>
                   </div>

                   {editingId === u.id && editForm && u.role !== 'Desenvolvedor' && (
                     <div className="w-full">
                       <label className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">Perfil de Acesso</label>
                       <select value={editForm.role} onChange={e=>setEditForm({...editForm, role:e.target.value})} className="bg-surface border border-surface-highest text-white rounded px-2 py-1.5 text-xs w-full outline-none focus:border-primary">
                         <option>Treinador</option>
                         <option>Administrador</option>
                       </select>
                     </div>
                   )}

                   <div className="flex justify-end gap-3 border-t border-surface-highest/40 pt-3">
                     {editingId === u.id ? (
                       <>
                          <button onClick={saveEdit} className="text-[#00ff41] hover:text-[#00ff41]/80 transition-colors uppercase text-xs font-bold tracking-wider">Salvar</button>
                          <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-400 transition-colors uppercase text-xs font-bold tracking-wider">Cancelar</button>
                       </>
                     ) : (
                       <>
                          <button onClick={() => startEdit(u)} className="text-[#d4af37] hover:text-[#d4af37]/80 transition-colors uppercase text-xs font-bold tracking-wider">Editar</button>
                          {u.unremovable ? (
                             <span className="text-xs text-zinc-600 italic">Protegido</span>
                          ) : (
                             <button onClick={() => tryRemoveUser(u)} className="text-zinc-500 hover:text-red-400 transition-colors uppercase text-xs font-bold tracking-wider flex items-center"><X className="w-3 h-3 mr-1" /> Remover</button>
                          )}
                       </>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           </>
         )}
      </div>

      {/* Workout history from Supabase */}
      <div className="bg-surface-container border border-surface-highest rounded-xl p-4 md:p-8 col-span-1 md:col-span-2">
         <div className="flex items-center gap-2 border-b border-surface-highest pb-2 mb-6">
            <RotateCcw className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg text-white">Histórico de Treinos Salvos</h3>
         </div>

         {loadingHistory ? (
           <p className="text-zinc-500 text-sm italic py-4 animate-pulse">Carregando histórico do banco de dados...</p>
         ) : history.length === 0 ? (
           <p className="text-zinc-500 text-sm italic py-4">Nenhum protocolo gerado ainda.</p>
         ) : (
           <>
             {/* Desktop Table View */}
             <div className="hidden sm:block">
               <table className="w-full text-left text-sm text-zinc-300">
                 <thead className="bg-surface-high uppercase text-xs font-bold text-zinc-500">
                   <tr>
                     <th className="p-3 rounded-tl">Data</th>
                     <th className="p-3">Nome do Aluno</th>
                     <th className="p-3">Tipo de Treino</th>
                     <th className="p-3">Status</th>
                     <th className="p-3 text-right rounded-tr">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-surface-highest">
                   {history.map(item => (
                     <tr key={item.id} className="hover:bg-surface-high/30">
                       <td className="p-3 font-medium text-white">{new Date(item.date).toISOString().split('T')[0]}</td>
                       <td className="p-3 text-zinc-100">{item.student}</td>
                       <td className="p-3 text-zinc-400 capitalize">{item.objective} {item.split}</td>
                       <td className="p-3">
                         <span className="px-2 py-1 bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 rounded text-[10px] font-bold uppercase tracking-widest">Concluído</span>
                       </td>
                       <td className="p-3 text-right text-zinc-500">
                         <button onClick={() => generatePDFAndShare(item, false, exerciseLibrary)} className="hover:text-primary transition-colors inline-block"><Share2 className="w-4 h-4"/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
                </table>
             </div>

             {/* Mobile Cards View */}
             <div className="grid grid-cols-1 gap-4 sm:hidden">
               {history.map(item => (
                 <div key={item.id} className="bg-surface-high border border-surface-highest p-4 rounded-lg flex flex-col gap-2">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] text-zinc-500 uppercase font-bold">{new Date(item.date).toISOString().split('T')[0]}</span>
                     <span className="px-2 py-0.5 bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 rounded text-[9px] font-bold uppercase tracking-widest">Concluído</span>
                   </div>
                   <div className="font-bold text-white text-sm mt-1">{item.student}</div>
                   <p className="text-xs text-zinc-400 capitalize truncate" title={item.objective}>{item.objective} {item.split}</p>
                   <div className="flex justify-end mt-2 pt-2 border-t border-surface-highest/40">
                     <button onClick={() => generatePDFAndShare(item, false, exerciseLibrary)} className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider">
                       <Share2 className="w-3.5 h-3.5"/> Compartilhar
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           </>
          )}
       </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({isOpen: false, id: null, userTarget: null})}
        onConfirm={() => {
          if (confirmModal.id !== null) {
            removeUser(confirmModal.id);
          }
        }}
        userTarget={confirmModal.userTarget}
        currentUser={currentUser}
      />
    </div>
  );
}
