import { createClient } from '@supabase/supabase-js';

// Project configuration provided by the user
export const SUPABASE_URL = 
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
  'https://gjbqylheutriojpnopcg.supabase.co';

export const SUPABASE_ANON_KEY = 
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
  'sb_publishable_msIHuQZlf6hiocY9b36axA_j23_iJJu';

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

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
