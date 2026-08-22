import React from 'react';
import { Qualification, UserProfile } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { Zap, Sparkles, ChevronRight, Award, Flame, BookOpen, Layers } from 'lucide-react';

interface QualificationPickerProps {
  onSelectQualification: (qual: Qualification) => void;
  user: UserProfile;
}

export const QualificationPicker: React.FC<QualificationPickerProps> = ({
  onSelectQualification,
  user,
}) => {
  return (
    <div id="screen-qualification-picker" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      
      {/* Top Banner / Heading */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Evolução Profissional & Conhecimento</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
          Escolha sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300">Qualificação</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-300">
          O Sara Quiz é estruturado por áreas técnicas e científicas. Selecione a sua área de especialização para começar a responder perguntas exclusivas e evoluir no ranking.
        </p>
      </div>

      {/* 7 Qualification Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {QUALIFICATIONS_LIST.map((q, index) => {
          const userStat = user.qualification_stats[q.id] || {
            points: 0,
            answered: 0,
            correct: 0,
            best_streak: 0,
            mastery_pct: 0,
            tier: 'Iniciante',
          };

          const isFeatured = q.id === 'Eletricidade Industrial';

          return (
            <div
              key={q.id}
              id={`qualification-card-${index}`}
              onClick={() => onSelectQualification(q.id)}
              className={`group relative bg-slate-900/90 hover:bg-slate-850 border rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 cursor-pointer flex flex-col justify-between overflow-hidden ${
                isFeatured
                  ? 'border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Top Accent Gradient Bar */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${q.color}`} />

              <div>
                {/* Header with Icon & Index Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 group-hover:border-amber-400/50 transition-all duration-300">
                    {q.icon}
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-amber-400 transition-colors">
                      0{index + 1}
                    </span>
                    {userStat.answered > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {userStat.mastery_pct}% Domínio
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2">
                  <span>{q.title}</span>
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed line-clamp-3">
                  {q.description}
                </p>

                {/* Subcategories preview */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-1 text-xs text-slate-400 font-semibold mb-2">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tópicos & Subcategorias:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {q.subcategories.slice(0, 3).map((sub, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-750"
                      >
                        {sub}
                      </span>
                    ))}
                    {q.subcategories.length > 3 && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        +{q.subcategories.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>

                {/* Science & Laws callout */}
                {q.sampleScientists && q.sampleScientists.length > 0 && (
                  <div className="mt-3 py-1 px-2 rounded-lg bg-amber-500/5 border border-amber-500/10 flex items-center gap-1.5 text-[11px] text-amber-300/90">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      <strong>Ciência e Leis:</strong> {q.sampleScientists.slice(0, 3).join(', ')}...
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer with Progress & Play CTA */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  <div className="flex items-center gap-1 text-slate-200 font-bold">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>{userStat.points.toLocaleString()} pts</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{userStat.answered} respondidas</span>
                </div>

                <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-200 group-hover:text-amber-300 group-hover:translate-x-1 transition-all bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 px-3.5 py-1.5 rounded-xl">
                  <span>Jogar</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Bottom Technical Guarantee */}
      <div className="mt-12 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Regra de Ineditismo Garantida</h4>
            <p className="text-xs text-slate-400">
              As perguntas respondidas por você ficam registradas no banco e nunca se repetem, garantindo progressão real e aprendizado contínuo.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
          <Flame className="w-4 h-4 text-orange-400" />
          <span>Banco expansível com milhares de questões</span>
        </div>
      </div>

    </div>
  );
};
