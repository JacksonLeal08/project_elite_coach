'use client';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, Zap, CheckCircle2, ChevronRight, Send, LayoutDashboard, Users, Dumbbell, History, Settings, FileSpreadsheet, Plus, Share2, Mail, Save, Download, Camera, Check, Award, X, MessageCircle, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- MOCK DATA ---
const MOCK_USERS = [
  { id: 1, name: 'Jackson Leal', email: 'jackson602@gmail.com', role: 'Desenvolvedor', unremovable: true, pass: '798621' },
  { id: 2, name: 'Jaira Leal', email: 'jaira@elitecoach.com', role: 'Administrador', unremovable: false },
  { id: 3, name: 'Carlos Silva', email: 'carlos@elitecoach.com', role: 'Treinador', unremovable: false },
];

const MOCK_STUDENTS = [
  { id: 1, name: 'Marcus Johnson', age: 28, goal: 'Hipertrofia', biotype: 'Mesomorfo', status: 'Ativo', imc: 22.5, badges: [{name: 'Comprometido', icon: '🔥'}, {name: 'Evolução Rápida', icon: '🚀'}] },
  { id: 2, name: 'Sarah Connor', age: 34, goal: 'Perda de Peso', biotype: 'Endomorfo', status: 'Ativo', imc: 28.1, badges: [{name: 'Foco Total', icon: '🎯'}] },
  { id: 3, name: 'David Lee', age: 41, goal: 'Resistência', biotype: 'Ectomorfo', status: 'Inativo', imc: 24.0, badges: [] },
];

const MOCK_PROGRESSION = [
  { week: 'Sem 1', load: 120, volume: 3000 },
  { week: 'Sem 2', load: 135, volume: 3200 },
  { week: 'Sem 3', load: 140, volume: 3450 },
  { week: 'Sem 4', load: 155, volume: 3800 },
  { week: 'Sem 5', load: 170, volume: 4100 },
  { week: 'Sem 6', load: 185, volume: 4500 },
];

const MOCK_ACTIVITIES = [
  { id: 1, msg: 'Novo registro de peso inserido.', time: '10 min atrás', user: 'Marcus J.' },
  { id: 2, msg: 'Treino de Hipertrofia A concluído.', time: '1h atrás', user: 'Sarah C.' },
  { id: 3, msg: 'Protocolo expirando em 2 dias.', time: 'Ontem', user: 'David L.' },
];

function ParticleEffect({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2500);
    return () => clearTimeout(t);
  }, [onComplete]);

  const particles = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
    y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
    size: Math.random() * 10 + 4,
    color: ['#d4af37', '#b5952f', '#00ff41'][Math.floor(Math.random() * 3)]
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 0, x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400 }}
          animate={{
            opacity: [1, 1, 0],
            scale: [0, 1.5, 0.5],
            x: p.x,
            y: p.y,
          }}
          transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
          className="absolute rounded-full shadow-[0_0_10px_currentColor]"
          style={{ width: p.size, height: p.size, backgroundColor: p.color, color: p.color }}
        />
      ))}
    </div>
  );
}

