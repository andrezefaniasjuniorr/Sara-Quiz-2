import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { 
  Question, 
  Qualification, 
  AnsweredQuestionRecord, 
  UserProfile, 
  LeaderboardEntry, 
  ChatMessage, 
  ModerationReport,
  WithdrawalRequest,
  ActivityLog,
  MobileWallet,
  WithdrawalStatus
} from './src/types';
import { ALL_INITIAL_QUESTIONS, ESTIMATED_BANK_COUNTS } from './src/data/questions';
import { QUALIFICATIONS_LIST } from './src/data/qualifications';
import { 
  supabase, 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  SUPABASE_SQL_SCHEMA 
} from './src/lib/supabase';

const app = express();
const PORT = 3000;
const ADMIN_PASSWORD = '001234';

app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------
// Supabase Sync State & Helpers
// ----------------------------------------------------
let supabaseConnected = false;
let supabaseLastSyncTime: string | null = null;
let supabaseError: string | null = null;

async function syncUserToSupabase(user: StoredUser) {
  try {
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      name: user.name,
      phone: user.phone,
      age: user.age,
      avatar: user.avatar,
      qualification_interest: user.qualification_interest,
      total_points: user.total_points,
      best_streak: user.best_streak,
      current_streak: user.current_streak,
      total_answered: user.total_answered,
      total_correct: user.total_correct,
      total_skipped: user.total_skipped,
      is_online: user.is_online,
      joined_at: user.joined_at,
      last_active: user.last_active,
      password_hash: user.password_hash,
      qualification_stats: user.qualification_stats,
    });
    if (error) {
      console.warn('[Supabase Sync User Error]:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync User Exception]:', err.message);
  }
}

async function syncQuestionToSupabase(q: Question) {
  try {
    const { error } = await supabase.from('questions').upsert({
      id: q.id,
      qualification: q.qualification,
      subcategory: q.subcategory,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      time_limit: q.time_limit,
      explanation: q.explanation,
      active: q.active !== false,
      scientist_law: q.scientist_law || null,
      created_at: q.created_at || new Date().toISOString(),
    });
    if (error) {
      console.warn('[Supabase Sync Question Error]:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Question Exception]:', err.message);
  }
}

async function deleteQuestionFromSupabase(id: string) {
  try {
    await supabase.from('questions').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Delete Question Exception]:', err.message);
  }
}

