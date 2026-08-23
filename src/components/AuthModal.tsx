import React, { useState } from 'react';
import { UserProfile, Qualification } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { SupabaseAuthService } from '../lib/supabase';
import { 
  User, 
  Phone, 
  Lock, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  ShieldCheck,
  Award,
  Wallet
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserProfile) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

const AVATAR_LIST = ['👨‍🎓', '👩‍🎓', '👨‍🔧', '👩‍🔧', '👷‍♂️', '👩‍💼', '🧑‍💼', '👨‍💻', '👩‍🏫', '⚙️', '⚡', '🧠'];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onLoginSuccess,
  onClose,
  canDismiss = false,
}) => {
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState('👨‍🎓');
  const [qualification, setQualification] = useState<Qualification>('Eletricidade Industrial');

  // Login Form State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Por favor, informe seu nome completo.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Por favor, informe o seu número de celular.');
      return;
    }
    if (!age || Number(age) < 10 || Number(age) > 100) {
      setErrorMsg('Por favor, informe uma idade válida (entre 10 e 100 anos).');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('A palavra-passe deve conter no mínimo 4 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('A confirmação da palavra-passe não coincide com a palavra-passe digitada.');
      return;
    }

    setLoading(true);

    try {
      // 100% Native Supabase Registration
      const { user } = await SupabaseAuthService.register({
        name: name.trim(),
        phone: phone.trim(),
        age: Number(age),
        password,
        avatar,
        qualification_interest: qualification,
      });

      setSuccessMsg('Conta criada com sucesso no Supabase! Carregando jogo...');
      setTimeout(() => {
        onLoginSuccess(user);
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao registrar conta no Supabase. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginPhone.trim() || !loginPassword.trim()) {
      setErrorMsg('Informe o número de celular e a palavra-passe.');
      return;
    }

    setLoading(true);

    try {
      // 100% Native Supabase Login
      const { user } = await SupabaseAuthService.login(loginPhone.trim(), loginPassword);

      setSuccessMsg(`Bem-vindo de volta, ${user.name}!`);
      setTimeout(() => {
        onLoginSuccess(user);
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Credenciais inválidas. Verifique seu número e palavra-passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative my-8">
        
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-2xl mx-auto mb-3">
            SQ
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Bem-vindo ao <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Sara Quiz</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Plataforma oficial de qualificação técnica, pontuação e recompensas em Meticais (MT).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-slate-950 p-1 mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tab === 'register'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Criar Nova Conta
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tab === 'login'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar (Já Tenho Conta)
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. REGISTRATION FORM */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Nome Completo */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome Completo <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Ex: André Zefanias Júnior"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Número de Celular & Idade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Número de Celular <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 844131370"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Idade <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="10"
                    max="100"
                    required
                    placeholder="Ex: 22"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Palavra-passe & Confirmar Palavra-passe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Palavra-passe <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 4 dígitos"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Confirmar Palavra-passe <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Repita a palavra-passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Qualificação de Interesse */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Qualificação Principal:
              </label>
              <select
                value={qualification}
                onChange={(e) => setQualification(e.target.value as Qualification)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none"
              >
                {QUALIFICATIONS_LIST.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.icon} {q.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Escolha seu Avatar:
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_LIST.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all cursor-pointer ${
                      avatar === av
                        ? 'bg-amber-500/20 border-amber-500 scale-110 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              🔒 Cadastro único e rigoroso: Cada número de celular só pode ser registrado uma única vez. Seus dados e pontos ficam salvos com segurança.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Criar Conta & Começar a Jogar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. LOGIN FORM */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Número de Celular Cadastrado <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  placeholder="Ex: 844131370"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Palavra-passe <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Digite sua palavra-passe"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar na Minha Conta</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setTab('register')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
              >
                Ainda não tem uma conta? Crie aqui em 30 segundos
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
