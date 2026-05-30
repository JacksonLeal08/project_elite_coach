'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, LayoutDashboard, Users, Dumbbell, Settings, FileSpreadsheet, X, ArrowRight, BookOpen, LogOut, CreditCard, Menu, Eye, EyeOff, ArrowLeft, User as UserIcon, Activity, Trophy, Calendar, Sparkles } from 'lucide-react';
import { ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import DashboardView from './components/DashboardView';
import AlunosView from './components/AlunosView';
import ProtocolosView from './components/ProtocolosView';
import InspecoesView from './components/InspecoesView';
import ConfigView from './components/ConfigView';
import BibliotecaView from './components/BibliotecaView';
import FinanceiroView from './components/FinanceiroView';
import { supabase } from './utils/supabase';
import { User } from './types';
import { getOfflineQueue, queueOfflineOperation, runOfflineSync } from './utils/offline';

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'app' | 'goodbye' | 'reset_password' | 'public_evolution'>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [publicToken, setPublicToken] = useState<string>('');
  
  // Login Logic
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  // Floating Support
  const [showSupportBtn, setShowSupportBtn] = useState<boolean>(true);

  const [sessionUser, setSessionUser] = useState<any | null>(null);

  // Forgot Password / Recovery States
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string>('');
  const [forgotSuccess, setForgotSuccess] = useState<string>('');

  // Reset Password States (For PASSWORD_RECOVERY redirection)
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>('');
  const [resetSuccess, setResetSuccess] = useState<string>('');
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  // Notifications States & Handlers
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);

  // Notification redirect states
  const [redirectStudentId, setRedirectStudentId] = useState<string | number | null>(null);
  const [redirectTab, setRedirectTab] = useState<'general' | 'anamnesis' | 'goals' | 'schedule' | 'attendance' | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const fetchAllStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name');
      if (data) {
        setAllStudents(data);
      }
    } catch (e) {
      console.error('Error fetching students list:', e);
    }
  };

  useEffect(() => {
    if (showNotificationsModal) {
      fetchAllStudents();
    }
  }, [showNotificationsModal]);

  const handleNotificationDetails = (n: any) => {
    // Try to find if any student's name is mentioned in the message/title
    const found = allStudents.find(s => 
      n.message.toLowerCase().includes(s.name.toLowerCase()) || 
      n.title.toLowerCase().includes(s.name.toLowerCase())
    );

    // Determine target sub-tab based on message contents
    let targetTab: 'general' | 'anamnesis' | 'goals' | 'schedule' | 'attendance' = 'general';
    const msgLower = n.message.toLowerCase();
    const titleLower = n.title.toLowerCase();
    
    if (msgLower.includes('ciente') || msgLower.includes('cronograma') || titleLower.includes('cronograma')) {
      targetTab = 'goals';
    } else if (msgLower.includes('retorno') || msgLower.includes('agend') || titleLower.includes('retorno') || msgLower.includes('sugeri')) {
      targetTab = 'schedule';
    } else if (msgLower.includes('treino') || msgLower.includes('conclui') || msgLower.includes('frequencia') || msgLower.includes('assiduidad')) {
      targetTab = 'attendance';
    }

    if (found) {
      setRedirectStudentId(found.id);
      setRedirectTab(targetTab);
    }
    
    // Always navigate to Alunos view and close modal
    setActiveTab('alunos');
    setShowNotificationsModal(false);
  };

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        setNotifications(data);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (!error) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (!error) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };


  // Separate useEffect to fetch profile when sessionUser is defined, avoiding auth loop deadlock
  useEffect(() => {
    if (!sessionUser) return;

    const loadProfile = async () => {
      console.log('loadProfile starting for user ID:', sessionUser.id);
      try {
        console.log('Querying profiles table in Supabase...');
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .maybeSingle();

        console.log('Profiles table query completed. profile:', profile, 'error:', error);

        if (profile) {
          console.log('Profile found, checking expiration and setting current user as:', profile.name);
          
          if (profile.expires_at) {
            const expiry = new Date(profile.expires_at);
            const now = new Date();
            if (now > expiry) {
              console.log('Profile has expired. Logging out.');
              setLoginError('Seu período de acesso contratado expirou. Entre em contato com a JIMMP Info.');
              setAuthState('login');
              await supabase.auth.signOut();
              setCurrentUser(null);
              return;
            }
          }

          setCurrentUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            unremovable: profile.unremovable,
            avatar_url: profile.avatar_url || undefined,
            expires_at: profile.expires_at || undefined
          });
        } else {
          console.log('Profile not found in profiles table, using fallback user details.');
          setCurrentUser({
            id: sessionUser.id,
            name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Treinador',
            email: sessionUser.email || '',
            role: 'Treinador',
            unremovable: false
          });
        }
        console.log('Setting authState to "app"');
        setAuthState('app');
      } catch (e) {
        console.error('Exception caught in loadProfile:', e);
        // Fallback user setting
        setCurrentUser({
          id: sessionUser.id,
          name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Treinador',
          email: sessionUser.email || '',
          role: 'Treinador',
          unremovable: false
        });
        setAuthState('app');
      }
    };

    loadProfile();
  }, [sessionUser]);

  // Expiry check interval
  useEffect(() => {
    if (!currentUser?.expires_at) return;
    const interval = setInterval(() => {
      const expiry = new Date(currentUser.expires_at!);
      const now = new Date();
      if (now > expiry) {
        handleLogoutWithMsg('Seu período de acesso contratado expirou. Entre em contato com a JIMMP Info.');
      }
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [currentUser]);

  // Notifications Polling
  useEffect(() => {
    if (!currentUser) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [currentUser]);


  useEffect(() => {
    console.log('App.tsx useEffect mounted');
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('elite_coach_theme');
      console.log('Saved theme in localStorage:', savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
      }

      // Check for public student_token
      const params = new URLSearchParams(window.location.search);
      const token = params.get('student_token');
      if (token) {
        console.log('Public student_token found in URL:', token);
        setPublicToken(token);
        setAuthState('public_evolution');
        return; // Skip checking initial session for public token users
      }
    }

    // 1. Get initial session
    const checkInitialSession = async () => {
      console.log('checkInitialSession starting...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('checkInitialSession complete. Session found:', !!session);
        if (session?.user) {
          console.log('Initial session user email:', session.user.email);
          setSessionUser(session.user);
        } else {
          console.log('No initial session, setting authState to "login"');
          setAuthState('login');
        }
      } catch (e) {
        console.error('Exception in checkInitialSession:', e);
        setAuthState('login');
      }
    };

    checkInitialSession();

        // 2. Listen for auth changes
    console.log('Registering onAuthStateChange listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('onAuthStateChange fired! Event:', event, 'Has session:', !!session);
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event captured! Directing to reset_password...');
        setAuthState('reset_password');
        return;
      }
      if (session?.user) {
        console.log('Auth change detected user:', session.user.email);
        setSessionUser(session.user);
      } else {
        console.log('Auth change: no user session, setting authState to "login"');
        setSessionUser(null);
        setCurrentUser(null);
        setAuthState('login');
      }
    });

    return () => {
      console.log('App.tsx useEffect unmounting, unsubscribing from auth changes');
      subscription.unsubscribe();
    };
  }, []);

    const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthState('loading');

    try {
      let targetEmail = email.trim();
      if (!targetEmail.includes('@')) {
        const { data: profileEmail, error: lookupError } = await supabase
          .rpc('get_profile_by_username', { p_username: targetEmail.toLowerCase() });
        
        if (lookupError || !profileEmail || profileEmail.length === 0) {
          setLoginError('Nome de usuário não encontrado.');
          setAuthState('login');
          return;
        }
        targetEmail = profileEmail[0].email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password
      });

      if (error) {
        setLoginError(error.message || 'Credenciais inválidas.');
        setAuthState('login');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Erro de conexão.');
      setAuthState('login');
    }
  };


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : '',
      });

      if (error) {
        setForgotError(error.message);
      } else {
        setForgotSuccess('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.');
        setForgotEmail('');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    setResetSuccess('');

    if (newPassword !== confirmNewPassword) {
      setResetError('As senhas não coincidem.');
      setResetLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setResetError(error.message);
      } else {
        setResetSuccess('Sua senha foi redefinida com sucesso! Redirecionando...');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => {
          setAuthState('login');
          setResetSuccess('');
        }, 3000);
      }
    } catch (err: any) {
      setResetError(err.message || 'Erro ao redefinir a senha.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
     setAuthState('goodbye');
     setTimeout(async () => {
       try {
         await supabase.auth.signOut();
       } catch (e) {
         console.error('Logout error:', e);
       }
       setCurrentUser(null);
       setAuthState('login');
     }, 2000);
  };

  const handleLogoutWithMsg = async (msg?: string) => {
     setAuthState('loading');
     try {
       await supabase.auth.signOut();
     } catch (e) {
       console.error('Logout error:', e);
     }
     setCurrentUser(null);
     if (msg) setLoginError(msg);
     setAuthState('login');
  };

  if (authState === 'goodbye') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://i.ibb.co/jk8KJxCz/personal-trainer-loading-screen.png")' }}></div>
        <div className="absolute inset-0 bg-black/40 z-0 backdrop-blur-[2px]"></div>

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }} className="flex flex-col items-center z-10 w-full max-w-[420px] px-4">
            <motion.div 
               animate={{ scale: [1, 1.05, 1] }} 
               transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
               className="w-[360px] h-[360px] sm:w-[400px] sm:h-[400px] mb-2 flex items-center justify-center"
            >
               <img src="/logo.png" alt="Logo Jaira Leal" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </motion.div>
            
            <div className="mt-2 w-full h-5 rounded-full p-[2px] relative border border-[#dfbf80]/40 shadow-lg" style={{ backgroundColor: '#0a1a10' }}>
               <motion.div 
                 initial={{ width: "100%" }} 
                 animate={{ width: 0 }} 
                 transition={{ duration: 2.0, ease: "easeInOut" }} 
                 className="h-full rounded-full relative overflow-hidden"
                 style={{ background: 'linear-gradient(90deg, #dfbf80 0%, #18462b 100%)', boxShadow: '0 0 12px rgba(223,191,128,0.3)' }}
               />
               <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
            </div>
            <p className="mt-5 text-[#dfbf80] text-sm sm:text-base font-semibold tracking-wide drop-shadow-md">Até breve, Coach! Saindo do sistema...</p>
        </motion.div>
      </div>
    );
  }

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://i.ibb.co/jk8KJxCz/personal-trainer-loading-screen.png")' }}></div>
        <div className="absolute inset-0 bg-black/40 z-0 backdrop-blur-[2px]"></div>

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1 }} className="flex flex-col items-center z-10 w-full max-w-[420px] px-4">
            <motion.div 
               animate={{ scale: [1, 1.08, 1] }} 
               transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
               className="w-[360px] h-[360px] sm:w-[400px] sm:h-[400px] mb-2 flex items-center justify-center"
            >
               <img src="/logo.png" alt="Logo Jaira Leal" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
               <div className="hidden flex-col items-center justify-center">
                 <span className="text-6xl mb-2 drop-shadow-md">💃</span>
               </div>
            </motion.div>
            
            <div className="mt-2 w-full h-5 rounded-full p-[2px] relative border border-[#dfbf80]/40 shadow-lg" style={{ backgroundColor: '#0a1a10' }}>
               <motion.div 
                 initial={{ width: 0 }} 
                 animate={{ width: "80%" }} 
                 transition={{ duration: 2.5, ease: "easeInOut" }} 
                 className="h-full rounded-full relative overflow-hidden"
                 style={{ background: 'linear-gradient(90deg, #18462b 0%, #dfbf80 100%)', boxShadow: '0 0 12px rgba(223,191,128,0.3)' }}
               />
               <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
            </div>
            <p className="mt-5 text-[#dfbf80] text-sm sm:text-base font-semibold tracking-wide drop-shadow-md">Loading your personalized training plan...</p>
        </motion.div>
      </div>
    );
  }

  if (authState === 'login') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 bg-black">
        {/* Background mimic (Dark gym) */}
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://i.ibb.co/HDzs8w0w/personal-trainer-login-screen.png")' }}></div>
        {/* Slightly darken the image */}
        <div className="absolute inset-0 bg-black/40 z-0 backdrop-blur-[2px]"></div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 w-full max-w-[420px] backdrop-blur-[16px] rounded-[32px] overflow-hidden border border-white/20 p-8 sm:p-10" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%)', boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
           
           <div className="flex flex-col items-center mb-6 mt-[-10px]">
              <div className="w-[360px] h-[240px] sm:w-[380px] sm:h-[260px] mb-2 flex items-center justify-center">
                 <img src="/logo.png" alt="Logo Jaira Leal" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(20px 7px 7px white)' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                 <div className="hidden flex-col items-center justify-center">
                     <span className="text-4xl drop-shadow-sm">💃</span>
                 </div>
              </div>
           </div>

           <div className="text-center mb-6">
             <h3 className="text-[#0b2817] text-[15px] font-extrabold tracking-widest uppercase drop-shadow-sm">Bem-Vindo</h3>
           </div>

           <form onSubmit={handleLogin} className="space-y-4">
              {loginError && <div className="p-3 bg-red-500/10 text-red-700 text-sm font-semibold text-center rounded-xl border border-red-500/20">{loginError}</div>}
              <div>
                <input type="text" placeholder="E-mail ou Usuário" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-white/60 border border-[#8fa498]/60 rounded-xl text-[#0b2817] placeholder-[#5a6c60] font-medium focus:outline-none focus:border-[#0b2817] focus:bg-white transition-all shadow-sm" required />
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Senha" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  className="w-full px-5 pr-12 py-3.5 bg-white/60 border border-[#8fa498]/60 rounded-xl text-[#0b2817] placeholder-[#5a6c60] font-medium focus:outline-none focus:border-[#0b2817] focus:bg-white transition-all shadow-sm" 
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a6c60] hover:text-[#0b2817] transition-colors p-1 flex items-center justify-center"
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 ml-1">
                <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-4 h-4 accent-[#0b2817] cursor-pointer" />
                <label htmlFor="remember" className="text-[#0b2817] text-sm font-bold cursor-pointer hover:text-[#18462b] transition-colors">Lembrar-me</label>
              </div>
              <button type="submit" className="w-full py-4 mt-6 flex items-center justify-center gap-2 bg-[#0b2817] hover:bg-[#134026] text-white font-bold uppercase tracking-[0.1em] rounded-xl transition-all shadow-[0_8px_20px_rgba(11,40,23,0.3)] hover:shadow-[0_8px_25px_rgba(11,40,23,0.4)] hover:-translate-y-0.5 group">
                 <span>Entrar</span>
                 <ArrowRight className="w-5 h-5 opacity-80 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all" />
              </button>
           </form>
           
                       <div className="mt-8 text-center border-t border-[#8fa498]/20 pt-6">
             <button type="button" onClick={() => setShowForgotModal(true)} className="text-[13px] font-bold text-[#3c5647] hover:text-[#0b2817] transition-colors tracking-wide underline underline-offset-4 decoration-[#8fa498]/50 hover:decoration-[#0b2817]">Esqueci minha senha</button>
           </div>
         </motion.div>
         
         {/* Forgot Password Modal */}
         <AnimatePresence>
           {showForgotModal && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
               <motion.div 
                 initial={{ scale: 0.95, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.95, opacity: 0 }}
                 className="w-full max-w-[400px] bg-surface border border-surface-highest/60 p-6 sm:p-8 rounded-[24px] relative overflow-hidden"
                 style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
               >
                 <button 
                   type="button"
                   onClick={() => {
                     setShowForgotModal(false);
                     setForgotError('');
                     setForgotSuccess('');
                   }}
                   className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg bg-surface-high border border-surface-highest hover:border-white/20 transition-all"
                 >
                   <X className="w-4 h-4" />
                 </button>

                 <h4 className="text-sm font-bold text-[#dfbf80] mb-2 uppercase tracking-wider flex items-center gap-2">
                   🔐 Recuperação de Senha
                 </h4>
                 <p className="text-zinc-300 text-xs mb-6 leading-relaxed">
                   Digite seu e-mail cadastrado abaixo. Enviaremos um link seguro para redefinir a sua senha.
                 </p>

                 <form onSubmit={handleForgotPassword} className="space-y-4">
                   {forgotError && <div className="p-3 bg-red-500/10 text-red-400 text-xs font-semibold text-center rounded-xl border border-red-500/20">{forgotError}</div>}
                   {forgotSuccess && <div className="p-3 bg-green-500/10 text-[#00ff41] text-xs font-semibold text-center rounded-xl border border-green-500/20">{forgotSuccess}</div>}

                   <div>
                     <input 
                       type="email" 
                       placeholder="Seu e-mail" 
                       value={forgotEmail} 
                       onChange={e => setForgotEmail(e.target.value)} 
                       className="w-full px-4 py-3 bg-surface-high border border-surface-highest rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[#dfbf80]/50 transition-all" 
                       required 
                     />
                   </div>

                   <button 
                     type="submit" 
                     disabled={forgotLoading}
                     className="w-full py-3 bg-gradient-to-r from-primary to-primary-dim text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                     {forgotLoading ? 'Enviando...' : 'Enviar Link'}
                   </button>
                 </form>
               </motion.div>
             </div>
           )}
         </AnimatePresence>
       </div>
     );
   }

   if (authState === 'reset_password') {
     return (
        <div className="min-h-screen relative flex items-center justify-center p-4 bg-black">
          <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://i.ibb.co/HDzs8w0w/personal-trainer-login-screen.png")' }}></div>
          <div className="absolute inset-0 bg-black/40 z-0 backdrop-blur-[2px]"></div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 w-full max-w-[420px] backdrop-blur-[16px] rounded-[32px] overflow-hidden border border-white/20 p-8 sm:p-10" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%)', boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
             <div className="flex flex-col items-center mb-6 mt-[-10px]">
                <div className="w-[360px] h-[240px] sm:w-[380px] sm:h-[260px] mb-2 flex items-center justify-center">
                   <img src="/logo.png" alt="Logo Jaira Leal" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(20px 7px 7px white)' }} />
                </div>
             </div>

             <div className="text-center mb-6">
               <h3 className="text-[#0b2817] text-[15px] font-extrabold tracking-widest uppercase drop-shadow-sm">Redefinir Senha</h3>
               <p className="text-xs text-zinc-300 mt-1">Defina sua nova senha de acesso abaixo</p>
             </div>

             <form onSubmit={handleResetPassword} className="space-y-4">
                {resetError && <div className="p-3 bg-red-500/10 text-red-700 text-sm font-semibold text-center rounded-xl border border-red-500/20">{resetError}</div>}
                {resetSuccess && <div className="p-3 bg-green-500/10 text-[#00ff41] text-sm font-semibold text-center rounded-xl border border-green-500/20">{resetSuccess}</div>}
                
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    placeholder="Nova Senha" 
                    value={newPassword} 
                    onChange={e=>setNewPassword(e.target.value)} 
                    className="w-full px-5 pr-12 py-3.5 bg-white/60 border border-[#8fa498]/60 rounded-xl text-[#0b2817] placeholder-[#5a6c60] font-medium focus:outline-none focus:border-[#0b2817] focus:bg-white transition-all shadow-sm" 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a6c60] hover:text-[#0b2817] transition-colors p-1 flex items-center justify-center"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <div className="relative">
                  <input 
                    type={showConfirmNewPassword ? "text" : "password"} 
                    placeholder="Confirmar Nova Senha" 
                    value={confirmNewPassword} 
                    onChange={e=>setConfirmNewPassword(e.target.value)} 
                    className="w-full px-5 pr-12 py-3.5 bg-white/60 border border-[#8fa498]/60 rounded-xl text-[#0b2817] placeholder-[#5a6c60] font-medium focus:outline-none focus:border-[#0b2817] focus:bg-white transition-all shadow-sm" 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a6c60] hover:text-[#0b2817] transition-colors p-1 flex items-center justify-center"
                  >
                    {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <button type="submit" disabled={resetLoading} className="w-full py-4 mt-6 flex items-center justify-center gap-2 bg-[#0b2817] hover:bg-[#134026] text-white font-bold uppercase tracking-[0.1em] rounded-xl transition-all shadow-[0_8px_20px_rgba(11,40,23,0.3)] disabled:opacity-50">
                   <span>{resetLoading ? 'Salvando...' : 'Salvar Nova Senha'}</span>
                </button>
             </form>
          </motion.div>
        </div>
     );
   }

   if (authState === 'public_evolution') {
     return (
       <PublicEvolutionView token={publicToken} />
     );
   }

  return (
    <MainApp 
      currentUser={currentUser} 
      setCurrentUser={setCurrentUser} 
      showSupportBtn={showSupportBtn} 
      setShowSupportBtn={setShowSupportBtn} 
      handleLogout={handleLogout} 
      notifications={notifications}
      showNotificationsModal={showNotificationsModal}
      setShowNotificationsModal={setShowNotificationsModal}
      handleMarkAsRead={handleMarkAsRead}
      handleMarkAllAsRead={handleMarkAllAsRead}
      handleDeleteNotification={handleDeleteNotification}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      redirectStudentId={redirectStudentId}
      redirectTab={redirectTab}
      setRedirectStudentId={setRedirectStudentId}
      setRedirectTab={setRedirectTab}
      handleNotificationDetails={handleNotificationDetails}
    />
  );
}