async function syncWithdrawalToSupabase(w: WithdrawalRequest) {
  try {
    const { error } = await supabase.from('withdrawals').upsert({
      id: w.id,
      user_id: w.user_id,
      user_name: w.user_name,
      wallet_type: w.wallet_type,
      wallet_number: w.wallet_number,
      amount_mt: w.amount_mt,
      points_deducted: w.points_deducted,
      status: w.status,
      created_at: w.created_at,
      processed_at: w.processed_at || null,
    });
    if (error) {
      console.warn('[Supabase Sync Withdrawal Error]:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Withdrawal Exception]:', err.message);
  }
}

async function syncActivityToSupabase(act: ActivityLog) {
  try {
    const { error } = await supabase.from('activity_logs').upsert({
      id: act.id,
      type: act.type,
      title: act.title,
      description: act.description,
      user_id: act.user_id || null,
      user_name: act.user_name || null,
      timestamp: act.timestamp,
    });
    if (error) {
      console.warn('[Supabase Sync Activity Error]:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Activity Exception]:', err.message);
  }
}

async function syncChatMessageToSupabase(msg: ChatMessage) {
  try {
    const { error } = await supabase.from('chat_messages').upsert({
      id: msg.id,
      sender_id: msg.user_id,
      sender_name: msg.user_name,
      sender_avatar: msg.user_avatar,
      sender_tier: 'Iniciante',
      content: msg.message,
      channel: msg.recipient_id ? 'private' : 'global',
      recipient_id: msg.recipient_id || null,
      recipient_name: msg.recipient_name || null,
      timestamp: msg.created_at || new Date().toISOString(),
    });
    if (error) {
      console.warn('[Supabase Sync Chat Error]:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Chat Exception]:', err.message);
  }
}

async function syncAnsweredToSupabase(rec: AnsweredQuestionRecord) {
  try {
    const { error } = await supabase.from('answered_questions').upsert({
      id: `${rec.user_id}_${rec.question_id}`,
      user_id: rec.user_id,
      question_id: rec.question_id,
      qualification: rec.qualification,
      user_answer: rec.selected_answer,
      is_correct: rec.correct,
      points_earned: rec.points_earned,
      time_spent_seconds: rec.time_taken_seconds,
      answered_at: rec.answered_at,
    });
    if (error) {
      console.warn('[Supabase Sync Answer Error]:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Answer Exception]:', err.message);
  }
}

// Initial bootstrap from Supabase if available
async function initializeSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id, name, phone, age, avatar, qualification_interest, total_points, best_streak, current_streak, total_answered, total_correct, total_skipped, is_online, joined_at, last_active, password_hash, qualification_stats').limit(100);
    if (!error) {
      supabaseConnected = true;
      supabaseError = null;
      supabaseLastSyncTime = new Date().toISOString();
      console.log('✅ Supabase conectado com sucesso:', SUPABASE_URL);

      if (data && data.length > 0) {
        for (const u of data) {
          const userObj: StoredUser = {
            id: u.id,
            name: u.name,
            phone: u.phone,
            age: u.age || 20,
            avatar: u.avatar || '👨‍🎓',
            qualification_interest: u.qualification_interest || 'Eletricidade Industrial',
            total_points: Number(u.total_points) || 0,
            best_streak: Number(u.best_streak) || 0,
            current_streak: Number(u.current_streak) || 0,
            total_answered: Number(u.total_answered) || 0,
            total_correct: Number(u.total_correct) || 0,
            total_skipped: Number(u.total_skipped) || 0,
            is_online: u.is_online !== false,
            joined_at: u.joined_at || new Date().toISOString(),
            last_active: u.last_active || new Date().toISOString(),
            password_hash: u.password_hash || '',
            qualification_stats: u.qualification_stats || createInitialQualStats(),
          };
          usersMap.set(userObj.id, userObj);
          usersByPhoneMap.set(userObj.phone, userObj.id);
        }
        console.log(`[Supabase] Carregados ${data.length} usuários do banco de dados remoto.`);
      }

      // Also try fetching remote questions
      const qRes = await supabase.from('questions').select('*').limit(500);
      if (qRes.data && qRes.data.length > 0) {
        for (const q of qRes.data) {
          if (!questionsDatabase.some((local) => local.id === q.id)) {
            questionsDatabase.unshift(normalizeQuestionPoints({
              id: q.id,
              qualification: q.qualification,
              subcategory: q.subcategory,
              difficulty: q.difficulty,
              question: q.question,
              options: q.options,
              correct_answer: q.correct_answer,
              points: q.points,
              time_limit: q.time_limit || 25,
              explanation: q.explanation,
              active: q.active !== false,
              created_at: q.created_at,
              scientist_law: q.scientist_law,
            }));
          }
        }
        console.log(`[Supabase] Questões sincronizadas com sucesso.`);
      }

      // Also try fetching withdrawals
      const wRes = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
      if (wRes.data && wRes.data.length > 0) {
        withdrawalsList = wRes.data.map((w) => ({
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
      }
    } else {
      supabaseConnected = true; // Auth works, table may need creation
      supabaseError = error.message;
      console.log('ℹ️ Supabase conectado (tabelas em preparação):', error.message);
    }
  } catch (err: any) {
    supabaseConnected = false;
    supabaseError = err.message;
    console.warn('⚠️ Supabase connection warning:', err.message);
  }
}

// ----------------------------------------------------
// Normalizing Question Points to Strict User Criteria:
// - Fácil: 5 a 20 pontos (padrão 15)
// - Médio: 21 a 50 pontos (padrão 35)
// - Difícil / Especial: 51 a 100 pontos (padrão 75)
// ----------------------------------------------------
function normalizeQuestionPoints(q: Question): Question {
  let pts = q.points;
  if (q.difficulty === 'Fácil') {
    if (pts < 5 || pts > 20) pts = 15;
  } else if (q.difficulty === 'Médio') {
    if (pts < 21 || pts > 50) pts = 35;
  } else {
    // Difícil ou Especial
    if (pts < 51 || pts > 100) pts = 75;
  }
  return { ...q, points: pts };
}

// In-Memory & Persistent State Stores
let questionsDatabase: Question[] = ALL_INITIAL_QUESTIONS.map(normalizeQuestionPoints);

// answered_questions unique by (user_id, question_id)
let answeredQuestionsMap = new Map<string, AnsweredQuestionRecord>(); // key: `${user_id}_${question_id}`

// Users store: ONLY real registered players
interface StoredUser extends UserProfile {
  password_hash: string;
}
let usersMap = new Map<string, StoredUser>(); // key: user.id
let usersByPhoneMap = new Map<string, string>(); // key: phone (clean), value: user.id

// Withdrawals & Financial store
let withdrawalsList: WithdrawalRequest[] = [];

// Activity logs for admin real-time monitoring
let activityLogs: ActivityLog[] = [
  {
    id: 'act-init',
    type: 'register',
    title: 'Sistema Sara Quiz Inicializado',
    description: 'Ambiente de jogo e validações de moedas e qualificações ativas.',
    timestamp: new Date().toISOString(),
  }
];

function logActivity(type: ActivityLog['type'], title: string, description: string, user_id?: string, user_name?: string) {
  const log: ActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
    user_id,
    user_name,
  };
  activityLogs.unshift(log);
  if (activityLogs.length > 200) activityLogs.pop();
}

// Helper to initialize qualification stats for a user
function createInitialQualStats(): Record<Qualification, any> {
  const stats: any = {};
  for (const q of QUALIFICATIONS_LIST) {
    stats[q.id] = {
      qualification: q.id,
      points: 0,
      answered: 0,
      correct: 0,
      skipped: 0,
      best_streak: 0,
      mastery_pct: 0,
      tier: 'Iniciante',
    };
  }
  return stats;
}

// Clean phone number helper
function cleanPhone(raw: string): string {
  return raw.replace(/[\s\-\+\(\)]/g, '').trim();
}

// Chat Messages Store
let globalChatMessages: ChatMessage[] = [];
let privateChatMessages: ChatMessage[] = [];
let moderationReports: ModerationReport[] = [];
let blockedUsersMap = new Map<string, Set<string>>(); // userId -> Set of blockedUserIds

// Helper to calculate tier
function getTierName(correctCount: number, masteryPct: number): string {
  if (correctCount >= 200 && masteryPct >= 85) return 'Mestre da Qualificação 🎖️';
  if (correctCount >= 100 && masteryPct >= 70) return 'Especialista Sênior 🌟';
  if (correctCount >= 35 && masteryPct >= 50) return 'Técnico Pleno ⚙️';
  if (correctCount >= 10) return 'Praticante 📘';
  return 'Iniciante / Aprendiz 🌱';
}

// ----------------------------------------------------
// 1. AUTHENTICATION (CADASTRO RIGOROSO & LOGIN)
// ----------------------------------------------------

// Register New User
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, phone, age, password, confirm_password, avatar, qualification_interest } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome completo é obrigatório.' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Número de celular é obrigatório.' });
  }
  if (!age || Number(age) < 10 || Number(age) > 100) {
    return res.status(400).json({ error: 'Por favor, informe uma idade válida (entre 10 e 100 anos).' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'A palavra-passe deve ter no mínimo 4 caracteres.' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ error: 'A confirmação da palavra-passe não coincide.' });
  }

  const normalizedPhone = cleanPhone(phone);
  if (normalizedPhone.length < 7) {
    return res.status(400).json({ error: 'Número de celular inválido.' });
  }

  // Rigorous Check: No duplicate phone registrations
  if (usersByPhoneMap.has(normalizedPhone)) {
    return res.status(409).json({
      error: 'Já existe uma conta cadastrada com este número de celular. Por favor, faça login com sua palavra-passe.',
    });
  }

  const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newUser: StoredUser = {
    id: userId,
    name: name.trim(),
    phone: normalizedPhone,
    age: Number(age),
    avatar: avatar || '👨‍🎓',
    qualification_interest: qualification_interest || 'Eletricidade Industrial',
    total_points: 0,
    best_streak: 0,
    current_streak: 0,
    total_answered: 0,
    total_correct: 0,
    total_skipped: 0,
    is_online: true,
    joined_at: now,
    last_active: now,
    qualification_stats: createInitialQualStats(),
    password_hash: password, // In production this would be bcrypt
  };

  usersMap.set(userId, newUser);
  usersByPhoneMap.set(normalizedPhone, userId);

  // Sync with Supabase in background
  syncUserToSupabase(newUser);

  logActivity(
    'register',
    'Novo Jogador Cadastrado',
    `${newUser.name} (${newUser.phone}) ingressou na plataforma com interesse em ${newUser.qualification_interest}.`,
    newUser.id,
    newUser.name
  );
  syncActivityToSupabase({
    id: `act-${Date.now()}`,
    type: 'register',
    title: 'Novo Jogador Cadastrado',
    description: `${newUser.name} (${newUser.phone}) ingressou na plataforma com interesse em ${newUser.qualification_interest}.`,
    user_id: newUser.id,
    user_name: newUser.name,
    timestamp: now,
  });

  // Return public user profile (omit password)
  const { password_hash, ...publicUser } = newUser;
  res.status(201).json({
    success: true,
    user: publicUser,
    message: 'Conta criada com sucesso!',
  });
});

// Login Existing User
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Número de celular e palavra-passe são obrigatórios.' });
  }

  const normalizedPhone = cleanPhone(phone);
  const userId = usersByPhoneMap.get(normalizedPhone);

  if (!userId || !usersMap.has(userId)) {
    return res.status(404).json({
      error: 'Nenhuma conta encontrada com este número de celular. Verifique o número ou cadastre-se.',
    });
  }

  const user = usersMap.get(userId)!;
  if (user.password_hash !== password) {
    return res.status(401).json({ error: 'Palavra-passe incorreta. Tente novamente.' });
  }

  user.is_online = true;
  user.last_active = new Date().toISOString();
  usersMap.set(userId, user);

  // Sync online status to Supabase
  syncUserToSupabase(user);

  const { password_hash, ...publicUser } = user;
  res.json({
    success: true,
    user: publicUser,
    message: `Bem-vindo de volta, ${user.name}!`,
  });
});