// ... main component
export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'app'>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Login Logic
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Floating Support
  const [showSupportBtn, setShowSupportBtn] = useState(true);

  useEffect(() => {
    const sessionStr = localStorage.getItem('elite_coach_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.user && session.expiresAt && Date.now() < session.expiresAt) {
          setCurrentUser(session.user);
          setAuthState('app');
          return;
        } else {
           localStorage.removeItem('elite_coach_session');
        }
      } catch(e) {}
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && password) {
      if (user.pass && password !== user.pass) {
        setLoginError('Credenciais inválidas.');
        return;
      }
      
      setAuthState('loading');
      
      const t = setTimeout(() => {
        setCurrentUser(user);
        setAuthState('app');
        if (rememberMe) {
           localStorage.setItem('elite_coach_session', JSON.stringify({
              user: user,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000
           }));
        } else {
           localStorage.removeItem('elite_coach_session');
        }
      }, 2500);
      return () => clearTimeout(t);
    } else {
      setLoginError('Credenciais inválidas.');
    }
  };

  const handleLogout = () => {
     localStorage.removeItem('elite_coach_session');
     setCurrentUser(null);
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
               <img src="https://i.ibb.co/Ld1WcP1t/NEW-LOGO-JAIRA-LEAL.png" alt="Logo Jaira Leal" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
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
                 <img src="https://i.ibb.co/Ld1WcP1t/NEW-LOGO-JAIRA-LEAL.png" alt="Logo Jaira Leal" className="w-full h-full object-contain" style={{ filter: 'drop-shadow(20px 7px 7px rgba(255, 255, 255, 0.5))' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
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
    <MainApp currentUser={currentUser} setAuthState={setAuthState} showSupportBtn={showSupportBtn} setShowSupportBtn={setShowSupportBtn} handleLogout={handleLogout} />
  );
}

function MainApp({ currentUser, setAuthState, showSupportBtn, setShowSupportBtn, handleLogout }: { currentUser: any, setAuthState: any, showSupportBtn: boolean, setShowSupportBtn: any, handleLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const handleSupportClick = () => {
     window.open("https://wa.me/5511999999999?text=Olá, preciso de suporte no Elite Coach CRM", "_blank");
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5"/> },
    { id: 'alunos', label: 'Alunos', icon: <Users className="w-5 h-5"/> },
    { id: 'protocolos', label: 'Protocolos de Treino', icon: <Dumbbell className="w-5 h-5"/> },
    { id: 'inspecoes', label: 'Inspeções de Campo', icon: <FileSpreadsheet className="w-5 h-5"/> },
  ];

  if (currentUser?.role === 'Desenvolvedor') {
     navItems.push({ id: 'config', label: 'Configurações', icon: <Settings className="w-5 h-5"/> });
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Sidebar */}
      <aside className="w-64 border-r border-surface-highest bg-surface-container flex flex-col">
        <div className="p-5 border-b border-surface-highest flex items-center">
          <div className="w-full flex items-center gap-3">
             <div className="h-[48px] w-[48px] bg-gradient-to-br from-[#dfbf80]/20 to-[#dfbf80]/5 rounded-xl border border-[#dfbf80]/30 shadow-[0_0_15px_rgba(223,191,128,0.15)] flex items-center justify-center p-1.5 backdrop-blur-md shrink-0">
               <img src="https://i.ibb.co/Ld1WcP1t/NEW-LOGO-JAIRA-LEAL.png" alt="Logo Jaira Leal" className="h-full w-full object-contain" style={{ filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.2))' }} />
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

        <div className="p-4 border-t border-surface-highest bg-surface-high/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface border border-surface-highest flex items-center justify-center text-xs font-bold text-zinc-300">
                {currentUser?.name.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">{currentUser?.name}</p>
                <p className="text-xs text-primary">{currentUser?.role}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-zinc-500 hover:text-red-400 transition-colors p-2" title="Sair">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-surface-highest bg-surface/50 backdrop-blur flex items-center justify-between px-8">
           <div className="flex items-center bg-surface-high rounded-full border border-surface-highest px-4 py-2 w-96 focus-within:border-primary/50 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 mr-2" />
              <input type="text" placeholder="Buscar aluno, protocolo..." className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-zinc-500" />
           </div>

           <div className="flex items-center gap-4 border border-surface-highest rounded-full p-1 border-primary/20 bg-surface-container">
             <button className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-primary transition-colors hover:bg-surface-high relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
             </button>
           </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
           <AnimatePresence mode="wait">
             <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {activeTab === 'dashboard' && <DashboardView />}
                {activeTab === 'alunos' && <AlunosView />}
                {activeTab === 'protocolos' && <ProtocolosView />}
                {activeTab === 'config' && <ConfigView />}
                {activeTab === 'inspecoes' && <InspecoesView />}
             </motion.div>
           </AnimatePresence>
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
    </div>
  );
}

// --- SUB-VIEWS ---

function DashboardView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white">Dashboard Geral</h2>
          <p className="text-zinc-400 text-sm mt-1">Visão panorâmica da sua consultoria.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Alunos Ativos', val: '45', icon: <Users/>, trend: '+12%' },
          { label: 'Protocolos Gerados (Mês)', val: '128', icon: <Dumbbell/>, trend: '+5%' },
          { label: 'Faturamento Estimado', val: 'R$ 8.5K', icon: <Zap/>, trend: '+20%' },
          { label: 'Inspeções no Prazo', val: '98%', icon: <CheckCircle2/>, trend: '+2%' },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container border border-surface-highest p-5 rounded-xl hover:border-primary/50 transition-colors cursor-default group">
             <div className="flex items-center justify-between mb-4 text-zinc-400 group-hover:text-primary transition-colors">
               {React.cloneElement(s.icon as any, {className: "w-5 h-5"})}
               <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{s.trend}</span>
             </div>
             <div className="text-3xl font-heading font-bold text-white">{s.val}</div>
             <div className="text-sm text-zinc-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container border border-surface-highest rounded-xl p-6">
           <div className="flex justify-between items-center mb-6">
            <h3 className="font-heading font-semibold text-lg text-white">Progressão de Carga Média do Time (kg)</h3>
            <button className="text-xs uppercase font-bold text-primary hover:text-primary-dim flex items-center gap-1">Ver Relatório <ChevronRight className="w-4 h-4"/></button>
           </div>
           
           <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={MOCK_PROGRESSION}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
                    <XAxis dataKey="week" stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} width={40} />
                    <RechartsTooltip 
                       contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4' }}
                       itemStyle={{ color: '#d4af37' }}
                    />
                    <Line type="monotone" dataKey="load" stroke="#d4af37" strokeWidth={3} dot={{ r: 4, fill: '#d4af37' }} activeDot={{ r: 6 }} />
                 </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
           <h3 className="font-heading font-semibold text-lg text-white mb-6">Atividades Recentes</h3>
           <div className="space-y-6">
             {MOCK_ACTIVITIES.map((act) => (
               <div key={act.id} className="flex gap-4 relative">
                  <div className="w-px h-full bg-surface-highest absolute left-[15px] top-4"></div>
                  <div className="w-8 h-8 rounded-full bg-surface-high border-2 border-surface-highest flex-shrink-0 flex items-center justify-center z-10 text-xs text-zinc-400">
                    <History className="w-3 h-3"/>
                  </div>
                  <div className="pt-1 w-full">
                     <div className="text-sm text-zinc-300 font-medium">{act.user}</div>
                     <div className="text-sm text-zinc-500 mt-0.5 leading-snug">{act.msg}</div>
                     <div className="text-xs text-primary mt-1 font-mono">{act.time}</div>
                  </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}

function AlunosView() {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
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

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        setPhoto(canvasRef.current.toDataURL('image/png'));
        stopCamera();
      }
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

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-8">
                 <div className="space-y-4">
                    <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2 flex items-center gap-2"><Award className="w-5 h-5 text-primary"/> Conquistas (Badges)</h3>
                    <div className="flex flex-wrap gap-2">
                       {selectedStudent.badges && selectedStudent.badges.length > 0 ? selectedStudent.badges.map((b: any, i: number) => (
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
              </div>

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
                       <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl border border-surface-highest bg-black object-cover aspect-video"></video>
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
                       <img src={photo} alt="Progresso" className="w-full rounded-xl border-2 border-primary shadow-[0_0_15px_rgba(212,175,55,0.2)]" />
                       <button onClick={() => {setPhoto(null); startCamera();}} className="absolute top-2 right-2 bg-black/60 p-2 rounded flex items-center justify-center text-white hover:bg-black backdrop-blur text-xs font-bold transition-colors z-10">🔄 Refazer</button>
                    </div>
                 )}
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
        <button className="px-4 py-2 bg-primary text-black font-bold rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)]">
          <Plus className="w-4 h-4" /> Novo Aluno
        </button>
      </div>

      <div className="bg-surface-container border border-surface-highest rounded-xl overflow-hidden">
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
            {MOCK_STUDENTS.map(s => (
              <tr key={s.id} onClick={() => setSelectedStudent(s)} className="hover:bg-surface-high/50 transition-colors cursor-pointer group text-zinc-300">
                <td className="p-4">
                   <div className="font-medium text-white group-hover:text-primary transition-colors">{s.name}</div>
                   <div className={`text-xs ${s.status === 'Ativo' ? 'text-primary' : 'text-red-400'}`}>{s.status}</div>
                </td>
                <td className="p-4 font-mono text-zinc-400">{s.age}</td>
                <td className="p-4"><span className="px-2 py-1 bg-surface rounded border border-surface-highest text-xs">{s.goal}</span></td>
                <td className="p-4">
                  <div className="flex -space-x-1">
                    {s.badges && s.badges.slice(0,3).map((b:any, i:number) => (
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
    </div>
  );
}

function ProtocolosView() {
  const [student, setStudent] = useState('');
  const [objective, setObjective] = useState('');
  const [split, setSplit] = useState('ABC');
  const [days, setDays] = useState('3');
  const [needs, setNeeds] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('4');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const handleGenerate = async () => {
    if(!student || !objective) return alert("Preencha Aluno e Objetivo");
    setIsGenerating(true);
    setWorkoutData(null);
    try {
      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student, objective, split, days, needs, durationWeeks })
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
    } catch (error: any) {
      alert(`Erro ao gerar protocolo: ${error.message}\nTente novamente em alguns instantes.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!workoutData || !workoutData.days) return;

    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(212, 175, 55); // Primary Gold
    doc.text("JAIRA LEAL - PROTOCOLO DE TREINO", 14, 22);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(`Aluno:`, 14, 32);
    doc.setFont("helvetica", "normal");
    doc.text(student, 30, 32);

    doc.setFont("helvetica", "bold");
    doc.text(`Objetivo:`, 14, 38);
    doc.setFont("helvetica", "normal");
    doc.text(objective, 35, 38);

    doc.setFont("helvetica", "bold");
    doc.text(`Duração:`, 14, 44);
    doc.setFont("helvetica", "normal");
    doc.text(`${durationWeeks} semanas`, 35, 44);
    
    let yPos = 54;

    workoutData.days.forEach((dayItem: any) => {
       doc.setFont("helvetica", "bold");
       doc.setFontSize(14);
       doc.setTextColor(0, 0, 0);
       doc.text(dayItem.dayName, 14, yPos);
       
       const tableData = dayItem.exercises.map((ex: any) => [
         ex.name, ex.sets, ex.reps, ex.rest, ex.notes || '-'
       ]);

       autoTable(doc, {
         startY: yPos + 4,
         head: [['Exercício', 'Séries', 'Reps', 'Descanso', 'Notas']],
         body: tableData,
         theme: 'grid',
         headStyles: { fillColor: [212, 175, 55], textColor: [0,0,0], fontStyle: 'bold' },
         styles: { fontSize: 10, cellPadding: 4, textColor: [40, 40, 40] },
         alternateRowStyles: { fillColor: [250, 248, 239] }
       });
       
       yPos = (doc as any).lastAutoTable.finalY + 15;
       if (yPos > 270) {
         doc.addPage();
         yPos = 20;
       }
    });

    doc.save(`Protocolo_${student.replace(/ /g, '_')}.pdf`);
  };

  const shareWhatsApp = () => {
    const text = `*PLANILHA DE TREINO (Jaira Leal High Performance)*\nAluno: ${student}\n\nAcesse seu PDF anexo ou via app Elite Coach.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-heading font-bold text-white">Criador de Protocolos</h2>
         <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-1 rounded font-bold uppercase tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(212,175,55,0.2)]">
            <Zap className="w-3 h-3" /> IA Agent
         </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
           <h3 className="font-heading font-semibold text-lg text-white mb-4 border-b border-surface-highest pb-2">Parâmetros</h3>
           <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400">Nome do Aluno</label>
                <input value={student} onChange={e=>setStudent(e.target.value)} type="text" placeholder="Ex: João Silva" className="w-full bg-surface-high border border-surface-highest rounded p-2 mt-1 focus:border-primary outline-none transition-colors text-white" />
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
                <textarea value={needs} onChange={e=>setNeeds(e.target.value)} placeholder="Ex: Condromalácia patelar grau 1..." className="w-full bg-surface-high border border-surface-highest text-white rounded p-2 mt-1 h-20 resize-none focus:border-primary outline-none text-sm"></textarea>
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
                <button onClick={shareWhatsApp} disabled={!workoutData} className="disabled:opacity-50 px-3 py-1.5 bg-surface border border-surface-highest rounded text-zinc-300 hover:text-white transition-colors text-xs font-bold uppercase flex items-center gap-1 group">
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
                   {workoutData.days.map((d: any, i: number) => (
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
                        {workoutData.days[activeDayIdx].exercises.map((ex: any, idx: number) => (
                          <div key={idx} className="bg-surface-high border border-surface-highest p-4 rounded-lg flex items-center justify-between hover:border-primary/30 transition-colors group">
                             <div className="flex-1">
                               <h4 className="font-bold text-white group-hover:text-primary transition-colors">{ex.name}</h4>
                               {ex.notes && <p className="text-xs text-zinc-400 mt-1">{ex.notes}</p>}
                             </div>
                             <div className="flex gap-4 text-center">
                               <div><div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Séries</div><div className="font-mono text-white bg-surface rounded px-2 py-1">{ex.sets}</div></div>
                               <div><div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Reps</div><div className="font-mono text-white bg-surface rounded px-2 py-1">{ex.reps}</div></div>
                               <div><div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Pausa</div><div className="font-mono text-primary bg-primary/10 rounded px-2 py-1">{ex.rest}</div></div>
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
    </div>
  );
}

function InspecoesView() {
  const [success, setSuccess] = useState(false);

  const handleSave = () => {
    setSuccess(true);
  };

  return (
    <div className="space-y-6 relative">
      {success && <ParticleEffect onComplete={() => setSuccess(false)} />}
      
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-white">Inspeção de Campo</h2>
        <button onClick={handleSave} className="px-4 py-2 bg-primary text-black font-bold uppercase tracking-wider rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_15px_rgba(212,175,55,0.3)]">
          <Save className="w-4 h-4" /> Salvar Avaliação
        </button>
      </div>

      <div className="bg-surface-container border border-surface-highest rounded-xl p-8 max-w-3xl">
         <div className="space-y-8">
             <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Aluno Selecionado</label>
                  <select className="w-full bg-surface-high border border-surface-highest text-white rounded p-3 mt-1 outline-none focus:border-primary">
                     <option>Marcus Johnson</option>
                     <option>Sarah Connor</option>
                  </select>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="space-y-4">
                 <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2">📏 Biometria</h3>
                 <div><label className="text-xs text-zinc-400">Gordura Corporal (%)</label><input type="number" className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/></div>
                 <div><label className="text-xs text-zinc-400">Peso Atual (kg)</label><input type="number" className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/></div>
                 <div><label className="text-xs text-zinc-400 font-bold text-primary">Frequência Cardíaca de Repouso (BPM)</label><input type="number" placeholder="Ex: 60" className="w-full bg-surface-high text-primary font-mono border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary shadow-[inset_0_0_10px_rgba(212,175,55,0.05)]"/></div>
               </div>
               
               <div className="space-y-4 md:col-span-2">
                 <h3 className="font-heading font-semibold text-lg text-white border-b border-surface-highest pb-2">📝 Avaliação Subjetiva</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs text-zinc-400">Nível de Energia (1-10)</label>
                     <input type="number" min="1" max="10" className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/>
                   </div>
                   <div>
                     <label className="text-xs text-zinc-400">Qualidade do Sono (1-10)</label>
                     <input type="number" min="1" max="10" className="w-full bg-surface-high text-white border border-surface-highest rounded p-2 mt-1 outline-none focus:border-primary"/>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs text-zinc-400">Feedback do Aluno / Queixas</label>
                   <textarea className="w-full bg-surface-high text-white border border-surface-highest rounded p-3 mt-1 h-24 resize-none outline-none focus:border-primary"></textarea>
                 </div>
               </div>
             </div>

             <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-sm text-zinc-300 flex items-start gap-3">
               <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
               <p>Registro de inspeção acionará notificação via email ao aluno com um resumo comparativo com a última avaliação.</p>
             </div>
         </div>
      </div>
    </div>
  );
}

function ConfigView() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Treinador' });
  const [adding, setAdding] = useState(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const handleAdd = () => {
    if(newUser.name && newUser.email) {
      setUsers([...users, { id: Date.now(), ...newUser, unremovable: false }]);
      setNewUser({ name: '', email: '', role: 'Treinador' });
      setAdding(false);
    }
  };

  const startEdit = (u: any) => {
    setEditingId(u.id);
    setEditForm({ ...u });
    setAdding(false);
  };
  
  const saveEdit = () => {
    if(editForm.name && editForm.email) {
      setUsers(users.map(u => u.id === editingId ? editForm : u));
      setEditingId(null);
      setEditForm(null);
    }
  };

  const removeUser = (id: number) => {
    if(confirm('Tem certeza que deseja remover este usuário?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-white">Configurações & Equipe</h2>
        <button onClick={() => setAdding(!adding)} className="px-4 py-2 bg-surface text-primary border border-surface-highest font-bold uppercase tracking-wider rounded flex items-center gap-2 hover:border-primary transition-colors text-sm">
          {adding ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4" />} {adding ? 'Cancelar' : 'Adicionar Membro'}
        </button>
      </div>

      <div className="bg-surface-container border border-surface-highest rounded-xl p-8 max-w-4xl">
         <h3 className="font-heading font-semibold text-lg text-white mb-6 border-b border-surface-highest pb-2">Usuários do Sistema</h3>
         
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
                    {editingId === u.id ? <input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary" /> : u.name}
                 </td>
                 <td className="p-3 text-zinc-400">
                    {editingId === u.id ? <input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm, email:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary" /> : u.email}
                 </td>
                 <td className="p-3">
                   {editingId === u.id && u.role !== 'Desenvolvedor' ? (
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
                              <button onClick={() => removeUser(u.id)} className="text-zinc-500 hover:text-red-400 transition-colors uppercase text-xs font-bold tracking-wider flex items-center"><X className="w-3 h-3 mr-1" /> Remover</button>
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
    </div>
  );
}
