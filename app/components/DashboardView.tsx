import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Dumbbell, Zap, CheckCircle2, Award, ChevronRight, History } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ProgressionData, ActivityEntry } from '../types';
import { MOCK_PROGRESSION, MOCK_ACTIVITIES } from '../mocks';

export default function DashboardView() {
  const [goal, setGoal] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('elite_coach_goal') || '10000';
    }
    return '10000';
  });

  const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGoal(e.target.value);
    localStorage.setItem('elite_coach_goal', e.target.value);
  };

  const currentRevenue = 8500;
  const goalValue = parseFloat(goal) || 1;
  const progressPercent = Math.min(100, Math.round((currentRevenue / goalValue) * 100));

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
          { label: 'Faturamento Estimado', val: `R$ ${currentRevenue.toLocaleString()}`, icon: <Zap/>, trend: '+20%' },
          { label: 'Inspeções no Prazo', val: '98%', icon: <CheckCircle2/>, trend: '+2%' },
        ].map((s, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.3, delay: i * 0.1 }}
            key={i} 
            className="bg-surface-container border border-surface-highest p-5 rounded-xl hover:border-primary/50 transition-colors cursor-default group"
          >
             <div className="flex items-center justify-between mb-4 text-zinc-400 group-hover:text-primary transition-colors">
               {React.cloneElement(s.icon as React.ReactElement, {className: "w-5 h-5"})}
               <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{s.trend}</span>
             </div>
             <div className="text-3xl font-heading font-bold text-white">{s.val}</div>
             <div className="text-sm text-zinc-500 mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Monthly Goals Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }} className="bg-gradient-to-r from-surface-container to-surface border border-primary/20 rounded-xl p-6 relative overflow-hidden">
         <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <h3 className="font-heading font-semibold text-lg text-white mb-1 flex items-center gap-2"><Award className="w-5 h-5 text-primary" /> Metas Mensais</h3>
              <p className="text-sm text-zinc-400">Faturamento alvo vs Atual (Mês Anterior: R$ 7.083)</p>
            </div>
            
            <div className="flex items-center gap-6 w-full md:w-auto">
               <div className="flex-1 md:w-48">
                 <div className="flex justify-between text-xs font-bold mb-2">
                   <span className="text-white">R$ {currentRevenue.toLocaleString()}</span>
                   <span className="text-primary">{progressPercent}%</span>
                 </div>
                 <div className="w-full bg-surface-highest rounded-full h-2 overflow-hidden">
                   <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                 </div>
               </div>
               
               <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Definir Meta (R$)</label>
                  <input type="number" value={goal} onChange={handleGoalChange} className="w-24 bg-surface-high border border-surface-highest rounded p-1.5 text-white text-sm outline-none focus:border-primary transition-colors text-right font-mono" />
               </div>
            </div>
         </div>
      </motion.div>

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