// Get User Profile
app.get('/api/profile/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = usersMap.get(userId);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const answeredCountByQual: Record<string, number> = {};
  for (const rec of answeredQuestionsMap.values()) {
    if (rec.user_id === userId) {
      answeredCountByQual[rec.qualification] = (answeredCountByQual[rec.qualification] || 0) + 1;
    }
  }

  const { password_hash, ...publicUser } = user;
  res.json({ user: publicUser, answeredCountByQual });
});

// Update Profile Info
app.put('/api/profile/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const { name, avatar, qualification_interest, age } = req.body;

  const user = usersMap.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  if (name && name.trim()) user.name = name.trim();
  if (avatar) user.avatar = avatar;
  if (qualification_interest) user.qualification_interest = qualification_interest;
  if (age && Number(age) > 0) user.age = Number(age);
  user.last_active = new Date().toISOString();

  usersMap.set(userId, user);
  syncUserToSupabase(user);

  const { password_hash, ...publicUser } = user;
  res.json({ success: true, user: publicUser });
});

// ----------------------------------------------------
// 2. QUALIFICATIONS & QUESTIONS
// ----------------------------------------------------

app.get('/api/qualifications', (req: Request, res: Response) => {
  const userId = req.query.user_id as string;
  const user = userId ? usersMap.get(userId) : null;

  const result = QUALIFICATIONS_LIST.map((q) => {
    const totalInDb = questionsDatabase.filter((item) => item.qualification === q.id && item.active).length;
    let answeredCount = 0;
    let userPoints = 0;
    let mastery = 0;

    if (user && user.qualification_stats[q.id]) {
      answeredCount = user.qualification_stats[q.id].answered;
      userPoints = user.qualification_stats[q.id].points;
      mastery = user.qualification_stats[q.id].mastery_pct;
    }

    return {
      ...q,
      total_active_questions: totalInDb,
      estimated_bank_total: ESTIMATED_BANK_COUNTS[q.id] || 5000,
      user_answered_count: answeredCount,
      user_points: userPoints,
      user_mastery_pct: mastery,
    };
  });

  res.json({ qualifications: result });
});

app.get('/api/questions', (req: Request, res: Response) => {
  const { qualification, user_id, mode, difficulty, limit } = req.query;
  const qualStr = qualification as Qualification;
  const userIdStr = (user_id as string) || 'guest-user';
  const maxQuestions = parseInt(limit as string, 10) || (mode === 'classico' ? 10 : 15);

  if (!qualStr) {
    return res.status(400).json({ error: 'Qualification is required' });
  }

  // Find all active questions for this qualification
  let candidateQuestions = questionsDatabase.filter((q) => q.qualification === qualStr && q.active);

  // Filter by difficulty if mode is "pergunta_dificil"
  if (mode === 'pergunta_dificil' || difficulty === 'Difícil' || difficulty === 'Especial') {
    const hardOnly = candidateQuestions.filter((q) => q.difficulty === 'Difícil' || q.difficulty === 'Especial');
    if (hardOnly.length > 0) {
      candidateQuestions = hardOnly;
    }
  }

  // Filter out questions the user has already answered or skipped!
  const unAnsweredQuestions = candidateQuestions.filter((q) => {
    const key = `${userIdStr}_${q.id}`;
    return !answeredQuestionsMap.has(key);
  });

  let selectedPool = unAnsweredQuestions;
  let allAnswered = false;

  if (selectedPool.length === 0) {
    allAnswered = true;
    selectedPool = [...candidateQuestions];
  }

  // Shuffle selected pool for variety
  const shuffled = [...selectedPool].sort(() => Math.random() - 0.5);
  const questionsToSend = shuffled.slice(0, maxQuestions);

  res.json({
    qualification: qualStr,
    mode: mode || 'classico',
    total_unanswered_available: unAnsweredQuestions.length,
    all_answered_previously: allAnswered,
    count: questionsToSend.length,
    questions: questionsToSend,
  });
});

