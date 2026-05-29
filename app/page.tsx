'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, LayoutDashboard, Users, Dumbbell, Settings, FileSpreadsheet, X, ArrowRight, BookOpen, LogOut, CreditCard, Menu } from 'lucide-react';
import DashboardView from './components/DashboardView';
import AlunosView from './components/AlunosView';
import ProtocolosView from './components/ProtocolosView';
import InspecoesView from './components/InspecoesView';
import ConfigView from './components/ConfigView';
import BibliotecaView from './components/BibliotecaView';
import FinanceiroView from './components/FinanceiroView';
import { supabase } from './utils/supabase';
import { User } from './types';

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'app'>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Login Logic
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  // Floating Support
  const [showSupportBtn, setShowSupportBtn] = useState<boolean>(true);

  const [sessionUser, setSessionUser] = useState<any | null>(null);

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

  useEffect(() => {
    console.log('App.tsx useEffect mounted');
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('elite_coach_theme');
      console.log('Saved theme in localStorage:', savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setLoginError(error.message || 'Credenciais inválidas.');
        setAuthState('login');
      }
      // Note: onAuthStateChange listener will automatically trigger profile fetching and change authState to 'app'
    } catch (err: any) {
      setLoginError(err.message || 'Erro de conexão.');
      setAuthState('login');
    }
  };

  const handleLogout = async () => {
     setAuthState('loading');
     try {
       await supabase.auth.signOut();
     } catch (e) {
       console.error('Logout error:', e);
     }
     setCurrentUser(null);
     setAuthState('login');
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
                <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-white/60 border border-[#8fa498]/60 rounded-xl text-[#0b2817] placeholder-[#5a6c60] font-medium focus:outline-none focus:border-[#0b2817] focus:bg-white transition-all shadow-sm" required />
              </div>
              <div>
                <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-5 py-3.5 bg-white/60 border border-[#8fa498]/60 rounded-xl text-[#0b2817] placeholder-[#5a6c60] font-medium focus:outline-none focus:border-[#0b2817] focus:bg-white transition-all shadow-sm" required />
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
             <button className="text-[13px] font-bold text-[#3c5647] hover:text-[#0b2817] transition-colors tracking-wide underline underline-offset-4 decoration-[#8fa498]/50 hover:decoration-[#0b2817]">Esqueci minha senha</button>
           </div>
        </motion.div>
      </div>
    );
  }

  return (
    <MainApp currentUser={currentUser} setCurrentUser={setCurrentUser} showSupportBtn={showSupportBtn} setShowSupportBtn={setShowSupportBtn} handleLogout={handleLogout} />
  );
}

function MainApp({ currentUser, setCurrentUser, showSupportBtn, setShowSupportBtn, handleLogout }: { currentUser: User | null, setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>, showSupportBtn: boolean, setShowSupportBtn: any, handleLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [showZoom, setShowZoom] = useState<boolean>(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState<boolean>(false);

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
                    handleLogout();
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
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-primary transition-colors hover:bg-surface-high relative">
                 <Bell className="w-4 h-4" />
                 <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
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
                  onClick={handleLogout} 
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
                    {activeTab === 'alunos' && <AlunosView currentUser={currentUser} />}
                    {activeTab === 'protocolos' && <ProtocolosView />}
                    {activeTab === 'biblioteca' && <BibliotecaView currentUser={currentUser} />}
                    {activeTab === 'financeiro' && <FinanceiroView currentUser={currentUser} />}
                    {activeTab === 'config' && <ConfigView currentUser={currentUser} onUserUpdate={(updatedUser: any) => setCurrentUser(updatedUser)} />}
                    {activeTab === 'inspecoes' && <InspecoesView currentUser={currentUser} />}
                 </motion.div>
              </AnimatePresence>
           </div>

           {/* Global Page Footer */}
           <footer className="mt-4 pt-4 border-t border-surface-highest/40 text-center space-y-0.5 shrink-0 z-10 bg-surface/80 backdrop-blur-sm">
             <p className="text-[11px] text-zinc-500">© 2026 - Todos os direitos reservados | JIMMP Info</p>
             <p className="text-[9px] text-[#dfbf80]/70 uppercase tracking-[0.2em] font-mono">Versão 1.2.0</p>
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
    </div>
  );
}
