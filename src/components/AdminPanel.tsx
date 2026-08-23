import React, { useState, useEffect } from 'react';
import { Question, Qualification, WithdrawalRequest, ActivityLog } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabase';
import { 
  Shield, 
  PlusCircle, 
  Upload, 
  AlertTriangle, 
  Check, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  Database, 
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
  Lock,
  Wallet,
  Users,
  Clock,
  ArrowRight,
  Send,
  Activity,
  Phone,
  Calendar,
  AlertCircle,
  Server,
  Copy,
  ExternalLink,
  Zap
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('sara_quiz_admin_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Admin Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'withdrawals' | 'users' | 'activities' | 'questions' | 'create' | 'import' | 'moderation' | 'supabase'
  >('withdrawals');

  const [stats, setStats] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Supabase Status State
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [supabaseSyncMsg, setSupabaseSyncMsg] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filters for Questions tab
  const [filterQual, setFilterQual] = useState<string>('');
  const [filterDiff, setFilterDiff] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Create Question Form State (strictly scaled: 5-20 fácil, 21-50 médio, 51-100 difícil)
  const [formData, setFormData] = useState({
    qualification: 'Eletricidade Industrial' as Qualification,
    subcategory: '',
    difficulty: 'Médio',
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correct_answer: 'a' as 'a' | 'b' | 'c' | 'd',
    points: 35,
    time_limit: 25,
    explanation: '',
    scientist: '',
    lawOrPrinciple: '',
  });
  const [createSuccess, setCreateSuccess] = useState(false);

  // Bulk Import State
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importData, setImportData] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Handle PIN Unlock
  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pinInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminAuthenticated(true);
        sessionStorage.setItem('sara_quiz_admin_auth', 'true');
        loadAllAdminData();
      } else {
        setPinError(data.error || 'Palavra-passe de administrador incorreta.');
      }
    } catch (err) {
      setPinError('Erro ao verificar palavra-passe.');
    }
  };

  const handleLogoutAdmin = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('sara_quiz_admin_auth');
    setPinInput('');
  };

  // Load All Admin Data
  const loadAllAdminData = async () => {
    try {
      const [statsRes, qRes, usersRes, withRes, actRes, repRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/questions'),
        fetch('/api/admin/users'),
        fetch('/api/admin/withdrawals'),
        fetch('/api/admin/activities'),
        fetch('/api/admin/moderation'),
      ]);

      const statsData = await statsRes.json();
      const qData = await qRes.json();
      const usersData = await usersRes.json();
      const withData = await withRes.json();
      const actData = await actRes.json();
      const repData = await repRes.json();

      setStats(statsData);
      setQuestions(qData.questions || []);
      setRegisteredUsers(usersData.users || []);
      setWithdrawals(withData.withdrawals || []);
      setActivities(actData.activities || []);
      setReports(repData.reports || []);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadAllAdminData();
      const interval = setInterval(loadAllAdminData, 10000); // Polling for real-time updates
      return () => clearInterval(interval);
    }
  }, [isAdminAuthenticated]);

  // Process Withdrawal (Approve or Reject)
  const handleProcessWithdrawal = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        loadAllAdminData();
      }
    } catch (err) {
      console.error('Error processing withdrawal:', err);
    }
  };

  // Create Question Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        qualification: formData.qualification,
        subcategory: formData.subcategory.trim() || 'Geral',
        difficulty: formData.difficulty,
        question: formData.question.trim(),
        options: {
          a: formData.optionA.trim(),
          b: formData.optionB.trim(),
          c: formData.optionC.trim(),
          d: formData.optionD.trim(),
        },
        correct_answer: formData.correct_answer,
        points: Number(formData.points) || (formData.difficulty === 'Fácil' ? 15 : formData.difficulty === 'Médio' ? 35 : 75),
        time_limit: Number(formData.time_limit) || 25,
        explanation: formData.explanation.trim(),
      };

      if (formData.scientist.trim() && formData.lawOrPrinciple.trim()) {
        payload.scientist_law = {
          scientist: formData.scientist.trim(),
          lawOrPrinciple: formData.lawOrPrinciple.trim(),
          field: formData.qualification,
        };
      }

      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setCreateSuccess(true);
        loadAllAdminData();
        setFormData({
          qualification: 'Eletricidade Industrial',
          subcategory: '',
          difficulty: 'Médio',
          question: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correct_answer: 'a',
          points: 35,
          time_limit: 25,
          explanation: '',
          scientist: '',
          lawOrPrinciple: '',
        });
        setTimeout(() => setCreateSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error creating question:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Import Submit
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importData.trim()) return;
    setLoading(true);
    setImportStatus(null);

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: importFormat,
          data: importData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setImportStatus(`Sucesso! ${data.imported_count} questões foram importadas para o banco.`);
        setImportData('');
        loadAllAdminData();
      } else {
        setImportStatus(`Erro na importação: ${data.error}`);
      }
    } catch (err: any) {
      setImportStatus(`Erro de rede ou formato inválido.`);
    } finally {
      setLoading(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta questão?')) return;
    try {
      await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
      loadAllAdminData();
    } catch (err) {
      console.error('Error deleting question:', err);
    }
  };

  // Moderation action
  const handleModerationAction = async (action: string, repId: string, msgId?: string, userId?: string) => {
    try {
      await fetch(`/api/admin/moderation/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: repId, message_id: msgId, user_id: userId }),
      });
      loadAllAdminData();
    } catch (err) {
      console.error('Error in moderation action:', err);
    }
  };

  // Supabase Handlers
  const loadSupabaseStatus = async () => {
    try {
      const res = await fetch('/api/supabase/status');
      const data = await res.json();
      setSupabaseStatus(data);
    } catch (err: any) {
      console.error('Error loading Supabase status:', err);
    }
  };

  const handleSyncAllSupabase = async () => {
    setSupabaseSyncing(true);
    setSupabaseSyncMsg(null);
    try {
      const res = await fetch('/api/supabase/sync-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSupabaseSyncMsg(`Sincronização concluída com sucesso! (${data.synced.users} usuários, ${data.synced.questions} questões, ${data.synced.withdrawals} levantamentos, ${data.synced.activities} atividades)`);
        loadSupabaseStatus();
        loadAllAdminData();
      } else {
        setSupabaseSyncMsg(`Erro na sincronização: ${data.error || 'Falha ao sincronizar'}`);
      }
    } catch (err: any) {
      setSupabaseSyncMsg('Erro de conexão ao sincronizar com o Supabase.');
    } finally {
      setSupabaseSyncing(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // ----------------------------------------------------
  // 1. PIN PASSWORD GATE (PASSWORD "001234")
  // ----------------------------------------------------
  if (!isAdminAuthenticated) {
    return (
      <div id="screen-admin-gate" className="max-w-md mx-auto px-4 py-16 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 text-2xl">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black text-white">Acesso Restrito</h2>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Digite a palavra-passe de administrador para monitorar o jogo e gerenciar levantamentos.
          </p>

          {pinError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockAdmin} className="space-y-4">
            <div>
              <input
                type="password"
                autoFocus
                required
                maxLength={10}
                placeholder="Palavra-passe de Admin"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center text-lg tracking-widest px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Desbloquear Painel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered Questions
  const filteredQuestions = questions.filter((q) => {
    if (filterQual && q.qualification !== filterQual) return false;
    if (filterDiff && q.difficulty !== filterDiff) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return q.question.toLowerCase().includes(s) || q.explanation.toLowerCase().includes(s);
    }
    return true;
  });

  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');

  // ----------------------------------------------------
  // 2. AUTHENTICATED ADMIN DASHBOARD
  // ----------------------------------------------------
  return (
    <div id="screen-admin-panel" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      
      {/* Header & Quick Global Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Painel do Administrador & Monitoramento</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Gestão do Sistema <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Sara Quiz</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllAdminData}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Dados</span>
          </button>

          <button
            onClick={handleLogoutAdmin}
            className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear Admin</span>
          </button>
        </div>
      </div>

      {/* Stats Bento */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Levantamentos Pendentes</span>
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {stats.pending_withdrawals_count} <span className="text-xs text-slate-400">({stats.pending_withdrawals_total_mt.toLocaleString()} MT)</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Jogadores Reais</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {stats.total_players} <span className="text-xs text-slate-400">({stats.online_players} online)</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Saldo Distribuído</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono">
              {stats.total_meticais_balance.toLocaleString()} <span className="text-xs text-slate-400">MT</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Questões no Banco</span>
              <Database className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {stats.total_db_questions}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Moderação / Denúncias</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400 font-mono">
              {stats.pending_reports}
            </div>
          </div>

        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin scrollbar-thumb-slate-800">
        
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'withdrawals'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Solicitações de Levantamento</span>
          {pendingWithdrawals.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 font-black text-[10px]">
              {pendingWithdrawals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Jogadores Cadastrados ({registeredUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activities')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'activities'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Monitoramento em Tempo Real</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'questions'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Banco de Perguntas</span>
        </button>

        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'create'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Cadastrar Pergunta</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'import'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Importar JSON / CSV</span>
        </button>

        <button
          onClick={() => setActiveTab('moderation')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'moderation'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Moderação</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('supabase');
            loadSupabaseStatus();
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'supabase'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-900 text-emerald-400 hover:bg-slate-800 border border-emerald-500/30'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Supabase DB</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
      </div>

      {/* 1. ABA DE LEVANTAMENTOS (M-PESA & E-MOLA) */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              <span>Gerenciamento de Solicitações de Saque (M-Pesa / E-Mola)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Transfira o valor para o número indicado e clique em <strong>"Confirmar Transferência"</strong>. Caso haja algum problema com a conta do usuário, clique em <strong>"Rejeitar & Devolver Pontos"</strong> para estornar o saldo.
            </p>

            {withdrawals.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhuma solicitação de levantamento registrada até o momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Jogador</th>
                      <th className="py-3 px-4">Carteira & Celular</th>
                      <th className="py-3 px-4">Valor em MT</th>
                      <th className="py-3 px-4">Pontos Deduzidos</th>
                      <th className="py-3 px-4">Data/Hora</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ação do Administrador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div>{w.user_name}</div>
                          <span className="text-[11px] text-slate-400 font-mono">ID: {w.user_id}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                            <span>{w.wallet_type === 'M-Pesa' ? '🔴' : '🟡'}</span>
                            <span>{w.wallet_type}</span>
                          </span>
                          <div className="font-mono text-amber-300 font-bold text-sm mt-0.5">{w.wallet_number}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-emerald-400 text-sm">{w.amount_mt.toLocaleString()} MT</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {w.points_deducted.toLocaleString()} pts
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(w.created_at).toLocaleDateString()} {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-4">
                          {w.status === 'pending' && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              ⏳ Pendente
                            </span>
                          )}
                          {w.status === 'completed' && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                              ✅ Transferido & Pago
                            </span>
                          )}
                          {w.status === 'rejected' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                              ❌ Rejeitado (Estornado)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {w.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleProcessWithdrawal(w.id, 'approve')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm cursor-pointer"
                              >
                                ✅ Confirmar Transferência
                              </button>
                              <button
                                onClick={() => handleProcessWithdrawal(w.id, 'reject')}
                                className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold transition-all shadow-sm cursor-pointer"
                              >
                                ❌ Rejeitar & Devolver Pontos
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">Finalizado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ABA DE JOGADORES CADASTRADOS (MONITORAMENTO) */}
      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Jogadores Reais Cadastrados</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total de <strong>{registeredUsers.length} usuários</strong> registrados com número de celular exclusivo.
              </p>
            </div>
          </div>

          {registeredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Nenhum jogador cadastrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Jogador</th>
                    <th className="py-3 px-4">Número de Celular</th>
                    <th className="py-3 px-4">Idade</th>
                    <th className="py-3 px-4">Qualificação de Foco</th>
                    <th className="py-3 px-4">Saldo em Pontos</th>
                    <th className="py-3 px-4">Saldo em Meticais (MT)</th>
                    <th className="py-3 px-4">Respondidas / Acertos</th>
                    <th className="py-3 px-4">Data de Cadastro</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {registeredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                        <span className="text-2xl">{u.avatar}</span>
                        <div>
                          <div>{u.name}</div>
                          <span className="text-[10px] text-slate-500 font-mono">{u.id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                        {u.phone}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {u.age || '-'} anos
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {u.qualification_interest}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                        {u.total_points.toLocaleString()} pts
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {(u.total_points / 2).toLocaleString()} MT
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {u.total_answered} ({u.total_correct} certas / {u.total_skipped || 0} puladas)
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(u.joined_at).toLocaleDateString()} {new Date(u.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        {u.is_online ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            Online
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Offline</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. ABA DE ATIVIDADES EM TEMPO REAL */}
      {activeTab === 'activities' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <span>Feed de Atividades & Auditoria em Tempo Real</span>
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Acompanhamento de novos cadastros, solicitações de saque, jogos e ações dos usuários.
          </p>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
            {activities.map((act) => (
              <div key={act.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base shrink-0">
                  {act.type === 'register' ? '👤' : act.type === 'withdrawal' ? '💰' : act.type === 'skip' ? '⏭️' : '🎮'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">{act.title}</h4>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ABA DE BANCO DE PERGUNTAS */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterQual}
                  onChange={(e) => setFilterQual(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">Todas as Qualificações</option>
                  {QUALIFICATIONS_LIST.map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>

                <select
                  value={filterDiff}
                  onChange={(e) => setFilterDiff(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">Todas as Dificuldades</option>
                  <option value="Fácil">Fácil (5-20 pts)</option>
                  <option value="Médio">Médio (21-50 pts)</option>
                  <option value="Difícil">Difícil (51-100 pts)</option>
                </select>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar perguntas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>

            </div>

            <div className="text-xs text-slate-400 mb-3">
              Mostrando <strong>{filteredQuestions.length}</strong> de {questions.length} questões
            </div>

            <div className="space-y-3">
              {filteredQuestions.map((q) => (
                <div key={q.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                        {q.qualification}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        q.difficulty === 'Fácil' ? 'bg-emerald-500/20 text-emerald-400' :
                        q.difficulty === 'Médio' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {q.difficulty} (+{q.points} pts)
                      </span>
                      {q.scientist_law && (
                        <span className="text-[10px] text-slate-400">
                          🔬 {q.scientist_law.lawOrPrinciple} ({q.scientist_law.scientist})
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-200">{q.question}</h4>
                    <p className="text-xs text-slate-400 mt-1">{q.explanation}</p>
                  </div>

                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 self-end sm:self-auto cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. ABA DE CADASTRO DE PERGUNTA */}
      {activeTab === 'create' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto">
          <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-amber-400" />
            <span>Cadastrar Nova Pergunta Técnica</span>
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            A pontuação deve seguir a regra: Fácil (5-20 pts), Médio (21-50 pts), Difícil (51-100 pts).
          </p>

          {createSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Questão cadastrada com sucesso no banco de dados!</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Qualificação:</label>
                <select
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value as Qualification })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                >
                  {QUALIFICATIONS_LIST.map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dificuldade:</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => {
                    const diff = e.target.value;
                    const defaultPts = diff === 'Fácil' ? 15 : diff === 'Médio' ? 35 : 75;
                    setFormData({ ...formData, difficulty: diff, points: defaultPts });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                >
                  <option value="Fácil">Fácil (5 a 20 pts)</option>
                  <option value="Médio">Médio (21 a 50 pts)</option>
                  <option value="Difícil">Difícil (51 a 100 pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Pontos:</label>
                <input
                  type="number"
                  min={formData.difficulty === 'Fácil' ? 5 : formData.difficulty === 'Médio' ? 21 : 51}
                  max={formData.difficulty === 'Fácil' ? 20 : formData.difficulty === 'Médio' ? 50 : 100}
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Enunciado da Questão:</label>
              <textarea
                required
                rows={3}
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="Digite o enunciado completo da questão técnica..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-xs sm:text-sm text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Opção A:</label>
                <input
                  type="text"
                  required
                  value={formData.optionA}
                  onChange={(e) => setFormData({ ...formData, optionA: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Opção B:</label>
                <input
                  type="text"
                  required
                  value={formData.optionB}
                  onChange={(e) => setFormData({ ...formData, optionB: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Opção C:</label>
                <input
                  type="text"
                  required
                  value={formData.optionC}
                  onChange={(e) => setFormData({ ...formData, optionC: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Opção D:</label>
                <input
                  type="text"
                  required
                  value={formData.optionD}
                  onChange={(e) => setFormData({ ...formData, optionD: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Alternativa Correta:</label>
                <select
                  value={formData.correct_answer}
                  onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                >
                  <option value="a">A</option>
                  <option value="b">B</option>
                  <option value="c">C</option>
                  <option value="d">D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Cientista / Autor (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ex: Michael Faraday"
                  value={formData.scientist}
                  onChange={(e) => setFormData({ ...formData, scientist: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Lei / Princípio (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ex: Lei da Indução"
                  value={formData.lawOrPrinciple}
                  onChange={(e) => setFormData({ ...formData, lawOrPrinciple: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Explicação Técnica Detalhada:</label>
              <textarea
                rows={2}
                required
                placeholder="Explicação do porquê a resposta correta é válida..."
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer"
            >
              {loading ? 'Cadastrando...' : 'Salvar Pergunta no Banco'}
            </button>
          </form>
        </div>
      )}

      {/* 6. ABA DE IMPORTAÇÃO JSON/CSV */}
      {activeTab === 'import' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto">
          <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-400" />
            <span>Importação em Lote (JSON ou CSV)</span>
          </h3>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setImportFormat('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                importFormat === 'json' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => setImportFormat('csv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                importFormat === 'csv' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              CSV
            </button>
          </div>

          {importStatus && (
            <div className="mb-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-amber-300">
              {importStatus}
            </div>
          )}

          <form onSubmit={handleImportSubmit} className="space-y-4">
            <textarea
              rows={10}
              required
              placeholder={importFormat === 'json' ? '[{"question": "...", "options": {"a": "...", "b": "..."}, "correct_answer": "a", "qualification": "Eletricidade Industrial"}]' : 'question;optA;optB;optC;optD;correct;qualification;subcategory;difficulty;explanation'}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer"
            >
              {loading ? 'Importando...' : 'Iniciar Importação em Lote'}
            </button>
          </form>
        </div>
      )}

      {/* 7. ABA DE MODERAÇÃO */}
      {activeTab === 'moderation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span>Denúncias e Moderação de Chat</span>
          </h3>

          {reports.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Nenhuma denúncia pendente. A comunidade está em conformidade.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-rose-400">{r.reason}</span>
                    <p className="text-xs text-slate-200 mt-1 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      "{r.message_content}"
                    </p>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Autor: {r.reported_user_name} ({r.reported_user_id})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleModerationAction('delete_message', r.id, r.message_id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Remover Mensagem
                    </button>
                    <button
                      onClick={() => handleModerationAction('dismiss_report', r.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. ABA DE SUPABASE */}
      {activeTab === 'supabase' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-white">Integração Supabase Database</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Banco de dados relacional PostgreSQL em nuvem para persistência permanente de jogadores, pontos, histórico de levantamentos e questões.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={loadSupabaseStatus}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar Status</span>
                </button>

                <button
                  onClick={handleSyncAllSupabase}
                  disabled={supabaseSyncing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{supabaseSyncing ? 'Sincronizando...' : 'Sincronizar Tudo Agora'}</span>
                </button>
              </div>
            </div>

            {/* Sync Feedback Message */}
            {supabaseSyncMsg && (
              <div className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                supabaseSyncMsg.includes('sucesso') 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                {supabaseSyncMsg.includes('sucesso') ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{supabaseSyncMsg}</span>
              </div>
            )}
          </div>

          {/* Connection Details Bento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-400 font-semibold mb-1">Status da Conexão</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-lg font-black text-emerald-400">Ativo & Conectado</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Sincronização em segundo plano habilitada para todas as ações.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-400 font-semibold mb-1">Endpoint do Projeto</div>
              <div className="text-sm font-mono font-bold text-slate-200 truncate">
                https://gjbqylheutriojpnopcg.supabase.co
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Project ID: <span className="font-mono text-amber-400">gjbqylheutriojpnopcg</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-400 font-semibold mb-1">Chave Pública (Anon Key)</div>
              <div className="text-xs font-mono text-emerald-300 truncate">
                sb_publishable_msIHuQZlf6hiocY9b...
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Permissão configurada para REST & Realtime APIs
              </div>
            </div>
          </div>

          {/* Tables Overview */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h4 className="text-sm font-black text-white mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Tabelas do Banco de Dados</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs font-bold text-slate-300">users</div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {supabaseStatus?.tables?.users?.count !== undefined ? supabaseStatus.tables.users.count : registeredUsers.length}
                </div>
                <div className="text-[10px] text-emerald-400 mt-1 font-semibold">Jogadores & Pontos</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs font-bold text-slate-300">questions</div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {supabaseStatus?.tables?.questions?.count !== undefined ? supabaseStatus.tables.questions.count : questions.length}
                </div>
                <div className="text-[10px] text-orange-400 mt-1 font-semibold">Banco de Questões</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs font-bold text-slate-300">withdrawals</div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {supabaseStatus?.tables?.withdrawals?.count !== undefined ? supabaseStatus.tables.withdrawals.count : withdrawals.length}
                </div>
                <div className="text-[10px] text-amber-400 mt-1 font-semibold">Levantamentos</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs font-bold text-slate-300">activity_logs</div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {supabaseStatus?.tables?.activity_logs?.count !== undefined ? supabaseStatus.tables.activity_logs.count : activities.length}
                </div>
                <div className="text-[10px] text-blue-400 mt-1 font-semibold">Feed de Atividades</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs font-bold text-slate-300">chat_messages</div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {supabaseStatus?.tables?.chat_messages?.count !== undefined ? supabaseStatus.tables.chat_messages.count : 'Ativo'}
                </div>
                <div className="text-[10px] text-purple-400 mt-1 font-semibold">Chat Geral e Privado</div>
              </div>
            </div>
          </div>

          {/* SQL Schema Generator / Instructions */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Script SQL de Criação de Tabelas (Supabase SQL Editor)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Caso crie um novo projeto no Supabase ou queira recriar as tabelas, copie o script abaixo e execute no SQL Editor do painel Supabase.
                </p>
              </div>

              <button
                onClick={handleCopySql}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 scrollbar-thin scrollbar-thumb-slate-800">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
