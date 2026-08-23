import { createClient } from '@supabase/supabase-js';
import { UserProfile, Qualification, WithdrawalRequest, ChatMessage } from '../types';

// Read env variables (supports Vite VITE_, Next.js NEXT_PUBLIC_, and fallback defaults)
export const SUPABASE_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  'https://gjbqylheutriojpnopcg.supabase.co';

export const SUPABASE_ANON_KEY: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  'sb_publishable_msIHuQZlf6hiocY9b36axA_j23_iJJu';

// Initialize the native Supabase browser client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper for fast hashing / simple password verification on client
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'ph_' + Math.abs(hash).toString(36);
}

// ----------------------------------------------------
// 100% Native Supabase Auth & Database Service Layer
// ----------------------------------------------------

export interface RegisterParams {
  name: string;
  phone: string;
  age: number;
  password: string;
  avatar: string;
  qualification_interest: Qualification;
}

export const SupabaseAuthService = {
  /**
   * Register a new user directly in Supabase table `users`
   */
  async register(params: RegisterParams): Promise<{ user: UserProfile }> {
    const cleanPhone = params.phone.replace(/[\s\-\+]/g, '');

    // 1. Check if user already exists
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, phone')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existing) {
      throw new Error('Este número de celular já está cadastrado. Por favor, faça login.');
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = simpleHash(params.password);
    const now = new Date().toISOString();

    const newUserRow = {
      id: userId,
      name: params.name.trim(),
      phone: cleanPhone,
      age: params.age || 20,
      avatar: params.avatar || '👨‍🎓',
      qualification_interest: params.qualification_interest || 'Eletricidade Industrial',
      total_points: 0,
      best_streak: 0,
      current_streak: 0,
      total_answered: 0,
      total_correct: 0,
      total_skipped: 0,
      is_online: true,
      joined_at: now,
      last_active: now,
      password_hash: passwordHash,
      qualification_stats: {},
    };

    // 2. Insert into Supabase table `users`
    const { error: insertError } = await supabase.from('users').insert([newUserRow]);

    if (insertError) {
      console.error('[Supabase Register Error]:', insertError);
      throw new Error(`Falha no cadastro: ${insertError.message || 'Erro ao conectar ao Supabase'}`);
    }

    // 3. Log activity in Supabase
    try {
      await supabase.from('activity_logs').insert([
        {
          id: `act-${Date.now()}`,
          type: 'register',
          title: 'Novo Jogador Cadastrado',
          description: `${params.name} ingressou no Sara Quiz com interesse em ${params.qualification_interest}.`,
          user_id: userId,
          user_name: params.name,
          timestamp: now,
        },
      ]);
    } catch {
      // Non-blocking log failure
    }

    const { password_hash, ...publicProfile } = newUserRow;
    return { user: publicProfile as UserProfile };
  },

  /**
   * Login user directly using Supabase client
   */
  async login(phone: string, password: string): Promise<{ user: UserProfile }> {
    const cleanPhone = phone.replace(/[\s\-\+]/g, '');

    const { data: userRow, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (error || !userRow) {
      throw new Error('Número de celular não encontrado. Verifique os dados ou crie uma conta.');
    }

    const inputHash = simpleHash(password);
    if (userRow.password_hash !== inputHash && userRow.password_hash !== password) {
      throw new Error('Palavra-passe incorreta. Tente novamente.');
    }

    // Update online status and last_active
    const now = new Date().toISOString();
    await supabase
      .from('users')
      .update({ is_online: true, last_active: now })
      .eq('id', userRow.id);

    const { password_hash, ...publicProfile } = userRow;
    return {
      user: {
        ...publicProfile,
        total_points: Number(publicProfile.total_points) || 0,
        best_streak: Number(publicProfile.best_streak) || 0,
        current_streak: Number(publicProfile.current_streak) || 0,
        total_answered: Number(publicProfile.total_answered) || 0,
        total_correct: Number(publicProfile.total_correct) || 0,
        total_skipped: Number(publicProfile.total_skipped) || 0,
      } as UserProfile,
    };
  },

  /**
   * Fetch current user profile directly from Supabase
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    const { password_hash, ...profile } = data;
    return {
      ...profile,
      total_points: Number(profile.total_points) || 0,
      best_streak: Number(profile.best_streak) || 0,
      current_streak: Number(profile.current_streak) || 0,
      total_answered: Number(profile.total_answered) || 0,
      total_correct: Number(profile.total_correct) || 0,
      total_skipped: Number(profile.total_skipped) || 0,
    } as UserProfile;
  },

  /**
   * Update user profile directly in Supabase
   */
  async updateProfile(
    userId: string,
    updates: {
      name?: string;
      avatar?: string;
      qualification_interest?: Qualification;
      age?: number;
    }
  ): Promise<UserProfile | null> {
    const payload: any = {
      last_active: new Date().toISOString(),
    };
    if (updates.name) payload.name = updates.name.trim();
    if (updates.avatar) payload.avatar = updates.avatar;
    if (updates.qualification_interest) payload.qualification_interest = updates.qualification_interest;
    if (updates.age) payload.age = Number(updates.age);

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error || !data) return null;
    const { password_hash, ...profile } = data;
    return profile as UserProfile;
  },

  /**
   * Record answer result directly to Supabase
   */
  async recordAnswer(payload: {
    user_id: string;
    question_id: string;
    qualification: string;
    selected_answer: string;
    correct: boolean;
    points_earned: number;
    time_taken_seconds: number;
  }): Promise<{ user_stats: any }> {
    // 1. Log answered question
    await supabase.from('answered_questions').insert([
      {
        id: `${payload.user_id}_${payload.question_id}_${Date.now()}`,
        user_id: payload.user_id,
        question_id: payload.question_id,
        qualification: payload.qualification,
        user_answer: payload.selected_answer,
        is_correct: payload.correct,
        points_earned: payload.points_earned,
        time_spent_seconds: payload.time_taken_seconds,
        answered_at: new Date().toISOString(),
      },
    ]);

    // 2. Fetch and update user stats in Supabase
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.user_id)
      .maybeSingle();

    if (userRow) {
      let total_points = Number(userRow.total_points) || 0;
      let total_answered = (Number(userRow.total_answered) || 0) + 1;
      let total_correct = Number(userRow.total_correct) || 0;
      let current_streak = Number(userRow.current_streak) || 0;
      let best_streak = Number(userRow.best_streak) || 0;

      if (payload.correct) {
        total_correct += 1;
        current_streak += 1;
        if (current_streak > best_streak) best_streak = current_streak;
        total_points += payload.points_earned;
      } else {
        current_streak = 0;
        // penalty points deduction
        const penaltyPts = payload.points_earned < 0 ? Math.abs(payload.points_earned) : 0;
        total_points = Math.max(0, total_points - penaltyPts);
      }

      await supabase
        .from('users')
        .update({
          total_points,
          total_answered,
          total_correct,
          current_streak,
          best_streak,
          last_active: new Date().toISOString(),
        })
        .eq('id', payload.user_id);

      return {
        user_stats: {
          total_points,
          total_answered,
          total_correct,
          total_skipped: Number(userRow.total_skipped) || 0,
          current_streak,
          best_streak,
        },
      };
    }

    return { user_stats: null };
  },

  /**
   * Request withdrawal directly via Supabase
   */
  async requestWithdrawal(payload: {
    user_id: string;
    wallet_type: string;
    wallet_number: string;
    amount_mt: number;
  }): Promise<WithdrawalRequest> {
    const requiredPoints = payload.amount_mt * 2;

    // Get user
    const { data: user } = await supabase.from('users').select('*').eq('id', payload.user_id).single();
    if (!user) throw new Error('Jogador não encontrado.');
    if (Number(user.total_points) < requiredPoints) {
      throw new Error('Saldo insuficiente para efetuar este levantamento.');
    }

    // Deduct points
    const newPoints = Number(user.total_points) - requiredPoints;
    await supabase.from('users').update({ total_points: newPoints }).eq('id', payload.user_id);

    const withdrawalId = `wdr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newWithdrawal: WithdrawalRequest = {
      id: withdrawalId,
      user_id: user.id,
      user_name: user.name,
      user_phone: user.phone,
      wallet_type: payload.wallet_type as any,
      wallet_number: payload.wallet_number,
      amount_mt: payload.amount_mt,
      points_deducted: requiredPoints,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    await supabase.from('withdrawals').insert([
      {
        id: newWithdrawal.id,
        user_id: newWithdrawal.user_id,
        user_name: newWithdrawal.user_name,
        wallet_type: newWithdrawal.wallet_type,
        wallet_number: newWithdrawal.wallet_number,
        amount_mt: newWithdrawal.amount_mt,
        points_deducted: newWithdrawal.points_deducted,
        status: newWithdrawal.status,
        created_at: newWithdrawal.created_at,
      },
    ]);

    await supabase.from('activity_logs').insert([
      {
        id: `act-${Date.now()}`,
        type: 'withdrawal',
        title: 'Solicitação de Levantamento',
        description: `${user.name} solicitou levantamento de ${payload.amount_mt} MT via ${payload.wallet_type} (${payload.wallet_number}).`,
        user_id: user.id,
        user_name: user.name,
        timestamp: new Date().toISOString(),
      },
    ]);

    return newWithdrawal;
  },

  /**
   * Fetch User withdrawals from Supabase
   */
  async getUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((w: any) => ({
      id: w.id,
      user_id: w.user_id,
      user_name: w.user_name,
      user_phone: w.user_phone || '',
      wallet_type: w.wallet_type,
      wallet_number: w.wallet_number,
      amount_mt: Number(w.amount_mt),
      points_deducted: Number(w.points_deducted),
      status: w.status,
      created_at: w.created_at,
      processed_at: w.processed_at,
    }));
  },
};

// SQL Schema for complete Supabase database setup
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- SCHEMA SQL PARA O BANCO DE DADOS SUPABASE (SARA QUIZ)
-- Cole este script no SQL Editor do seu Dashboard Supabase
-- ========================================================

-- 1. TABELA DE JOGADORES (USERS)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    age INTEGER DEFAULT 20,
    avatar TEXT DEFAULT '👨‍🎓',
    qualification_interest TEXT DEFAULT 'Eletricidade Industrial',
    total_points BIGINT DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    total_answered INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    password_hash TEXT NOT NULL,
    qualification_stats JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_points ON public.users(total_points DESC);

-- 2. TABELA DE QUESTÕES (QUESTIONS)
CREATE TABLE IF NOT EXISTS public.questions (
    id TEXT PRIMARY KEY,
    qualification TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    points INTEGER NOT NULL,
    time_limit INTEGER DEFAULT 25,
    explanation TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    scientist_law JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_qual ON public.questions(qualification);
CREATE INDEX IF NOT EXISTS idx_questions_diff ON public.questions(difficulty);

-- 3. TABELA DE QUESTÕES RESPONDIDAS (ANSWERED QUESTIONS)
CREATE TABLE IF NOT EXISTS public.answered_questions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    qualification TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    points_earned INTEGER NOT NULL,
    time_spent_seconds INTEGER DEFAULT 0,
    answered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answered_user_q ON public.answered_questions(user_id, question_id);

-- 4. TABELA DE SOLICITAÇÕES DE LEVANTAMENTO (WITHDRAWALS)
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    wallet_type TEXT NOT NULL,
    wallet_number TEXT NOT NULL,
    amount_mt NUMERIC NOT NULL,
    points_deducted BIGINT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);

-- 5. TABELA DE FEED DE ATIVIDADES E AUDITORIA (ACTIVITY LOGS)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE CHAT & MENSAGENS (CHAT MESSAGES)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_avatar TEXT DEFAULT '👨‍🎓',
    sender_tier TEXT DEFAULT 'Iniciante',
    content TEXT NOT NULL,
    channel TEXT DEFAULT 'global',
    recipient_id TEXT,
    recipient_name TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE DENÚNCIAS & MODERAÇÃO
CREATE TABLE IF NOT EXISTS public.moderation_reports (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    message_content TEXT NOT NULL,
    reported_user_id TEXT NOT NULL,
    reported_user_name TEXT NOT NULL,
    reporting_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending'
);

-- Habilitar RLS e Políticas Permissivas para leitura/escrita com a chave anon do projeto
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on answered_questions" ON public.answered_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on withdrawals" ON public.withdrawals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on moderation_reports" ON public.moderation_reports FOR ALL USING (true) WITH CHECK (true);
`;