// ----------------------------------------------------
// 3. POST ANSWER & SKIP QUESTION (LOST 5 PTS ON SKIP)
// ----------------------------------------------------
app.post('/api/answers', (req: Request, res: Response) => {
  const { user_id, question_id, qualification, selected_answer, correct, points_earned, time_taken_seconds } = req.body;

  if (!user_id || !question_id || !qualification) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const recordKey = `${user_id}_${question_id}`;
  const now = new Date().toISOString();

  const isSkipped = selected_answer === 'skipped';
  const isCorrect = !isSkipped && !!correct;

  // Record creation
  const record: AnsweredQuestionRecord = {
    id: `ans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id,
    question_id,
    qualification,
    selected_answer: selected_answer || 'timeout',
    correct: isCorrect,
    points_earned: isSkipped ? -5 : Number(points_earned) || 0,
    time_taken_seconds: Number(time_taken_seconds) || 0,
    answered_at: now,
  };

  // Enforce UNIQUE (user_id, question_id)
  answeredQuestionsMap.set(recordKey, record);

  let user = usersMap.get(user_id);
  if (!user) {
    return res.status(404).json({ error: 'User not found. Please log in.' });
  }

  // Update qualification stats map
  if (!user.qualification_stats[qualification]) {
    user.qualification_stats[qualification] = {
      qualification,
      points: 0,
      answered: 0,
      correct: 0,
      skipped: 0,
      best_streak: 0,
      mastery_pct: 0,
      tier: 'Iniciante',
    };
  }
  const qStat = user.qualification_stats[qualification];

  if (isSkipped) {
    // Penalty: Lost 5 points on skip
    user.total_skipped += 1;
    user.total_answered += 1;
    user.total_points = Math.max(0, user.total_points - 5);
    user.current_streak = 0;

    qStat.skipped += 1;
    qStat.answered += 1;
    qStat.points = Math.max(0, qStat.points - 5);

    logActivity('skip', 'Questão Pulada', `${user.name} pulou uma questão de ${qualification} (-5 pontos).`, user.id, user.name);
  } else {
    user.total_answered += 1;
    qStat.answered += 1;

    if (isCorrect) {
      user.total_correct += 1;
      user.total_points += record.points_earned;
      user.current_streak += 1;
      if (user.current_streak > user.best_streak) {
        user.best_streak = user.current_streak;
      }

      qStat.correct += 1;
      qStat.points += record.points_earned;
      if (user.current_streak > qStat.best_streak) {
        qStat.best_streak = user.current_streak;
      }
    } else {
      // PENALTY TAX ON WRONG ANSWER: 5 to 20 MT (1 MT = 2 Points -> 10 to 40 Points)
      const targetQ = questionsDatabase.find((q) => q.id === question_id);
      const diff = targetQ?.difficulty || 'Médio';
      let penaltyMT = 10;
      if (diff === 'Fácil') {
        penaltyMT = 5;
      } else if (diff === 'Médio') {
        penaltyMT = 10;
      } else if (diff === 'Difícil' || diff === 'Especial') {
        penaltyMT = 20;
      }

      const penaltyPoints = penaltyMT * 2; // 1 MT = 2 pts
      record.points_earned = -penaltyPoints;

      user.total_points = Math.max(0, user.total_points - penaltyPoints);
      user.current_streak = 0;

      qStat.points = Math.max(0, qStat.points - penaltyPoints);

      logActivity(
        'penalty',
        'Taxa por Erro',
        `${user.name} errou questão de ${qualification} (${diff}) e perdeu uma taxa de ${penaltyMT} MT (-${penaltyPoints} pts).`,
        user.id,
        user.name
      );
    }
  }

  qStat.mastery_pct = Math.round((qStat.correct / Math.max(1, qStat.answered)) * 100);
  qStat.tier = getTierName(qStat.correct, qStat.mastery_pct);
  user.last_active = now;
  usersMap.set(user_id, user);

  // Sync to Supabase in background
  syncUserToSupabase(user);
  syncAnsweredToSupabase(record);

  res.json({
    success: true,
    record,
    user_stats: {
      total_points: user.total_points,
      current_streak: user.current_streak,
      best_streak: user.best_streak,
      total_answered: user.total_answered,
      total_correct: user.total_correct,
      total_skipped: user.total_skipped,
      qualification_stat: qStat,
    },
  });
});

// ----------------------------------------------------
// 4. FINANCIAL / WITHDRAWALS (M-PESA & E-MOLA)
// Conversion rule: 2000 points = 1000 MT (1 MT = 2 Points)
// ----------------------------------------------------

// Request Withdrawal
app.post('/api/withdrawals/request', (req: Request, res: Response) => {
  const { user_id, wallet_type, wallet_number, amount_mt } = req.body;

  if (!user_id || !wallet_type || !wallet_number || !amount_mt) {
    return res.status(400).json({ error: 'Todos os campos de levantamento são obrigatórios.' });
  }

  const user = usersMap.get(user_id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const requestedMt = Number(amount_mt);
  if (isNaN(requestedMt) || requestedMt < 1000) {
    return res.status(400).json({
      error: 'O valor mínimo de levantamento é de 1.000 MT (equivalente a 2.000 pontos).',
    });
  }

  // 1 MT = 2 Pontos
  const requiredPoints = requestedMt * 2;

  if (user.total_points < requiredPoints) {
    return res.status(400).json({
      error: `Saldo insuficiente. Você possui ${user.total_points} pontos (${user.total_points / 2} MT). São necessários no mínimo ${requiredPoints} pontos para levantar ${requestedMt} MT.`,
    });
  }

  if (wallet_type !== 'M-Pesa' && wallet_type !== 'E-Mola') {
    return res.status(400).json({ error: 'Carteira móvel inválida. Escolha M-Pesa ou E-Mola.' });
  }

  const cleanWalletNum = cleanPhone(wallet_number);
  if (cleanWalletNum.length < 7) {
    return res.status(400).json({ error: 'Número de telefone da carteira móvel inválido.' });
  }

  // Deduct points from user balance immediately
  user.total_points -= requiredPoints;
  usersMap.set(user_id, user);
  syncUserToSupabase(user);

  const withdrawalId = `wdr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newWithdrawal: WithdrawalRequest = {
    id: withdrawalId,
    user_id: user.id,
    user_name: user.name,
    user_phone: user.phone,
    wallet_type: wallet_type as MobileWallet,
    wallet_number: cleanWalletNum,
    amount_mt: requestedMt,
    points_deducted: requiredPoints,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  withdrawalsList.unshift(newWithdrawal);
  syncWithdrawalToSupabase(newWithdrawal);

  logActivity(
    'withdrawal',
    'Solicitação de Levantamento',
    `${user.name} solicitou levantamento de ${requestedMt} MT (${requiredPoints} pts) via ${wallet_type} (${cleanWalletNum}).`,
    user.id,
    user.name
  );
  syncActivityToSupabase({
    id: `act-${Date.now()}`,
    type: 'withdrawal',
    title: 'Solicitação de Levantamento',
    description: `${user.name} solicitou levantamento de ${requestedMt} MT (${requiredPoints} pts) via ${wallet_type} (${cleanWalletNum}).`,
    user_id: user.id,
    user_name: user.name,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    withdrawal: newWithdrawal,
    new_balance_points: user.total_points,
    new_balance_mt: user.total_points / 2,
    message: 'Solicitação de levantamento enviada com sucesso! O dinheiro irá refletir na sua conta em 2 a 3 horas.',
  });
});

// Get User's Withdrawals History
app.get('/api/withdrawals/user/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const userWithdrawals = withdrawalsList.filter((w) => w.user_id === userId);
  res.json({ withdrawals: userWithdrawals });
});

// ----------------------------------------------------
// 5. RANKINGS (REAL REGISTERED PLAYERS ONLY)
// ----------------------------------------------------
app.get('/api/rankings', (req: Request, res: Response) => {
  const { qualification } = req.query;
  const allUsers = Array.from(usersMap.values());

  let leaderboard: LeaderboardEntry[] = [];

  if (!qualification || qualification === 'Global' || qualification === 'Geral') {
    leaderboard = allUsers
      .sort((a, b) => b.total_points - a.total_points)
      .map((u, idx) => ({
        position: idx + 1,
        user_id: u.id,
        name: u.name,
        avatar: u.avatar,
        points: u.total_points,
        streak: u.best_streak,
        accuracy_pct: u.total_answered > 0 ? Math.round((u.total_correct / u.total_answered) * 100) : 0,
        top_qualification: u.qualification_interest || 'Eletricidade Industrial',
        is_online: u.is_online,
        phone_masked: u.phone ? u.phone.substring(0, 3) + '***' + u.phone.slice(-2) : undefined,
      }));
  } else {
    const qualStr = qualification as Qualification;
    leaderboard = allUsers
      .map((u) => {
        const qStat = u.qualification_stats[qualStr] || {
          points: 0,
          answered: 0,
          correct: 0,
          best_streak: 0,
        };
        return {
          user_id: u.id,
          name: u.name,
          avatar: u.avatar,
          points: qStat.points,
          streak: qStat.best_streak,
          accuracy_pct: qStat.answered > 0 ? Math.round((qStat.correct / qStat.answered) * 100) : 0,
          top_qualification: qualStr,
          is_online: u.is_online,
          phone_masked: u.phone ? u.phone.substring(0, 3) + '***' + u.phone.slice(-2) : undefined,
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((entry, idx) => ({
        ...entry,
        position: idx + 1,
      }));
  }

  res.json({
    filter: qualification || 'Global',
    leaderboard: leaderboard.slice(0, 100),
  });
});

// ----------------------------------------------------
// 6. CHAT & MODERATION
// ----------------------------------------------------
app.get('/api/chat/global', (req: Request, res: Response) => {
  const userId = req.query.user_id as string;
  const userBlocked = userId && blockedUsersMap.has(userId) ? blockedUsersMap.get(userId)! : new Set<string>();

  const visibleMessages = globalChatMessages
    .filter((m) => !userBlocked.has(m.user_id))
    .slice(-50);

  res.json({ messages: visibleMessages });
});

app.post('/api/chat/global', (req: Request, res: Response) => {
  const { user_id, user_name, user_avatar, user_qualification, message } = req.body;

  if (!user_id || !message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const trimmed = message.trim().substring(0, 300);

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    user_id,
    user_name: user_name || 'Jogador',
    user_avatar: user_avatar || '👨‍🎓',
    user_qualification: user_qualification || 'Eletricidade Industrial',
    message: trimmed,
    created_at: new Date().toISOString(),
    reported: false,
    report_count: 0,
  };

  globalChatMessages.push(newMsg);
  if (globalChatMessages.length > 150) globalChatMessages.shift();

  // Sync to Supabase
  syncChatMessageToSupabase(newMsg);

  res.json({ success: true, message: newMsg });
});

app.get('/api/chat/private/:userId/:peerId', (req: Request, res: Response) => {
  const { userId, peerId } = req.params;

  const conversation = privateChatMessages.filter(
    (m) =>
      (m.user_id === userId && m.recipient_id === peerId) ||
      (m.user_id === peerId && m.recipient_id === userId)
  );

  res.json({ messages: conversation });
});

app.post('/api/chat/private', (req: Request, res: Response) => {
  const { user_id, user_name, user_avatar, user_qualification, recipient_id, recipient_name, message } = req.body;

  if (!user_id || !recipient_id || !message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Recipient and message are required' });
  }

  const newMsg: ChatMessage = {
    id: `pmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    user_id,
    user_name: user_name || 'Jogador',
    user_avatar: user_avatar || '👨‍🎓',
    user_qualification,
    recipient_id,
    recipient_name,
    message: message.trim().substring(0, 300),
    created_at: new Date().toISOString(),
    reported: false,
    report_count: 0,
  };

  privateChatMessages.push(newMsg);
  syncChatMessageToSupabase(newMsg);
  res.json({ success: true, message: newMsg });
});

app.post('/api/chat/report', (req: Request, res: Response) => {
  const { message_id, reported_by_user_id, reason } = req.body;

  const msg = globalChatMessages.find((m) => m.id === message_id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  msg.reported = true;
  msg.report_count = (msg.report_count || 0) + 1;

  const report: ModerationReport = {
    id: `rep-${Date.now()}`,
    message_id,
    reported_by_user_id: reported_by_user_id || 'anonymous',
    reported_user_id: msg.user_id,
    reported_user_name: msg.user_name,
    message_content: msg.message,
    reason: reason || 'Conteúdo Inadequado / Spam',
    created_at: new Date().toISOString(),
    status: 'pending',
  };

  moderationReports.push(report);
  res.json({ success: true, report });
});

app.post('/api/chat/block', (req: Request, res: Response) => {
  const { user_id, block_user_id } = req.body;
  if (!user_id || !block_user_id) return res.status(400).json({ error: 'Missing parameters' });

  if (!blockedUsersMap.has(user_id)) {
    blockedUsersMap.set(user_id, new Set<string>());
  }
  blockedUsersMap.get(user_id)!.add(block_user_id);
  res.json({ success: true, blocked_user_id: block_user_id });
});

// ----------------------------------------------------
// 6.1 SARA AI ASSISTANT ENDPOINT
// ----------------------------------------------------
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Fallback intelligent answers for basic questions when Gemini API key is missing or network unavailable
function generateSaraFallbackAnswer(message: string, userName?: string): string {
  const lower = message.toLowerCase();
  const name = userName || 'Colega';

  if (lower.includes('ola') || lower.includes('olá') || lower.includes('oi') || lower.includes('bom dia') || lower.includes('boa tarde') || lower.includes('boa noite')) {
    return `Olá, ${name}! Sou a Sara, sua assistente e tutora virtual no Sara Quiz. Como posso te ajudar hoje nos estudos técnicos ou com as regras da plataforma?`;
  }
  if (lower.includes('quem e voce') || lower.includes('quem és') || lower.includes('quem é você') || lower.includes('apresente-se')) {
    return `Eu sou a Sara, assistente e tutora inteligente do Sara Quiz! Estou aqui para te ajudar a tirar dúvidas de matérias técnicas (Eletricidade, Mecânica, Construção, Contabilidade, Gestão, Ensino Geral e Informática), dar dicas de estudo e explicar as regras do jogo e dos saques.`;
  }
  if (lower.includes('como funciona') || lower.includes('regras') || lower.includes('como jogar') || lower.includes('pontos')) {
    return `No Sara Quiz você responde a questões técnicas reais:\n• Cada acerto dá pontos (Fácil: 15 pts, Médio: 35 pts, Difícil/Especial: 75 pts).\n• Pular questão tem taxa de -5 pontos.\n• Resposta incorreta desconta taxa de 5 a 20 MT (10 a 40 pts).\n• 2 Pontos = 1 Metical (MT).\n• O ranking é atualizado em tempo real para todos os jogadores cadastrados!`;
  }
  if (lower.includes('saque') || lower.includes('levantamento') || lower.includes('m-pesa') || lower.includes('emola') || lower.includes('e-mola') || lower.includes('dinheiro') || lower.includes('pagamento')) {
    return `Para solicitar um levantamento:\n1. O valor mínimo é de 1.000 MT (equivalente a 2.000 pontos acumulados).\n2. Acesse a aba 'Perfil' e insira seu número de M-Pesa ou E-Mola.\n3. O valor é transferido em um prazo médio de 2 a 3 horas após aprovação administrativa.`;
  }
  if (lower.includes('ohm') || lower.includes('lei de ohm') || lower.includes('eletricidade') || lower.includes('voltagem') || lower.includes('amperagem') || lower.includes('resistencia') || lower.includes('corrente')) {
    return `A 1ª Lei de Ohm define que a Tensão (V) é igual à Corrente (I) multiplicada pela Resistência (R): V = I × R. A potência elétrica é calculada por P = V × I (em Watts). Lembre-se sempre de respeitar as normas de segurança ao manusear circuitos!`;
  }
  if (lower.includes('mecanica') || lower.includes('motor') || lower.includes('torque') || lower.includes('rosca') || lower.includes('engrenagem')) {
    return `Em Mecânica Industrial:\n• Torque = Força × Braço de Alavanca (N·m).\n• Relação de transmissão em engrenagens: i = Z2 / Z1 = n1 / n2.\n• A lubrificação periódica e o alinhamento de eixos evitam vibração excessiva e desgaste prematuro dos rolamentos.`;
  }
  if (lower.includes('construcao') || lower.includes('betão') || lower.includes('concreto') || lower.includes('cimento') || lower.includes('alvenaria')) {
    return `Na Construção Civil:\n• O traço comum de concreto estrutural é 1 : 2 : 3 (Cimento : Areia : Brita) com relação água/cimento controlada.\n• A cura úmida mínima nos primeiros 7 dias é fundamental para atingir a resistência de projeto (fck).`;
  }
  if (lower.includes('contabilidade') || lower.includes('debito') || lower.includes('crédito') || lower.includes('ativo') || lower.includes('passivo') || lower.includes('patrimonio')) {
    return `Na Contabilidade:\n• Equação Fundamental: Ativo = Passivo + Patrimônio Líquido.\n• No método das partidas dobradas, para cada débito há um crédito de igual valor. As contas de Ativo aumentam a Débito e diminuem a Crédito.`;
  }
  if (lower.includes('informatica') || lower.includes('computador') || lower.includes('ip') || lower.includes('rede') || lower.includes('software') || lower.includes('programacao')) {
    return `Em Informática e Tecnologia:\n• Um endereço IPv4 é composto por 32 bits (4 octetos decimais, ex: 192.168.1.1).\n• O protocolo TCP garante a entrega ordenada e confiável dos pacotes, enquanto o UDP prioriza velocidade sem confirmação.`;
  }
  if (lower.includes('dica') || lower.includes('ganhar mais') || lower.includes('estudar') || lower.includes('aprender')) {
    return `Dica da Sara:\n1. Mantenha sequências de acertos (streak) para maximizar sua confiança.\n2. Se tiver dúvida em uma questão muito difícil, revise a explicação técnica após responder.\n3. Explore todos os módulos de qualificações para subir no Ranking Global!`;
  }

  return `Entendi sua pergunta, ${name}! Posso te explicar matérias de Eletricidade, Mecânica, Construção Civil, Contabilidade, Gestão, Ensino Geral e Informática, além de te ajudar a entender as regras do Sara Quiz e como sacar seus Meticais. O que você gostaria de saber com mais detalhes?`;
}

// Endpoint POST /api/chat/sara
app.post('/api/chat/sara', async (req: Request, res: Response) => {
  const { message, user_id, user_name, user_qualification, history } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Mensagem vazia' });
  }

  const promptText = message.trim();
  const userName = user_name || 'Jogador';
  const qualInterest = user_qualification || 'Geral';

  const systemInstruction = `Você é a Sara, a Tutora e Assistente Virtual Inteligente oficial da plataforma "Sara Quiz" em Moçambique.
Seu objetivo é ser acolhedora, amigável, clara, didática e motivadora com os estudantes e profissionais.
Você responde perguntas básicas de conhecimento geral (ciência, história, língua portuguesa, matemática) e dúvidas técnicas de qualquer uma das qualificações do Sara Quiz:
1. Eletricidade Industrial (Leis de Ohm, Kirchhoff, motores, comandos elétricos, segurança).
2. Mecânica Industrial (hidráulica, pneumática, usinagem, manutenção, termodinâmica).
3. Construção Civil (estruturas, concreto/betão armado, topografia, alvenaria, instalações).
4. Contabilidade & Finanças (débito/crédito, balanço patrimonial, DRE, IFRS/NIRF em Moçambique).
5. Gestão & Liderança (administração, gestão de pessoas, logística, qualidade).
6. Ensino Geral (conhecimentos fundamentais, biologia, química, física, língua).
7. Informática & Tecnologia (redes, computadores, sistemas, segurança cibernética, lógica).

Regras da plataforma Sara Quiz para informar se perguntado:
- Conversão: 2 Pontos = 1 Metical (MT) (ou seja, 1 MT = 2 Pontos).
- Levantamento mínimo: 1.000 MT (2.000 pontos acumulados) via M-Pesa ou E-Mola no prazo de 2 a 3 horas.
- Pontuação de acerto: Fácil (15 pts), Médio (35 pts), Difícil/Especial (75 pts).
- Penalidades: Pular questão desconta 5 pontos (-5 pts). Errar questão aplica taxa de 5 a 20 MT (-10 a -40 pts).
- O usuário atual se chama: ${userName} e tem foco em: ${qualInterest}.
Responda sempre em Português de forma direta, encorajadora e estruturada (use bullet points se for listar passos ou conceitos).`;

  try {
    const ai = getGeminiClient();
    if (ai) {
      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: promptText,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        });
      } catch (e: any) {
        console.warn('Retrying with gemini-3.6-flash:', e?.message);
        response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: promptText,
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        });
      }

      const responseText = response.text || generateSaraFallbackAnswer(promptText, userName);
      return res.json({
        success: true,
        reply: responseText,
        sender: 'Sara (Tutora IA)',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    console.warn('Gemini API call failed, falling back to local Sara engine:', err?.message);
  }

  // Fallback response
  const fallbackReply = generateSaraFallbackAnswer(promptText, userName);
  return res.json({
    success: true,
    reply: fallbackReply,
    sender: 'Sara (Tutora IA)',
    timestamp: new Date().toISOString(),
  });
});

// Endpoint GET /api/users/all-registered (Returns all registered users for ranking and chat discovery)
app.get('/api/users/all-registered', (_req: Request, res: Response) => {
  const usersList = Array.from(usersMap.values()).map((u) => {
    const { password_hash, ...safeUser } = u;
    return safeUser;
  });
  res.json({ success: true, count: usersList.length, users: usersList });
});

// ----------------------------------------------------
// 7. ADMIN ENDPOINTS (PROTECTED BY PASSWORD "001234")
// ----------------------------------------------------

// Verify Admin Password
app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Acesso de Administrador Autorizado' });
  }
  return res.status(401).json({ error: 'Palavra-passe de administrador incorreta.' });
});

// Admin Stats
app.get('/api/admin/stats', (req: Request, res: Response) => {
  const countsByQual: Record<string, { in_db: number; estimated_bank: number }> = {};

  for (const q of QUALIFICATIONS_LIST) {
    const inDb = questionsDatabase.filter((item) => item.qualification === q.id).length;
    countsByQual[q.id] = {
      in_db: inDb,
      estimated_bank: ESTIMATED_BANK_COUNTS[q.id] || 5000,
    };
  }

  const allUsers = Array.from(usersMap.values());
  const totalPointsDistributed = allUsers.reduce((sum, u) => sum + u.total_points, 0);
  const pendingWithdrawalsCount = withdrawalsList.filter((w) => w.status === 'pending').length;
  const pendingWithdrawalsTotalMt = withdrawalsList
    .filter((w) => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount_mt, 0);

  res.json({
    total_db_questions: questionsDatabase.length,
    active_questions: questionsDatabase.filter((q) => q.active).length,
    counts_by_qualification: countsByQual,
    total_players: usersMap.size,
    online_players: allUsers.filter((u) => u.is_online).length,
    total_points_distributed: totalPointsDistributed,
    total_meticais_balance: totalPointsDistributed / 2,
    pending_withdrawals_count: pendingWithdrawalsCount,
    pending_withdrawals_total_mt: pendingWithdrawalsTotalMt,
    pending_reports: moderationReports.filter((r) => r.status === 'pending').length,
  });
});

// Admin List All Registered Players
app.get('/api/admin/users', (_req: Request, res: Response) => {
  const usersList = Array.from(usersMap.values()).map((u) => {
    const { password_hash, ...safeUser } = u;
    return {
      ...safeUser,
      balance_mt: safeUser.total_points / 2,
    };
  });
  res.json({ users: usersList });
});

// Admin Activity Feed
app.get('/api/admin/activities', (_req: Request, res: Response) => {
  res.json({ activities: activityLogs });
});

// Admin Withdrawals Management
app.get('/api/admin/withdrawals', (_req: Request, res: Response) => {
  res.json({ withdrawals: withdrawalsList });
});

// Admin Process Withdrawal (Approve / Transfer or Reject & Refund)
app.post('/api/admin/withdrawals/:id/process', (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, notes } = req.body; // action: 'approve' | 'reject'

  const withdrawal = withdrawalsList.find((w) => w.id === id);
  if (!withdrawal) {
    return res.status(404).json({ error: 'Solicitação de levantamento não encontrada.' });
  }

  if (withdrawal.status !== 'pending') {
    return res.status(400).json({ error: 'Esta solicitação já foi processada anteriormente.' });
  }

  const now = new Date().toISOString();
  withdrawal.processed_at = now;
  withdrawal.admin_notes = notes || '';

  if (action === 'approve') {
    withdrawal.status = 'completed';
    syncWithdrawalToSupabase(withdrawal);

    logActivity(
      'withdrawal',
      'Levantamento Aprovado e Pago',
      `O levantamento de ${withdrawal.amount_mt} MT para ${withdrawal.user_name} via ${withdrawal.wallet_type} (${withdrawal.wallet_number}) foi concluído com sucesso.`,
      withdrawal.user_id,
      withdrawal.user_name
    );
    syncActivityToSupabase({
      id: `act-${Date.now()}`,
      type: 'withdrawal',
      title: 'Levantamento Aprovado e Pago',
      description: `O levantamento de ${withdrawal.amount_mt} MT para ${withdrawal.user_name} via ${withdrawal.wallet_type} (${withdrawal.wallet_number}) foi concluído com sucesso.`,
      user_id: withdrawal.user_id,
      user_name: withdrawal.user_name,
      timestamp: now,
    });
    return res.json({ success: true, message: 'Levantamento marcado como pago e transferido!', withdrawal });
  } else if (action === 'reject') {
    withdrawal.status = 'rejected';
    syncWithdrawalToSupabase(withdrawal);

    // Refund points to user!
    const user = usersMap.get(withdrawal.user_id);
    if (user) {
      user.total_points += withdrawal.points_deducted;
      usersMap.set(user.id, user);
      syncUserToSupabase(user);
    }

    logActivity(
      'withdrawal',
      'Levantamento Rejeitado e Reembolsado',
      `O pedido de ${withdrawal.amount_mt} MT de ${withdrawal.user_name} foi cancelado e os ${withdrawal.points_deducted} pontos foram devolvidos ao saldo. Motivo: ${notes || 'Não especificado'}.`,
      withdrawal.user_id,
      withdrawal.user_name
    );
    syncActivityToSupabase({
      id: `act-${Date.now()}`,
      type: 'withdrawal',
      title: 'Levantamento Rejeitado e Reembolsado',
      description: `O pedido de ${withdrawal.amount_mt} MT de ${withdrawal.user_name} foi cancelado e os ${withdrawal.points_deducted} pontos foram devolvidos ao saldo. Motivo: ${notes || 'Não especificado'}.`,
      user_id: withdrawal.user_id,
      user_name: withdrawal.user_name,
      timestamp: now,
    });
    return res.json({ success: true, message: 'Levantamento rejeitado e pontos reembolsados ao jogador.', withdrawal });
  }

  return res.status(400).json({ error: 'Ação inválida. Escolha approve ou reject.' });
});

// Admin Questions CRUD
app.get('/api/admin/questions', (req: Request, res: Response) => {
  const { qualification, subcategory, difficulty, status, search } = req.query;
  let filtered = [...questionsDatabase];

  if (qualification) filtered = filtered.filter((q) => q.qualification === qualification);
  if (subcategory) filtered = filtered.filter((q) => q.subcategory === subcategory);
  if (difficulty) filtered = filtered.filter((q) => q.difficulty === difficulty);
  if (status === 'active') filtered = filtered.filter((q) => q.active);
  else if (status === 'inactive') filtered = filtered.filter((q) => !q.active);
  if (search) {
    const s = (search as string).toLowerCase();
    filtered = filtered.filter(
      (q) => q.question.toLowerCase().includes(s) || q.explanation.toLowerCase().includes(s)
    );
  }

  res.json({ total: filtered.length, questions: filtered });
});

// Create question with normalized points
app.post('/api/admin/questions', (req: Request, res: Response) => {
  const {
    question,
    options,
    correct_answer,
    qualification,
    subcategory,
    difficulty,
    points,
    explanation,
    time_limit,
    active,
    scientist_law,
  } = req.body;

  if (!question || !options || !correct_answer || !qualification) {
    return res.status(400).json({ error: 'Missing required question fields' });
  }

  // Calculate points according to difficulty criteria
  let pts = Number(points);
  if (!pts || isNaN(pts)) {
    if (difficulty === 'Fácil') pts = 15;
    else if (difficulty === 'Médio') pts = 35;
    else pts = 75;
  }

  const rawQuestion: Question = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    question: question.trim(),
    options,
    correct_answer,
    qualification,
    subcategory: subcategory || 'Geral',
    difficulty: difficulty || 'Médio',
    points: pts,
    explanation: explanation || '',
    time_limit: Number(time_limit) || 25,
    active: active !== undefined ? !!active : true,
    created_at: new Date().toISOString(),
    scientist_law,
  };

  const newQuestion = normalizeQuestionPoints(rawQuestion);
  questionsDatabase.unshift(newQuestion);
  syncQuestionToSupabase(newQuestion);

  res.json({ success: true, question: newQuestion });
});

app.put('/api/admin/questions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = questionsDatabase.findIndex((q) => q.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });

  questionsDatabase[idx] = normalizeQuestionPoints({
    ...questionsDatabase[idx],
    ...req.body,
  });
  syncQuestionToSupabase(questionsDatabase[idx]);

  res.json({ success: true, question: questionsDatabase[idx] });
});

app.delete('/api/admin/questions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  questionsDatabase = questionsDatabase.filter((q) => q.id !== id);
  deleteQuestionFromSupabase(id);
  res.json({ success: true });
});

// Import bulk JSON / CSV
app.post('/api/admin/import', (req: Request, res: Response) => {
  const { format, data } = req.body;
  if (!data) return res.status(400).json({ error: 'Data payload is required' });

  let importedCount = 0;

  try {
    if (format === 'json') {
      const items = Array.isArray(data) ? data : JSON.parse(data);
      for (const item of items) {
        if (item.question && item.options && item.correct_answer && item.qualification) {
          const rawQ: Question = {
            id: item.id || `imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            question: item.question,
            options: item.options,
            correct_answer: item.correct_answer,
            qualification: item.qualification,
            subcategory: item.subcategory || 'Importada',
            difficulty: item.difficulty || 'Médio',
            points: Number(item.points) || 35,
            explanation: item.explanation || '',
            time_limit: Number(item.time_limit) || 25,
            active: item.active !== undefined ? !!item.active : true,
            created_at: new Date().toISOString(),
            scientist_law: item.scientist_law,
          };
          const normQ = normalizeQuestionPoints(rawQ);
          questionsDatabase.unshift(normQ);
          syncQuestionToSupabase(normQ);
          importedCount++;
        }
      }
    } else if (format === 'csv') {
      const lines = data.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(';');
        if (cols.length >= 7) {
          const diff = (cols[8]?.trim() as any) || 'Médio';
          const rawQ: Question = {
            id: `csv-${Date.now()}-${i}`,
            question: cols[0].trim(),
            options: {
              a: cols[1]?.trim() || '',
              b: cols[2]?.trim() || '',
              c: cols[3]?.trim() || '',
              d: cols[4]?.trim() || '',
            },
            correct_answer: (cols[5]?.trim().toLowerCase() as any) || 'a',
            qualification: (cols[6]?.trim() as Qualification) || 'Eletricidade Industrial',
            subcategory: cols[7]?.trim() || 'Importada via CSV',
            difficulty: diff,
            points: diff === 'Fácil' ? 15 : diff === 'Médio' ? 35 : 75,
            explanation: cols[9]?.trim() || 'Resposta conforme padrão técnico.',
            time_limit: 25,
            active: true,
            created_at: new Date().toISOString(),
          };
          const normQ = normalizeQuestionPoints(rawQ);
          questionsDatabase.unshift(normQ);
          syncQuestionToSupabase(normQ);
          importedCount++;
        }
      }
    }

    res.json({ success: true, imported_count: importedCount, total_db: questionsDatabase.length });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to parse import data', details: err.message });
  }
});

