import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
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

const app = express();
const PORT = 3000;
const ADMIN_PASSWORD = '001234';

app.use(express.json({ limit: '10mb' }));

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

  logActivity(
    'register',
    'Novo Jogador Cadastrado',
    `${newUser.name} (${newUser.phone}) ingressou na plataforma com interesse em ${newUser.qualification_interest}.`,
    newUser.id,
    newUser.name
  );

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

  logActivity(
    'withdrawal',
    'Solicitação de Levantamento',
    `${user.name} solicitou levantamento de ${requestedMt} MT (${requiredPoints} pts) via ${wallet_type} (${cleanWalletNum}).`,
    user.id,
    user.name
  );

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
    logActivity(
      'withdrawal',
      'Levantamento Aprovado e Pago',
      `O levantamento de ${withdrawal.amount_mt} MT para ${withdrawal.user_name} via ${withdrawal.wallet_type} (${withdrawal.wallet_number}) foi concluído com sucesso.`,
      withdrawal.user_id,
      withdrawal.user_name
    );
    return res.json({ success: true, message: 'Levantamento marcado como pago e transferido!', withdrawal });
  } else if (action === 'reject') {
    withdrawal.status = 'rejected';

    // Refund points to user!
    const user = usersMap.get(withdrawal.user_id);
    if (user) {
      user.total_points += withdrawal.points_deducted;
      usersMap.set(user.id, user);
    }

    logActivity(
      'withdrawal',
      'Levantamento Rejeitado e Reembolsado',
      `O pedido de ${withdrawal.amount_mt} MT de ${withdrawal.user_name} foi cancelado e os ${withdrawal.points_deducted} pontos foram devolvidos ao saldo. Motivo: ${notes || 'Não especificado'}.`,
      withdrawal.user_id,
      withdrawal.user_name
    );
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

  res.json({ success: true, question: questionsDatabase[idx] });
});

app.delete('/api/admin/questions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  questionsDatabase = questionsDatabase.filter((q) => q.id !== id);
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
          questionsDatabase.unshift(normalizeQuestionPoints(rawQ));
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
          questionsDatabase.unshift(normalizeQuestionPoints(rawQ));
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
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------
async function startServer() {
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
