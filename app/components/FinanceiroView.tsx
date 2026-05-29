import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trash2, CheckCircle2, CreditCard, Plus, X, DollarSign, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Student, Payment, User } from '../types';
import { supabase } from '../utils/supabase';
import CustomAlertModal from './CustomAlertModal';

interface FinanceiroViewProps {
  currentUser: User | null;
}

export default function FinanceiroView({ currentUser }: FinanceiroViewProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Add Payment Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // New Payment Form State
  const [studentInput, setStudentInput] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [formAmount, setFormAmount] = useState<string>('150');
  const [formPlanName, setFormPlanName] = useState<string>('Mensal');
  const [formDueDate, setFormDueDate] = useState<string>('');

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    title: string;
    message?: string;
    recordName?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'info', title: '' });

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm',
    recordName?: string,
    onConfirm?: () => void
  ) => {
    setAlertModal({
      isOpen: true,
      type,
      title,
      message,
      recordName,
      onConfirm
    });
  };

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('due_date', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error);
      } else if (data) {
        setPayments(data as Payment[]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching students:', error);
      } else if (data) {
        setStudents(data as Student[]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchPayments(), fetchStudents()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkAsPaid = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    const student = students.find(s => s.id.toString() === payment?.student_id.toString());
    const planDesc = payment ? `${payment.plan_name} - R$ ${payment.amount} (${student?.name || 'Aluno'})` : 'esta fatura';

    showCustomAlert(
      'Confirmar Recebimento',
      `Deseja realmente marcar a cobrança "${planDesc}" como paga?`,
      'confirm',
      planDesc,
      async () => {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const { error } = await supabase
            .from('payments')
            .update({ status: 'Pago', payment_date: todayStr })
            .eq('id', paymentId);

          if (error) {
            showCustomAlert('Erro', 'Erro ao registrar pagamento: ' + error.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Pagamento registrado com sucesso!', 'success');
            fetchPayments();
          }
        } catch (e: any) {
          console.error(e);
          showCustomAlert('Erro', 'Erro inesperado ao registrar pagamento.', 'error');
        }
      }
    );
  };

  const handleDeletePayment = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    const student = students.find(s => s.id.toString() === payment?.student_id.toString());
    const planDesc = payment ? `${payment.plan_name} - R$ ${payment.amount} (${student?.name || 'Aluno'})` : 'Fatura';

    showCustomAlert(
      'Confirmar Exclusão',
      '',
      'confirm',
      planDesc,
      async () => {
        try {
          const { error } = await supabase
            .from('payments')
            .delete()
            .eq('id', paymentId);

          if (error) {
            showCustomAlert('Erro', 'Erro ao excluir cobrança: ' + error.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Cobrança excluída com sucesso!', 'success');
            fetchPayments();
          }
        } catch (e: any) {
          console.error(e);
          showCustomAlert('Erro', 'Erro inesperado ao excluir cobrança.', 'error');
        }
      }
    );
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      return showCustomAlert('Aviso', 'Selecione um aluno cadastrado no sistema.', 'warning');
    }
    if (!formAmount || !formDueDate) {
      return showCustomAlert('Aviso', 'Preencha o valor e a data de vencimento.', 'warning');
    }
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      return showCustomAlert('Aviso', 'O valor deve ser um número maior que zero.', 'warning');
    }

    setSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const isPastDueDate = formDueDate < todayStr;
      
      const { error } = await supabase
        .from('payments')
        .insert([{
          student_id: selectedStudent.id,
          amount: amt,
          due_date: formDueDate,
          plan_name: formPlanName,
          status: isPastDueDate ? 'Atrasado' : 'Pendente'
        }]);

      if (error) {
        showCustomAlert('Erro', 'Erro ao adicionar cobrança: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Nova cobrança gerada com sucesso!', 'success');
        setShowAddModal(false);
        setStudentInput('');
        setSelectedStudent(null);
        setFormAmount('150');
        setFormPlanName('Mensal');
        setFormDueDate('');
        fetchPayments();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao gerar cobrança.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetName: string, amount: string) => {
    setFormPlanName(presetName);
    setFormAmount(amount);
  };

  // Calculations for current month cash flow
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  let totalReceived = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  payments.forEach((p) => {
    // Dynamic status resolution
    const actualStatus = p.status === 'Pago' ? 'Pago' : (p.due_date < todayStr ? 'Atrasado' : 'Pendente');

    if (actualStatus === 'Pago') {
      const isPaidThisMonth = (p.payment_date && p.payment_date.startsWith(currentMonthPrefix)) ||
                              (!p.payment_date && p.due_date && p.due_date.startsWith(currentMonthPrefix));
      if (isPaidThisMonth) {
        totalReceived += Number(p.amount) || 0;
      }
    } else if (actualStatus === 'Pendente') {
      if (p.due_date && p.due_date.startsWith(currentMonthPrefix)) {
        totalPending += Number(p.amount) || 0;
      }
    } else if (actualStatus === 'Atrasado') {
      totalOverdue += Number(p.amount) || 0;
    }
  });

  // Billing graph: group payments of the current year by month
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const billingChartData = monthNames.map((m) => ({ month: m, recebido: 0, pendente: 0 }));

  payments.forEach((p) => {
    if (p.due_date) {
      const payDate = new Date(p.due_date);
      if (payDate.getFullYear() === currentYear) {
        const mIdx = payDate.getMonth();
        const amt = Number(p.amount) || 0;
        const actualStatus = p.status === 'Pago' ? 'Pago' : (p.due_date < todayStr ? 'Atrasado' : 'Pendente');

        if (actualStatus === 'Pago') {
          billingChartData[mIdx].recebido += amt;
        } else {
          billingChartData[mIdx].pendente += amt;
        }
      }
    }
  });

  // Filtered Payments list
  const filteredPayments = payments.filter((p) => {
    const student = students.find((s) => s.id.toString() === p.student_id.toString());
    const matchesSearch = student ? student.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    
    const actualStatus = p.status === 'Pago' ? 'Pago' : (p.due_date < todayStr ? 'Atrasado' : 'Pendente');
    const matchesStatus = statusFilter === 'todos' || actualStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Student suggestions for autocomplete
  const suggestions = students.filter(s => 
    s.name.toLowerCase().includes(studentInput.toLowerCase()) &&
    s.name.toLowerCase() !== studentInput.toLowerCase()
  );

  const selectStudentFromSuggestion = (student: Student) => {
    setSelectedStudent(student);
    setStudentInput(student.name);
    setShowSuggestions(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-surface-container border border-surface-highest rounded w-48"></div>
          <div className="h-10 bg-surface-container border border-surface-highest rounded w-36"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-surface-container border border-surface-highest h-28 rounded-xl"></div>
          ))}
        </div>
        <div className="bg-surface-container border border-surface-highest h-80 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white">Fluxo Financeiro</h2>
          <p className="text-zinc-400 text-sm mt-1">Gestão de cobranças, inadimplência e faturamento consolidado.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-black font-bold py-2.5 px-4 rounded-lg hover:bg-primary-dim transition-colors text-xs font-sans uppercase tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.2)]"
        >
          <Plus className="w-4 h-4" /> Adicionar Cobrança
        </button>
      </div>

      {/* Cash Flow Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recebido */}
        <div className="bg-surface-container border border-[#00ff41]/20 rounded-xl p-5 hover:border-[#00ff41]/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Recebido (Mês Atual)
            </span>
            <DollarSign className="w-5 h-5 text-emerald-400/80" />
          </div>
          <div className="text-2xl font-heading font-black text-white">
            R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Somatória de todas as faturas quitadas deste mês.</div>
        </div>

        {/* Pendente */}
        <div className="bg-surface-container border border-amber-500/20 rounded-xl p-5 hover:border-amber-500/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> A Receber (Mês Atual)
            </span>
            <DollarSign className="w-5 h-5 text-amber-400/80" />
          </div>
          <div className="text-2xl font-heading font-black text-white">
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Cobranças deste mês ainda aguardando pagamento.</div>
        </div>

        {/* Atrasado */}
        <div className="bg-surface-container border border-red-500/20 rounded-xl p-5 hover:border-red-500/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Inadimplência Geral
            </span>
            <DollarSign className="w-5 h-5 text-red-400/80 animate-pulse" />
          </div>
          <div className="text-2xl font-heading font-black text-white">
            R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Acumulado total de parcelas vencidas e não pagas.</div>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
        <h3 className="font-heading font-semibold text-lg text-white mb-6">Gráfico de Faturamento Mensal - {currentYear}</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={billingChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
              <XAxis dataKey="month" stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} width={50} tickFormatter={(v: any) => `R$ ${v}`} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4' }}
                formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`}
              />
              <Bar dataKey="recebido" name="Recebido" fill="#00ff41" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pendente" name="Pendente/Atrasado" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoice List & Filters */}
      <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-surface-highest pb-4 mb-6">
          <h3 className="font-heading font-semibold text-lg text-white">Relatório Geral de Cobranças</h3>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="flex items-center bg-surface-high rounded-lg border border-surface-highest px-3 py-1.5 w-60 focus-within:border-primary/50 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
              <input 
                type="text" 
                placeholder="Buscar por aluno..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-zinc-500" 
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-surface-high border border-surface-highest text-zinc-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-surface-high uppercase text-xs font-bold text-zinc-500">
              <tr>
                <th className="p-4 rounded-tl-lg">Aluno</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Vencimento</th>
                <th className="p-4">Data Pagto.</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right rounded-tr-lg">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highest">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-zinc-500 italic py-10">
                    Nenhuma cobrança encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const student = students.find((s) => s.id.toString() === p.student_id.toString());
                  const actualStatus = p.status === 'Pago' ? 'Pago' : (p.due_date < todayStr ? 'Atrasado' : 'Pendente');

                  return (
                    <tr key={p.id} className="hover:bg-surface-high/30 transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold shrink-0">
                          {student?.name ? student.name.charAt(0) : '?'}
                        </div>
                        {student?.name || 'Aluno Removido'}
                      </td>
                      <td className="p-4 text-zinc-400">{p.plan_name}</td>
                      <td className="p-4 font-bold text-white font-mono">
                        R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 font-mono text-zinc-400">
                        {p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-4 font-mono text-zinc-400">
                        {p.payment_date ? new Date(p.payment_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                          actualStatus === 'Pago' ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20' :
                          actualStatus === 'Atrasado' ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {actualStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {actualStatus !== 'Pago' && (
                            <button
                              onClick={() => handleMarkAsPaid(p.id)}
                              className="text-emerald-400 hover:text-emerald-300 transition-colors p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/20"
                              title="Marcar como Pago"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 bg-surface-high hover:bg-red-500/10 rounded border border-surface-highest hover:border-red-500/20"
                            title="Excluir Cobrança"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredPayments.length === 0 ? (
            <p className="text-center text-zinc-500 italic py-6">Nenhuma cobrança encontrada.</p>
          ) : (
            filteredPayments.map((p) => {
              const student = students.find((s) => s.id.toString() === p.student_id.toString());
              const actualStatus = p.status === 'Pago' ? 'Pago' : (p.due_date < todayStr ? 'Atrasado' : 'Pendente');

              return (
                <div key={p.id} className="bg-surface-high border border-surface-highest p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold shrink-0">
                        {student?.name ? student.name.charAt(0) : '?'}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{student?.name || 'Aluno Removido'}</h4>
                        <span className="text-xs text-zinc-400 block mt-0.5">{p.plan_name}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border shrink-0 ${
                      actualStatus === 'Pago' ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20' :
                      actualStatus === 'Atrasado' ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>{actualStatus}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-surface p-2.5 rounded-lg border border-surface-highest/60 text-center font-mono">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-sans">Valor</span>
                      <span className="text-white text-xs font-bold">R$ {Number(p.amount).toLocaleString('pt-BR')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-sans">Vencimento</span>
                      <span className="text-zinc-300 text-xs">{p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-sans">Pagamento</span>
                      <span className="text-zinc-300 text-xs">{p.payment_date ? new Date(p.payment_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-surface-highest/40 pt-3">
                    {actualStatus !== 'Pago' && (
                      <button
                        onClick={() => handleMarkAsPaid(p.id)}
                        className="text-xs py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Receber
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="text-xs py-1.5 px-3 bg-surface border border-surface-highest text-zinc-400 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 rounded-lg font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remover
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container border border-surface-highest rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden"
            >
              {/* Gold Top Indicator */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-dim" />

              <div className="flex items-center justify-between border-b border-surface-highest pb-3 mb-5">
                <h3 className="text-lg font-heading font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" /> Lançar Nova Cobrança
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddPaymentSubmit} className="space-y-4">
                {/* Student Autocomplete Selection */}
                <div className="relative">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Nome do Aluno</label>
                  <input
                    type="text"
                    value={studentInput}
                    onChange={(e) => {
                      setStudentInput(e.target.value);
                      setSelectedStudent(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-surface-high border border-surface-highest rounded-xl p-3 mt-1.5 text-white text-sm outline-none focus:border-primary transition-colors"
                    placeholder="Busque ou digite o nome do aluno..."
                    required
                  />

                  {/* Suggestions List */}
                  <AnimatePresence>
                    {showSuggestions && studentInput.trim().length > 0 && suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute left-0 right-0 mt-1 bg-surface-container border border-surface-highest rounded-xl max-h-40 overflow-y-auto z-50 shadow-2xl"
                      >
                        {suggestions.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => selectStudentFromSuggestion(student)}
                            className="w-full text-left p-3 hover:bg-surface-high/60 transition-colors text-xs text-zinc-200 border-b border-surface-highest/40 last:border-b-0 flex items-center justify-between"
                          >
                            <span className="font-medium">{student.name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              student.status === 'Ativo' ? 'bg-[#00ff41]/10 text-[#00ff41]' : 'bg-zinc-700 text-zinc-400'
                            }`}>{student.status}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Selected Badge */}
                  {selectedStudent && (
                    <div className="mt-2 p-2 bg-[#00ff41]/5 border border-[#00ff41]/20 rounded-lg flex items-center justify-between text-xs text-[#00ff41]">
                      <span>Selecionado: <strong>{selectedStudent.name}</strong></span>
                      <button type="button" onClick={() => { setSelectedStudent(null); setStudentInput(''); }} className="hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Plan presets */}
                <div>
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-2">Presets de Planos</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Mensal', amt: '150' },
                      { name: 'Trimestral', amt: '400' },
                      { name: 'Semestral', amt: '750' },
                      { name: 'Anual', amt: '1300' }
                    ].map((plan) => (
                      <button
                        key={plan.name}
                        type="button"
                        onClick={() => applyPreset(plan.name, plan.amt)}
                        className={`py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          formPlanName === plan.name
                            ? 'bg-primary text-black border-primary'
                            : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'
                        }`}
                      >
                        {plan.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Identificador Plano</label>
                    <input
                      type="text"
                      value={formPlanName}
                      onChange={(e) => setFormPlanName(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest rounded-xl p-3 mt-1.5 text-white text-sm outline-none focus:border-primary transition-colors"
                      placeholder="Ex: Mensal"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Valor (R$)</label>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest rounded-xl p-3 mt-1.5 text-white text-sm outline-none focus:border-primary transition-colors text-right font-mono"
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Data de Vencimento</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-surface-high border border-surface-highest rounded-xl p-3 mt-1.5 text-white text-sm outline-none focus:border-primary transition-colors font-mono"
                    required
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3 mt-6 border-t border-surface-highest/60 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 border border-surface-highest text-zinc-400 hover:text-white font-bold uppercase tracking-wider rounded-xl text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 bg-primary text-black font-bold uppercase tracking-wider rounded-xl text-xs hover:bg-primary-dim transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Gravando...' : 'Lançar Cobrança'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RLS/Permission Confirmations */}
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
