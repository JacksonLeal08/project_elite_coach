import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trash2, CheckCircle2, CreditCard, Plus, X, DollarSign, TrendingUp, AlertCircle, Calendar, MessageSquare, Edit } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Student, Payment, User, Cost } from '../types';
import { supabase } from '../utils/supabase';
import CustomAlertModal from './CustomAlertModal';

interface FinanceiroViewProps {
  currentUser: User | null;
}

const COST_CATEGORIES = ['Aluguel', 'Marketing', 'Equipamentos', 'Serviços', 'Impostos', 'Outros'];

export default function FinanceiroView({ currentUser }: FinanceiroViewProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Tab state
  const [financeTab, setFinanceTab] = useState<'receitas' | 'despesas'>('receitas');

  // Search & Filter states (Receitas)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Search & Filter states (Despesas)
  const [costsSearchTerm, setCostsSearchTerm] = useState<string>('');
  const [costsStatusFilter, setCostsStatusFilter] = useState<string>('todos');
  const [costsCategoryFilter, setCostsCategoryFilter] = useState<string>('todos');

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [showAddCostModal, setShowAddCostModal] = useState<boolean>(false);
  const [showEditCostModal, setShowEditCostModal] = useState<boolean>(false);
  const [selectedCost, setSelectedCost] = useState<Cost | null>(null);
  const [costSaving, setCostSaving] = useState<boolean>(false);

  // Form states (Receitas)
  const [studentInput, setStudentInput] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [formAmount, setFormAmount] = useState<string>('150');
  const [formPlanName, setFormPlanName] = useState<string>('Mensal');
  const [formDueDate, setFormDueDate] = useState<string>('');

  // Form states (Despesas)
  const [costDescription, setCostDescription] = useState<string>('');
  const [costAmount, setCostAmount] = useState<string>('');
  const [costDueDate, setCostDueDate] = useState<string>('');
  const [costPaymentDate, setCostPaymentDate] = useState<string>('');
  const [costCategory, setCostCategory] = useState<string>('Outros');
  const [costStatus, setCostStatus] = useState<'Pago' | 'Pendente' | 'Atrasado'>('Pendente');

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

  const fetchCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('costs')
        .select('*')
        .order('due_date', { ascending: false });

      if (error) {
        console.error('Error fetching costs:', error);
      } else if (data) {
        setCosts(data as Cost[]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchPayments(), fetchStudents(), fetchCosts()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- ACTIONS (Receitas) ---
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
      `Confirmando a exclusão do faturamento, o registro será removido permanentemente.`,
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

  // --- ACTIONS (Despesas) ---
  const handleMarkCostAsPaid = (costId: string) => {
    const cost = costs.find(c => c.id === costId);
    const desc = cost ? `${cost.description} - R$ ${cost.amount}` : 'esta despesa';

    showCustomAlert(
      'Confirmar Pagamento',
      `Deseja registrar o pagamento de "${desc}"?`,
      'confirm',
      desc,
      async () => {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const { error } = await supabase
            .from('costs')
            .update({ status: 'Pago', payment_date: todayStr })
            .eq('id', costId);

          if (error) {
            showCustomAlert('Erro', 'Erro ao registrar pagamento: ' + error.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Pagamento registrado com sucesso!', 'success');
            fetchCosts();
          }
        } catch (e) {
          console.error(e);
          showCustomAlert('Erro', 'Erro inesperado ao registrar pagamento.', 'error');
        }
      }
    );
  };

  const handleDeleteCost = (costId: string) => {
    const cost = costs.find(c => c.id === costId);
    const desc = cost ? `${cost.description} - R$ ${cost.amount}` : 'Despesa';

    showCustomAlert(
      'Confirmar Exclusão',
      `Confirmando a exclusão da despesa, o registro será removido permanentemente.`,
      'confirm',
      desc,
      async () => {
        try {
          const { error } = await supabase
            .from('costs')
            .delete()
            .eq('id', costId);

          if (error) {
            showCustomAlert('Erro', 'Erro ao excluir despesa: ' + error.message, 'error');
          } else {
            showCustomAlert('Sucesso', 'Despesa excluída com sucesso!', 'success');
            fetchCosts();
          }
        } catch (e) {
          console.error(e);
          showCustomAlert('Erro', 'Erro inesperado ao excluir despesa.', 'error');
        }
      }
    );
  };

  const handleAddCostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costDescription || !costAmount || !costDueDate) {
      return showCustomAlert('Aviso', 'Preencha a descrição, valor e data de vencimento.', 'warning');
    }
    const amt = parseFloat(costAmount);
    if (isNaN(amt) || amt <= 0) {
      return showCustomAlert('Aviso', 'O valor deve ser um número maior que zero.', 'warning');
    }

    setCostSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const isPast = costDueDate < todayStr;
      const status = isPast ? 'Atrasado' : 'Pendente';

      const { error } = await supabase
        .from('costs')
        .insert([{
          description: costDescription,
          amount: amt,
          due_date: costDueDate,
          status,
          category: costCategory
        }]);

      if (error) {
        showCustomAlert('Erro', 'Erro ao adicionar despesa: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Despesa registrada com sucesso!', 'success');
        setShowAddCostModal(false);
        setCostDescription('');
        setCostAmount('');
        setCostDueDate('');
        setCostCategory('Outros');
        fetchCosts();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao cadastrar despesa.', 'error');
    } finally {
      setCostSaving(false);
    }
  };

  const handleEditCostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCost) return;
    if (!costDescription || !costAmount || !costDueDate) {
      return showCustomAlert('Aviso', 'Preencha a descrição, valor e data de vencimento.', 'warning');
    }
    const amt = parseFloat(costAmount);
    if (isNaN(amt) || amt <= 0) {
      return showCustomAlert('Aviso', 'O valor deve ser um número maior que zero.', 'warning');
    }

    setCostSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let finalStatus = costStatus;
      if (costStatus !== 'Pago') {
        finalStatus = costDueDate < todayStr ? 'Atrasado' : 'Pendente';
      }

      const { error } = await supabase
        .from('costs')
        .update({
          description: costDescription,
          amount: amt,
          due_date: costDueDate,
          payment_date: finalStatus === 'Pago' ? (costPaymentDate || todayStr) : null,
          status: finalStatus,
          category: costCategory
        })
        .eq('id', selectedCost.id);

      if (error) {
        showCustomAlert('Erro', 'Erro ao atualizar despesa: ' + error.message, 'error');
      } else {
        showCustomAlert('Sucesso', 'Despesa atualizada com sucesso!', 'success');
        setShowEditCostModal(false);
        setSelectedCost(null);
        fetchCosts();
      }
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', 'Erro inesperado ao atualizar despesa.', 'error');
    } finally {
      setCostSaving(false);
    }
  };

  const openEditCost = (cost: Cost) => {
    setSelectedCost(cost);
    setCostDescription(cost.description);
    setCostAmount(cost.amount.toString());
    setCostDueDate(cost.due_date);
    setCostPaymentDate(cost.payment_date || '');
    setCostStatus(cost.status);
    setCostCategory(cost.category);
    setShowEditCostModal(true);
  };

  // --- CALCULATIONS ---
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // Receitas calculations
  let totalReceived = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  payments.forEach((p) => {
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

  // Despesas calculations
  let costTotalPaid = 0;
  let costTotalPending = 0;
  let costTotalOverdue = 0;

  costs.forEach((c) => {
    const actualStatus = c.status === 'Pago' ? 'Pago' : (c.due_date < todayStr ? 'Atrasado' : 'Pendente');

    if (actualStatus === 'Pago') {
      const isPaidThisMonth = (c.payment_date && c.payment_date.startsWith(currentMonthPrefix)) ||
                              (!c.payment_date && c.due_date && c.due_date.startsWith(currentMonthPrefix));
      if (isPaidThisMonth) {
        costTotalPaid += Number(c.amount) || 0;
      }
    } else if (actualStatus === 'Pendente') {
      if (c.due_date && c.due_date.startsWith(currentMonthPrefix)) {
        costTotalPending += Number(c.amount) || 0;
      }
    } else if (actualStatus === 'Atrasado') {
      costTotalOverdue += Number(c.amount) || 0;
    }
  });

  // Recharts Month names
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  // Charts arrays
  const billingChartData = monthNames.map((m) => ({ month: m, recebido: 0, pendente: 0 }));
  const costsChartData = monthNames.map((m) => ({ month: m, pago: 0, pendente: 0 }));

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

  costs.forEach((c) => {
    if (c.due_date) {
      const dueDateObj = new Date(c.due_date);
      if (dueDateObj.getFullYear() === currentYear) {
        const mIdx = dueDateObj.getMonth();
        const amt = Number(c.amount) || 0;
        const actualStatus = c.status === 'Pago' ? 'Pago' : (c.due_date < todayStr ? 'Atrasado' : 'Pendente');

        if (actualStatus === 'Pago') {
          costsChartData[mIdx].pago += amt;
        } else {
          costsChartData[mIdx].pendente += amt;
        }
      }
    }
  });

  // Filtered lists
  const filteredPayments = payments.filter((p) => {
    const student = students.find((s) => s.id.toString() === p.student_id.toString());
    const matchesSearch = student ? student.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    
    const actualStatus = p.status === 'Pago' ? 'Pago' : (p.due_date < todayStr ? 'Atrasado' : 'Pendente');
    const matchesStatus = statusFilter === 'todos' || actualStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const filteredCosts = costs.filter((c) => {
    const matchesSearch = c.description.toLowerCase().includes(costsSearchTerm.toLowerCase());
    
    const actualStatus = c.status === 'Pago' ? 'Pago' : (c.due_date < todayStr ? 'Atrasado' : 'Pendente');
    const matchesStatus = costsStatusFilter === 'todos' || actualStatus.toLowerCase() === costsStatusFilter.toLowerCase();
    
    const matchesCategory = costsCategoryFilter === 'todos' || c.category === costsCategoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Suggestions for autocomplete
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
      {/* Header & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white">Fluxo Financeiro</h2>
          <p className="text-zinc-400 text-sm mt-1">Gestão de cobranças, despesas operacionais e saúde financeira.</p>
        </div>
        <div className="flex gap-2">
          {financeTab === 'receitas' ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-primary text-black font-bold py-2.5 px-4 rounded-lg hover:bg-primary-dim transition-colors text-xs font-sans uppercase tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.2)]"
            >
              <Plus className="w-4 h-4" /> Adicionar Cobrança
            </button>
          ) : (
            <button
              onClick={() => {
                setCostDescription('');
                setCostAmount('');
                setCostDueDate('');
                setCostCategory('Outros');
                setShowAddCostModal(true);
              }}
              className="flex items-center gap-2 bg-primary text-black font-bold py-2.5 px-4 rounded-lg hover:bg-primary-dim transition-colors text-xs font-sans uppercase tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.2)]"
            >
              <Plus className="w-4 h-4" /> Adicionar Despesa
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs selectors */}
      <div className="flex border-b border-surface-highest">
        <button
          onClick={() => setFinanceTab('receitas')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
            financeTab === 'receitas'
              ? 'text-primary border-primary bg-primary/5'
              : 'text-zinc-400 border-transparent hover:text-white'
          }`}
        >
          📈 Faturamento (Receitas)
        </button>
        <button
          onClick={() => setFinanceTab('despesas')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
            financeTab === 'despesas'
              ? 'text-primary border-primary bg-primary/5'
              : 'text-zinc-400 border-transparent hover:text-white'
          }`}
        >
          📉 Custos (Despesas)
        </button>
      </div>

      {financeTab === 'receitas' ? (
        <>
          {/* Receitas Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Receitas Chart */}
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

          {/* Receitas Table */}
          <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-surface-highest pb-4 mb-6">
              <h3 className="font-heading font-semibold text-lg text-white">Relatório Geral de Cobranças</h3>
              
              <div className="flex flex-wrap items-center gap-3">
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

            <div className="overflow-x-auto">
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
                        Nenhuma cobrança encontrada.
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
                            <div className="flex items-center justify-end gap-2">
                              {actualStatus !== 'Pago' && student?.phone_number && (
                                <a
                                  href={`https://wa.me/${student.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    `Olá, ${student.name}! Lembrete de pagamento: sua fatura do plano ${p.plan_name} no valor de R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vence em ${new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}. Se já efetuou o pagamento, favor desconsiderar. Obrigado! 💪`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-primary-dim transition-colors p-1.5 bg-primary/10 hover:bg-primary/20 rounded border border-primary/20 flex items-center justify-center"
                                  title="Cobrar via WhatsApp"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </a>
                              )}
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
          </div>
        </>
      ) : (
        <>
          {/* Despesas Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-container border border-red-500/20 rounded-xl p-5 hover:border-red-500/40 transition-colors shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 rotate-180" /> Pago (Mês Atual)
                </span>
                <DollarSign className="w-5 h-5 text-red-400/80" />
              </div>
              <div className="text-2xl font-heading font-black text-white">
                R$ {costTotalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Soma de todas as despesas pagas neste mês.</div>
            </div>

            <div className="bg-surface-container border border-amber-500/20 rounded-xl p-5 hover:border-amber-500/40 transition-colors shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> A Pagar (Mês Atual)
                </span>
                <DollarSign className="w-5 h-5 text-amber-400/80" />
              </div>
              <div className="text-2xl font-heading font-black text-white">
                R$ {costTotalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Despesas em aberto com vencimento neste mês.</div>
            </div>

            <div className="bg-surface-container border border-red-500/20 rounded-xl p-5 hover:border-red-500/40 transition-colors shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Vencido & Não Pago
                </span>
                <DollarSign className="w-5 h-5 text-red-400/80 animate-pulse" />
              </div>
              <div className="text-2xl font-heading font-black text-white">
                R$ {costTotalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Total de despesas com datas em atraso geral.</div>
            </div>
          </div>

          {/* Despesas Chart */}
          <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
            <h3 className="font-heading font-semibold text-lg text-white mb-6">Gráfico de Custos Mensais - {currentYear}</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#224233" vertical={false} />
                  <XAxis dataKey="month" stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8f9b95" fontSize={12} tickLine={false} axisLine={false} width={50} tickFormatter={(v: any) => `R$ ${v}`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#12241C', border: '1px solid #224233', borderRadius: '8px', color: '#e0e8e4' }}
                    formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`}
                  />
                  <Bar dataKey="pago" name="Pago" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendente" name="Pendente/Atrasado" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Despesas Table */}
          <div className="bg-surface-container border border-surface-highest rounded-xl p-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-surface-highest pb-4 mb-6">
              <h3 className="font-heading font-semibold text-lg text-white">Relatório Geral de Custos</h3>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-surface-high rounded-lg border border-surface-highest px-3 py-1.5 w-60 focus-within:border-primary/50 transition-colors">
                  <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Buscar despesa..." 
                    value={costsSearchTerm}
                    onChange={e => setCostsSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-zinc-500" 
                  />
                </div>

                <select
                  value={costsCategoryFilter}
                  onChange={e => setCostsCategoryFilter(e.target.value)}
                  className="bg-surface-high border border-surface-highest text-zinc-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="todos">Todas Categorias</option>
                  {COST_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={costsStatusFilter}
                  onChange={e => setCostsStatusFilter(e.target.value)}
                  className="bg-surface-high border border-surface-highest text-zinc-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="todos">Todos Status</option>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="atrasado">Atrasado</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-surface-high uppercase text-xs font-bold text-zinc-500">
                  <tr>
                    <th className="p-4 rounded-tl-lg">Descrição</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Valor</th>
                    <th className="p-4">Vencimento</th>
                    <th className="p-4">Data Pagto.</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right rounded-tr-lg">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-highest">
                  {filteredCosts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-zinc-500 italic py-10">
                        Nenhum custo registrado.
                      </td>
                    </tr>
                  ) : (
                    filteredCosts.map((c) => {
                      const actualStatus = c.status === 'Pago' ? 'Pago' : (c.due_date < todayStr ? 'Atrasado' : 'Pendente');

                      return (
                        <tr key={c.id} className="hover:bg-surface-high/30 transition-colors">
                          <td className="p-4 font-bold text-white">
                            {c.description}
                          </td>
                          <td className="p-4 text-zinc-400">
                            <span className="px-2 py-1 bg-surface-high rounded text-xs">
                              {c.category}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-white font-mono">
                            R$ {Number(c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 font-mono text-zinc-400">
                            {c.due_date ? new Date(c.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-4 font-mono text-zinc-400">
                            {c.payment_date ? new Date(c.payment_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                              actualStatus === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              actualStatus === 'Atrasado' ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {actualStatus}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {actualStatus !== 'Pago' && (
                                <button
                                  onClick={() => handleMarkCostAsPaid(c.id)}
                                  className="text-emerald-400 hover:text-emerald-300 transition-colors p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/20"
                                  title="Marcar como Pago"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => openEditCost(c)}
                                className="text-zinc-400 hover:text-white transition-colors p-1.5 bg-surface-high hover:bg-zinc-800 rounded border border-surface-highest"
                                title="Editar Despesa"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCost(c.id)}
                                className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 bg-surface-high hover:bg-red-500/10 rounded border border-surface-highest hover:border-red-500/20"
                                title="Excluir Despesa"
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
          </div>
        </>
      )}

      {/* MODAL: Adicionar Cobrança (Receitas) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-heading font-bold text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" /> Lançar Nova Cobrança
              </h3>

              <form onSubmit={handleAddPaymentSubmit} className="space-y-4">
                {/* Autocomplete Aluno */}
                <div className="relative">
                  <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Aluno</label>
                  <input
                    type="text"
                    placeholder="Digite o nome do aluno..."
                    value={studentInput}
                    onChange={(e) => {
                      setStudentInput(e.target.value);
                      setSelectedStudent(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-surface-high border border-surface-highest text-white rounded p-3 mt-1 outline-none focus:border-primary text-sm"
                  />
                  {showSuggestions && studentInput && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-surface-high border border-surface-highest rounded mt-1 shadow-2xl max-h-40 overflow-y-auto z-50">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectStudentFromSuggestion(s)}
                          className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-surface-highest/40 last:border-b-0"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedStudent && (
                    <div className="mt-2 text-xs text-[#00ff41] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aluno Selecionado: {selectedStudent.name}
                    </div>
                  )}
                </div>

                {/* Plan Presets */}
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Planos Rápidos</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button type="button" onClick={() => applyPreset('Mensal', '150')} className={`py-2 px-3 text-xs border rounded transition-all font-bold ${formPlanName === 'Mensal' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'}`}>Mensal: R$ 150</button>
                    <button type="button" onClick={() => applyPreset('Trimestral', '400')} className={`py-2 px-3 text-xs border rounded transition-all font-bold ${formPlanName === 'Trimestral' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'}`}>Trimestral: R$ 400</button>
                    <button type="button" onClick={() => applyPreset('Semestral', '750')} className={`py-2 px-3 text-xs border rounded transition-all font-bold ${formPlanName === 'Semestral' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'}`}>Semestral: R$ 750</button>
                    <button type="button" onClick={() => applyPreset('Anual', '1300')} className={`py-2 px-3 text-xs border rounded transition-all font-bold ${formPlanName === 'Anual' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-surface-highest text-zinc-400 hover:text-white'}`}>Anual: R$ 1.300</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Nome do Plano</label>
                    <input
                      type="text"
                      value={formPlanName}
                      onChange={(e) => setFormPlanName(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Valor (R$)</label>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider block">Data de Vencimento</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-sm font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider rounded hover:bg-primary-dim transition-colors text-xs font-sans mt-4"
                >
                  {saving ? 'Registrando...' : 'Lançar Cobrança'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Adicionar Despesa (Despesas) */}
      <AnimatePresence>
        {showAddCostModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative"
            >
              <button 
                onClick={() => setShowAddCostModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-heading font-bold text-white mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-red-400" /> Registrar Nova Despesa
              </h3>

              <form onSubmit={handleAddCostSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Descrição / Custo</label>
                  <input
                    type="text"
                    placeholder="Ex: Aluguel da Sala, Marketing do Mês..."
                    value={costDescription}
                    onChange={(e) => setCostDescription(e.target.value)}
                    className="w-full bg-surface-high border border-surface-highest text-white rounded p-3 mt-1 outline-none focus:border-primary text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Categoria</label>
                    <select
                      value={costCategory}
                      onChange={(e) => setCostCategory(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-zinc-300 rounded p-2.5 mt-1 outline-none focus:border-primary text-sm cursor-pointer"
                    >
                      {COST_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Valor (R$)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={costAmount}
                      onChange={(e) => setCostAmount(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider block">Data de Vencimento</label>
                  <input
                    type="date"
                    value={costDueDate}
                    onChange={(e) => setCostDueDate(e.target.value)}
                    className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-sm font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={costSaving}
                  className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider rounded hover:bg-primary-dim transition-colors text-xs font-sans mt-4"
                >
                  {costSaving ? 'Registrando...' : 'Registrar Despesa'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Editar Despesa (Despesas) */}
      <AnimatePresence>
        {showEditCostModal && selectedCost && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative"
            >
              <button 
                onClick={() => setShowEditCostModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-heading font-bold text-white mb-6 flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" /> Editar Despesa
              </h3>

              <form onSubmit={handleEditCostSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Descrição / Custo</label>
                  <input
                    type="text"
                    value={costDescription}
                    onChange={(e) => setCostDescription(e.target.value)}
                    className="w-full bg-surface-high border border-surface-highest text-white rounded p-3 mt-1 outline-none focus:border-primary text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Categoria</label>
                    <select
                      value={costCategory}
                      onChange={(e) => setCostCategory(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-zinc-300 rounded p-2.5 mt-1 outline-none focus:border-primary text-sm cursor-pointer"
                    >
                      {COST_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Valor (R$)</label>
                    <input
                      type="number"
                      value={costAmount}
                      onChange={(e) => setCostAmount(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider block">Data Vencimento</label>
                    <input
                      type="date"
                      value={costDueDate}
                      onChange={(e) => setCostDueDate(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider block">Status</label>
                    <select
                      value={costStatus}
                      onChange={(e) => setCostStatus(e.target.value as any)}
                      className="w-full bg-surface-high border border-surface-highest text-zinc-300 rounded p-2.5 mt-1 outline-none focus:border-primary text-xs cursor-pointer"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Pago">Pago</option>
                      <option value="Atrasado">Atrasado</option>
                    </select>
                  </div>
                </div>

                {costStatus === 'Pago' && (
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider block">Data de Pagamento</label>
                    <input
                      type="date"
                      value={costPaymentDate}
                      onChange={(e) => setCostPaymentDate(e.target.value)}
                      className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 outline-none focus:border-primary text-sm font-mono"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={costSaving}
                  className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider rounded hover:bg-primary-dim transition-colors text-xs font-sans mt-4"
                >
                  {costSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
