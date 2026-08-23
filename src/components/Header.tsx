import React from 'react';
import { Qualification, UserProfile } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { Trophy, MessageSquare, User, Shield, Flame, Zap, Award, UserPlus, LogIn, LogOut } from 'lucide-react';

interface HeaderProps {
  currentTab: 'qualifications' | 'modes' | 'game' | 'rankings' | 'chat' | 'profile' | 'admin';
  setCurrentTab: (tab: 'qualifications' | 'modes' | 'game' | 'rankings' | 'chat' | 'profile' | 'admin') => void;
  selectedQualification: Qualification | null;
  user: UserProfile;
  onlinePlayersCount: number;
  onOpenAuth?: (tab?: 'register' | 'login') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  selectedQualification,
  user,
  onlinePlayersCount,
  onOpenAuth,
}) => {
  const currentQualMeta = QUALIFICATIONS_LIST.find((q) => q.id === selectedQualification);
  const isGuest = !user || user.id === 'guest' || !user.phone;

  return (
    <header id="app-header" className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Logo & Active Qualification Indicator */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('qualifications')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl tracking-wider">
              SQ
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-white bg-clip-text">
                  Sara Quiz
                </span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Moçambique
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {selectedQualification ? (
                  <span className="text-amber-400 flex items-center gap-1 font-semibold">
                    <span>{currentQualMeta?.icon}</span> {selectedQualification}
                  </span>
                ) : (
                  'Qualificações & Ciência'
                )}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <button
              id="nav-qualifications"
              onClick={() => setCurrentTab('qualifications')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'qualifications' || currentTab === 'modes' || currentTab === 'game'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Qualificações</span>
            </button>

            <button
              id="nav-rankings"
              onClick={() => setCurrentTab('rankings')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'rankings'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Rankings</span>
            </button>

            <button
              id="nav-chat"
              onClick={() => setCurrentTab('chat')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 relative ${
                currentTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat Global</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </button>

            <button
              id="nav-profile"
              onClick={() => setCurrentTab('profile')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                currentTab === 'profile'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Perfil</span>
            </button>

            <button
              id="nav-admin"
              onClick={() => setCurrentTab('admin')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentTab === 'admin'
                  ? 'bg-slate-700 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </nav>

          {/* User Status / Auth Quick Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Online pill */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium">{onlinePlayersCount} online</span>
            </div>

            {isGuest ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => onOpenAuth?.('register')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Criar Conta</span>
                  <span className="sm:hidden">Cadastro</span>
                </button>
                <button
                  onClick={() => onOpenAuth?.('login')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                </button>
              </div>
            ) : (
              /* Streak & Points */
              <div 
                id="user-quick-profile-badge"
                onClick={() => setCurrentTab('profile')}
                className="flex items-center space-x-2.5 bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 rounded-xl px-2.5 sm:px-3 py-1.5 cursor-pointer transition-all shadow-sm"
              >
                <div className="text-lg sm:text-xl select-none">{user.avatar}</div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 leading-tight">
                    <span className="truncate max-w-[80px] sm:max-w-[110px]">{user.name}</span>
                    {user.current_streak > 0 && (
                      <span className="flex items-center text-orange-400 font-extrabold text-[11px]">
                        <Flame className="w-3.5 h-3.5 fill-orange-500" />
                        {user.current_streak}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
                    <span className={`flex items-center gap-0.5 ${user.total_points < 0 ? 'text-rose-400 font-bold' : 'text-amber-400'}`}>
                      <Award className="w-3 h-3" />
                      <span>{user.total_points.toLocaleString()} pts</span>
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-emerald-400 font-mono">
                      {(user.total_points / 2).toLocaleString()} MT
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-1.5 border-t border-slate-800/80 text-[11px]">
          <button
            onClick={() => setCurrentTab('qualifications')}
            className={`py-1 px-1.5 rounded-md font-semibold flex flex-col items-center gap-0.5 ${
              currentTab === 'qualifications' || currentTab === 'modes' || currentTab === 'game' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Matérias</span>
          </button>
          
          <button
            onClick={() => setCurrentTab('rankings')}
            className={`py-1 px-1.5 rounded-md font-semibold flex flex-col items-center gap-0.5 ${
              currentTab === 'rankings' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Rankings</span>
          </button>

          <button
            onClick={() => setCurrentTab('chat')}
            className={`py-1 px-1.5 rounded-md font-semibold flex flex-col items-center gap-0.5 ${
              currentTab === 'chat' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat</span>
          </button>

          {isGuest ? (
            <>
              <button
                onClick={() => onOpenAuth?.('register')}
                className="py-1 px-2 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex flex-col items-center gap-0.5 border border-amber-500/30"
              >
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Criar Conta</span>
              </button>
              <button
                onClick={() => onOpenAuth?.('login')}
                className="py-1 px-2 rounded-lg bg-slate-800 text-slate-300 font-bold flex flex-col items-center gap-0.5 border border-slate-700"
              >
                <LogIn className="w-4 h-4 text-slate-300" />
                <span>Entrar</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCurrentTab('profile')}
                className={`py-1 px-1.5 rounded-md font-semibold flex flex-col items-center gap-0.5 ${
                  currentTab === 'profile' ? 'text-amber-400 font-bold' : 'text-slate-400'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Perfil</span>
              </button>
              <button
                onClick={() => setCurrentTab('admin')}
                className={`py-1 px-1.5 rounded-md font-semibold flex flex-col items-center gap-0.5 ${
                  currentTab === 'admin' ? 'text-amber-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
