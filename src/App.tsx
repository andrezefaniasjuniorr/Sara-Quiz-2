import React, { useState, useEffect } from 'react';
import { Qualification, GameMode, UserProfile } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { QualificationPicker } from './components/QualificationPicker';
import { GameModeSelector } from './components/GameModeSelector';
import { QuizArena } from './components/QuizArena';
import { LeaderboardView } from './components/LeaderboardView';
import { ChatView } from './components/ChatView';
import { ProfileView } from './components/ProfileView';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { SupabaseAuthService, supabase, handleUserRegistration } from './lib/supabase';

export function App() {
  const [currentTab, setCurrentTab] = useState<
    'qualifications' | 'modes' | 'game' | 'rankings' | 'chat' | 'profile' | 'admin'
  >('qualifications');
  const [selectedQualification, setSelectedQualification] = useState<Qualification | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode>('classico');
  const [onlineCount, setOnlineCount] = useState(48);

  // Authenticated User State
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('sara_quiz_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(!user);
  const [authInitialTab, setAuthInitialTab] = useState<'register' | 'login'>('register');

  // Keep localStorage & Supabase in sync with user state
  useEffect(() => {
    if (user) {
      localStorage.setItem('sara_quiz_auth_user', JSON.stringify(user));
      setIsAuthModalOpen(false);

      // Force synchronous/direct upsert to Supabase users table
      handleUserRegistration({
        id: user.id || `usr-${Date.now()}`,
        name: user.name || 'Novo Jogador',
        phone: user.phone || null,
        qualification: user.qualification_interest || 'Geral',
        points: user.total_points || 0,
      });
    } else {
      localStorage.removeItem('sara_quiz_auth_user');
      setIsAuthModalOpen(true);
    }
  }, [user?.id, user?.name, user?.total_points]);

  // Refresh user data directly from Supabase
  const refreshUserData = async () => {
    if (!user?.id) return;
    try {
      const refreshed = await SupabaseAuthService.getProfile(user.id);
      if (refreshed) {
        setUser(refreshed);
      }
    } catch (err) {
      console.error('Error refreshing user data from Supabase:', err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      refreshUserData();
    }
  }, [user?.id]);

  // Online count simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount((prev) => Math.max(35, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenAuth = (tab: 'register' | 'login' = 'register') => {
    setAuthInitialTab(tab);
    setIsAuthModalOpen(true);
  };

  const handleLoginSuccess = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsAuthModalOpen(false);
    if (authenticatedUser.qualification_interest) {
      setSelectedQualification(authenticatedUser.qualification_interest);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuthInitialTab('login');
    setIsAuthModalOpen(true);
    setCurrentTab('qualifications');
  };

  // Navigation handlers
  const handleSelectQualification = (qual: Qualification) => {
    setSelectedQualification(qual);
    setCurrentTab('modes');
  };

  const handleSelectMode = (mode: GameMode) => {
    setSelectedMode(mode);
    setCurrentTab('game');
  };

  const handleExitQuiz = () => {
    setCurrentTab('qualifications');
    refreshUserData();
  };

  const handleAnswerRecorded = (userStats: any) => {
    if (!userStats || !user) return;
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev };
      updated.total_points = userStats.total_points;
      updated.current_streak = userStats.current_streak;
      updated.best_streak = userStats.best_streak;
      updated.total_answered = userStats.total_answered;
      updated.total_correct = userStats.total_correct;
      updated.total_skipped = userStats.total_skipped;

      if (userStats.qualification_stat && selectedQualification) {
        if (!updated.qualification_stats) updated.qualification_stats = {} as any;
        updated.qualification_stats[selectedQualification] = userStats.qualification_stat;
      }
      return updated;
    });
  };

  const handleUpdateProfile = async (updated: { 
    name?: string; 
    avatar?: string; 
    qualification_interest?: Qualification;
    age?: number;
    phone?: string;
  }) => {
    if (!user) return;
    try {
      const updatedUser = await SupabaseAuthService.updateProfile(user.id, updated);
      if (updatedUser) {
        setUser(updatedUser);
      }
    } catch (err) {
      console.error('Error updating profile with Supabase:', err);
    }
  };

  const handleSelectQualificationFromOtherTab = (qual: Qualification) => {
    setSelectedQualification(qual);
    setCurrentTab('modes');
  };

  // Render fallback shell while auth modal is active and no user
  const effectiveUser: UserProfile = user || {
    id: 'guest',
    name: 'Convidado',
    phone: '',
    age: 20,
    avatar: '👨‍🎓',
    qualification_interest: 'Eletricidade Industrial',
    total_points: 0,
    best_streak: 0,
    current_streak: 0,
    total_answered: 0,
    total_correct: 0,
    total_skipped: 0,
    is_online: false,
    joined_at: new Date().toISOString(),
    qualification_stats: {} as any,
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-tech-grid bg-radial-ambient text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
      
      {/* Interactive Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulseGlow"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulseGlow"></div>

      {/* Auth Modal */}
      <AuthModal
        key={authInitialTab}
        isOpen={isAuthModalOpen || !user}
        onLoginSuccess={handleLoginSuccess}
        canDismiss={!!user}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authInitialTab}
      />

      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        selectedQualification={selectedQualification}
        user={effectiveUser}
        onlinePlayersCount={onlineCount}
        onOpenAuth={handleOpenAuth}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {currentTab === 'qualifications' && (
          <QualificationPicker
            onSelectQualification={handleSelectQualification}
            user={effectiveUser}
          />
        )}

        {currentTab === 'modes' && selectedQualification && (
          <GameModeSelector
            qualification={selectedQualification}
            onBack={() => setCurrentTab('qualifications')}
            onSelectMode={handleSelectMode}
            user={effectiveUser}
          />
        )}

        {currentTab === 'game' && selectedQualification && user && (
          <QuizArena
            qualification={selectedQualification}
            mode={selectedMode}
            user={user}
            onExit={handleExitQuiz}
            onAnswerRecorded={handleAnswerRecorded}
          />
        )}

        {currentTab === 'rankings' && (
          <LeaderboardView
            initialQualification={selectedQualification || 'Global'}
            onSelectQualificationToPlay={handleSelectQualificationFromOtherTab}
          />
        )}

        {currentTab === 'chat' && user && <ChatView user={user} />}

        {currentTab === 'profile' && user && (
          <ProfileView
            user={user}
            onUpdateProfile={handleUpdateProfile}
            onSelectQualificationToPlay={handleSelectQualificationFromOtherTab}
            onLogout={handleLogout}
            onUserRefresh={refreshUserData}
          />
        )}

        {currentTab === 'admin' && <AdminPanel />}
      </main>

      {/* Footer strictly adhering to creator identifier constraint */}
      <Footer />

    </div>
  );
}

export default App;
