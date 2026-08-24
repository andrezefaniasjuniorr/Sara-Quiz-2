import React, { useState, useEffect } from 'react';
import { UserProfile, Qualification, WithdrawalRequest, MobileWallet } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { SupabaseAuthService } from '../lib/supabase';
import { 
  User, 
  Award, 
  Flame, 
  CheckCircle2, 
  Zap, 
  Edit3, 
  Save, 
  Layers, 
  ShieldCheck, 
  ChevronRight, 
  Trophy,
  Wallet,
  ArrowDownToLine,
  Clock,
  AlertCircle,
  Phone,
  Calendar,
  LogOut,
  XCircle,
  TrendingUp,
  HelpCircle
} from 'lucide-react';

interface ProfileViewProps {
  user: UserProfile;
  onUpdateProfile: (updated: { name?: string; avatar?: string; qualification_interest?: Qualification; age?: number; phone?: string }) => void;
  onSelectQualificationToPlay: (qual: Qualification) => void;
  onLogout: () => void;
  onUserRefresh?: () => void;
}

const AVATAR_CHOICES = ['👨‍🎓', '👩‍🎓', '⚡', '👨‍🔧', '👩‍🔧', '👷‍♂️', '👩‍💼', '🧑‍💼', '👨‍💻', '👩‍🏫', '⚙️', '🧠'];

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUpdateProfile,
  onSelectQualificationToPlay,
  onLogout,
  onUserRefresh,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editAvatar, setEditAvatar] = useState(user.avatar);
  const [editAge, setEditAge] = useState(user.age || 20);
  const [editQual, setEditQual] = useState<Qualification>(user.qualification_interest || 'Eletricidade Industrial');

  // Withdrawal State
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [walletType, setWalletType] = useState<MobileWallet>('M-Pesa');
  const [walletNumber, setWalletNumber] = useState(user.phone || '');
  const [amountMt, setAmountMt] = useState<number>(1000);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const balanceMt = user.total_points / 2;
  const minPointsRequired = 2000;
  const minMtRequired = 1000;
  const canWithdraw = user.total_points >= minPointsRequired;
  const pointsProgressPct = Math.min(100, Math.round((user.total_points / minPointsRequired) * 100));

  const accuracy = user.total_answered > 0 ? Math.round((user.total_correct / user.total_answered) * 100) : 0;

  // Load User Withdrawals History directly from Supabase
  const loadWithdrawals = async () => {
    try {
      const userWithdrawals = await SupabaseAuthService.getUserWithdrawals(user.id);
      setWithdrawals(userWithdrawals);
    } catch (err) {
      console.error('Error fetching withdrawals from Supabase:', err);
    }
  };

  useEffect(() => {
    loadWithdrawals();
    setWalletNumber(user.phone || '');
    setEditPhone(user.phone || '');
    setEditName(user.name || '');
    setEditAge(user.age || 20);
  }, [user.id, user.phone, user.name, user.age]);

  const handleSave = () => {
    onUpdateProfile({
      name: editName.trim() || user.name,
      phone: editPhone.trim() || user.phone,
      avatar: editAvatar,
      age: Number(editAge) || user.age,
      qualification_interest: editQual,
    });
    setIsEditing(false);
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    const mtVal = Number(amountMt);
    if (isNaN(mtVal) || mtVal < minMtRequired) {
      setWithdrawError(`O valor mínimo para levantamento é de ${minMtRequired.toLocaleString()} MT.`);
      return;
    }

    const requiredPoints = mtVal * 2;
    if (user.total_points < requiredPoints) {
      setWithdrawError(`Saldo insuficiente. Você possui ${user.total_points} pts (${balanceMt} MT). Necessário ${requiredPoints} pts.`);
      return;
    }

    if (!walletNumber.trim()) {
      setWithdrawError('Por favor informe o número de celular da sua carteira móvel.');
      return;
    }

    setWithdrawLoading(true);

    try {
      // 100% Native Supabase Withdrawal Request
      await SupabaseAuthService.requestWithdrawal({
        user_id: user.id,
        wallet_type: walletType,
        wallet_number: walletNumber.trim(),
        amount_mt: mtVal,
      });

      setWithdrawSuccess('Solicitação enviada com sucesso! O dinheiro irá refletir na sua conta em 2 a 3 horas.');
      loadWithdrawals();
      if (onUserRefresh) onUserRefresh();

      setTimeout(() => {
        setIsWithdrawModalOpen(false);
        setWithdrawSuccess(null);
      }, 3000);
    } catch (err: any) {
      setWithdrawError(err.message || 'Erro ao processar levantamento no Supabase.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div id="screen-profile" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      
      {/* Top Header Identity Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-slate-800 border-2 border-amber-500/40 flex items-center justify-center text-5xl sm:text-6xl shadow-xl shrink-0">
              {user.avatar}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Jogador Oficial
                </span>
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span>{user.phone}</span>
                </span>
                {user.age && (
                  <span className="text-xs text-slate-400">
                    • {user.age} anos
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <span>{user.name}</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Qualificação de Foco: <strong className="text-slate-200">{user.qualification_interest}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancelar' : 'Editar Perfil'}</span>
            </button>

            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>

        </div>

        {/* Inline Edit Form */}
        {isEditing && (
          <div className="mt-6 pt-6 border-t border-slate-800 animate-fadeIn">
            <h3 className="text-sm font-bold text-white mb-3">Atualizar Informações Pessoais</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Nome Completo:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={40}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-750 focus:border-amber-400 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Número de Celular:</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ex: +258 84 123 4567"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-750 focus:border-amber-400 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Idade:</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={editAge}
                  onChange={(e) => setEditAge(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-750 focus:border-amber-400 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Qualificação Principal:</label>
                <select
                  value={editQual}
                  onChange={(e) => setEditQual(e.target.value as Qualification)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-750 focus:border-amber-400 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none"
                >
                  {QUALIFICATIONS_LIST.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.icon} {q.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-400 font-semibold block mb-1.5">Escolher Avatar:</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_CHOICES.map((av) => (
                  <button
                    key={av}
                    onClick={() => setEditAvatar(av)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all cursor-pointer ${
                      editAvatar === av
                        ? 'bg-amber-500/20 border-amber-500 scale-110 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-750'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* WALLET & REAL-MONEY WITHDRAWAL BENTO */}
      <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border-2 border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
          
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Wallet className="w-4 h-4 text-amber-400" />
              <span>Carteira & Conversão Financeira Real</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Saldo em Pontos & <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">Meticais (MT)</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Regra oficial: <strong>1 MT = 2 Pontos</strong>. Levantamento mínimo de <strong>1.000 MT (2.000 pts)</strong> via <strong>M-Pesa</strong> ou <strong>E-Mola</strong>. 
              <span className="text-rose-300 font-semibold block mt-1">
                ⚠️ Taxa de Erro: Errar questões desconta de 5 a 20 MT (-10 a -40 pts) do seu saldo conforme a dificuldade.
              </span>
            </p>
          </div>

          {/* Quick Balance Counter */}
          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl shrink-0">
            <div className="text-right">
              <span className="text-xs text-slate-400 font-semibold block">Pontos Totais</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {user.total_points.toLocaleString()} <span className="text-xs text-amber-300">pts</span>
              </span>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div className="text-left">
              <span className="text-xs text-emerald-400 font-semibold block">Saldo em Dinheiro</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {balanceMt.toLocaleString()} <span className="text-xs text-emerald-300">MT</span>
              </span>
            </div>
          </div>

        </div>

        {/* Withdrawal Progress Bar & Call to Action */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">
                Progresso para Levantamento Mínimo (2.000 pts = 1.000 MT):
              </span>
              <span className="text-xs font-extrabold text-amber-400 font-mono">
                {user.total_points} / {minPointsRequired} pts
              </span>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {canWithdraw ? 'Meta atingida! Disponível para saque' : `Faltam ${Math.max(0, minPointsRequired - user.total_points)} pts (${Math.max(0, minMtRequired - balanceMt)} MT)`}
            </span>
          </div>

          {/* Bar */}
          <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden relative">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                canWithdraw 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${pointsProgressPct}%` }}
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>O dinheiro solicitado via M-Pesa ou E-Mola irá refletir na sua conta em <strong>2 a 3 horas</strong>.</span>
            </div>

            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              disabled={!canWithdraw}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                canWithdraw
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>{canWithdraw ? 'Solicitar Levantamento (M-Pesa / E-Mola)' : 'Levantamento Bloqueado (Mín. 1.000 MT)'}</span>
            </button>
          </div>
        </div>

        {/* Withdrawal Requests History */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <span>Histórico de Levantamentos</span>
            <span className="text-xs text-slate-400">({withdrawals.length})</span>
          </h3>

          {withdrawals.length === 0 ? (
            <div className="text-xs text-slate-500 bg-slate-950/40 p-4 rounded-xl text-center border border-slate-800/50">
              Nenhuma solicitação de levantamento efetuada até o momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 bg-slate-950/60 rounded-2xl border border-slate-800 overflow-hidden text-xs">
              {withdrawals.map((w) => (
                <div key={w.id} className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs">
                      {w.wallet_type === 'M-Pesa' ? '🔴' : '🟡'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">
                        {w.amount_mt.toLocaleString()} MT <span className="text-[11px] text-slate-400">({w.points_deducted} pts)</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {w.wallet_type}: {w.wallet_number} • {new Date(w.created_at).toLocaleDateString()} {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div>
                    {w.status === 'pending' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Pendente (Reflete em 2-3h)</span>
                      </span>
                    )}
                    {w.status === 'completed' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Concluído & Transferido</span>
                      </span>
                    )}
                    {w.status === 'rejected' && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        <span>Rejeitado (Pontos Reembolsados)</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Global Performance Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
            <Award className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-white block">{user.total_points.toLocaleString()}</span>
          <span className="text-xs text-slate-400 font-medium">Pontos Totais</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto mb-2">
            <Flame className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-white block">{user.best_streak}</span>
          <span className="text-xs text-slate-400 font-medium">Maior Sequência (Streak)</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-white block">{accuracy}%</span>
          <span className="text-xs text-slate-400 font-medium">Precisão Global ({user.total_correct}/{user.total_answered})</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-2">
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-white block">{user.total_skipped || 0}</span>
          <span className="text-xs text-slate-400 font-medium">Questões Puladas (-5 pts)</span>
        </div>
      </div>

      {/* Mastery & Stats by Qualification */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span>Domínio Técnico por Qualificação</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUALIFICATIONS_LIST.map((q) => {
            const stat = user.qualification_stats[q.id] || {
              points: 0,
              answered: 0,
              correct: 0,
              skipped: 0,
              best_streak: 0,
              mastery_pct: 0,
              tier: 'Iniciante',
            };

            return (
              <div
                key={q.id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{q.icon}</span>
                    <div>
                      <h4 className="font-bold text-slate-200 text-sm">{q.title}</h4>
                      <span className="text-[11px] text-amber-400 font-semibold">{stat.tier}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectQualificationToPlay(q.id)}
                    className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <span>Jogar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${stat.mastery_pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{stat.points.toLocaleString()} pts ({stat.points / 2} MT)</span>
                  <span>{stat.correct}/{stat.answered} certas ({stat.mastery_pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WITHDRAWAL REQUEST MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              <span>Solicitar Levantamento</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Saldo disponível: <strong className="text-emerald-400">{balanceMt.toLocaleString()} MT</strong> ({user.total_points.toLocaleString()} pts).
            </p>

            {withdrawError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{withdrawError}</span>
              </div>
            )}

            {withdrawSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{withdrawSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRequestWithdrawal} className="space-y-4">
              
              {/* Carteira Movel Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Selecione a Carteira Móvel:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWalletType('M-Pesa')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      walletType === 'M-Pesa'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-md shadow-rose-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-750'
                    }`}
                  >
                    <span>🔴</span>
                    <span>M-Pesa (Vodacom)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWalletType('E-Mola')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      walletType === 'E-Mola'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-750'
                    }`}
                  >
                    <span>🟡</span>
                    <span>E-Mola (Movitel)</span>
                  </button>
                </div>
              </div>

              {/* Numero de Celular da Carteira */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Número de Celular {walletType}:
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 841234567"
                  value={walletNumber}
                  onChange={(e) => setWalletNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 focus:outline-none"
                />
              </div>

              {/* Valor em MT */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Valor a Levantar (MT):
                  </label>
                  <span className="text-[11px] text-amber-400 font-semibold">
                    Custo: {Number(amountMt || 0) * 2} pontos
                  </span>
                </div>
                <input
                  type="number"
                  min={minMtRequired}
                  max={balanceMt}
                  step={50}
                  required
                  value={amountMt}
                  onChange={(e) => setAmountMt(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Mínimo: 1.000 MT (2.000 pts). Máximo: {balanceMt.toLocaleString()} MT.
                </span>
              </div>

              {/* Notice */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                ⏱️ <strong>Prazo de Transferência:</strong> O dinheiro solicitado será transferido diretamente para a sua conta {walletType} e refletirá no prazo de <strong>2 a 3 horas</strong> após a confirmação administrativa.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsWithdrawModalOpen(false);
                    setWithdrawError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading || amountMt < minMtRequired || amountMt > balanceMt}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {withdrawLoading ? 'Processando...' : 'Confirmar Solicitação'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
