import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Dumbbell, Zap, CheckCircle2, Award, ChevronRight, History, ShieldAlert } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { ProgressionData, ActivityEntry } from '../types';
import { MOCK_PROGRESSION, MOCK_ACTIVITIES } from '../mocks';
import { supabase } from '../utils/supabase';

export default function DashboardView() {
  const [goal, setGoal] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('elite_coach_goal') || '10000';
    }
    return '10000';
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    activeStudents: 0,
    totalStudents: 0,
    protocolsMonth: 0,
    currentRevenue: 0,
    defaultingRate: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [chartTab, setChartTab] = useState<'loads' | 'billing'>('loads');
  const [billingData, setBillingData] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      const { data: students, error: studErr } = await supabase
        .from('students')
        .select('id, name, status');

      let activeCount = 0;
      let totalCount = 0;
      if (students) {
        totalCount = students.length;
        activeCount = students.filter((s: any) => s.status === 'Ativo').length;
      }

      // 2. Fetch Protocols for current month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      
      const { count: protocolCount } = await supabase
        .from('workout_protocols')
        .select('*', { count: 'exact', head: true })
        .gte('date', firstDayOfMonthStr);

      // 3. Fetch Payments
      const { data: payments } = await supabase
        .from('payments')
        .select('*');

      const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      let calculatedRevenue = 0;
      let monthlyTotalBilled = 0;
      let monthlyUnpaid = 0;

      // Agrupamento para gráfico de faturamento anual
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const billingMap = monthNames.map(m => ({ month: m, recebido: 0, pendente: 0 }));

      if (payments) {
        payments.forEach((p: any) => {
          const isPaidThisMonth = p.status === 'Pago' && (
            (p.payment_date && p.payment_date.startsWith(currentMonthPrefix)) ||
            (!p.payment_date && p.due_date && p.due_date.startsWith(currentMonthPrefix))
          );
          if (isPaidThisMonth) {
            calculatedRevenue += parseFloat(p.amount) || 0;
          }

          const isDueThisMonth = p.due_date && p.due_date.startsWith(currentMonthPrefix);
          if (isDueThisMonth) {
            monthlyTotalBilled += parseFloat(p.amount) || 0;
            if (p.status !== 'Pago') {
              monthlyUnpaid += parseFloat(p.amount) || 0;
            }
          }

          // Agrupamento para gráfico anual
          if (p.due_date) {
            const payDate = new Date(p.due_date);
            if (payDate.getFullYear() === currentYear) {
              const mIdx = payDate.getMonth();
              const amt = parseFloat(p.amount) || 0;
              if (p.status === 'Pago') {
                billingMap[mIdx].recebido += amt;
              } else {
                billingMap[mIdx].pendente += amt;
              }
            }
          }
        });
      }

      setBillingData(billingMap);

      const defaultingPercent = monthlyTotalBilled > 0
        ? Math.round((monthlyUnpaid / monthlyTotalBilled) * 100)
        : 0;

      setStats({
        activeStudents: activeCount,
        totalStudents: totalCount,
        protocolsMonth: protocolCount || 0,
        currentRevenue: calculatedRevenue,
        defaultingRate: defaultingPercent
      });

      // 4. Fetch Recent Activities
      const { data: recentProts } = await supabase
        .from('workout_protocols')
        .select('student_name, date, objective')
        .order('date', { ascending: false })
        .limit(3);

      const { data: recentInsps } = await supabase
        .from('field_inspections')
        .select('student_id, date, weight')
        .order('date', { ascending: false })
        .limit(3);

      const activitiesList: any[] = [];
      if (recentProts) {
        recentProts.forEach((p: any) => {
          activitiesList.push({
            id: `prot-${p.date}-${p.student_name}-${p.objective}`,
            user: p.student_name,
            msg: `Novo protocolo gerado: ${p.objective}`,
            time: p.date ? new Date(p.date).toLocaleDateString('pt-BR') : 'Hoje',
            timestamp: p.date ? new Date(p.date).getTime() : 0
          });
        });
      }

      if (recentInsps && students) {
        recentInsps.forEach((ins: any) => {
          const studentObj = students.find((s: any) => s.id.toString() === ins.student_id.toString());
          if (studentObj) {
            activitiesList.push({
              id: `insp-${ins.date}-${ins.student_id}`,
              user: studentObj.name,
              msg: `Nova inspeção de campo registrada (Peso: ${ins.weight || '-'} kg)`,
              time: ins.date ? new Date(ins.date).toLocaleDateString('pt-BR') : 'Hoje',
              timestamp: ins.date ? new Date(ins.date).getTime() : 0
            });
          }
        });
      }

      activitiesList.sort((a, b) => b.timestamp - a.timestamp);
      if (activitiesList.length === 0) {
        setRecentActivities([]);
      } else {
        setRecentActivities(activitiesList.slice(0, 4));
      }

      // 5. Fetch Protocols & Progress for Attendance Ranking
      const { data: allProtocols } = await supabase
        .from('workout_protocols')
        .select('id, student_id, duration_weeks, workout_data, date')
        .order('date', { ascending: false });

      const { data: allProgress } = await supabase
        .from('student_workout_progress')
        .select('student_id, protocol_id, status');

      const studentRanking: any[] = [];

      if (students) {
        students.forEach((student: any) => {
          const studentProts = allProtocols ? allProtocols.filter((p: any) => p.student_id.toString() === student.id.toString()) : [];
          const latestProt = studentProts[0];

          let attendancePct = 0;
          let completed = 0;
          let totalPlanned = 0;

          if (latestProt) {
            const weeks = parseInt(latestProt.duration_weeks || '4', 10);
            const daysInSplit = latestProt.workout_data?.days?.length || 0;
            totalPlanned = weeks * daysInSplit;

            const studentProg = allProgress ? allProgress.filter((pr: any) => 
              pr.student_id.toString() === student.id.toString() && 
              pr.protocol_id.toString() === latestProt.id.toString() &&
              pr.status === 'REALIZADO'
            ) : [];
            completed = studentProg.length;

            attendancePct = totalPlanned > 0 ? Math.round((completed / totalPlanned) * 100) : 0;
          }

          studentRanking.push({
            id: student.id,
            name: student.name,
            status: student.status,
            attendancePct,
            completed,
            totalPlanned
          });
        });
      }

      studentRanking.sort((a, b) => b.attendancePct - a.attendancePct || b.completed - a.completed);
      setRanking(studentRanking);

    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGoal(e.target.value);
    localStorage.setItem('elite_coach_goal', e.target.value);
  };

  const currentRevenue = stats.currentRevenue;
  const goalValue = parseFloat(goal) || 1;
  const progressPercent = Math.min(100, Math.round((currentRevenue / goalValue) * 100));  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-8 bg-surface-container border border-surface-highest rounded w-48 mb-2"></div>
          <div className="h-4 bg-surface-container border border-surface-highest rounded w-64"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-surface-container border border-surface-highest h-28 rounded-xl p-5 space-y-3">
              <div className="flex justify-between">
                <div className="w-8 h-8 bg-surface-high rounded-full"></div>
                <div className="w-12 h-4 bg-surface-high rounded"></div>
              </div>
              <div className="w-20 h-8 bg-surface-high rounded"></div>
              <div className="w-24 h-4 bg-surface-high rounded"></div>
            </div>
          ))}
        </div>
        <div className="bg-surface-container border border-surface-highest h-24 rounded-xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-container border border-surface-highest h-80 rounded-xl"></div>
          <div className="bg-surface-container border border-surface-highest h-80 rounded-xl"></div>
        </div>
      </div>
    );
  }

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
          { label: 'Alunos Ativos', val: `${stats.activeStudents} / ${stats.totalStudents}`, icon: <Users/>, trend: 'Total' },
          { label: 'Protocolos Gerados (Mês)', val: stats.protocolsMonth.toString(), icon: <Dumbbell/>, trend: 'Novo' },
          { label: 'Faturamento Real', val: `R$ ${stats.currentRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: <Zap/>, trend: 'Mensal' },
          { label: 'Taxa de Inadimplência', val: `${stats.defaultingRate}%`, icon: <ShieldAlert/>, trend: stats.defaultingRate > 15 ? 'Atenção' : 'Saudável' },
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
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                 s.label === 'Taxa de Inadimplência' && stats.defaultingRate > 15
                   ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                   : 'bg-primary/10 text-primary'
               }`}>{s.trend}</span>
             </div>
             <div className="text-2xl font-heading font-bold text-white">{s.val}</div>
             <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
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
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
             <div className="flex gap-2 bg-surface p-1 rounded-lg border border-surface-highest/60 w-fit">
               <button 
                 onClick={() => setChartTab('loads')}
                 className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                   chartTab === 'loads' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'
                 }`}
               >
                 Cargas do Time
               </button>
               <button 
                 onClick={() => setChartTab('billing')}
                 className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                   chartTab === 'billing' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'
                 }`}
               >
                 Faturamento Anual
               </button>
             </div>
             <h3 className="font-heading font-semibold text-sm text-zinc-400">
               {chartTab === 'loads' ? 'Progressão de Carga Média (kg)' : 'Balanço Mensal Real (R$)'}
             </h3>
           </div>
           
           <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === 'loads' ? (
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
                ) : (
                   <BarChart data={billingData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
                      <XAxis dataKey="month" stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} width={40} tickFormatter={(v: any) => `R$ ${v}`} />
                      <RechartsTooltip 
                         contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4' }}
                         formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`}
                      />
                      <Bar dataKey="recebido" name="Recebido" fill="#00ff41" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pendente" name="Pendente/Atrasado" fill="#ef4444" radius={[4, 4, 0, 0]} />
                   </BarChart>
                )}
              </ResponsiveContainer>
           </div>
         </div>
         {/* Right Column: Arena Elite: Ranking de Assiduidade (colspan 1) */}
         <div className="bg-surface-container border border-surface-highest rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-semibold text-lg text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#dfbf80]" /> Arena Elite: Ranking
              </h3>
              <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
                {ranking.slice(0, 5).map((student, index) => {
                  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏃';
                  const isElite = student.attendancePct >= 80;
                  return (
                    <div key={student.id} className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs bg-surface ${
                      isElite 
                        ? 'border-[#dfbf80]/30 shadow-[0_2px_10px_rgba(223,191,128,0.05)] bg-gradient-to-r from-[#dfbf80]/5 to-transparent' 
                        : 'border-surface-highest/60'
                    }`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-base shrink-0">{medal}</span>
                        <div className="overflow-hidden">
                          <span className="font-bold text-white block truncate">{student.name}</span>
                          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wide">
                            {student.completed} de {student.totalPlanned} treinos
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className={`px-1.5 py-0.5 border rounded text-[9px] font-bold font-mono ${
                          isElite 
                            ? 'text-[#dfbf80] bg-[#dfbf80]/10 border-[#dfbf80]/20 animate-pulse' 
                            : 'text-primary bg-primary/10 border-primary/20'
                        }`}>
                          {student.attendancePct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {ranking.length === 0 && (
                  <p className="text-zinc-500 text-xs italic text-center py-8">Nenhum aluno no ranking.</p>
                )}
              </div>
            </div>
         </div>
      </div>

      {/* Atividades Recentes Row */}
      <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
         <h3 className="font-heading font-semibold text-lg text-white mb-6">Atividades Recentes</h3>
         {recentActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-center h-48 border border-dashed border-surface-highest rounded-lg bg-surface/20">
               <History className="w-8 h-8 mb-2 opacity-35" />
               <p className="text-xs font-semibold text-zinc-400">Nenhuma atividade recente</p>
               <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px] leading-relaxed">As interações aparecerão aqui assim que novos treinos ou avaliações forem registrados.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentActivities.map((act) => (
                 <div key={act.id} className="bg-surface border border-surface-highest/60 p-4 rounded-xl flex gap-3 relative">
                    <div className="w-8 h-8 rounded-full bg-surface-high border-2 border-surface-highest flex-shrink-0 flex items-center justify-center text-xs text-zinc-400">
                      <History className="w-3.5 h-3.5 text-primary"/>
                    </div>
                    <div className="overflow-hidden">
                       <div className="text-xs text-zinc-300 font-bold truncate">{act.user}</div>
                       <div className="text-xs text-zinc-500 mt-0.5 leading-snug line-clamp-2">{act.msg}</div>
                       <div className="text-[10px] text-primary mt-1 font-mono">{act.time}</div>
                    </div>
                 </div>
              ))}
            </div>
         )}
      </div>
    </div>
  );
}