function MainApp({ 
  currentUser, 
  setCurrentUser, 
  showSupportBtn, 
  setShowSupportBtn, 
  handleLogout,
  notifications,
  showNotificationsModal,
  setShowNotificationsModal,
  handleMarkAsRead,
  handleMarkAllAsRead,
  handleDeleteNotification,
  activeTab,
  setActiveTab,
  redirectStudentId,
  redirectTab,
  setRedirectStudentId,
  setRedirectTab,
  handleNotificationDetails
}: { 
  currentUser: User | null, 
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>, 
  showSupportBtn: boolean, 
  setShowSupportBtn: any, 
  handleLogout: () => void,
  notifications: any[],
  showNotificationsModal: boolean,
  setShowNotificationsModal: React.Dispatch<React.SetStateAction<boolean>>,
  handleMarkAsRead: (id: string) => Promise<void>,
  handleMarkAllAsRead: () => Promise<void>,
  handleDeleteNotification: (id: string) => Promise<void>,
  activeTab: string,
  setActiveTab: React.Dispatch<React.SetStateAction<string>>,
  redirectStudentId: string | number | null,
  redirectTab: 'general' | 'anamnesis' | 'goals' | 'schedule' | 'attendance' | null,
  setRedirectStudentId: React.Dispatch<React.SetStateAction<string | number | null>>,
  setRedirectTab: React.Dispatch<React.SetStateAction<'general' | 'anamnesis' | 'goals' | 'schedule' | 'attendance' | null>>,
  handleNotificationDetails: (n: any) => void
}) {

  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [showZoom, setShowZoom] = useState<boolean>(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA installation');
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  const mobileMainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5"/> },
    { id: 'alunos', label: 'Alunos', icon: <Users className="w-5 h-5"/> },
    { id: 'protocolos', label: 'Criar', icon: <Dumbbell className="w-5 h-5"/> },
  ];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR'));
      
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      };
      let formattedDate = now.toLocaleDateString('pt-BR', options);
      formattedDate = formattedDate.replace(/ de (\d{4})$/, ' $1');
      formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
      setDate(formattedDate);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSupportClick = () => {
     window.open("https://wa.me/5511999999999?text=Olá, preciso de suporte no Elite Coach CRM", "_blank");
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5"/> },
    { id: 'alunos', label: 'Alunos', icon: <Users className="w-5 h-5"/> },
    { id: 'protocolos', label: 'Criar Treino', icon: <Dumbbell className="w-5 h-5"/> },
    { id: 'biblioteca', label: 'Biblioteca', icon: <BookOpen className="w-5 h-5"/> },
    { id: 'inspecoes', label: 'Inspeções de Campo', icon: <FileSpreadsheet className="w-5 h-5"/> },
  ];

  if (currentUser?.role === 'Desenvolvedor' || currentUser?.role === 'Administrador') {
     navItems.push({ id: 'financeiro', label: 'Financeiro', icon: <CreditCard className="w-5 h-5"/> });
     navItems.push({ id: 'config', label: 'Configurações', icon: <Settings className="w-5 h-5"/> });
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 border-r border-surface-highest bg-surface-container flex-col shrink-0">
        <div className="p-5 border-b border-surface-highest flex items-center">
          <div className="w-full flex items-center gap-3">
             <div className="h-[48px] w-[48px] bg-gradient-to-br from-[#dfbf80]/20 to-[#dfbf80]/5 rounded-xl border border-[#dfbf80]/30 shadow-[0_0_15px_rgba(223,191,128,0.15)] flex items-center justify-center p-1.5 backdrop-blur-md shrink-0">
               <img src="/logo.png" alt="Logo Jaira Leal" className="h-full w-full object-contain" style={{ filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.2))' }} />
             </div>
             <div className="flex flex-col overflow-hidden">
                <span className="font-heading font-black text-white text-[13px] tracking-widest uppercase truncate leading-tight drop-shadow-sm">Elite Coach</span>
                <span className="text-[#dfbf80] text-[10px] font-bold tracking-[0.2em] uppercase mt-0.5 truncate drop-shadow-sm">Premium</span>
             </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_15px_rgba(212,175,55,0.05)]' 
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-surface-high'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-highest bg-surface-high/30 flex flex-col gap-2">
          {/* Digital Clock & Date */}
          <div className="text-center py-3 px-2 bg-surface rounded-xl border border-surface-highest/60 font-mono shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <div className="text-[9px] font-bold text-[#dfbf80] uppercase tracking-[0.2em] mb-1 select-none">
              Horário do Sistema
            </div>
            <div className="text-xl font-black tracking-widest text-[#00ff41] select-none drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]">
              {time || '00:00:00'}
            </div>
            <div className="text-[10px] text-zinc-400 font-medium mt-1.5 select-none truncate">
              {date || 'Quinta-feira, 28 de maio 2026'}
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container border-t border-surface-highest flex justify-around items-center z-40 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] animate-fade-in">
        {mobileMainItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setShowMobileMoreMenu(false);
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all ${
              activeTab === item.id && !showMobileMoreMenu
                ? 'text-primary' 
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === item.id && !showMobileMoreMenu ? 'bg-primary/10' : ''}`}>
              {item.icon}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">{item.label}</span>
          </button>
        ))}
         <button
           onClick={() => setShowMobileMoreMenu(prev => !prev)}
           className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all ${
             showMobileMoreMenu 
               ? 'text-primary' 
               : 'text-zinc-400 hover:text-zinc-100'
           }`}
         >
           <div className={`p-1 rounded-lg ${showMobileMoreMenu ? 'bg-primary/10' : ''}`}>
             <Menu className="w-5 h-5" />
           </div>
           <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">Mais</span>
         </button>
      </nav>

      {/* Mobile More Menu Bottom Sheet */}
      <AnimatePresence>
        {showMobileMoreMenu && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMoreMenu(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full bg-surface-container border-t border-surface-highest rounded-t-2xl p-6 pb-8 relative z-50 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-surface-highest pb-3 mb-4">
                <h3 className="text-sm font-bold text-[#dfbf80] uppercase tracking-wider">Mais Opções</h3>
                <button 
                  onClick={() => setShowMobileMoreMenu(false)}
                  className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-surface-high border border-surface-highest"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setActiveTab('biblioteca');
                    setShowMobileMoreMenu(false);
                  }}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 text-center ${
                    activeTab === 'biblioteca'
                      ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(212,175,55,0.1)]'
                      : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Biblioteca</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('inspecoes');
                    setShowMobileMoreMenu(false);
                  }}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 text-center ${
                    activeTab === 'inspecoes'
                      ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(212,175,55,0.1)]'
                      : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Inspeções</span>
                </button>

                {(currentUser?.role === 'Desenvolvedor' || currentUser?.role === 'Administrador') && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab('financeiro');
                        setShowMobileMoreMenu(false);
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 text-center ${
                        activeTab === 'financeiro'
                          ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(212,175,55,0.1)]'
                          : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Financeiro</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('config');
                        setShowMobileMoreMenu(false);
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 text-center ${
                        activeTab === 'config'
                          ? 'bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(212,175,55,0.1)]'
                          : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Settings className="w-5 h-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Ajustes</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setShowMobileMoreMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all gap-2 text-center"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Sair</span>
                </button>

                {showInstallBtn && (
                  <button
                    onClick={handleInstallClick}
                    className="col-span-3 py-3 bg-gradient-to-r from-primary to-primary-dim text-black font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.2)] animate-pulse mt-2"
                  >
                    📲 Instalar no Celular
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <header className="h-16 border-b border-surface-highest bg-surface/50 backdrop-blur flex items-center justify-between px-4 md:px-8">
           <div className="flex items-center bg-surface-high rounded-full border border-surface-highest px-3 py-1.5 w-44 sm:w-64 md:w-96 focus-within:border-primary/50 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
              <input type="text" placeholder="Buscar..." className="bg-transparent border-none outline-none text-xs md:text-sm w-full text-white placeholder-zinc-500" />
           </div>

           <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <button 
                onClick={() => setShowNotificationsModal(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-primary transition-colors hover:bg-surface-high relative"
              >
                 <Bell className="w-4 h-4" />
                 {notifications.filter(n => !n.read).length > 0 && (
                   <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border border-surface">
                     {notifications.filter(n => !n.read).length}
                   </span>
                 )}
              </button>

              {/* Logged in User Profile Info (Top Right) */}
              <div className="flex items-center gap-3 pl-3 border-l border-surface-highest">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">{currentUser?.name}</p>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{currentUser?.role}</p>
                </div>
                <button 
                  onClick={() => setShowZoom(true)}
                  className="h-9 w-9 rounded-full border border-primary/40 hover:border-primary transition-all p-0.5 hover:scale-105 active:scale-95 overflow-hidden flex items-center justify-center bg-surface-high relative cursor-pointer mr-1"
                  title="Ampliar foto de perfil"
                >
                  {currentUser?.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-surface border border-surface-highest flex items-center justify-center text-sm font-bold text-zinc-300">
                      {currentUser?.name.charAt(0)}
                    </div>
                  )}
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(true)} 
                  className="text-zinc-500 hover:text-red-400 hover:scale-110 active:scale-95 transition-all p-2 bg-surface rounded-lg border border-surface-highest/40 hover:border-red-500/20 hover:bg-red-500/5 flex items-center justify-center group shrink-0 ml-1" 
                  title="Sair da Conta"
                >
                  <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
           </div>
        </header>

        {/* Scrollable Content Wrapper (Fixed overall layout, scroll only in center) */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 md:p-8 pb-20 md:pb-8">
           {/* Center Content Panel */}
           <div className="flex-1 overflow-y-auto pr-0 sm:pr-1">
              <AnimatePresence mode="wait">
                 <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    {activeTab === 'dashboard' && <DashboardView />}
                    {activeTab === 'alunos' && (
                      <AlunosView 
                        currentUser={currentUser} 
                        redirectStudentId={redirectStudentId}
                        redirectTab={redirectTab}
                        clearRedirect={() => {
                          setRedirectStudentId(null);
                          setRedirectTab(null);
                        }}
                      />
                    )}
                    {activeTab === 'protocolos' && <ProtocolosView />}
                    {activeTab === 'biblioteca' && <BibliotecaView currentUser={currentUser} />}
                    {activeTab === 'financeiro' && <FinanceiroView currentUser={currentUser} />}
                    {activeTab === 'config' && <ConfigView currentUser={currentUser} onUserUpdate={(updatedUser: any) => setCurrentUser(updatedUser)} />}
                    {activeTab === 'inspecoes' && <InspecoesView currentUser={currentUser} />}
                 </motion.div>
              </AnimatePresence>
           </div>

            {/* Global Page Footer */}
            <footer className="py-1.5 mt-2 border-t border-surface-highest/20 text-center shrink-0 z-10 bg-surface/80 backdrop-blur-sm">
              <div className="text-[7.5px] sm:text-[9px] text-zinc-500 font-medium tracking-wide whitespace-nowrap overflow-x-auto scrollbar-none flex items-center justify-center gap-1 sm:gap-1.5 px-2">
                <span>© 2026 - Todos os direitos reservados</span>
                <span className="text-[#dfbf80]/30 shrink-0">|</span>
                <span>JIMMP Info</span>
                <span className="text-[#dfbf80]/30 shrink-0">|</span>
                <span className="text-[#dfbf80]/70 uppercase tracking-widest font-mono text-[7px] sm:text-[8px] shrink-0">Versão 1.2.0</span>
              </div>
            </footer>
        </div>
      </main>

      {/* Floating Support Button */}
      <AnimatePresence>
        {showSupportBtn && (
          <motion.div 
            drag
            dragConstraints={{ left: -1000, right: 0, top: -1000, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ scale: 0, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50 flex items-end flex-col gap-2 cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
             <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowSupportBtn(false)} className="w-6 h-6 bg-surface-highest text-zinc-400 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-lg">
                <X className="w-3 h-3" />
             </button>
             <button onPointerDown={(e) => e.stopPropagation()} onClick={handleSupportClick} className="w-16 h-16 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform group relative shadow-[0_0_15px_rgba(37,211,102,0.4)] overflow-hidden bg-transparent border-none outline-none">
                 <img src="https://i.ibb.co/p63JHmDM/372108180-WHATSAPP-ICON-1080.gif" alt="WhatsApp" className="w-full h-full object-cover scale-110 pointer-events-none" />
                 {/* Popup info */}
                 <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-surface-high border border-surface-highest text-white text-xs px-3 py-2 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Suporte ao Cliente
                 </div>
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom Profile Photo Modal */}
      <AnimatePresence>
        {showZoom && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowZoom(false)}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center cursor-zoom-out p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative max-w-sm w-full aspect-square bg-surface-container border border-surface-highest rounded-2xl overflow-hidden p-2 shadow-2xl animate-fade"
              onClick={(e) => e.stopPropagation()}
            >
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="Zoomed Profile" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="w-full h-full rounded-xl bg-surface border border-surface-highest flex flex-col items-center justify-center text-7xl font-bold text-zinc-500">
                  {currentUser?.name ? currentUser.name.charAt(0) : '?'}
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-4">Sem Foto Cadastrada</span>
                </div>
              )}
              <button 
                onClick={() => setShowZoom(false)}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full backdrop-blur-sm transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowLogoutConfirm(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative max-w-sm w-full bg-surface-container border border-surface-highest rounded-2xl p-6 shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 animate-pulse">
                <LogOut className="w-5 h-5" />
              </div>

              {/* Title & Desc */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-white mb-2 tracking-wide uppercase font-heading">Encerrar Sessão</h3>
                <p className="text-sm text-zinc-400 font-medium">Deseja realmente sair do Elite Coach?</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 bg-surface hover:bg-surface-high text-zinc-300 font-bold uppercase tracking-wider text-[11px] rounded-xl border border-surface-highest transition-all duration-200 active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold uppercase tracking-wider text-[11px] rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-200 active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotificationsModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowNotificationsModal(false)}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative max-w-md w-full bg-surface-container border border-surface-highest rounded-2xl p-6 shadow-2xl cursor-default flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-surface-highest pb-3 mb-4">
                <h3 className="text-sm font-bold text-[#dfbf80] uppercase tracking-wider flex items-center gap-2">
                  🔔 Notificações ({notifications.filter(n => !n.read).length} não lidas)
                </h3>
                <button 
                  onClick={() => setShowNotificationsModal(false)}
                  className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-surface-high border border-surface-highest"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {notifications.filter(n => !n.read).length > 0 && (
                <div className="flex justify-end mb-3">
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] text-primary font-bold uppercase tracking-wider hover:underline"
                  >
                    Marcar todas como lidas
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500 italic">
                    Nenhuma notificação registrada.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-3 rounded-xl border transition-all relative flex flex-col gap-1.5 ${
                        n.read 
                          ? 'bg-surface/30 border-surface-highest/40 opacity-60' 
                          : 'bg-[#dfbf80]/5 border-[#dfbf80]/20 shadow-[inset_0_0_10px_rgba(223,191,128,0.02)]'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          n.type === 'warning' 
                            ? 'bg-red-500/20 text-red-400' 
                            : n.type === 'success' 
                            ? 'bg-green-500/20 text-green-400' 
                            : n.type === 'schedule'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-zinc-500/20 text-zinc-300'
                        }`}>
                          {n.type === 'schedule' ? 'Agenda' : n.type === 'warning' ? 'Aviso' : n.type === 'success' ? 'Financeiro' : 'Info'}
                        </span>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleNotificationDetails(n)}
                            className="text-[9px] text-primary hover:underline uppercase font-bold"
                            title="Ver detalhes do aviso"
                          >
                            Detalhe
                          </button>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkAsRead(n.id)}
                              className="text-[9px] text-[#dfbf80] hover:underline uppercase font-bold"
                              title="Marcar como lida"
                            >
                              Lida
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteNotification(n.id)}
                            className="text-[9px] text-red-400 hover:text-red-300 hover:underline uppercase font-bold"
                            title="Excluir notificação"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-white">{n.title}</h4>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">{n.message}</p>
                      
                      <span className="text-[9px] text-zinc-500 self-end font-mono">
                        {new Date(n.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function PublicEvolutionView({ token }: { token: string }) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<any>(null);

  // Posture grid states
  const [activePostureAngle, setActivePostureAngle] = useState<'front' | 'back' | 'side'>('front');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridOpacity, setGridOpacity] = useState<number>(0.4);
  const [gridOffset, setGridOffset] = useState<number>(0);

  // Workout active tab, completions, video player, and celebration
  const [activeWorkoutDayIdx, setActiveWorkoutDayIdx] = useState<number>(0);
  const [activeWeekIdx, setActiveWeekIdx] = useState<number>(0);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [exerciseVideos, setExerciseVideos] = useState<Record<string, { video_url?: string; video_file_url?: string }>>({});
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string>('');

  // Return Scheduling states
  const [schedDate, setSchedDate] = useState<string>('');
  const [schedTime, setSchedTime] = useState<string>('');
  const [schedNotes, setSchedNotes] = useState<string>('');
  const [scheduling, setScheduling] = useState<boolean>(false);
  const [schedSuccess, setSchedSuccess] = useState<string>('');
  const [schedError, setSchedError] = useState<string>('');

  // Offline and notification states
  const [isOnline, setIsOnline] = useState<boolean>(typeof window !== 'undefined' ? navigator.onLine : true);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [showPublicAlerts, setShowPublicAlerts] = useState<boolean>(false);
  const [ackNotes, setAckNotes] = useState<string>('');
  const [acknowledging, setAcknowledging] = useState<boolean>(false);
  const [respondingSchId, setRespondingSchId] = useState<string | null>(null);
  
  // Notification dismissal local storage state
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('elite_coach_dismissed_alerts');
      if (stored) {
        try {
          setDismissedAlerts(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const handleDismissAlert = (alertId: string) => {
    const updated = [...dismissedAlerts, alertId];
    setDismissedAlerts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('elite_coach_dismissed_alerts', JSON.stringify(updated));
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com/embed/')) return url;
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('youtube.com/watch')) {
      const params = new URLSearchParams(url.split('?')[1]);
      videoId = params.get('v') || '';
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  const fetchData = async (showLoading = false) => {
    const cacheKey = `elite_coach_public_cache_${token}`;
    let cachedData: any = null;
    if (typeof window !== 'undefined') {
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          cachedData = JSON.parse(cachedStr);
        }
      } catch (err) {
        console.error('Error reading localStorage cache:', err);
      }
    }

    try {
      if (showLoading || (!data && !cachedData)) {
        setLoading(true);
      }

      // If offline, bypass network call and use cache directly
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (cachedData) {
          setData(cachedData);
          setError('');
        } else {
          setError('Você está offline e não possui dados salvos localmente.');
        }
        setLoading(false);
        return;
      }

      const { data: res, error: err } = await supabase.rpc('get_public_student_evolution', {
        p_token: token
      });

      if (err) {
        if (cachedData || data) {
          console.warn('Network request failed, falling back to cache:', err.message);
          if (cachedData && !data) setData(cachedData);
          setError('');
        } else {
          setError(err.message);
        }
      } else if (res && !res.success) {
        setError(res.message || 'Link inválido ou expirado.');
      } else if (res) {
        setData(res);
        setError('');
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res));
          } catch (cacheErr) {
            console.error('Error saving to localStorage cache:', cacheErr);
          }
        }
      }
    } catch (e: any) {
      if (cachedData || data) {
        console.warn('Network error, falling back to cache:', e.message);
        if (cachedData && !data) setData(cachedData);
        setError('');
      } else {
        setError(e.message || 'Erro de conexão ao buscar os dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const { data } = await supabase
          .from('exercise_library')
          .select('name, video_url, video_file_url');
        if (data) {
          const map: Record<string, { video_url?: string; video_file_url?: string }> = {};
          data.forEach((ex: any) => {
            map[ex.name.toLowerCase().trim()] = {
              video_url: ex.video_url || undefined,
              video_file_url: ex.video_file_url || undefined
            };
          });
          setExerciseVideos(map);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchLibrary();
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 10000); // Silent background polling every 10 seconds to catch trainer updates
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      const queue = getOfflineQueue();
      setOfflineCount(queue.length);
    };

    const handleOnline = async () => {
      updateStatus();
      const res = await runOfflineSync();
      if (res.syncedCount > 0) {
        fetchData();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('offline_queue_changed', updateStatus);

    updateStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('offline_queue_changed', updateStatus);
    };
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: 'url("https://i.ibb.co/jk8KJxCz/personal-trainer-loading-screen.png")' }}></div>
        <div className="absolute inset-0 bg-black/60 z-0 backdrop-blur-[4px]"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center z-10 w-full max-w-[420px] px-6 text-center"
        >
          <motion.div 
             animate={{ 
               scale: [1, 1.04, 1],
               filter: [
                 'drop-shadow(0 0 20px rgba(223,191,128,0.25))',
                 'drop-shadow(0 0 35px rgba(223,191,128,0.5))',
                 'drop-shadow(0 0 20px rgba(223,191,128,0.25))'
               ]
             }} 
             transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
             className="w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] mb-4 flex items-center justify-center animate-fade-in"
          >
             <img 
               src="/logo.png" 
               alt="Logo Jaira Leal" 
               className="w-full h-full object-contain" 
               onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} 
             />
             <div className="hidden flex-col items-center justify-center">
               <span className="text-6xl mb-2 drop-shadow-md">💃</span>
             </div>
          </motion.div>
          
          <div className="w-48 h-1 rounded-full relative overflow-hidden bg-[#dfbf80]/10 border border-[#dfbf80]/20">
             <motion.div 
               animate={{ 
                 left: ["-100%", "100%"]
               }} 
               transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} 
               className="absolute top-0 bottom-0 w-1/2 rounded-full"
               style={{ background: 'linear-gradient(90deg, transparent 0%, #dfbf80 50%, transparent 100%)' }}
             />
          </div>
          
          <p className="mt-6 text-[#dfbf80] text-xs sm:text-sm font-semibold tracking-[0.15em] uppercase drop-shadow-md animate-pulse">
            Carregando evolução física...
          </p>
        </motion.div>
      </div>
    );
  }


  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center text-red-400 mb-6 text-2xl">
          ⚠️
        </div>
        <h2 className="text-xl font-heading font-bold text-white mb-2">Acesso Indisponível</h2>
        <p className="text-zinc-400 text-sm max-w-md mb-6">{error || 'O link que você está tentando acessar é inválido ou expirou.'}</p>
        <button 
          onClick={() => { window.location.href = '/'; }}
          className="px-6 py-2.5 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-primary-dim transition-colors"
        >
          Ir para Login
        </button>
      </div>
    );
  }

  const { student, goals, evaluations, anamnesis, latest_workout } = data;

  // Sorting evaluations by date for chart rendering
  const chartData = [...evaluations].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((e: any) => ({
    date: new Date(e.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
    weight: e.weight,
    body_fat: e.body_fat,
    skeletal_muscle: e.skeletal_muscle
  }));

  const currentWeight = evaluations.length > 0 ? evaluations[evaluations.length - 1].weight : null;
  const currentFat = evaluations.length > 0 ? evaluations[evaluations.length - 1].body_fat : null;
  const currentMuscle = evaluations.length > 0 ? evaluations[evaluations.length - 1].skeletal_muscle : null;

  const getPosturePhoto = () => {
    switch (activePostureAngle) {
      case 'back':
        return student.photo_back_url;
      case 'side':
        return student.photo_side_url;
      case 'front':
      default:
        return student.photo_front_url;
    }
  };

  const getDayOffsetInWeek = (d: number, totalDays: number): number => {
    if (totalDays === 1) return 0;
    if (totalDays === 2) return d === 0 ? 0 : 3;
    if (totalDays === 3) return d === 0 ? 0 : d === 1 ? 2 : 4;
    if (totalDays === 4) return d === 0 ? 0 : d === 1 ? 1 : d === 2 ? 3 : 4;
    if (totalDays === 5) return d;
    return d;
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

  const getWorkoutDateForKey = (wIdx: number, dIdx: number) => {
    const startStr = latest_workout?.start_date || latest_workout?.date || new Date().toISOString();
    const start = new Date(startStr + 'T12:00:00');
    start.setDate(start.getDate() + (wIdx * 7) + getDayOffsetInWeek(dIdx, latest_workout?.workout_data?.days?.length || 1));
    return start;
  };

  const formatWorkoutDate = (date: Date) => {
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dayMonth = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`;
  };

  const getWeekRangeLabel = (weekIdx: number) => {
    const startStr = latest_workout?.start_date || latest_workout?.date || new Date().toISOString();
    const start = new Date(startStr + 'T12:00:00');
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (weekIdx * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
  };

  const handleAcknowledgeProtocol = async (notes: string) => {
    if (!latest_workout) return;
    setAcknowledging(true);
    try {
      if (!navigator.onLine) {
        queueOfflineOperation('acknowledge_protocol', {
          p_token: token,
          p_protocol_id: latest_workout.id,
          p_notes: notes
        });
        setData((prev: any) => ({
          ...prev,
          latest_workout: {
            ...prev.latest_workout,
            acknowledged: true,
            acknowledgment_notes: notes
          }
        }));
        setAcknowledging(false);
        return;
      }

      const { data: res, error: err } = await supabase.rpc('acknowledge_public_protocol', {
        p_token: token,
        p_protocol_id: latest_workout.id,
        p_notes: notes
      });

      if (err) {
        console.error('Error acknowledging protocol:', err);
      } else {
        setData((prev: any) => ({
          ...prev,
          latest_workout: {
            ...prev.latest_workout,
            acknowledged: true,
            acknowledgment_notes: notes
          }
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleRespondPublicSchedule = async (scheduleId: string, action: 'accept' | 'decline') => {
    setRespondingSchId(scheduleId);
    try {
      if (!navigator.onLine) {
        queueOfflineOperation('respond_schedule', {
          p_token: token,
          p_schedule_id: scheduleId,
          p_action: action
        });
        
        setData((prev: any) => {
          const updatedSchedules = prev.schedules.map((s: any) => {
            if (s.id === scheduleId) {
              if (action === 'accept') {
                return {
                  ...s,
                  status: 'Confirmado',
                  scheduled_date: s.suggested_date || s.scheduled_date,
                  scheduled_time: s.suggested_time || s.scheduled_time,
                  suggested_date: null,
                  suggested_time: null
                };
              } else {
                return { ...s, status: 'Cancelado' };
              }
            }
            return s;
          });
          return { ...prev, schedules: updatedSchedules };
        });
        setRespondingSchId(null);
        return;
      }

      const { data: res, error: err } = await supabase.rpc('respond_public_schedule', {
        p_token: token,
        p_schedule_id: scheduleId,
        p_action: action
      });

      if (err) {
        console.error('Error responding public schedule:', err);
      } else {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRespondingSchId(null);
    }
  };

  const handleToggleExercise = async (exerciseName: string, wDayIdx: number, wWeekIdx: number) => {
    if (!latest_workout) return;
    
    const activeDayName = latest_workout.workout_data.days[wDayIdx]?.dayName;
    const activeDayDate = getWorkoutDateForKey(wWeekIdx, wDayIdx);
    const activeDayDateKey = activeDayDate.toISOString().split('T')[0];
    
    const activeDayProgressEntry = data.workout_progress?.find((p: any) => p.workout_date === activeDayDateKey && p.day_name === activeDayName);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const compareDate = new Date(activeDayDate);
    compareDate.setHours(0,0,0,0);
    
    const isCompleted = activeDayProgressEntry?.status === 'REALIZADO';
    const isFuture = compareDate > today;
    const isLocked = isCompleted || isFuture;
    
    if (isLocked) return;
    
    const totalExercises = latest_workout.workout_data.days[wDayIdx]?.exercises.length || 0;
    const currentChecked = activeDayProgressEntry?.checked_exercises || [];
    
    let newChecked: string[];
    if (currentChecked.includes(exerciseName)) {
      newChecked = currentChecked.filter((name: string) => name !== exerciseName);
    } else {
      newChecked = [...currentChecked, exerciseName];
    }
    
    let newStatus: 'REALIZADO' | 'PENDENTE' | 'NÃO REALIZADO' = 'PENDENTE';
    if (newChecked.length === totalExercises) {
      newStatus = 'REALIZADO';
    } else if (newChecked.length === 0) {
      if (compareDate < today) {
        newStatus = 'NÃO REALIZADO';
      }
    }
    
    try {
      if (!navigator.onLine) {
        queueOfflineOperation('save_progress', {
          p_token: token,
          p_protocol_id: latest_workout.id,
          p_workout_date: activeDayDateKey,
          p_day_name: activeDayName,
          p_checked_exercises: newChecked,
          p_total_exercises: totalExercises,
          p_status: newStatus
        });
        
        setData((prev: any) => {
          const oldProgress = prev.workout_progress || [];
          const exists = oldProgress.some((p: any) => p.workout_date === activeDayDateKey && p.day_name === activeDayName);
          
          let newProgress;
          if (exists) {
            newProgress = oldProgress.map((p: any) => 
              (p.workout_date === activeDayDateKey && p.day_name === activeDayName)
                ? { ...p, checked_exercises: newChecked, status: newStatus, total_exercises: totalExercises, updated_at: new Date().toISOString() }
                 : p
            );
          } else {
            newProgress = [
              ...oldProgress,
              {
                workout_date: activeDayDateKey,
                day_name: activeDayName,
                checked_exercises: newChecked,
                total_exercises: totalExercises,
                status: newStatus,
                protocol_id: latest_workout.id,
                student_id: student.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ];
          }
          return { ...prev, workout_progress: newProgress };
        });
        
        if (newStatus === 'REALIZADO') {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 4000);
        }
        return;
      }

      const { error: rpcError } = await supabase.rpc('save_public_workout_progress', {
        p_token: token,
        p_protocol_id: latest_workout.id,
        p_workout_date: activeDayDateKey,
        p_day_name: activeDayName,
        p_checked_exercises: newChecked,
        p_total_exercises: totalExercises,
        p_status: newStatus
      });
      
      if (rpcError) {
        console.error('Error saving workout progress:', rpcError);
        return;
      }
      
      setData((prev: any) => {
        const oldProgress = prev.workout_progress || [];
        const exists = oldProgress.some((p: any) => p.workout_date === activeDayDateKey && p.day_name === activeDayName);
        
        let newProgress;
        if (exists) {
          newProgress = oldProgress.map((p: any) => 
            (p.workout_date === activeDayDateKey && p.day_name === activeDayName)
              ? { ...p, checked_exercises: newChecked, status: newStatus, total_exercises: totalExercises, updated_at: new Date().toISOString() }
               : p
          );
        } else {
          newProgress = [
            ...oldProgress,
            {
              workout_date: activeDayDateKey,
              day_name: activeDayName,
              checked_exercises: newChecked,
              total_exercises: totalExercises,
              status: newStatus,
              protocol_id: latest_workout.id,
              student_id: student.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ];
        }
        return { ...prev, workout_progress: newProgress };
      });

      if (newStatus === 'REALIZADO') {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 4000);
        
        const { data: adminSettings } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'telegram_admin_chat_id')
          .maybeSingle();

        if (adminSettings?.value) {
          const tgMsg = `<b>💪 Elite Coach - Treino Concluído!</b>\n\n👤 <b>Aluno:</b> ${student.name}\n🏋️‍♂️ <b>Treino:</b> ${activeDayName}\n📅 <b>Data:</b> ${activeDayDateKey.split('-').reverse().join('/')}`;
          try {
            await fetch('/api/telegram/send-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: adminSettings.value, message: tgMsg })
            });
          } catch (tgErr) {
            console.error('Error sending Telegram alert:', tgErr);
          }
        }
      }
    } catch (err) {
      console.error('Exception saving workout progress:', err);
    }
  };

  const handleScheduleEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedDate || !schedTime) return;
    setScheduling(true);
    setSchedError('');
    setSchedSuccess('');
    
    try {
      const evaluationPayload = {
        p_token: token,
        p_scheduled_date: schedDate,
        p_scheduled_time: schedTime,
        p_notes: schedNotes
      };

      if (!navigator.onLine) {
        queueOfflineOperation('schedule_evaluation', evaluationPayload);
        setSchedSuccess('Agendamento solicitado localmente! Fila de sincronização ativa.');
        
        setData((prev: any) => ({
          ...prev,
          schedules: [
            ...(prev.schedules || []),
            {
              scheduled_date: schedDate,
              scheduled_time: schedTime,
              notes: schedNotes,
              status: 'Pendente',
              created_at: new Date().toISOString()
            }
          ]
        }));
        
        setSchedDate('');
        setSchedTime('');
        setSchedNotes('');
        setScheduling(false);
        return;
      }

      const { data: res, error: err } = await supabase.rpc('schedule_public_evaluation', evaluationPayload);
      
      if (err || (res && !res.success)) {
        setSchedError(err?.message || res?.message || 'Falha ao agendar retorno.');
      } else {
        setSchedSuccess('Retorno solicitado com sucesso!');
        
        setData((prev: any) => ({
          ...prev,
          schedules: [
            ...(prev.schedules || []),
            {
              scheduled_date: schedDate,
              scheduled_time: schedTime,
              notes: schedNotes,
              status: 'Pendente',
              created_at: new Date().toISOString()
            }
          ]
        }));
        
        setSchedDate('');
        setSchedTime('');
        setSchedNotes('');
        
        const { data: adminSettings } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'telegram_admin_chat_id')
          .maybeSingle();

        if (adminSettings?.value) {
          const tgMsg = `<b>📅 Elite Coach - Solicitação de Avaliação!</b>\n\n👤 <b>Aluno:</b> ${student.name}\n📅 <b>Data:</b> ${schedDate.split('-').reverse().join('/')}\n⏰ <b>Hora:</b> ${schedTime}\n📝 <b>Notas:</b> ${schedNotes || 'Sem observações'}`;
          try {
            await fetch('/api/telegram/send-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: adminSettings.value, message: tgMsg })
            });
          } catch (tgErr) {
            console.error('Error sending Telegram alert:', tgErr);
          }
        }
      }
    } catch (ex: any) {
      setSchedError(ex.message || 'Erro ao processar agendamento.');
    } finally {
      setScheduling(false);
    }
  };


  const unreadAlerts: any[] = [];
  if (latest_workout && !latest_workout.acknowledged) {
    const alertId = `new_protocol_${latest_workout.id}`;
    if (!dismissedAlerts.includes(alertId)) {
      unreadAlerts.push({
        id: alertId,
        type: 'protocol',
        title: '🏋️‍♂️ Novo Cronograma Liberado!',
        message: `Seu treinador liberou um novo cronograma: "${latest_workout.objective}".`
      });
    }
  }
  if (data?.schedules) {
    data.schedules.forEach((s: any, sIdx: number) => {
      if (s.status === 'Sugerido') {
        const alertId = `suggested_schedule_${s.id || sIdx}`;
        if (!dismissedAlerts.includes(alertId)) {
          unreadAlerts.push({
            id: alertId,
            type: 'schedule_suggested',
            title: '⚡ Nova Data Sugerida',
            message: `O professor sugeriu reagendar para ${new Date(s.suggested_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${s.suggested_time?.slice(0, 5)}.`
          });
        }
      } else if (s.status === 'Confirmado') {
        const alertId = `confirmed_schedule_${s.id || sIdx}`;
        if (!dismissedAlerts.includes(alertId)) {
          unreadAlerts.push({
            id: alertId,
            type: 'schedule_confirmed',
            title: '✅ Agendamento Confirmado',
            message: `Seu agendamento para o dia ${new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${s.scheduled_time?.slice(0, 5)} foi confirmado pelo treinador.`
          });
        }
      } else if (s.status === 'Cancelado') {
        const alertId = `cancelled_schedule_${s.id || sIdx}`;
        if (!dismissedAlerts.includes(alertId)) {
          unreadAlerts.push({
            id: alertId,
            type: 'schedule_cancelled',
            title: '❌ Agendamento Cancelado',
            message: `O agendamento do dia ${new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${s.scheduled_time?.slice(0, 5)} foi cancelado pelo treinador.`
          });
        }
      }
    });
  }

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      {/* Offline warning bar */}
      {(!isOnline || offlineCount > 0) && (
        <div className={`text-center py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
          !isOnline ? 'bg-red-500/20 text-red-400 border-b border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-b border-amber-500/30'
        }`}>
          <span>{!isOnline ? '📴 Modo Offline Ativo' : '⏳ Sincronização Pendente'}</span>
          {offlineCount > 0 && <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px]">{offlineCount} itens</span>}
        </div>
      )}

      {/* Premium Header */}
      <header className="border-b border-surface-highest bg-surface-container/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-[#dfbf80]/20 to-[#dfbf80]/5 rounded-lg border border-[#dfbf80]/30 flex items-center justify-center p-1 backdrop-blur-md">
              <img src="/logo.png" alt="Logo Jaira Leal" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="font-heading font-black text-white text-[11px] sm:text-xs tracking-widest uppercase leading-tight">Elite Coach</h1>
              <span className="text-[#dfbf80] text-[9px] font-bold tracking-[0.2em] uppercase">Evolução do Aluno</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5 px-3 py-1 bg-surface-high border border-surface-highest rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-[#dfbf80] animate-pulse" /> Acesso Seguro
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowPublicAlerts(prev => !prev)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-high hover:bg-surface-highest text-zinc-400 hover:text-primary transition-all relative border border-surface-highest/60"
              >
                <Bell className="w-4 h-4" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse border border-black" />
                )}
              </button>
              
              {/* Alert box dropdown */}
              <AnimatePresence>
                {showPublicAlerts && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-64 bg-surface-container border border-surface-highest rounded-xl p-4 shadow-2xl z-50 text-xs space-y-3"
                  >
                    <h4 className="font-bold text-white uppercase tracking-wider border-b border-surface-highest/60 pb-1.5">Avisos e Notificações</h4>
                    {unreadAlerts.length === 0 ? (
                      <p className="text-zinc-500 italic py-2">Nenhum aviso pendente.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {unreadAlerts.map(alert => (
                          <div key={alert.id} className="p-2.5 rounded bg-surface border border-surface-highest/40 space-y-1 relative group">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismissAlert(alert.id);
                              }}
                              className="absolute top-1.5 right-1.5 text-zinc-500 hover:text-white transition-colors"
                              title="Marcar como lida"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-bold text-[#dfbf80] text-[10px] block uppercase pr-4">{alert.title}</span>
                            <p className="text-zinc-400 text-[10.5px] leading-relaxed pr-4">{alert.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8 animate-fade-in">
        {/* Welcome Section */}
        <div className="text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(223,191,128,0.2)]">
              {student.photo_avatar_url ? (
                <img src={student.photo_avatar_url} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-[#dfbf80]">{student.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="text-left">
              <h2 className="text-3xl font-heading font-extrabold text-white tracking-tight">Olá, <span className="text-[#dfbf80]">{student.name}</span>!</h2>
              <p className="text-zinc-400 text-sm mt-0.5">Acompanhe aqui o seu histórico de evolução e treino ativo.</p>
            </div>
          </div>
        </div>

        {/* Suggested Schedules Card */}
        {data?.schedules && data.schedules.some((s: any) => s.status === 'Sugerido') && (
          <div className="space-y-3">
            {data.schedules.filter((s: any) => s.status === 'Sugerido').map((s: any, sIdx: number) => (
              <div 
                key={sIdx} 
                className="bg-gradient-to-r from-cyan-950/20 to-surface-container border border-cyan-500/30 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(6,182,212,0.05)]"
              >
                <div className="space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest block">Proposta de Retorno/Avaliação</span>
                  <h4 className="text-sm font-bold text-white leading-tight">
                    O treinador sugeriu reagendar para o dia <span className="font-mono text-cyan-300">{new Date(s.suggested_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span> às <span className="font-mono text-cyan-300">{s.suggested_time?.slice(0, 5)}</span>.
                  </h4>
                  {s.notes && <p className="text-zinc-400 text-xs italic">“{s.notes}”</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={respondingSchId === s.id}
                    onClick={() => handleRespondPublicSchedule(s.id, 'accept')}
                    className="px-4 py-2 bg-cyan-500 text-black hover:bg-cyan-400 font-bold uppercase tracking-wider text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    Aceitar Nova Data
                  </button>
                  <button
                    disabled={respondingSchId === s.id}
                    onClick={() => handleRespondPublicSchedule(s.id, 'decline')}
                    className="px-4 py-2 bg-surface hover:bg-surface-high border border-surface-highest text-zinc-300 hover:text-white font-bold uppercase tracking-wider text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    Recusar Proposta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Profile Card & Biomarker Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 bg-surface-container border border-surface-highest rounded-2xl p-6 flex flex-col items-center text-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(223,191,128,0.2)] mb-4">
              {student.photo_avatar_url ? (
                <img src={student.photo_avatar_url} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-[#dfbf80]">{student.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <h3 className="font-heading font-bold text-white text-base leading-tight truncate w-full">{student.name}</h3>
            <p className="text-zinc-400 text-xs mt-1 capitalize">{student.goal}</p>
            <div className="mt-4 pt-3 border-t border-surface-highest w-full text-[11px] text-zinc-400 flex flex-col gap-1">
              <span><strong>Idade:</strong> {student.age} anos</span>
              <span><strong>Biotipo:</strong> {student.biotype}</span>
            </div>
          </div>

          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Weight Card */}
            <div className="bg-surface-container border border-surface-highest rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-20 h-20 text-white" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Peso Atual</span>
                <span className="text-3xl font-black text-white font-mono mt-1 block">
                  {currentWeight ? `${currentWeight} kg` : '--'}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-highest/60 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Meta Definida</span>
                <span className="font-bold text-primary font-mono">{goals?.weight_target ? `${goals.weight_target} kg` : '-'}</span>
              </div>
            </div>

            {/* Body Fat Card */}
            <div className="bg-surface-container border border-surface-highest rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Trophy className="w-20 h-20 text-white" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">% de Gordura</span>
                <span className="text-3xl font-black text-white font-mono mt-1 block">
                  {currentFat ? `${currentFat}%` : '--'}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-highest/60 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Meta Definida</span>
                <span className="font-bold text-primary font-mono">{goals?.body_fat_target ? `${goals.body_fat_target}%` : '-'}</span>
              </div>
            </div>

            {/* Muscle Mass Card */}
            <div className="bg-surface-container border border-surface-highest rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-20 h-20 text-white" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Massa Muscular</span>
                <span className="text-3xl font-black text-white font-mono mt-1 block">
                  {currentMuscle ? `${currentMuscle} kg` : '--'}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-highest/60 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Meta Definida</span>
                <span className="font-bold text-primary font-mono">{goals?.muscle_target ? `${goals.muscle_target} kg` : '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Planilha de Treinos / Active Workout Section */}
        {latest_workout && latest_workout.workout_data && latest_workout.workout_data.days && (() => {
          const totalWeeks = parseInt(latest_workout.duration_weeks || '4', 10);
          
          // Calculate active week progress
          const activeWeekDays = latest_workout.workout_data.days;
          let weekTotalExercises = 0;
          let weekCheckedExercises = 0;
          activeWeekDays.forEach((day: any, idx: number) => {
            const wDate = getWorkoutDateForKey(activeWeekIdx, idx);
            const dateKey = wDate.toISOString().split('T')[0];
            const progressEntry = data.workout_progress?.find((p: any) => p.workout_date === dateKey && p.day_name === day.dayName);
            weekTotalExercises += day.exercises.length;
            weekCheckedExercises += progressEntry?.checked_exercises?.length || 0;
          });
          const weekProgressPct = weekTotalExercises > 0 ? Math.round((weekCheckedExercises / weekTotalExercises) * 100) : 0;

          // Day progress & states for active workout day
          const activeDayName = latest_workout.workout_data.days[activeWorkoutDayIdx]?.dayName;
          const activeDayDate = getWorkoutDateForKey(activeWeekIdx, activeWorkoutDayIdx);
          const activeDayDateKey = activeDayDate.toISOString().split('T')[0];
          const activeDayProgressEntry = data.workout_progress?.find((p: any) => p.workout_date === activeDayDateKey && p.day_name === activeDayName);
          
          const today = new Date();
          today.setHours(0,0,0,0);
          const compareDate = new Date(activeDayDate);
          compareDate.setHours(0,0,0,0);
          
          const isCompleted = activeDayProgressEntry?.status === 'REALIZADO';
          const isFuture = compareDate > today;
          const isLocked = isCompleted || isFuture;

          let dayPct = 0;
          if (activeDayProgressEntry && activeDayProgressEntry.total_exercises > 0) {
            dayPct = Math.round((activeDayProgressEntry.checked_exercises.length / activeDayProgressEntry.total_exercises) * 100);
          }

          return (
            <div className="bg-surface-container border border-surface-highest rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-highest/60 pb-3 gap-3">
                <div>
                  <h3 className="font-heading font-semibold text-lg text-white flex items-center gap-2">
                    💪 Seu Cronograma de Treino Ativo
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Objetivo: <strong className="text-[#dfbf80]">{latest_workout.objective}</strong> | Divisão: <strong>{latest_workout.split}</strong> ({latest_workout.duration_weeks} semanas)
                  </p>
                </div>
                
                <button 
                  onClick={() => window.open(`https://wa.me/5511999999999?text=Olá, coach! Estou com dúvidas sobre minha planilha de treinos...`, '_blank')}
                  className="px-4 py-2 bg-surface hover:bg-surface-high border border-surface-highest rounded text-zinc-300 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 self-start sm:self-center"
                >
                  💬 Chamar Treinador
                </button>
              </div>

              {/* Progress & Week Selector */}
              <div className="space-y-4">
                {/* Week Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2 scrollbar-none border-b border-surface-highest/40">
                  {Array.from({ length: totalWeeks }).map((_, wIdx) => (
                    <button
                      key={wIdx}
                      onClick={() => {
                        setActiveWeekIdx(wIdx);
                        setActiveWorkoutDayIdx(0);
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap text-left shrink-0 ${
                        activeWeekIdx === wIdx
                          ? 'bg-primary text-black font-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                          : 'bg-surface-high text-zinc-400 hover:text-zinc-200 border border-surface-highest/60'
                      }`}
                    >
                      Semana {wIdx + 1}
                      <span className="block text-[8px] lowercase opacity-80 font-normal mt-0.5">({getWeekRangeLabel(wIdx)})</span>
                    </button>
                  ))}
                </div>

                {/* Progress Bar for the active week */}
                <div className="bg-surface p-4 rounded-xl border border-surface-highest/60">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    <span>Frequência da Semana {activeWeekIdx + 1}</span>
                    <span className="font-mono text-primary text-xs">{weekProgressPct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-high rounded-full overflow-hidden border border-surface-highest">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${weekProgressPct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Left Day Selector Tabs */}
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 shrink-0 w-full md:w-56 scrollbar-none">
                  {latest_workout.workout_data.days.map((day: any, idx: number) => {
                    const wDate = getWorkoutDateForKey(activeWeekIdx, idx);
                    const dateKey = wDate.toISOString().split('T')[0];
                    const progressEntry = data.workout_progress?.find((p: any) => p.workout_date === dateKey && p.day_name === day.dayName);
                    const status = getWorkoutStatus(wDate, progressEntry);
                    
                    let pct = 0;
                    if (progressEntry && progressEntry.total_exercises > 0) {
                      pct = Math.round((progressEntry.checked_exercises.length / progressEntry.total_exercises) * 100);
                    }
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveWorkoutDayIdx(idx)}
                        className={`flex flex-col items-start p-3.5 rounded-xl border transition-all w-full min-w-[180px] md:min-w-0 text-left ${
                          activeWorkoutDayIdx === idx
                            ? 'bg-[#dfbf80]/10 border-[#dfbf80] text-[#dfbf80] shadow-[0_0_15px_rgba(223,191,128,0.15)]'
                            : 'bg-surface border-surface-highest text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-xs truncate">{day.dayName}</span>
                          {status === 'REALIZADO' ? (
                            <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30 font-extrabold">
                              FEITO
                            </span>
                          ) : status === 'NÃO REALIZADO' ? (
                            <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 font-extrabold">
                              FALTOU
                            </span>
                          ) : (
                            <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-extrabold">
                              {pct > 0 ? `${pct}%` : 'PENDENTE'}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-zinc-500 mt-1 font-medium font-sans">
                          {formatWorkoutDate(wDate)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Exercises List for Active Day */}
                <div className="flex-1 bg-surface/50 border border-surface-highest/60 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-highest/40 pb-3 gap-3">
                    <div>
                      <h4 className="font-heading font-black text-sm text-white uppercase tracking-wider">
                        {latest_workout.workout_data.days[activeWorkoutDayIdx]?.dayName}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-medium">
                        Marque cada exercício concluído.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-zinc-400">Progresso:</span>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'}`}>{dayPct}%</span>
                    </div>
                  </div>

                  {isLocked && (
                    <div className={`p-3 text-center text-xs rounded-lg font-bold border ${isFuture ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                      {isFuture ? '📅 Este treino está agendado para o futuro e ainda não foi liberado.' : '✓ Treino gravado e concluído com sucesso! Travado para edições.'}
                    </div>
                  )}

                  <div className="space-y-3 divide-y divide-surface-highest/20">
                    {latest_workout.workout_data.days[activeWorkoutDayIdx]?.exercises.map((ex: any, idx: number) => {
                      const videoInfo = exerciseVideos[ex.name.toLowerCase().trim()];
                      const hasVideo = !!(videoInfo?.video_url || videoInfo?.video_file_url);
                      const isChecked = activeDayProgressEntry?.checked_exercises?.includes(ex.name) || false;
                      
                      return (
                        <div key={idx} className="pt-3 first:pt-0 flex items-center justify-between gap-4 group transition-all">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isLocked}
                              onChange={() => handleToggleExercise(ex.name, activeWorkoutDayIdx, activeWeekIdx)}
                              className="w-4.5 h-4.5 rounded border-surface-highest bg-surface-high text-primary focus:ring-primary accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="space-y-0.5">
                              <h5 className={`font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-primary transition-colors flex items-center gap-2 ${isChecked ? 'line-through text-zinc-500' : ''}`}>
                                {ex.name}
                                {hasVideo && (
                                  <button
                                    onClick={() => {
                                      const url = videoInfo?.video_url || videoInfo?.video_file_url || '';
                                      setActiveVideoUrl(url);
                                      setActiveVideoTitle(ex.name);
                                    }}
                                    className="text-[8px] sm:text-[9px] bg-[#dfbf80]/20 text-[#dfbf80] border border-[#dfbf80]/30 px-1.5 py-0.5 rounded font-mono font-bold hover:bg-[#dfbf80] hover:text-black transition-colors shrink-0"
                                  >
                                    VER EXECUÇÃO
                                  </button>
                                )}
                              </h5>
                              {ex.notes && (
                                <p className="text-[10px] sm:text-[10.5px] text-zinc-400 italic">
                                  Obs: {ex.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2.5 font-mono text-[9.5px] sm:text-[10px] text-zinc-400 bg-surface px-2.5 py-1 rounded-lg border border-surface-highest/40 shrink-0">
                            <div>
                              <span className="text-[7.5px] text-zinc-500 uppercase font-bold block">Séries</span>
                              <span className="font-bold text-white text-xs">{ex.sets}</span>
                            </div>
                            <div className="border-l border-surface-highest/40 pl-2.5">
                              <span className="text-[7.5px] text-zinc-500 uppercase font-bold block">Reps</span>
                              <span className="font-bold text-white text-xs">{ex.reps}</span>
                            </div>
                            <div className="border-l border-surface-highest/40 pl-2.5">
                              <span className="text-[7.5px] text-zinc-500 uppercase font-bold block">Pausa</span>
                              <span className="font-bold text-white text-xs">{ex.rest}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Charts & Postural Evaluation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Postural Evaluation View */}
          <div className="bg-surface-container border border-surface-highest rounded-2xl p-6 space-y-6 h-fit">
            <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest/60 pb-2 flex items-center gap-2">
              📸 Avaliação Postural
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Analise seu alinhamento corporal sobreposto pela nossa grade geométrica calibrável. Selecione o ângulo abaixo:
            </p>

            {/* Posture Photo Selector Buttons */}
            <div className="flex gap-2">
              {(['front', 'back', 'side'] as const).map(angle => (
                <button
                  key={angle}
                  onClick={() => setActivePostureAngle(angle)}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded border transition-colors ${
                    activePostureAngle === angle
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'
                  }`}
                >
                  {angle === 'front' ? 'Frente' : angle === 'back' ? 'Costas' : 'Perfil'}
                </button>
              ))}
            </div>

            {/* Image Box with Overlaid Calibratable Grid */}
            <div className="border border-surface-highest rounded-xl overflow-hidden bg-black/60 relative flex items-center justify-center min-h-[300px]">
              {getPosturePhoto() ? (
                <div className="relative w-full aspect-[3/4] max-w-sm mx-auto overflow-hidden">
                  <img src={getPosturePhoto()} alt="Avaliação Postural" className="w-full h-full object-contain" />
                  
                  {/* Calibratable Grid Overlay */}
                  {showGrid && (
                    <div 
                      className="absolute inset-0 pointer-events-none flex items-center justify-center transition-opacity duration-300"
                      style={{ opacity: gridOpacity }}
                    >
                      {/* Central vertical cian line */}
                      <div 
                        className="absolute h-full w-[2px] border-l-2 border-dashed border-cyan-400"
                        style={{ left: `calc(50% + ${gridOffset}px)` }}
                      />
                      
                      {/* Grid cells */}
                      <div className="absolute inset-0 grid grid-cols-8 grid-rows-12">
                        {Array.from({ length: 96 }).map((_, index) => (
                          <div key={index} className="border-r border-b border-white/10" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500 italic">
                  Nenhuma foto postural cadastrada para este ângulo.
                </div>
              )}
            </div>

            {/* Calibrators */}
            {getPosturePhoto() && (
              <div className="space-y-4 pt-2 border-t border-surface-highest/60 text-[11px] text-zinc-400">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Sobrepor Grade</span>
                  <input 
                    type="checkbox" 
                    checked={showGrid} 
                    onChange={e => setShowGrid(e.target.checked)} 
                    className="accent-primary w-4 h-4 cursor-pointer"
                  />
                </div>
                
                {showGrid && (
                  <>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Calibração Horizontal da Linha</span>
                        <span className="font-mono text-zinc-300">{gridOffset > 0 ? `+${gridOffset}` : gridOffset}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-100" 
                        max="100" 
                        value={gridOffset} 
                        onChange={e => setGridOffset(parseInt(e.target.value))} 
                        className="w-full accent-primary bg-surface-high h-1 rounded-lg cursor-pointer"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Opacidade da Grade</span>
                        <span className="font-mono text-zinc-300">{Math.round(gridOpacity * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={gridOpacity} 
                        onChange={e => setGridOpacity(parseFloat(e.target.value))} 
                        className="w-full accent-primary bg-surface-high h-1 rounded-lg cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Evolution Charts Panel */}
          <div className="lg:col-span-2 bg-surface-container border border-surface-highest rounded-2xl p-6 space-y-6">
            <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest/60 pb-2 flex items-center gap-2">
              📈 Tendência de Evolução Física
            </h3>
            
            {chartData.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 italic">
                Nenhum histórico de avaliações físicas disponível para gerar gráficos.
              </div>
            ) : (
              <div className="space-y-8">
                {/* Weight Evolution Chart */}
                <div className="bg-surface p-4 rounded-xl border border-surface-highest/50">
                  <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-4">Evolução do Peso (kg)</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="date" stroke="#666" style={{ fontSize: 9 }} />
                        <YAxis stroke="#666" style={{ fontSize: 9 }} domain={['auto', 'auto']} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: 10, color: '#fff' }} />
                        {goals?.weight_target && (
                          <ReferenceLine y={goals.weight_target} stroke="#dfbf80" strokeDasharray="5 5" label={{ value: `Meta: ${goals.weight_target}kg`, fill: '#dfbf80', fontSize: 8, position: 'top' }} />
                        )}
                        <Line type="monotone" dataKey="weight" stroke="#d4af37" strokeWidth={3} dot={{ fill: '#d4af37', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Body Fat Evolution Chart */}
                <div className="bg-surface p-4 rounded-xl border border-surface-highest/50">
                  <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-4">Evolução da Gordura Corporal (%)</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="date" stroke="#666" style={{ fontSize: 9 }} />
                        <YAxis stroke="#666" style={{ fontSize: 9 }} domain={['auto', 'auto']} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: 10, color: '#fff' }} />
                        {goals?.body_fat_target && (
                          <ReferenceLine y={goals.body_fat_target} stroke="#dfbf80" strokeDasharray="5 5" label={{ value: `Meta: ${goals.body_fat_target}%`, fill: '#dfbf80', fontSize: 8, position: 'top' }} />
                        )}
                        <Line type="monotone" dataKey="body_fat" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Muscle Mass Evolution Chart */}
                <div className="bg-surface p-4 rounded-xl border border-surface-highest/50">
                  <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-4">Evolução da Massa Muscular (kg)</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="date" stroke="#666" style={{ fontSize: 9 }} />
                        <YAxis stroke="#666" style={{ fontSize: 9 }} domain={['auto', 'auto']} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: 10, color: '#fff' }} />
                        {goals?.muscle_target && (
                          <ReferenceLine y={goals.muscle_target} stroke="#dfbf80" strokeDasharray="5 5" label={{ value: `Meta: ${goals.muscle_target}kg`, fill: '#dfbf80', fontSize: 8, position: 'top' }} />
                        )}
                        <Line type="monotone" dataKey="skeletal_muscle" stroke="#00ff41" strokeWidth={3} dot={{ fill: '#00ff41', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Return Scheduling & Anamnesis Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scheduling Card */}
          <div className="bg-surface-container border border-surface-highest rounded-2xl p-6 space-y-4 h-fit">
            <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest/60 pb-2 flex items-center gap-2">
              📅 Agendar Retorno / Avaliação
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Solicite uma avaliação presencial ou de retorno com o treinador.
            </p>

            <form onSubmit={handleScheduleEvaluation} className="space-y-3">
              {schedError && <div className="p-2.5 bg-red-500/10 text-red-400 text-xs font-semibold text-center rounded-lg border border-red-500/20">{schedError}</div>}
              {schedSuccess && <div className="p-2.5 bg-green-500/10 text-green-400 text-xs font-semibold text-center rounded-lg border border-green-500/20">{schedSuccess}</div>}
              
              <div>
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Data Desejada</label>
                <input 
                  type="date" 
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} 
                  value={schedDate} 
                  onChange={e => setSchedDate(e.target.value)} 
                  className="w-full bg-surface-high border border-surface-highest text-white rounded-lg p-2.5 outline-none focus:border-primary text-xs font-sans" 
                  required 
                />
              </div>
              
              <div>
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Horário</label>
                <input 
                  type="time" 
                  value={schedTime} 
                  onChange={e => setSchedTime(e.target.value)} 
                  className="w-full bg-surface-high border border-surface-highest text-white rounded-lg p-2.5 outline-none focus:border-primary text-xs font-mono" 
                  required 
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Observações</label>
                <textarea 
                  value={schedNotes} 
                  onChange={e => setSchedNotes(e.target.value)} 
                  placeholder="Ex: Preferência por período matutino..." 
                  className="w-full bg-surface-high border border-surface-highest text-white rounded-lg p-2.5 h-16 resize-none outline-none focus:border-primary text-xs font-sans" 
                />
              </div>

              <button 
                type="submit" 
                disabled={scheduling}
                className="w-full py-2.5 bg-primary hover:bg-[#d4af37] text-black font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all shadow-[0_0_12px_rgba(212,175,55,0.2)] disabled:opacity-50"
              >
                {scheduling ? 'Enviando Solicitação...' : 'Solicitar Agendamento'}
              </button>
            </form>

            {data.schedules && data.schedules.length > 0 && (
              <div className="mt-4 pt-3 border-t border-surface-highest/40">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-2">Solicitações Recentes:</span>
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-none pr-1">
                  {data.schedules.map((s: any, sIdx: number) => (
                    <div key={sIdx} className="bg-surface p-2 rounded-lg border border-surface-highest/50 flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-white block">{new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{s.scheduled_time}</span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase ${
                        s.status === 'Realizado' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        s.status === 'Cancelado' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Anamnesis / Clinical Info (col-span-2) */}
          <div className="lg:col-span-2 bg-surface-container border border-surface-highest rounded-2xl p-6 space-y-6">
            <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest/60 pb-2 flex items-center gap-2">
              📋 Ficha de Anamnese e Observações Médicas
            </h3>
            
            {anamnesis ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-300">
                <div className="space-y-4">
                  <div className="p-4 bg-surface rounded-xl border border-surface-highest/50">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Restrições Médicas / Lesões</span>
                    <p className="leading-relaxed whitespace-pre-line text-[11px] text-zinc-100 font-medium">
                      {anamnesis.medical_restrictions || 'Nenhuma restrição registrada.'}
                    </p>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-surface-highest/50">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Histórico Cirúrgico</span>
                    <p className="leading-relaxed whitespace-pre-line text-[11px]">
                      {anamnesis.surgical_history || 'Nenhuma cirurgia relatada.'}
                    </p>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-[#dfbf80]/15">
                    <span className="text-[10px] text-[#dfbf80] font-bold uppercase block mb-1">Condição Cardiovascular</span>
                    <p className="leading-relaxed whitespace-pre-line text-[11px]">
                      {anamnesis.cardio_condition || 'Nenhuma condição cardiovascular informada.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-surface rounded-xl border border-surface-highest/50">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Medicamentos em Uso</span>
                    <p className="leading-relaxed whitespace-pre-line text-[11px]">
                      {anamnesis.medications || 'Nenhum medicamento relatado.'}
                    </p>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-surface-highest/50">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Hábitos Alimentares / Alergias</span>
                    <p className="leading-relaxed whitespace-pre-line text-[11px]">
                      {anamnesis.dietary_habits || 'Nenhum hábito específico ou alergia relatados.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-surface rounded-xl border border-surface-highest/50">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Meta Hidratação</span>
                      <p className="font-mono text-base font-bold text-white mt-1">
                        {anamnesis.water_intake ? `${anamnesis.water_intake} L / dia` : '--'}
                      </p>
                    </div>
                    <div className="p-4 bg-surface rounded-xl border border-[#dfbf80]/15">
                      <span className="text-[10px] text-[#dfbf80] font-bold uppercase block mb-1">Nível de Flexibilidade</span>
                      <p className="font-bold text-white mt-1 text-sm uppercase tracking-wide">
                        {anamnesis.flexibility_level || '--'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500 italic">
                Nenhuma ficha de anamnese disponível para este aluno.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-[#dfbf80]/10 backdrop-blur-[1px] animate-pulse" />
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [1.2, 1], opacity: [1, 0] }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-4xl sm:text-6xl font-black text-[#dfbf80] drop-shadow-[0_0_20px_rgba(223,191,128,0.8)] select-none uppercase tracking-widest text-center"
          >
            💪 Treino Concluído! <br/>
            <span className="text-xl sm:text-2xl mt-2 block text-white font-sans font-medium">BOM TRABALHO! 🏆</span>
          </motion.div>
          {Array.from({ length: 40 }).map((_, i) => {
            const angle = (i * 360) / 40;
            const radius = 100 + Math.random() * 200;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{ x, y, scale: 0, opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: i % 2 === 0 ? '#dfbf80' : '#18462b',
                  boxShadow: '0 0 10px rgba(223,191,128,0.5)',
                  left: '50%',
                  top: '50%'
                }}
              />
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      <AnimatePresence>
        {activeVideoUrl && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setActiveVideoUrl(null)}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative max-w-2xl w-full aspect-video bg-surface-container border border-surface-highest rounded-2xl overflow-hidden p-2 shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded backdrop-blur-md text-xs font-bold text-white border border-white/10 uppercase tracking-wider">
                🎥 {activeVideoTitle}
              </div>
              <button 
                onClick={() => setActiveVideoUrl(null)}
                className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-black text-white p-2 rounded-full backdrop-blur-sm transition-colors border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-full h-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                {activeVideoUrl.includes('youtube.com') || activeVideoUrl.includes('youtu.be') ? (
                  <iframe 
                    src={getEmbedUrl(activeVideoUrl)} 
                    title={activeVideoTitle} 
                    className="w-full h-full border-none" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen 
                  />
                ) : (
                  <video 
                    src={activeVideoUrl} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-contain" 
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ciente do Cronograma Popup Overlay */}
      {latest_workout && !latest_workout.acknowledged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg bg-surface-container border border-surface-highest rounded-2xl p-6 shadow-[0_0_50px_rgba(223,191,128,0.15)] flex flex-col max-h-[90vh]"
          >
            <div className="text-center mb-6 shrink-0 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-2 border-[#dfbf80] overflow-hidden bg-surface-high flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(223,191,128,0.2)] mb-3">
                {student.photo_avatar_url ? (
                  <img src={student.photo_avatar_url} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-[#dfbf80]">{student.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <h4 className="text-xs text-[#dfbf80] font-bold tracking-widest uppercase mb-1">{student.name}</h4>
              <h3 className="text-xl font-heading font-black text-white tracking-wide uppercase">Novo Cronograma Liberado!</h3>
              <p className="text-xs text-zinc-400 mt-1">Sua nova planilha de treinamentos foi montada.</p>
            </div>

            {/* Delay/remaining days check and messages */}
            {(() => {
              const startDate = latest_workout.start_date ? new Date(latest_workout.start_date + 'T12:00:00') : null;
              const today = new Date();
              today.setHours(0,0,0,0);
              let dayMessage = '';
              let isDelay = false;
              if (startDate) {
                startDate.setHours(0,0,0,0);
                const diffTime = startDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                  dayMessage = `📅 O treinamento está planejado para iniciar em ${diffDays} dia(s).`;
                } else if (diffDays < 0) {
                  dayMessage = `⚠️ Há um atraso de ${Math.abs(diffDays)} dia(s) para o aceite deste cronograma.`;
                  isDelay = true;
                } else {
                  dayMessage = `🔥 Seu cronograma começa HOJE!`;
                }
              }
              return (
                <div className={`p-3 text-center text-xs rounded-xl border mb-4 font-bold ${
                  isDelay ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-[#dfbf80]/10 border-[#dfbf80]/20 text-[#dfbf80]'
                }`}>
                  {dayMessage || 'Cronograma pronto para início imediato.'}
                </div>
              );
            })()}

            {/* Weekly workout grid summary (scroll-occluded) */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-none border border-surface-highest/60 rounded-xl p-4 bg-surface/50 mb-6 space-y-4">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block border-b border-surface-highest/60 pb-1.5">Resumo das Semanas</span>
              
              <div className="space-y-3">
                {latest_workout.workout_data?.days?.map((day: any, dIdx: number) => (
                  <div key={dIdx} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white uppercase">{day.dayName}</span>
                    <span className="text-zinc-400 text-[10.5px] truncate max-w-[200px]">
                      {day.exercises.map((e: any) => e.name).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Proposal feedback input form for beginning/dates adjustments */}
            <div className="space-y-3 mb-6 shrink-0">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Observações ou sugestões de ajuste (opcional)</label>
              <textarea 
                value={ackNotes} 
                onChange={e => setAckNotes(e.target.value)} 
                placeholder="Ex: Gostaria de alterar o início para segunda-feira, ou alterar os dias de descanso..." 
                className="w-full bg-surface border border-surface-highest rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 h-16 resize-none outline-none focus:border-primary"
              />
            </div>

            {/* Action button to save ciente and close the modal */}
            <button
              onClick={() => handleAcknowledgeProtocol(ackNotes)}
              disabled={acknowledging}
              className="w-full py-3 bg-[#dfbf80] hover:bg-[#d4af37] text-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-[0_0_20px_rgba(223,191,128,0.3)] transition-all shrink-0 disabled:opacity-50"
            >
              {acknowledging ? 'Confirmando...' : 'Estou Ciente e Concordo com o Cronograma'}
            </button>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 text-center text-[8px] text-zinc-600 font-medium tracking-widest select-none uppercase py-6 border-t border-surface-highest/30">
        © 2026 - Todos os direitos reservados | Jaira Leal Personal | Elite Coach Premium
      </footer>
    </div>
  );
}

