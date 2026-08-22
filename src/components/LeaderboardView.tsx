import React, { useState, useEffect } from 'react';
import { Qualification, LeaderboardEntry } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { Trophy, Medal, Flame, Zap, Award, User, Search } from 'lucide-react';

interface LeaderboardViewProps {
  initialQualification?: Qualification | 'Global';
  onSelectQualificationToPlay: (qual: Qualification) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  initialQualification = 'Global',
  onSelectQualificationToPlay,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>(initialQualification || 'Global');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const query = selectedFilter === 'Global' ? '' : `?qualification=${encodeURIComponent(selectedFilter)}`;
        const res = await fetch(`/api/rankings${query}`);
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [selectedFilter]);

  const filteredEntries = leaderboard.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const top3 = filteredEntries.slice(0, 3);
  const restList = filteredEntries.slice(3);

  return (
    <div id="screen-leaderboard" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Quadro de Honra & Classificação</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          Rankings por <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Qualificação</span>
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Veja os melhores desempenhos gerais ou filtre por área técnica e científica específica.
        </p>
      </div>

      {/* Qualification Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin scrollbar-thumb-slate-700">
        <button
          onClick={() => setSelectedFilter('Global')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'Global'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          🌎 Ranking Geral
        </button>

        {QUALIFICATIONS_LIST.map((q) => (
          <button
            key={q.id}
            onClick={() => setSelectedFilter(q.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === q.id
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <span>{q.icon}</span>
            <span>{q.title}</span>
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="max-w-md mx-auto mb-8 relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar jogador por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/80 transition-all"
        />
      </div>

      {/* Podium Top 3 */}
      {top3.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="order-2 md:order-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-center relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-400" />
              <div>
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 text-slate-300 font-black text-sm flex items-center justify-center mx-auto mb-3">
                  2º
                </div>
                <div className="text-4xl mb-2">{top3[1].avatar}</div>
                <h3 className="font-bold text-white text-base truncate">{top3[1].name}</h3>
                <span className="text-xs text-slate-400 block mt-0.5">{top3[1].top_qualification}</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800">
                <span className="text-xl font-black text-slate-200 block">{top3[1].points.toLocaleString()} pts</span>
                <span className="text-[11px] text-slate-400">{top3[1].accuracy_pct}% precisão</span>
              </div>
            </div>
          )}

          {/* 1st Place Champion */}
          {top3[0] && (
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 text-center relative shadow-xl shadow-amber-500/10 flex flex-col justify-between -translate-y-2">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-yellow-300" />
              <div>
                <div className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
                  👑 1º
                </div>
                <div className="text-5xl mb-2">{top3[0].avatar}</div>
                <h3 className="font-black text-white text-lg truncate">{top3[0].name}</h3>
                <span className="text-xs font-semibold text-amber-400 block mt-0.5">{top3[0].top_qualification}</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800">
                <span className="text-2xl font-black text-amber-400 block">{top3[0].points.toLocaleString()} pts</span>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-1">
                  <span className="flex items-center text-orange-400 font-bold">
                    <Flame className="w-3.5 h-3.5 fill-orange-500" /> {top3[0].streak} streak
                  </span>
                  <span>•</span>
                  <span>{top3[0].accuracy_pct}% precisão</span>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="order-3 md:order-3 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-center relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-700" />
              <div>
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-800 text-amber-600 font-black text-sm flex items-center justify-center mx-auto mb-3">
                  3º
                </div>
                <div className="text-4xl mb-2">{top3[2].avatar}</div>
                <h3 className="font-bold text-white text-base truncate">{top3[2].name}</h3>
                <span className="text-xs text-slate-400 block mt-0.5">{top3[2].top_qualification}</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800">
                <span className="text-xl font-black text-slate-200 block">{top3[2].points.toLocaleString()} pts</span>
                <span className="text-[11px] text-slate-400">{top3[2].accuracy_pct}% precisão</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Table List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
            <span>Tabela de Classificação</span>
            <span className="text-xs font-semibold text-slate-400">({filteredEntries.length} jogadores)</span>
          </h3>
          {selectedFilter !== 'Global' && (
            <button
              onClick={() => onSelectQualificationToPlay(selectedFilter as Qualification)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
            >
              Jogar nesta Qualificação
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Carregando ranking...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nenhum jogador encontrado para este filtro.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredEntries.map((player) => (
              <div
                key={player.user_id}
                className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-850/60 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  {/* Position */}
                  <span className={`w-7 text-center font-mono font-bold text-sm ${
                    player.position === 1 ? 'text-amber-400 font-extrabold text-base' :
                    player.position === 2 ? 'text-slate-300 font-bold' :
                    player.position === 3 ? 'text-amber-600 font-bold' : 'text-slate-500'
                  }`}>
                    #{player.position}
                  </span>

                  {/* Avatar */}
                  <div className="relative">
                    <span className="text-2xl select-none">{player.avatar}</span>
                    {player.is_online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                    )}
                  </div>

                  {/* Name & Specialization */}
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">{player.name}</h4>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span>{player.top_qualification}</span>
                      {player.streak > 0 && (
                        <span className="text-orange-400 font-semibold">• {player.streak} streak</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <span className="font-black text-amber-400 text-sm sm:text-base block leading-tight">
                    {player.points.toLocaleString()} pts
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {player.accuracy_pct}% acertos
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
