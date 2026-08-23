export type Qualification =
  | 'Eletricidade Industrial'
  | 'Mecânica Industrial'
  | 'Construção Civil'
  | 'Contabilidade'
  | 'Gestão'
  | 'Ensino Geral'
  | 'Informática & Tecnologia';

export type Difficulty = 'Fácil' | 'Médio' | 'Difícil' | 'Extremamente Difícil' | 'Especial';

export type GameMode =
  | 'classico'
  | 'resposta_rapida'
  | 'sequencia'
  | 'desafio'
  | 'pergunta_dificil'
  | 'desafio_diario';

export interface ScientistLawInfo {
  scientist: string;
  lawOrPrinciple: string;
  formula?: string;
  field: string;
}

export interface Question {
  id: string;
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correct_answer: 'a' | 'b' | 'c' | 'd';
  qualification: Qualification;
  subcategory: string;
  difficulty: Difficulty;
  points: number; // 5-10 Fácil, 11-30 Médio, 31-60 Difícil, 61-100 Extremamente Difícil
  explanation: string;
  time_limit: number; // in seconds (20s standard)
  active: boolean;
  created_at: string;
  scientist_law?: ScientistLawInfo;
}

export interface AnsweredQuestionRecord {
  id: string;
  user_id: string;
  question_id: string;
  qualification: Qualification;
  selected_answer: 'a' | 'b' | 'c' | 'd' | 'timeout' | 'skipped';
  correct: boolean;
  points_earned: number;
  time_taken_seconds: number;
  answered_at: string;
}

export interface QualificationStat {
  qualification: Qualification;
  points: number;
  answered: number;
  correct: number;
  skipped: number;
  best_streak: number;
  mastery_pct: number;
  tier: string;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  age: number;
  avatar: string;
  qualification_interest?: Qualification;
  total_points: number;
  best_streak: number;
  current_streak: number;
  total_answered: number;
  total_correct: number;
  total_skipped: number;
  is_online: boolean;
  joined_at: string;
  last_active?: string;
  qualification_stats: Record<Qualification, QualificationStat>;
}

export type MobileWallet = 'M-Pesa' | 'E-Mola';
export type WithdrawalStatus = 'pending' | 'completed' | 'rejected';

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  wallet_type: MobileWallet;
  wallet_number: string;
  amount_mt: number;
  points_deducted: number;
  status: WithdrawalStatus;
  created_at: string;
  processed_at?: string;
  admin_notes?: string;
}

export interface LeaderboardEntry {
  position: number;
  user_id: string;
  name: string;
  avatar: string;
  points: number;
  streak: number;
  accuracy_pct: number;
  top_qualification: Qualification;
  is_online: boolean;
  phone_masked?: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  user_qualification?: Qualification;
  recipient_id?: string; // If set, this is a private message
  recipient_name?: string;
  message: string;
  created_at: string;
  reported: boolean;
  report_count: number;
  report_reasons?: string[];
  is_system?: boolean;
  reply_to?: {
    id: string;
    user_name: string;
    message: string;
  };
}

export interface ModerationReport {
  id: string;
  message_id: string;
  reported_by_user_id: string;
  reported_user_id: string;
  reported_user_name: string;
  message_content: string;
  reason: string;
  created_at: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface ActivityLog {
  id: string;
  type: 'register' | 'withdrawal' | 'answer' | 'skip' | 'penalty';
  title: string;
  description: string;
  timestamp: string;
  user_id?: string;
  user_name?: string;
}

export interface QualificationMeta {
  id: Qualification;
  title: string;
  icon: string;
  color: string;
  badgeColor: string;
  description: string;
  subcategories: string[];
  sampleScientists: string[];
}