// Admin Moderation
app.get('/api/admin/moderation', (_req: Request, res: Response) => {
  res.json({ reports: moderationReports });
});

app.post('/api/admin/moderation/:action', (req: Request, res: Response) => {
  const { action } = req.params;
  const { report_id, message_id, user_id } = req.body;

  if (action === 'delete_message' && message_id) {
    globalChatMessages = globalChatMessages.filter((m) => m.id !== message_id);
    const rep = moderationReports.find((r) => r.message_id === message_id);
    if (rep) rep.status = 'resolved';
    return res.json({ success: true, message: 'Message removed' });
  }

  if (action === 'block_user' && user_id) {
    globalChatMessages = globalChatMessages.filter((m) => m.user_id !== user_id);
    moderationReports
      .filter((r) => r.reported_user_id === user_id)
      .forEach((r) => (r.status = 'resolved'));
    return res.json({ success: true, message: 'User content banned and removed' });
  }

  if (action === 'dismiss_report' && report_id) {
    const rep = moderationReports.find((r) => r.id === report_id);
    if (rep) rep.status = 'dismissed';
    return res.json({ success: true, message: 'Report dismissed' });
  }

  res.status(400).json({ error: 'Invalid moderation action' });
});

// ----------------------------------------------------
// 8. SUPABASE MANAGEMENT ENDPOINTS
// ----------------------------------------------------
app.get('/api/supabase/status', async (_req: Request, res: Response) => {
  let tableChecks: Record<string, { exists: boolean; count?: number; error?: string }> = {};

  try {
    const [uRes, qRes, wRes, aRes, cRes] = await Promise.allSettled([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('withdrawals').select('id', { count: 'exact', head: true }),
      supabase.from('activity_logs').select('id', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
    ]);

    tableChecks.users = uRes.status === 'fulfilled' && !uRes.value.error
      ? { exists: true, count: uRes.value.count || 0 }
      : { exists: false, error: uRes.status === 'fulfilled' ? uRes.value.error?.message : 'Falha na conexão' };

    tableChecks.questions = qRes.status === 'fulfilled' && !qRes.value.error
      ? { exists: true, count: qRes.value.count || 0 }
      : { exists: false, error: qRes.status === 'fulfilled' ? qRes.value.error?.message : 'Falha na conexão' };

    tableChecks.withdrawals = wRes.status === 'fulfilled' && !wRes.value.error
      ? { exists: true, count: wRes.value.count || 0 }
      : { exists: false, error: wRes.status === 'fulfilled' ? wRes.value.error?.message : 'Falha na conexão' };

    tableChecks.activity_logs = aRes.status === 'fulfilled' && !aRes.value.error
      ? { exists: true, count: aRes.value.count || 0 }
      : { exists: false, error: aRes.status === 'fulfilled' ? aRes.value.error?.message : 'Falha na conexão' };

    tableChecks.chat_messages = cRes.status === 'fulfilled' && !cRes.value.error
      ? { exists: true, count: cRes.value.count || 0 }
      : { exists: false, error: cRes.status === 'fulfilled' ? cRes.value.error?.message : 'Falha na conexão' };

    supabaseConnected = true;
    supabaseLastSyncTime = new Date().toISOString();
  } catch (err: any) {
    supabaseConnected = false;
    supabaseError = err.message;
  }

  res.json({
    connected: supabaseConnected,
    url: SUPABASE_URL,
    project_id: 'gjbqylheutriojpnopcg',
    last_sync: supabaseLastSyncTime,
    error: supabaseError,
    tables: tableChecks,
    local_state: {
      users_count: usersMap.size,
      questions_count: questionsDatabase.length,
      withdrawals_count: withdrawalsList.length,
      activities_count: activityLogs.length,
      chat_messages_count: globalChatMessages.length,
    }
  });
});

// Sync All Local In-Memory Data into Supabase
app.post('/api/supabase/sync-all', async (_req: Request, res: Response) => {
  let syncedUsers = 0;
  let syncedQuestions = 0;
  let syncedWithdrawals = 0;
  let syncedActivities = 0;

  try {
    // 1. Sync users
    for (const u of usersMap.values()) {
      await syncUserToSupabase(u);
      syncedUsers++;
    }

    // 2. Sync questions
    for (const q of questionsDatabase) {
      await syncQuestionToSupabase(q);
      syncedQuestions++;
    }

    // 3. Sync withdrawals
    for (const w of withdrawalsList) {
      await syncWithdrawalToSupabase(w);
      syncedWithdrawals++;
    }

    // 4. Sync activities
    for (const a of activityLogs) {
      await syncActivityToSupabase(a);
      syncedActivities++;
    }

    supabaseLastSyncTime = new Date().toISOString();
    supabaseConnected = true;

    res.json({
      success: true,
      message: 'Sincronização completa realizada com o banco de dados Supabase!',
      synced: {
        users: syncedUsers,
        questions: syncedQuestions,
        withdrawals: syncedWithdrawals,
        activities: syncedActivities,
      },
      last_sync: supabaseLastSyncTime,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro durante sincronização', details: err.message });
  }
});

// Return SQL Schema
app.get('/api/supabase/schema', (_req: Request, res: Response) => {
  res.json({ schema: SUPABASE_SQL_SCHEMA });
});

// ----------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------
async function startServer() {
  // Bootstrap Supabase initial connection
  await initializeSupabaseConnection();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sara Quiz Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
