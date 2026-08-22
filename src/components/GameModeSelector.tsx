import React from 'react';
import { Qualification, GameMode, UserProfile } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { ArrowLeft, Play, Zap, Flame, Trophy, Brain, Calendar, ShieldCheck, Award } from 'lucide-react';

interface GameModeSelectorProps {
  qualification: Qualification;
  onBack: () => void;
  onSelectMode: (mode: GameMode) => void;
  user: UserProfile;
}

export const GameModeSelector: React.FC<GameModeSelectorProps> = ({
  qualification,
  onBack,
  onSelectMode,
  user,
}) => {
  const meta = QUALIFICATIONS_LIST.find((q) => q.id === qualification) || QUALIFICATIONS_LIST[0];
  const userStat = user.qualification_stats[qualification] || {
    points: 0,
    answered: 0,
    correct: 0,
    best_streak: 0,
    mastery_pct: 0,
    tier: 'Iniciante',
  };

  const GAME_MODES = [
    {
      id: 'classico' as GameMode,
      title: 'Clássico',
      icon: <Play className="w-6 h-6 text-emerald-400" />,
      tag: '10 Perguntas',
      description: 'Sessão padrão balanceada para fixação de conceitos, fórmulas e práticas.',
      color: 'border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20',
      badge: 'Ideal para Estudo',
    },
    {
      id: 'resposta_rapida' as GameMode,
      title: 'Resposta Rápida',
      icon: <Zap className="w-6 h-6 text-amber-400" />,
      tag: '15s por Questão',
      description: 'Teste sua agilidade mental e reflexos técnicos sob pressão do cronômetro.',
      color: 'border-amber-500/40 hover:border-amber-400 bg-amber-950/20',
      badge: 'Bônus de Tempo',
    },
    {
      id: 'sequencia' as GameMode,
      title: 'Sequência (Streak)',
      icon: <Flame className="w-6 h-6 text-orange-400" />,
      tag: 'Modo Sobrevivência',
      description: 'Responda quantas perguntas conseguir em sequência sem errar nenhuma.',
      color: 'border-orange-500/40 hover:border-orange-400 bg-orange-950/20',
      badge: 'Multiplicador de Combo',
    },
    {
      id: 'desafio' as GameMode,
      title: 'Desafio Competitivo',
      icon: <Trophy className="w-6 h-6 text-yellow-400" />,
      tag: 'Valendo Ranking',
      description: 'Avaliação técnica abrangente com pontuações especiais para subir na tabela.',
      color: 'border-yellow-500/40 hover:border-yellow-400 bg-yellow-950/20',
      badge: 'Ranqueado',
    },
    {
      id: 'pergunta_dificil' as GameMode,
      title: 'Pergunta Difícil',
      icon: <Brain className="w-6 h-6 text-purple-400" />,
      tag: 'Nível Avançado',
      description: 'Questões aprofundadas com cálculos, leis científicas e cenários complexos.',
      color: 'border-purple-500/40 hover:border-purple-400 bg-purple-950/20',
      badge: 'Pontos Extras (200+ pts)',
    },
    {
      id: 'desafio_diario' as GameMode,
      title: 'Desafio Diário',
      icon: <Calendar className="w-6 h-6 text-sky-400" />,
      tag: 'Missão do Dia',
      description: 'Perguntas especiais selecionadas para o dia com XP e pontos dobrados (2x).',
      color: 'border-sky-500/40 hover:border-sky-400 bg-sky-950/20',
      badge: '2x Pontos',
    },
  ];

  return (
    <div id="screen-gamemode-selector" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      
      {/* Back to Qualifications Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-amber-400 transition-colors mb-6 group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Voltar para Escolha de Qualificação</span>
      </button>

      {/* Qualification Hero Banner */}
      <div className={`relative bg-gradient-to-r ${meta.color} p-0.5 rounded-3xl shadow-xl mb-10`}>
        <div className="bg-slate-900/95 rounded-[22px] p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-4xl sm:text-5xl shadow-lg shrink-0">
                {meta.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Qualificação Ativa
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{userStat.tier}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                  {meta.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                  {meta.description}
                </p>
              </div>
            </div>

            {/* User Qualification Stats Card */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 min-w-[240px] shrink-0 w-full md:w-auto">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Seu Progresso</span>
                <span className="text-emerald-400 font-extrabold">{userStat.mastery_pct}% Domínio</span>
              </div>
              
              {/* Mastery bar */}
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.max(5, userStat.mastery_pct)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-750">
                  <span className="text-slate-400 block text-[10px]">Pontuação</span>
                  <span className="font-extrabold text-amber-400 text-sm">{userStat.points.toLocaleString()}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-750">
                  <span className="text-slate-400 block text-[10px]">Respondidas</span>
                  <span className="font-extrabold text-slate-200 text-sm">{userStat.answered}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Mode Selection Grid */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
          Selecione o Modo de Jogo
        </h2>
        <p className="text-sm text-slate-400">
          Escolha como deseja praticar e competir nesta qualificação. Suas respostas serão computadas para o ranking exclusivo de {qualification}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {GAME_MODES.map((mode) => (
          <div
            key={mode.id}
            id={`mode-card-${mode.id}`}
            onClick={() => onSelectMode(mode.id)}
            className={`group border rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${mode.color} bg-slate-900/90`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  {mode.icon}
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {mode.badge}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                  {mode.title}
                </h3>
              </div>
              
              <span className="inline-block text-xs font-semibold text-amber-400/90 mt-0.5">
                {mode.tag}
              </span>

              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                {mode.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sem repetição
              </span>
              <button className="text-xs font-bold text-slate-900 bg-amber-500 group-hover:bg-amber-400 px-4 py-2 rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer">
                <span>Iniciar</span>
                <Play className="w-3.5 h-3.5 fill-slate-950" />
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
