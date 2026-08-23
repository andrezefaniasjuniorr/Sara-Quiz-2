import React, { useState, useEffect, useRef } from 'react';
import { Qualification, GameMode, Question, UserProfile } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { QUESTIONS_DATABASE } from '../data/questions';
import { SupabaseAuthService } from '../lib/supabase';
import { 
  ArrowLeft, 
  Timer, 
  Flame, 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ChevronRight, 
  RotateCcw, 
  Trophy, 
  Sparkles, 
  BookOpen,
  Zap,
  Layers,
  FastForward,
  Wallet
} from 'lucide-react';

interface QuizArenaProps {
  qualification: Qualification;
  mode: GameMode;
  user: UserProfile;
  onExit: () => void;
  onAnswerRecorded: (updatedStats: any) => void;
}

export const QuizArena: React.FC<QuizArenaProps> = ({
  qualification,
  mode,
  user,
  onExit,
  onAnswerRecorded,
}) => {
  const meta = QUALIFICATIONS_LIST.find((q) => q.id === qualification) || QUALIFICATIONS_LIST[0];

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<'a' | 'b' | 'c' | 'd' | 'skipped' | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25);
  const [totalQuestionsCount, setTotalQuestionsCount] = useState(10);
  
  // Game session metrics
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [sessionSkippedCount, setSessionSkippedCount] = useState(0);
  const [sessionWrongCount, setSessionWrongCount] = useState(0);
  const [sessionPenaltyTotalMt, setSessionPenaltyTotalMt] = useState(0);
  const [sessionPenaltyTotalPts, setSessionPenaltyTotalPts] = useState(0);
  const [lastPenaltyInfo, setLastPenaltyInfo] = useState<{ mt: number; pts: number } | null>(null);
  const [sessionStreak, setSessionStreak] = useState(user.current_streak || 0);
  const [highestSessionStreak, setHighestSessionStreak] = useState(user.current_streak || 0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [allAnsweredBefore, setAllAnsweredBefore] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const getPenaltyForDifficulty = (diff: string) => {
    if (diff === 'Fácil') return { mt: 5, pts: 10 };
    if (diff === 'Médio') return { mt: 10, pts: 20 };
    return { mt: 20, pts: 40 }; // Difícil or Especial
  };

  // Fetch Questions for Qualification directly from database
  useEffect(() => {
    function loadQualificationQuestions() {
      setLoading(true);
      try {
        const limit = mode === 'classico' ? 10 : mode === 'desafio' ? 15 : 20;
        const matchingQuestions = QUESTIONS_DATABASE.filter(
          (q) => q.qualification === qualification
        );
        
        // Shuffle questions
        const shuffled = [...matchingQuestions].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, limit);

        if (selected.length > 0) {
          setQuestions(selected);
          setTotalQuestionsCount(selected.length);
        } else {
          // Fallback to general pool if qualification has fewer questions
          setQuestions(QUESTIONS_DATABASE.slice(0, limit));
          setTotalQuestionsCount(limit);
        }
      } catch (err) {
        console.error('Error loading questions:', err);
      } finally {
        setLoading(false);
      }
    }

    loadQualificationQuestions();
  }, [qualification, mode, user.id]);

  const currentQuestion = questions[currentIndex];

  // Start question timer
  useEffect(() => {
    if (!currentQuestion || isAnswered || isGameOver || loading) return;

    const baseLimit = mode === 'resposta_rapida' ? 15 : currentQuestion.time_limit || 25;
    setTimeLeft(baseLimit);
    startTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, currentQuestion, isAnswered, isGameOver, loading]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || isGameOver) return;

      if (!isAnswered) {
        if (e.key === '1' || e.key === 'a' || e.key === 'A') handleSelectOption('a');
        if (e.key === '2' || e.key === 'b' || e.key === 'B') handleSelectOption('b');
        if (e.key === '3' || e.key === 'c' || e.key === 'C') handleSelectOption('c');
        if (e.key === '4' || e.key === 'd' || e.key === 'D') handleSelectOption('d');
        if (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S') handleSkipQuestion();
      } else {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, loading, isGameOver, selectedOption]);

  const handleTimeOut = () => {
    if (isAnswered) return;
    submitAnswer('timeout');
  };

  const handleSelectOption = (opt: 'a' | 'b' | 'c' | 'd') => {
    if (isAnswered || !currentQuestion) return;
    setSelectedOption(opt);
    submitAnswer(opt);
  };

  // Skip Question Handler (-5 Points Penalty)
  const handleSkipQuestion = async () => {
    if (isAnswered || !currentQuestion) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption('skipped');
    setIsAnswered(true);
    setSkipFeedback(true);
    setSessionSkippedCount((prev) => prev + 1);
    setSessionStreak(0);
    setSessionScore((prev) => Math.max(0, prev - 5));

    try {
      const { user_stats } = await SupabaseAuthService.recordAnswer({
        user_id: user.id,
        question_id: currentQuestion.id,
        qualification: qualification,
        selected_answer: 'skipped',
        correct: false,
        points_earned: -5,
        time_taken_seconds: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)),
      });
      if (user_stats && onAnswerRecorded) {
        onAnswerRecorded(user_stats);
      }
    } catch (err) {
      console.error('Error recording skipped question to Supabase:', err);
    }
  };

  const submitAnswer = async (selected: 'a' | 'b' | 'c' | 'd' | 'timeout') => {
    if (!currentQuestion) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setIsAnswered(true);
    const isCorrect = selected === currentQuestion.correct_answer;
    const timeTaken = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

    // Base point range (5-20 Fácil, 21-50 Médio, 51-100 Difícil)
    let earnedPoints = 0;
    let newStreak = sessionStreak;

    if (isCorrect) {
      newStreak = sessionStreak + 1;
      setSessionStreak(newStreak);
      if (newStreak > highestSessionStreak) setHighestSessionStreak(newStreak);

      const streakBonus = Math.min(10, Math.floor(newStreak * 1.5));
      const speedBonus = timeLeft > 12 ? 5 : 0;
      earnedPoints = currentQuestion.points + streakBonus + speedBonus;

      setSessionScore((prev) => prev + earnedPoints);
      setSessionCorrectCount((prev) => prev + 1);
      setLastPenaltyInfo(null);
    } else {
      newStreak = 0;
      setSessionStreak(0);

      // PENALTY TAX ON WRONG ANSWER (5 to 20 MT / 10 to 40 Points)
      const penalty = getPenaltyForDifficulty(currentQuestion.difficulty);
      setSessionPenaltyTotalMt((prev) => prev + penalty.mt);
      setSessionPenaltyTotalPts((prev) => prev + penalty.pts);
      setSessionWrongCount((prev) => prev + 1);
      setLastPenaltyInfo({ mt: penalty.mt, pts: penalty.pts });
      setSessionScore((prev) => Math.max(0, prev - penalty.pts));

      if (mode === 'sequencia') {
        setTimeout(() => {
          setIsGameOver(true);
        }, 1800);
      }
    }

    try {
      // 100% Native Supabase Answer Recording
      const { user_stats } = await SupabaseAuthService.recordAnswer({
        user_id: user.id,
        question_id: currentQuestion.id,
        qualification: qualification,
        selected_answer: selected,
        correct: isCorrect,
        points_earned: earnedPoints,
        time_taken_seconds: timeTaken,
      });

      if (user_stats && onAnswerRecorded) {
        onAnswerRecorded(user_stats);
      }
    } catch (err) {
      console.error('Error saving answer to Supabase:', err);
    }
  };

  const handleNextQuestion = () => {
    setSkipFeedback(false);
    setLastPenaltyInfo(null);
    if (mode === 'sequencia' && selectedOption !== currentQuestion?.correct_answer && selectedOption !== 'skipped') {
      setIsGameOver(true);
      return;
    }

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsGameOver(true);
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setSessionScore(0);
    setSessionCorrectCount(0);
    setSessionSkippedCount(0);
    setSessionWrongCount(0);
    setSessionPenaltyTotalMt(0);
    setSessionPenaltyTotalPts(0);
    setLastPenaltyInfo(null);
    setSessionStreak(0);
    setIsGameOver(false);
    setSkipFeedback(false);
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Carregando Banco de Perguntas...</h2>
        <p className="text-sm text-slate-400 mt-1">
          Selecionando questões inéditas de <span className="text-amber-400 font-semibold">{qualification}</span>
        </p>
      </div>
    );
  }

  // 2. Empty Questions Fallback
  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center bg-slate-900 border border-slate-800 rounded-3xl mt-8">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-2xl font-black text-white">Parabéns pelo Progresso!</h2>
        <p className="text-sm text-slate-300 mt-2">
          Você já respondeu a todas as questões disponíveis de <strong>{qualification}</strong> nesta sessão.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={onExit}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md"
          >
            Escolher Outra Qualificação
          </button>
        </div>
      </div>
    );
  }

  // 3. Game Over Screen
  if (isGameOver) {
    const accuracy = Math.round((sessionCorrectCount / Math.max(1, currentIndex + 1)) * 100);
    const sessionMtEarned = sessionScore / 2;

    return (
      <div className="max-w-2xl mx-auto px-4 py-10 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl shadow-amber-500/20">
            {accuracy >= 80 ? '👑' : accuracy >= 50 ? '🥈' : '📘'}
          </div>

          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Partida Finalizada
          </span>

          <h2 className="text-3xl font-black text-white mt-2">
            {accuracy >= 80 ? 'Excelente Desempenho Técnico!' : accuracy >= 50 ? 'Bom Trabalho!' : 'Continue Estudando!'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Qualificação: <strong className="text-slate-200">{qualification}</strong> • Modo: <strong className="text-amber-400">{mode}</strong>
          </p>

          {/* Results Bento */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-6">
            <div className="bg-slate-950 border border-slate-800 p-3 sm:p-4 rounded-2xl">
              <span className="text-xs text-slate-400 block font-medium">Pontos Líquidos</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">+{sessionScore}</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 sm:p-4 rounded-2xl">
              <span className="text-xs text-slate-400 block font-medium">Equivalente MT</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">+{sessionMtEarned} MT</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 sm:p-4 rounded-2xl">
              <span className="text-xs text-slate-400 block font-medium">Acertos</span>
              <span className="text-xl sm:text-2xl font-black text-slate-200 font-mono">{sessionCorrectCount}/{currentIndex + 1}</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 sm:p-4 rounded-2xl">
              <span className="text-xs text-slate-400 block font-medium">Erros (Taxa)</span>
              <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
                {sessionWrongCount} {sessionPenaltyTotalMt > 0 && `(-${sessionPenaltyTotalMt} MT)`}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 sm:p-4 rounded-2xl col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-400 block font-medium">Puladas (-5 pts)</span>
              <span className="text-xl sm:text-2xl font-black text-blue-400 font-mono">{sessionSkippedCount}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={restartQuiz}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Jogar Novamente</span>
            </button>

            <button
              onClick={onExit}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Menu</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  // 4. Main Question Arena
  return (
    <div id="screen-quiz-arena" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      
      {/* Top Session Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 mb-5 flex items-center justify-between shadow-md">
        <button
          onClick={onExit}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Sair</span>
        </button>

        {/* Center Indicators */}
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-300">
            Questão <strong className="text-amber-400">{currentIndex + 1}</strong> de {questions.length}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            <span>+{sessionScore} pts ({sessionScore / 2} MT)</span>
          </span>
          {sessionStreak > 0 && (
            <span className="hidden sm:flex items-center text-orange-400 font-extrabold gap-1">
              <Flame className="w-3.5 h-3.5 fill-orange-500" />
              <span>{sessionStreak} combo</span>
            </span>
          )}
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-mono font-bold text-xs ${
          timeLeft <= 5 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-slate-800 text-slate-200'
        }`}>
          <Timer className="w-3.5 h-3.5" />
          <span>{timeLeft}s</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-6 relative">
        
        {/* Difficulty Badge & Scientist Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              currentQuestion.difficulty === 'Fácil' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : currentQuestion.difficulty === 'Médio'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {currentQuestion.difficulty} (+{currentQuestion.points} pts)
            </span>

            {/* Error penalty indicator */}
            <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/25 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Taxa por Erro: -{getPenaltyForDifficulty(currentQuestion.difficulty).mt} MT (-{getPenaltyForDifficulty(currentQuestion.difficulty).pts} pts)</span>
            </span>

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              {currentQuestion.subcategory}
            </span>
          </div>

          {currentQuestion.scientist_law && (
            <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              🔬 {currentQuestion.scientist_law.lawOrPrinciple} ({currentQuestion.scientist_law.scientist})
            </span>
          )}
        </div>

        {/* Question Text */}
        <h2 className="text-base sm:text-xl font-bold text-white leading-relaxed mb-6">
          {currentQuestion.question}
        </h2>

        {/* Skip Question Alert Notice */}
        {skipFeedback && (
          <div className="mb-4 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <FastForward className="w-4 h-4 text-blue-400" />
            <span>Questão pulada com sucesso. Penalidade de -5 pontos aplicada ao seu saldo.</span>
          </div>
        )}

        {/* Penalty Feedback Alert on Wrong Answer */}
        {lastPenaltyInfo && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn shadow-lg shadow-rose-950/20">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>
                {selectedOption === 'timeout' ? 'Tempo esgotado!' : 'Resposta Incorreta!'} Penalidade aplicada: <strong className="text-white underline">-{lastPenaltyInfo.mt} MT (-{lastPenaltyInfo.pts} pts)</strong> foram deduzidos do seu saldo.
              </span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-black shrink-0">
              -{lastPenaltyInfo.mt} MT
            </span>
          </div>
        )}

        {/* 4 Options Grid */}
        <div className="space-y-3">
          {(['a', 'b', 'c', 'd'] as const).map((key, idx) => {
            const optText = currentQuestion.options[key];
            if (!optText) return null;

            let btnStyle = 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-850';

            if (isAnswered) {
              if (key === currentQuestion.correct_answer) {
                btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-lg shadow-emerald-500/10';
              } else if (selectedOption === key) {
                btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold';
              } else {
                btnStyle = 'bg-slate-950/40 border-slate-850 text-slate-500 opacity-60';
              }
            }

            return (
              <button
                key={key}
                disabled={isAnswered}
                onClick={() => handleSelectOption(key)}
                className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between group cursor-pointer ${btnStyle}`}
              >
                <div className="flex items-center gap-3.5">
                  <span className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border ${
                    isAnswered && key === currentQuestion.correct_answer
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : isAnswered && selectedOption === key
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700 group-hover:text-amber-300 group-hover:border-amber-500/40'
                  }`}>
                    {key.toUpperCase()}
                  </span>
                  <span className="leading-snug">{optText}</span>
                </div>

                {isAnswered && key === currentQuestion.correct_answer && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-2" />
                )}
                {isAnswered && selectedOption === key && key !== currentQuestion.correct_answer && (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation Box */}
        {isAnswered && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1.5">
              <BookOpen className="w-4 h-4" />
              <span>Explicação Técnica e Científica:</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {/* Action Controls: Skip Question & Next */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between gap-3">
          
          {/* Skip Button (-5 pts penalty) */}
          {!isAnswered ? (
            <button
              onClick={handleSkipQuestion}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <FastForward className="w-4 h-4 text-amber-400" />
              <span>Pular Questão (-5 pts)</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400">
              Pressione <strong className="text-amber-400">Espaço</strong> ou <strong className="text-amber-400">Enter</strong> para avançar
            </div>
          )}

          {/* Next Button */}
          {isAnswered && (
            <button
              onClick={handleNextQuestion}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer animate-fadeIn"
            >
              <span>{currentIndex + 1 < questions.length ? 'Próxima Questão' : 'Ver Resultados'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>

    </div>
  );
};
