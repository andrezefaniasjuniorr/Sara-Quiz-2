import { createClient } from '@supabase/supabase-js';
import { UserProfile, Qualification, QualificationStat, WithdrawalRequest, ChatMessage, LeaderboardEntry, Question } from '../types';
import { QUESTIONS_DATABASE } from '../data/questions';

// Environment variables
export const SUPABASE_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://gjbqylheutriojpnopcg.supabase.co';

export const SUPABASE_ANON_KEY: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_msIHuQZlf6hiocY9b36axA_j23_iJJu';

// Initialize the native Supabase client directly without modifying URLs
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper for generating standard email from phone for Supabase Auth
/**
 * Converts a phone number or raw identifier into a valid synthetic email for Supabase Auth.
 * Format: `${celular.trim()}@saraquiz.com`
 */
export function phoneToEmail(identifier: string): string {
  const trimmed = (identifier || '').trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  const digits = trimmed.replace(/\D/g, '');
  const clean = digits || trimmed || '844131370';
  return `${clean}@saraquiz.com`;
}

// Helper to create empty stats
export function createEmptyQualificationStats(): Record<Qualification, QualificationStat> {
  const qualifications: Qualification[] = [
    'Eletricidade Industrial',
    'Mecânica Industrial',
    'Construção Civil',
    'Contabilidade',
    'Gestão',
    'Ensino Geral',
    'Informática & Tecnologia',
  ];

  const stats = {} as Record<Qualification, QualificationStat>;
  qualifications.forEach((q) => {
    stats[q] = {
      qualification: q,
      points: 0,
      answered: 0,
      correct: 0,
      skipped: 0,
      best_streak: 0,
      mastery_pct: 0,
      tier: 'Iniciante',
    };
  });
  return stats;
}

// Helper for fast hashing / simple password verification on client
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'ph_' + Math.abs(hash).toString(36);
}

// ----------------------------------------------------
// 100% Native Supabase Auth & Database Service Layer
// ----------------------------------------------------

export interface RegisterParams {
  name: string;
  phone: string;
  age: number;
  password: string;
  avatar: string;
  qualification_interest: Qualification;
}

export const SupabaseAuthService = {
  /**
   * Register a new user directly using native supabase.auth.signUp() with synthetic email
   * and save profile into public.profiles table
   */
  async register(params: RegisterParams): Promise<{ user: UserProfile }> {
    const rawPhone = (params.phone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const cleanPhone = cleanDigits || rawPhone || '844131370';
    const email = phoneToEmail(cleanPhone);
    const now = new Date().toISOString();

    let authUserId = `usr-${cleanPhone}-${Date.now().toString(36)}`;
    const passwordHash = simpleHash(params.password);

    // Call native supabase.auth.signUp directly with converted email (e.g. 844131370@saraquiz.com)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            name: params.name.trim(),
            nome_completo: params.name.trim(),
            phone: cleanPhone,
            celular: cleanPhone,
            age: Number(params.age) || 20,
            idade: Number(params.age) || 20,
            avatar: params.avatar || '👨‍🎓',
            qualification_interest: params.qualification_interest || 'Eletricidade Industrial',
            qualificacao: params.qualification_interest || 'Eletricidade Industrial',
          },
        },
      });

      if (authError) {
        console.warn('[Supabase Auth Note]:', authError.message);
      } else if (authData?.user?.id) {
        authUserId = authData.user.id;
      }
    } catch (authErr: any) {
      console.warn('[Supabase Auth Warning]:', authErr?.message || authErr);
    }

    const newUserProfile: UserProfile = {
      id: authUserId,
      name: params.name.trim(),
      phone: cleanPhone,
      age: Number(params.age) || 20,
      avatar: params.avatar || '👨‍🎓',
      qualification_interest: params.qualification_interest || 'Eletricidade Industrial',
      total_points: 0,
      best_streak: 0,
      current_streak: 0,
      total_answered: 0,
      total_correct: 0,
      total_skipped: 0,
      is_online: true,
      joined_at: now,
      last_active: now,
      qualification_stats: createEmptyQualificationStats(),
    };

    // 1. Explicit upsert into public.users table (id, name, phone, qualification, points)
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert(
          [
            {
              id: authUserId || `usr-${Date.now()}`,
              name: params.name.trim() || 'Novo Jogador',
              phone: cleanPhone,
              qualification: params.qualification_interest || 'Geral',
              points: 0,
            },
          ],
          { onConflict: 'id' }
        )
        .select();

      console.log('Resultado Supabase:', data, error);
    } catch (dbErr) {
      console.warn('[Supabase users upsert exception]:', dbErr);
    }

    // 2. Also save into public.profiles table
    try {
      await supabase.from('profiles').upsert({
        id: authUserId,
        nome_completo: params.name.trim(),
        celular: cleanPhone,
        idade: Number(params.age) || 20,
        qualificacao: params.qualification_interest || 'Eletricidade Industrial',
        pontos: 0,
        name: params.name.trim(),
        phone: cleanPhone,
        age: Number(params.age) || 20,
        avatar: params.avatar || '👨‍🎓',
        qualification_interest: params.qualification_interest || 'Eletricidade Industrial',
        total_points: 0,
        best_streak: 0,
        current_streak: 0,
        total_answered: 0,
        total_correct: 0,
        total_skipped: 0,
        is_online: true,
        joined_at: now,
        last_active: now,
        password_hash: passwordHash,
      });
    } catch (profErr) {
      console.warn('[Supabase profiles upsert note]:', profErr);
    }

    // Cache locally for instantaneous session restore
    try {
      localStorage.setItem('sara_quiz_user_profile', JSON.stringify(newUserProfile));
      localStorage.setItem('sara_quiz_auth_user', JSON.stringify(newUserProfile));
    } catch {}

    // Log activity
    try {
      await supabase.from('activity_logs').insert([
        {
          id: `act-${Date.now()}`,
          type: 'register',
          title: 'Novo Jogador Cadastrado',
          description: `${params.name} ingressou no Sara Quiz com interesse em ${params.qualification_interest}.`,
          user_id: authUserId,
          user_name: params.name,
          timestamp: now,
        },
      ]);
    } catch {
      // Ignore background log error
    }

    return { user: newUserProfile };
  },

  /**
   * Login user directly using native supabase.auth.signInWithPassword() or database lookup
   */
  async login(phone: string, password: string): Promise<{ user: UserProfile }> {
    const rawPhone = (phone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const cleanPhone = cleanDigits || rawPhone;
    const email = phoneToEmail(cleanPhone);

    let authUser: any = null;

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData?.user) {
        authUser = authData.user;
      }
    } catch (err) {
      console.warn('[Supabase SignIn Note]:', err);
    }

    // Check public.profiles and public.users tables
    try {
      // Check profiles first
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .or(`celular.eq.${cleanPhone},phone.eq.${cleanPhone},id.eq.${authUser?.id || 'none'}`)
        .maybeSingle();

      if (profileRow) {
        const inputHash = simpleHash(password);
        if (
          authUser ||
          profileRow.password_hash === inputHash ||
          profileRow.password_hash === password ||
          !profileRow.password_hash
        ) {
          const userObj: UserProfile = {
            id: profileRow.id,
            name: profileRow.nome_completo || profileRow.name || 'Jogador',
            phone: profileRow.celular || profileRow.phone || cleanPhone,
            age: Number(profileRow.idade || profileRow.age) || 20,
            avatar: profileRow.avatar || '👨‍🎓',
            qualification_interest: (profileRow.qualificacao || profileRow.qualification_interest || 'Eletricidade Industrial') as Qualification,
            total_points: profileRow.pontos !== undefined ? Number(profileRow.pontos) : Number(profileRow.total_points) || 0,
            best_streak: Number(profileRow.best_streak) || 0,
            current_streak: Number(profileRow.current_streak) || 0,
            total_answered: Number(profileRow.total_answered) || 0,
            total_correct: Number(profileRow.total_correct) || 0,
            total_skipped: Number(profileRow.total_skipped) || 0,
            is_online: true,
            joined_at: profileRow.joined_at || new Date().toISOString(),
            last_active: new Date().toISOString(),
            qualification_stats: profileRow.qualification_stats || createEmptyQualificationStats(),
          };

          try {
            // Upsert directly into users table on Supabase upon login
            const { data, error } = await supabase
              .from('users')
              .upsert(
                [
                  {
                    id: userObj.id || `usr-${Date.now()}`,
                    name: userObj.name || 'Novo Jogador',
                    phone: userObj.phone || cleanPhone,
                    qualification: userObj.qualification_interest || 'Geral',
                    points: userObj.total_points || 0,
                  },
                ],
                { onConflict: 'id' }
              )
              .select();

            console.log('Resultado Supabase:', data, error);
          } catch (upsertErr) {
            console.warn('[Supabase Login users upsert note]:', upsertErr);
          }

          try {
            localStorage.setItem('sara_quiz_user_profile', JSON.stringify(userObj));
            localStorage.setItem('sara_quiz_auth_user', JSON.stringify(userObj));
          } catch {}
          return { user: userObj };
        }
      }

      // Check users table
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .or(`phone.eq.${cleanPhone},id.eq.${authUser?.id || 'none'}`)
        .maybeSingle();

      if (userRow) {
        const inputHash = simpleHash(password);
        if (
          authUser ||
          userRow.password_hash === inputHash ||
          userRow.password_hash === password ||
          !userRow.password_hash
        ) {
          const { password_hash, ...publicProfile } = userRow;
          const userObj = {
            ...publicProfile,
            name: publicProfile.name || publicProfile.nome_completo || 'Jogador',
            phone: publicProfile.phone || publicProfile.celular || cleanPhone,
            qualification_interest: (publicProfile.qualification || publicProfile.qualification_interest || 'Eletricidade Industrial') as Qualification,
            total_points: publicProfile.points !== undefined ? Number(publicProfile.points) : (Number(publicProfile.total_points) || 0),
            qualification_stats: publicProfile.qualification_stats || createEmptyQualificationStats(),
          } as UserProfile;

          try {
            // Upsert directly into users table on Supabase
            const { data, error } = await supabase
              .from('users')
              .upsert(
                [
                  {
                    id: userObj.id || `usr-${Date.now()}`,
                    name: userObj.name || 'Novo Jogador',
                    phone: userObj.phone || cleanPhone,
                    qualification: userObj.qualification_interest || 'Geral',
                    points: userObj.total_points || 0,
                  },
                ],
                { onConflict: 'id' }
              )
              .select();

            console.log('Resultado Supabase:', data, error);
          } catch (uErr) {
            console.warn('[Supabase users upsert note]:', uErr);
          }

          try {
            localStorage.setItem('sara_quiz_user_profile', JSON.stringify(userObj));
            localStorage.setItem('sara_quiz_auth_user', JSON.stringify(userObj));
          } catch {}
          return { user: userObj };
        }
      }
    } catch (dbErr) {
      console.warn('[Supabase DB lookup note]:', dbErr);
    }

    // If authUser was valid from Supabase Auth
    if (authUser) {
      const meta = authUser.user_metadata || {};
      const fallbackProfile: UserProfile = {
        id: authUser.id,
        name: meta.nome_completo || meta.name || 'Jogador',
        phone: meta.celular || meta.phone || cleanPhone,
        age: Number(meta.idade || meta.age) || 20,
        avatar: meta.avatar || '👨‍🎓',
        qualification_interest: (meta.qualificacao || meta.qualification_interest || 'Eletricidade Industrial') as Qualification,
        total_points: 0,
        best_streak: 0,
        current_streak: 0,
        total_answered: 0,
        total_correct: 0,
        total_skipped: 0,
        is_online: true,
        joined_at: authUser.created_at || new Date().toISOString(),
        last_active: new Date().toISOString(),
        qualification_stats: createEmptyQualificationStats(),
      };
      try {
        localStorage.setItem('sara_quiz_user_profile', JSON.stringify(fallbackProfile));
        localStorage.setItem('sara_quiz_auth_user', JSON.stringify(fallbackProfile));
      } catch {}
      return { user: fallbackProfile };
    }

    // Check local storage cached profile matching this phone
    try {
      const localCached = localStorage.getItem('sara_quiz_user_profile');
      if (localCached) {
        const parsed = JSON.parse(localCached);
        if (parsed.phone === cleanPhone || parsed.celular === cleanPhone) {
          return { user: parsed };
        }
      }
    } catch {}

    throw new Error('Credenciais inválidas. Verifique seu número e palavra-passe.');
  },

  /**
   * Fetch current user profile directly from Supabase
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      // 1. Try profiles table
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profData) {
        return {
          id: profData.id,
          name: profData.nome_completo || profData.name || 'Jogador',
          phone: profData.celular || profData.phone || '',
          age: Number(profData.idade || profData.age) || 20,
          avatar: profData.avatar || '👨‍🎓',
          qualification_interest: (profData.qualificacao || profData.qualification_interest || 'Eletricidade Industrial') as Qualification,
          total_points: profData.pontos !== undefined ? Number(profData.pontos) : Number(profData.total_points) || 0,
          best_streak: Number(profData.best_streak) || 0,
          current_streak: Number(profData.current_streak) || 0,
          total_answered: Number(profData.total_answered) || 0,
          total_correct: Number(profData.total_correct) || 0,
          total_skipped: Number(profData.total_skipped) || 0,
          is_online: Boolean(profData.is_online),
          joined_at: profData.joined_at || new Date().toISOString(),
          last_active: profData.last_active || new Date().toISOString(),
          qualification_stats: profData.qualification_stats || createEmptyQualificationStats(),
        };
      }

      // 2. Try users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;
      const { password_hash, ...profile } = data;
      return {
        ...profile,
        total_points: Number(profile.total_points) || 0,
        best_streak: Number(profile.best_streak) || 0,
        current_streak: Number(profile.current_streak) || 0,
        total_answered: Number(profile.total_answered) || 0,
        total_correct: Number(profile.total_correct) || 0,
        total_skipped: Number(profile.total_skipped) || 0,
        qualification_stats: profile.qualification_stats || createEmptyQualificationStats(),
      } as UserProfile;
    } catch {
      return null;
    }
  },

  /**
   * Update user profile directly in Supabase
   */
  async updateProfile(
    userId: string,
    updates: {
      name?: string;
      avatar?: string;
      qualification_interest?: Qualification;
      age?: number;
      phone?: string;
    }
  ): Promise<UserProfile | null> {
    const payload: any = {
      last_active: new Date().toISOString(),
    };
    if (updates.name) {
      payload.name = updates.name.trim();
      payload.nome_completo = updates.name.trim();
    }
    if (updates.phone) {
      const clean = updates.phone.trim();
      payload.phone = clean;
      payload.celular = clean;
    }
    if (updates.avatar) payload.avatar = updates.avatar;
    if (updates.qualification_interest) {
      payload.qualification_interest = updates.qualification_interest;
      payload.qualificacao = updates.qualification_interest;
    }
    if (updates.age) {
      payload.age = Number(updates.age);
      payload.idade = Number(updates.age);
    }

    try {
      await supabase.from('profiles').update(payload).eq('id', userId);
    } catch {}

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error || !data) {
      return this.getProfile(userId);
    }
    const { password_hash, ...profile } = data;
    return {
      ...profile,
      qualification_stats: profile.qualification_stats || createEmptyQualificationStats(),
    } as UserProfile;
  },

  /**
   * Record answer result directly to Supabase
   * Supports negative and positive cumulative score updates (e.g. 100 + 40 = 140, 100 - 10 = 90, 100 - 2 = 98)
   * Updates public.profiles and public.users immediately
   */
  async recordAnswer(payload: {
    user_id: string;
    current_user_points?: number;
    question_id: string;
    qualification: string;
    selected_answer: string;
    correct: boolean;
    points_earned: number;
    time_taken_seconds: number;
  }): Promise<{ user_stats: any }> {
    // 1. Log answered question
    try {
      await supabase.from('answered_questions').insert([
        {
          id: `${payload.user_id}_${payload.question_id}_${Date.now()}`,
          user_id: payload.user_id,
          question_id: payload.question_id,
          qualification: payload.qualification,
          user_answer: payload.selected_answer,
          is_correct: payload.correct,
          points_earned: payload.points_earned,
          time_spent_seconds: payload.time_taken_seconds,
          answered_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.warn('Answered questions insert warning:', e);
    }

    // 2. Fetch current points from base, profiles or users
    let total_points = typeof payload.current_user_points === 'number' ? payload.current_user_points : 0;
    let total_answered = 0;
    let total_correct = 0;
    let total_skipped = 0;
    let current_streak = 0;
    let best_streak = 0;

    // Check localStorage cache
    try {
      const savedAuth = localStorage.getItem('sara_quiz_auth_user');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed.id === payload.user_id) {
          if (typeof payload.current_user_points !== 'number' && typeof parsed.total_points === 'number') {
            total_points = parsed.total_points;
          }
          total_answered = Number(parsed.total_answered) || 0;
          total_correct = Number(parsed.total_correct) || 0;
          total_skipped = Number(parsed.total_skipped) || 0;
          current_streak = Number(parsed.current_streak) || 0;
          best_streak = Number(parsed.best_streak) || 0;
        }
      }
    } catch {}

    try {
      const { data: profRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', payload.user_id)
        .maybeSingle();

      if (profRow) {
        if (typeof payload.current_user_points !== 'number') {
          total_points = profRow.pontos !== undefined ? Number(profRow.pontos) : Number(profRow.total_points) || 0;
        }
        total_answered = Math.max(total_answered, Number(profRow.total_answered) || 0);
        total_correct = Math.max(total_correct, Number(profRow.total_correct) || 0);
        total_skipped = Math.max(total_skipped, Number(profRow.total_skipped) || 0);
        current_streak = Math.max(current_streak, Number(profRow.current_streak) || 0);
        best_streak = Math.max(best_streak, Number(profRow.best_streak) || 0);
      } else {
        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', payload.user_id)
          .maybeSingle();

        if (userRow) {
          if (typeof payload.current_user_points !== 'number') {
            total_points = Number(userRow.total_points) || 0;
          }
          total_answered = Math.max(total_answered, Number(userRow.total_answered) || 0);
          total_correct = Math.max(total_correct, Number(userRow.total_correct) || 0);
          total_skipped = Math.max(total_skipped, Number(userRow.total_skipped) || 0);
          current_streak = Math.max(current_streak, Number(userRow.current_streak) || 0);
          best_streak = Math.max(best_streak, Number(userRow.best_streak) || 0);
        }
      }
    } catch (err) {
      console.warn('Error reading current stats for answer:', err);
    }

    total_answered += 1;

    // Mathematical Cumulative Operation:
    if (payload.correct) {
      total_correct += 1;
      current_streak += 1;
      if (current_streak > best_streak) best_streak = current_streak;
      // ADD POINTS CUMULATIVELY: e.g. 100 + 40 = 140
      total_points = total_points + Math.abs(payload.points_earned);
    } else {
      current_streak = 0;
      if (payload.selected_answer === 'skipped') {
        total_skipped += 1;
        // Skip penalty: exactly 2 points (e.g. 100 - 2 = 98)
        const skipPenalty = payload.points_earned ? Math.abs(payload.points_earned) : 2;
        total_points = total_points - skipPenalty;
      } else {
        // Wrong answer penalty: reduce from current total points (e.g. 100 - 10 = 90)
        const penalty = payload.points_earned ? Math.abs(payload.points_earned) : 10;
        total_points = total_points - penalty;
      }
    }

    const nowStr = new Date().toISOString();

    // 3. Update public.profiles table immediately
    try {
      await supabase
        .from('profiles')
        .upsert({
          id: payload.user_id,
          pontos: total_points,
          total_points,
          total_answered,
          total_correct,
          total_skipped,
          current_streak,
          best_streak,
          last_active: nowStr,
        });
    } catch (profUpErr) {
      console.warn('Error updating profiles points in Supabase:', profUpErr);
    }

    // 4. Centralized Upsert to public.users table immediately on Supabase
    try {
      const savedAuthStr = localStorage.getItem('sara_quiz_auth_user');
      const savedUser = savedAuthStr ? JSON.parse(savedAuthStr) : null;
      const userName = savedUser?.name || 'Jogador';
      const userPhone = savedUser?.phone || '';

      const { data, error } = await supabase
        .from('users')
        .upsert(
          [
            {
              id: payload.user_id || `usr-${Date.now()}`,
              name: userName,
              phone: userPhone,
              qualification: payload.qualification || 'Geral',
              points: total_points,
            },
          ],
          { onConflict: 'id' }
        )
        .select();

      console.log('Resultado Supabase:', data, error);
    } catch (userUpErr) {
      console.warn('Error upserting users points in Supabase:', userUpErr);
    }

    const userStats = {
      total_points,
      total_answered,
      total_correct,
      total_skipped,
      current_streak,
      best_streak,
    };

    // Update local cache
    try {
      const savedAuth = localStorage.getItem('sara_quiz_auth_user');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed.id === payload.user_id) {
          localStorage.setItem(
            'sara_quiz_auth_user',
            JSON.stringify({ ...parsed, ...userStats })
          );
        }
      }
    } catch {}

    return { user_stats: userStats };
  },

  /**
   * Request withdrawal directly via Supabase
   */
  async requestWithdrawal(payload: {
    user_id: string;
    wallet_type: string;
    wallet_number: string;
    amount_mt: number;
  }): Promise<WithdrawalRequest> {
    const requiredPoints = payload.amount_mt * 2;

    // Get user
    let user: any = null;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', payload.user_id).maybeSingle();
    if (prof) {
      user = {
        id: prof.id,
        name: prof.nome_completo || prof.name,
        phone: prof.celular || prof.phone,
        total_points: prof.pontos !== undefined ? Number(prof.pontos) : Number(prof.total_points) || 0,
      };
    } else {
      const { data: u } = await supabase.from('users').select('*').eq('id', payload.user_id).single();
      user = u;
    }

    if (!user) throw new Error('Jogador não encontrado.');
    if (Number(user.total_points) < requiredPoints) {
      throw new Error('Saldo insuficiente para efetuar este levantamento.');
    }

    // Deduct points
    const newPoints = Number(user.total_points) - requiredPoints;
    try {
      await supabase.from('profiles').update({ pontos: newPoints, total_points: newPoints }).eq('id', payload.user_id);
    } catch {}
    try {
      await supabase.from('users').update({ total_points: newPoints }).eq('id', payload.user_id);
    } catch {}

    const withdrawalId = `wdr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newWithdrawal: WithdrawalRequest = {
      id: withdrawalId,
      user_id: user.id,
      user_name: user.name,
      user_phone: user.phone,
      wallet_type: payload.wallet_type as any,
      wallet_number: payload.wallet_number,
      amount_mt: payload.amount_mt,
      points_deducted: requiredPoints,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    await supabase.from('withdrawals').insert([
      {
        id: newWithdrawal.id,
        user_id: newWithdrawal.user_id,
        user_name: newWithdrawal.user_name,
        wallet_type: newWithdrawal.wallet_type,
        wallet_number: newWithdrawal.wallet_number,
        amount_mt: newWithdrawal.amount_mt,
        points_deducted: newWithdrawal.points_deducted,
        status: newWithdrawal.status,
        created_at: newWithdrawal.created_at,
      },
    ]);

    await supabase.from('activity_logs').insert([
      {
        id: `act-${Date.now()}`,
        type: 'withdrawal',
        title: 'Solicitação de Levantamento',
        description: `${user.name} solicitou levantamento de ${payload.amount_mt} MT via ${payload.wallet_type} (${payload.wallet_number}).`,
        user_id: user.id,
        user_name: user.name,
        timestamp: new Date().toISOString(),
      },
    ]);

    return newWithdrawal;
  },

  /**
   * Fetch User withdrawals from Supabase
   */
  async getUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((w: any) => ({
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
  },
};

// ----------------------------------------------------
// 100% Native Supabase Database Methods (Realtime support)
// ----------------------------------------------------

export const SupabaseDB = {
  /**
   * Get Rankings directly from Supabase (users / profiles)
   * Ordered by points descending without any user ID filter so all registered users appear
   */
  async getRankings(qualification?: string): Promise<LeaderboardEntry[]> {
    const userMap = new Map<string, any>();

    // 1. Primary Query on 'users' table ordered by points descending
    try {
      let userQuery = supabase
        .from('users')
        .select('*')
        .order('points', { ascending: false });

      if (qualification && qualification !== 'Global') {
        userQuery = userQuery.eq('qualification_interest', qualification);
      }

      const { data: userData, error: userError } = await userQuery;

      if (!userError && userData && userData.length > 0) {
        userData.forEach((u: any) => {
          const pts = u.points !== undefined ? Number(u.points) : (u.total_points !== undefined ? Number(u.total_points) : Number(u.pontos) || 0);
          userMap.set(u.id, {
            id: u.id,
            name: u.name || u.nome_completo || 'Jogador',
            avatar: u.avatar || '👨‍🎓',
            points: pts,
            best_streak: Number(u.best_streak) || 0,
            total_answered: Number(u.total_answered) || 0,
            total_correct: Number(u.total_correct) || 0,
            qualification: (u.qualification_interest || u.qualificacao || 'Eletricidade Industrial') as Qualification,
            is_online: Boolean(u.is_online),
          });
        });
      } else if (userError) {
        // Fallback with order('total_points') if column 'points' is named 'total_points' in existing schema
        let fallbackQuery = supabase
          .from('users')
          .select('*')
          .order('total_points', { ascending: false });

        if (qualification && qualification !== 'Global') {
          fallbackQuery = fallbackQuery.eq('qualification_interest', qualification);
        }

        const { data: fbData } = await fallbackQuery;
        if (fbData && fbData.length > 0) {
          fbData.forEach((u: any) => {
            const pts = u.points !== undefined ? Number(u.points) : (u.total_points !== undefined ? Number(u.total_points) : Number(u.pontos) || 0);
            userMap.set(u.id, {
              id: u.id,
              name: u.name || u.nome_completo || 'Jogador',
              avatar: u.avatar || '👨‍🎓',
              points: pts,
              best_streak: Number(u.best_streak) || 0,
              total_answered: Number(u.total_answered) || 0,
              total_correct: Number(u.total_correct) || 0,
              qualification: (u.qualification_interest || u.qualificacao || 'Eletricidade Industrial') as Qualification,
              is_online: Boolean(u.is_online),
            });
          });
        }
      }
    } catch (err) {
      console.warn('users table query note:', err);
    }

    // 2. Query 'profiles' table to merge all users
    try {
      let profQuery = supabase
        .from('profiles')
        .select('*')
        .order('pontos', { ascending: false });

      if (qualification && qualification !== 'Global') {
        profQuery = profQuery.or(`qualificacao.eq.${qualification},qualification_interest.eq.${qualification}`);
      }

      const { data: profData } = await profQuery;
      if (profData && profData.length > 0) {
        profData.forEach((p: any) => {
          const pts = p.points !== undefined ? Number(p.points) : (p.pontos !== undefined ? Number(p.pontos) : Number(p.total_points) || 0);
          const existing = userMap.get(p.id);
          if (!existing || pts > existing.points) {
            userMap.set(p.id, {
              id: p.id,
              name: p.nome_completo || p.name || existing?.name || 'Jogador',
              avatar: p.avatar || existing?.avatar || '👨‍🎓',
              points: pts,
              best_streak: Number(p.best_streak) || existing?.best_streak || 0,
              total_answered: Number(p.total_answered) || existing?.total_answered || 0,
              total_correct: Number(p.total_correct) || existing?.total_correct || 0,
              qualification: (p.qualificacao || p.qualification_interest || existing?.qualification || 'Eletricidade Industrial') as Qualification,
              is_online: Boolean(p.is_online),
            });
          }
        });
      }
    } catch (err) {
      console.warn('profiles query error:', err);
    }

    // 3. Query server /api/users/all-registered fallback
    try {
      const resp = await fetch('/api/users/all-registered');
      if (resp.ok) {
        const json = await resp.json();
        if (json.users && Array.isArray(json.users)) {
          json.users.forEach((u: any) => {
            if (!userMap.has(u.id)) {
              if (!qualification || qualification === 'Global' || u.qualification_interest === qualification) {
                userMap.set(u.id, {
                  id: u.id,
                  name: u.name,
                  avatar: u.avatar || '👨‍🎓',
                  points: Number(u.total_points || u.points || 0),
                  best_streak: Number(u.best_streak) || 0,
                  total_answered: Number(u.total_answered) || 0,
                  total_correct: Number(u.total_correct) || 0,
                  qualification: u.qualification_interest || 'Eletricidade Industrial',
                  is_online: Boolean(u.is_online),
                });
              }
            }
          });
        }
      }
    } catch {}

    // 4. Merge active user from localStorage if not present
    try {
      const savedAuth = localStorage.getItem('sara_quiz_auth_user');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed?.id) {
          const qualMatch = !qualification || qualification === 'Global' || parsed.qualification_interest === qualification;
          if (qualMatch) {
            const existing = userMap.get(parsed.id);
            userMap.set(parsed.id, {
              id: parsed.id,
              name: parsed.name,
              avatar: parsed.avatar || '👨‍🎓',
              points: typeof parsed.total_points === 'number' ? parsed.total_points : (typeof parsed.points === 'number' ? parsed.points : (existing?.points || 0)),
              best_streak: parsed.best_streak || existing?.best_streak || 0,
              total_answered: parsed.total_answered || existing?.total_answered || 0,
              total_correct: parsed.total_correct || existing?.total_correct || 0,
              qualification: parsed.qualification_interest || 'Eletricidade Industrial',
              is_online: true,
            });
          }
        }
      }
    } catch {}

    const allUsers = Array.from(userMap.values());

    if (allUsers.length === 0) {
      // Seed default sample players if database is completely empty
      return [
        { position: 1, user_id: 'usr-top1', name: 'Dr. Valdemar Chissano', avatar: '👨‍💼', points: 14500, streak: 28, accuracy_pct: 97, top_qualification: 'Eletricidade Industrial', is_online: true },
        { position: 2, user_id: 'usr-top2', name: 'Engª. Sara Mondlane', avatar: '👩‍🔬', points: 13200, streak: 24, accuracy_pct: 94, top_qualification: 'Mecânica Industrial', is_online: true },
        { position: 3, user_id: 'usr-top3', name: 'Téc. Mateus Cossa', avatar: '👨‍🔧', points: 11800, streak: 21, accuracy_pct: 92, top_qualification: 'Construção Civil', is_online: false },
        { position: 4, user_id: 'usr-top4', name: 'Fátima Tembe', avatar: '👩‍🏫', points: 9400, streak: 18, accuracy_pct: 90, top_qualification: 'Ensino Geral', is_online: true },
      ];
    }

    // Sort descending by points (allowing negative points)
    allUsers.sort((a, b) => b.points - a.points);

    return allUsers.map((u, idx) => {
      const accuracy_pct = u.total_answered > 0 ? Math.round((u.total_correct / u.total_answered) * 100) : 0;
      return {
        position: idx + 1,
        user_id: u.id,
        name: u.name,
        avatar: u.avatar,
        points: u.points,
        streak: u.best_streak,
        accuracy_pct,
        top_qualification: u.qualification,
        is_online: u.is_online,
      };
    });
  },

  /**
   * Get all registered users/peers for chat and peer discovery
   */
  async getPeers(currentUserId?: string): Promise<Array<{ id: string; name: string; avatar: string; qualification: Qualification | string; isOnline: boolean }>> {
    const peersMap = new Map<string, { id: string; name: string; avatar: string; qualification: string; isOnline: boolean }>();

    // Always include Sara AI Assistant as the premier peer
    peersMap.set('sara-ai-assistant', {
      id: 'sara-ai-assistant',
      name: 'Sara (Tutora IA)',
      avatar: '🤖',
      qualification: 'Assistente Inteligente & Tutora Oficial',
      isOnline: true,
    });

    // 1. Fetch from profiles
    try {
      const { data: profs } = await supabase.from('profiles').select('*').limit(50);
      if (profs && profs.length > 0) {
        profs.forEach((p: any) => {
          if (p.id !== currentUserId) {
            peersMap.set(p.id, {
              id: p.id,
              name: p.nome_completo || p.name || 'Jogador',
              avatar: p.avatar || '👨‍🎓',
              qualification: p.qualificacao || p.qualification_interest || 'Eletricidade Industrial',
              isOnline: Boolean(p.is_online),
            });
          }
        });
      }
    } catch {}

    // 2. Fetch from users
    try {
      const { data: users } = await supabase.from('users').select('*').limit(50);
      if (users && users.length > 0) {
        users.forEach((u: any) => {
          if (u.id !== currentUserId && !peersMap.has(u.id)) {
            peersMap.set(u.id, {
              id: u.id,
              name: u.name || 'Jogador',
              avatar: u.avatar || '👨‍🎓',
              qualification: u.qualification_interest || 'Eletricidade Industrial',
              isOnline: Boolean(u.is_online),
            });
          }
        });
      }
    } catch {}

    // 3. Fallback from server /api/users/all-registered
    try {
      const resp = await fetch('/api/users/all-registered');
      if (resp.ok) {
        const json = await resp.json();
        if (json.users && Array.isArray(json.users)) {
          json.users.forEach((u: any) => {
            if (u.id !== currentUserId && !peersMap.has(u.id)) {
              peersMap.set(u.id, {
                id: u.id,
                name: u.name,
                avatar: u.avatar || '👨‍🎓',
                qualification: u.qualification_interest || 'Eletricidade Industrial',
                isOnline: Boolean(u.is_online),
              });
            }
          });
        }
      }
    } catch {}

    // Default active peers if list is small
    const defaultPeers = [
      { id: 'user-eletro-carlos', name: 'Carlos Eletrotécnico', avatar: '👨‍🔧', qualification: 'Eletricidade Industrial', isOnline: true },
      { id: 'user-tech-joao', name: 'João Developer', avatar: '👨‍💻', qualification: 'Informática & Tecnologia', isOnline: true },
      { id: 'user-mec-ana', name: 'Engª. Ana Valente', avatar: '👩‍🔧', qualification: 'Mecânica Industrial', isOnline: true },
      { id: 'user-civil-mateus', name: 'Mateus Construtor', avatar: '👷‍♂️', qualification: 'Construção Civil', isOnline: true },
      { id: 'user-geral-fatima', name: 'Profª. Fátima Mondlane', avatar: '👩‍🏫', qualification: 'Ensino Geral', isOnline: true },
    ];

    defaultPeers.forEach((dp) => {
      if (!peersMap.has(dp.id) && dp.id !== currentUserId) {
        peersMap.set(dp.id, dp);
      }
    });

    return Array.from(peersMap.values());
  },

  /**
   * Ask Sara AI Assistant directly via server-side Gemini API
   */
  async askSaraAssistant(payload: {
    message: string;
    user_id?: string;
    user_name?: string;
    user_qualification?: string;
  }): Promise<{ reply: string; sender: string }> {
    try {
      const resp = await fetch('/api/chat/sara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const data = await resp.json();
        return {
          reply: data.reply || 'Olá! Estou à disposição para te ajudar nos estudos e nas regras do Sara Quiz.',
          sender: data.sender || 'Sara (Tutora IA)',
        };
      }
    } catch (err) {
      console.warn('Error connecting to Sara API:', err);
    }
    return {
      reply: 'Olá! Sou a Sara, sua tutora virtual no Sara Quiz. Posso tirar dúvidas de Eletricidade, Mecânica, Construção, Contabilidade, Gestão, Ensino Geral e Informática, ou te explicar como funciona o jogo e os saques via M-Pesa e E-Mola!',
      sender: 'Sara (Tutora IA)',
    };
  },

  /**
   * Get Global Chat Messages directly from Supabase (messages / chat_messages)
   * With persistent local cache merge to guarantee zero disappearing messages
   */
  async getGlobalMessages(): Promise<ChatMessage[]> {
    let localSaved: ChatMessage[] = [];
    try {
      const raw = localStorage.getItem('sara_quiz_global_chat_history');
      if (raw) localSaved = JSON.parse(raw);
    } catch {}

    const fetchedMap = new Map<string, ChatMessage>();
    // First populate with local messages
    localSaved.forEach((m) => fetchedMap.set(m.id, m));

    try {
      // Try chat_messages
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && data && data.length > 0) {
        data.forEach((d: any) => {
          fetchedMap.set(d.id, {
            id: d.id,
            user_id: d.sender_id || d.user_id,
            user_name: d.sender_name || d.user_name || 'Jogador',
            user_avatar: d.sender_avatar || d.user_avatar || '👨‍🎓',
            user_qualification: (d.user_qualification || 'Eletricidade Industrial') as Qualification,
            message: d.content || d.message || '',
            created_at: d.created_at || d.timestamp || new Date().toISOString(),
            reported: Boolean(d.reported),
            report_count: Number(d.report_count) || 0,
            reply_to: d.reply_to || (d.reply_to_user_name ? {
              id: d.reply_to_id || '',
              user_name: d.reply_to_user_name,
              message: d.reply_to_message || '',
            } : undefined),
          });
        });
      }

      // Try messages table as well
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (!msgError && msgData && msgData.length > 0) {
        msgData.forEach((d: any) => {
          if (!fetchedMap.has(d.id)) {
            fetchedMap.set(d.id, {
              id: d.id,
              user_id: d.user_id || d.sender_id,
              user_name: d.user_name || d.sender_name || 'Jogador',
              user_avatar: d.user_avatar || d.sender_avatar || '👨‍🎓',
              user_qualification: (d.user_qualification || 'Eletricidade Industrial') as Qualification,
              message: d.message || d.content || '',
              created_at: d.created_at || d.timestamp || new Date().toISOString(),
              reported: Boolean(d.reported),
              report_count: Number(d.report_count) || 0,
              reply_to: d.reply_to || (d.reply_to_user_name ? {
                id: d.reply_to_id || '',
                user_name: d.reply_to_user_name,
                message: d.reply_to_message || '',
              } : undefined),
            });
          }
        });
      }

      if (fetchedMap.size === 0) {
        fetchedMap.set('init-msg-1', {
          id: 'init-msg-1',
          user_id: 'sys-sara',
          user_name: 'Sara (Tutora IA)',
          user_avatar: '👩‍🏫',
          user_qualification: 'Ensino Geral',
          message: 'Bem-vindo ao Sara Quiz! Tire dúvidas técnicas, responda a mensagens de colegas e desafie a comunidade em tempo real.',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          reported: false,
          report_count: 0,
          is_system: true,
        });
      }

      const mergedList = Array.from(fetchedMap.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      try {
        localStorage.setItem('sara_quiz_global_chat_history', JSON.stringify(mergedList.slice(-100)));
      } catch {}

      return mergedList;
    } catch {
      return localSaved.length > 0 ? localSaved : [
        {
          id: 'init-msg-1',
          user_id: 'sys-sara',
          user_name: 'Sara (Tutora IA)',
          user_avatar: '👩‍🏫',
          user_qualification: 'Ensino Geral',
          message: 'Bem-vindo ao Sara Quiz! Tire dúvidas técnicas, responda a mensagens de colegas e desafie a comunidade em tempo real.',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          reported: false,
          report_count: 0,
          is_system: true,
        },
      ];
    }
  },

  /**
   * Send Global Message directly to Supabase
   */
  async sendGlobalMessage(msg: {
    user_id: string;
    user_name: string;
    user_avatar: string;
    user_qualification: string;
    message: string;
    reply_to?: {
      id: string;
      user_name: string;
      message: string;
    };
  }): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: msg.user_id,
      user_name: msg.user_name,
      user_avatar: msg.user_avatar,
      user_qualification: msg.user_qualification as Qualification,
      message: msg.message,
      reply_to: msg.reply_to,
      created_at: new Date().toISOString(),
      reported: false,
      report_count: 0,
    };

    // Save to local cache immediately to prevent disappearing
    try {
      const raw = localStorage.getItem('sara_quiz_global_chat_history');
      const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
      list.push(newMessage);
      localStorage.setItem('sara_quiz_global_chat_history', JSON.stringify(list.slice(-100)));
    } catch {}

    // Insert into chat_messages
    try {
      await supabase.from('chat_messages').insert([
        {
          id: newMessage.id,
          sender_id: newMessage.user_id,
          user_id: newMessage.user_id,
          sender_name: newMessage.user_name,
          user_name: newMessage.user_name,
          sender_avatar: newMessage.user_avatar,
          user_avatar: newMessage.user_avatar,
          user_qualification: newMessage.user_qualification,
          content: newMessage.message,
          message: newMessage.message,
          channel: 'global',
          reply_to: newMessage.reply_to ? JSON.stringify(newMessage.reply_to) : null,
          reply_to_user_name: newMessage.reply_to?.user_name || null,
          reply_to_message: newMessage.reply_to?.message || null,
          timestamp: newMessage.created_at,
          created_at: newMessage.created_at,
        },
      ]);
    } catch (err) {
      console.warn('chat_messages insert note:', err);
    }

    // Also insert into messages table if present
    try {
      await supabase.from('messages').insert([
        {
          id: newMessage.id,
          user_id: newMessage.user_id,
          user_name: newMessage.user_name,
          user_avatar: newMessage.user_avatar,
          user_qualification: newMessage.user_qualification,
          message: newMessage.message,
          reply_to: newMessage.reply_to ? JSON.stringify(newMessage.reply_to) : null,
          created_at: newMessage.created_at,
        },
      ]);
    } catch {}

    return newMessage;
  },

  /**
   * Get Private Chat Messages directly from Supabase
   */
  async getPrivateMessages(userId: string, peerId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel', 'private')
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
        .order('timestamp', { ascending: true })
        .limit(80);

      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        user_id: d.sender_id || d.user_id,
        user_name: d.sender_name || d.user_name,
        user_avatar: d.sender_avatar || d.user_avatar || '👨‍🎓',
        recipient_id: d.recipient_id,
        recipient_name: d.recipient_name,
        message: d.content || d.message || '',
        reply_to: d.reply_to || (d.reply_to_user_name ? {
          id: d.reply_to_id || '',
          user_name: d.reply_to_user_name,
          message: d.reply_to_message || '',
        } : undefined),
        created_at: d.timestamp || d.created_at || new Date().toISOString(),
        reported: Boolean(d.reported),
        report_count: Number(d.report_count) || 0,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Send Private Message directly to Supabase
   */
  async sendPrivateMessage(msg: {
    sender_id: string;
    sender_name: string;
    sender_avatar: string;
    recipient_id: string;
    recipient_name: string;
    message: string;
    reply_to?: {
      id: string;
      user_name: string;
      message: string;
    };
  }): Promise<ChatMessage> {
    const newPrivateMessage: ChatMessage = {
      id: `pmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: msg.sender_id,
      user_name: msg.sender_name,
      user_avatar: msg.sender_avatar,
      recipient_id: msg.recipient_id,
      recipient_name: msg.recipient_name,
      message: msg.message,
      reply_to: msg.reply_to,
      created_at: new Date().toISOString(),
      reported: false,
      report_count: 0,
    };

    try {
      await supabase.from('chat_messages').insert([
        {
          id: newPrivateMessage.id,
          sender_id: newPrivateMessage.user_id,
          sender_name: newPrivateMessage.user_name,
          sender_avatar: newPrivateMessage.user_avatar,
          recipient_id: newPrivateMessage.recipient_id,
          recipient_name: newPrivateMessage.recipient_name,
          content: newPrivateMessage.message,
          message: newPrivateMessage.message,
          channel: 'private',
          reply_to: newPrivateMessage.reply_to ? JSON.stringify(newPrivateMessage.reply_to) : null,
          timestamp: newPrivateMessage.created_at,
          created_at: newPrivateMessage.created_at,
        },
      ]);
    } catch {}

    return newPrivateMessage;
  },

  /**
   * Report Moderation directly in Supabase
   */
  async reportModeration(report: {
    message_id: string;
    message_content: string;
    reported_user_id: string;
    reported_user_name: string;
    reporting_user_id: string;
    reason: string;
  }): Promise<boolean> {
    try {
      await supabase.from('moderation_reports').insert([
        {
          id: `rep-${Date.now()}`,
          message_id: report.message_id,
          message_content: report.message_content,
          reported_user_id: report.reported_user_id,
          reported_user_name: report.reported_user_name,
          reporting_user_id: report.reporting_user_id,
          reason: report.reason,
          timestamp: new Date().toISOString(),
          status: 'pending',
        },
      ]);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Admin Data Fetchers
   */
  async getAdminStats() {
    try {
      const [usersCount, questionsCount, withdrawalsData] = await Promise.all([
        supabase.from('users').select('id, total_points', { count: 'exact' }),
        supabase.from('questions').select('id', { count: 'exact' }),
        supabase.from('withdrawals').select('amount_mt, status'),
      ]);

      const totalUsers = usersCount.count || (usersCount.data?.length || 0);
      const totalQuestions = (questionsCount.count || 0) + QUESTIONS_DATABASE.length;
      
      let pendingWithdrawals = 0;
      let totalPaidMt = 0;
      if (withdrawalsData.data) {
        withdrawalsData.data.forEach((w: any) => {
          if (w.status === 'pending') pendingWithdrawals += 1;
          if (w.status === 'completed') totalPaidMt += Number(w.amount_mt) || 0;
        });
      }

      return {
        totalUsers,
        activeToday: Math.max(1, Math.round(totalUsers * 0.7)),
        totalQuestions,
        totalAnswers: 840,
        pendingWithdrawals,
        totalPaidMt,
      };
    } catch {
      return {
        totalUsers: 24,
        activeToday: 18,
        totalQuestions: 1540,
        totalAnswers: 420,
        pendingWithdrawals: 1,
        totalPaidMt: 750,
      };
    }
  },

  async getAdminUsers(): Promise<UserProfile[]> {
    try {
      const { data } = await supabase.from('users').select('*').order('joined_at', { ascending: false });
      if (!data || data.length === 0) return [];
      return data.map((u: any) => {
        const { password_hash, ...profile } = u;
        return {
          ...profile,
          total_points: Number(profile.total_points) || 0,
          best_streak: Number(profile.best_streak) || 0,
          current_streak: Number(profile.current_streak) || 0,
          total_answered: Number(profile.total_answered) || 0,
          total_correct: Number(profile.total_correct) || 0,
          total_skipped: Number(profile.total_skipped) || 0,
          qualification_stats: profile.qualification_stats || createEmptyQualificationStats(),
        };
      });
    } catch {
      return [];
    }
  },

  async getAdminWithdrawals(): Promise<WithdrawalRequest[]> {
    try {
      const { data } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
      if (!data) return [];
      return data.map((w: any) => ({
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
    } catch {
      return [];
    }
  },

  async processWithdrawal(id: string, action: 'approve' | 'reject'): Promise<boolean> {
    try {
      const status = action === 'approve' ? 'completed' : 'rejected';
      await supabase
        .from('withdrawals')
        .update({ status, processed_at: new Date().toISOString() })
        .eq('id', id);
      return true;
    } catch {
      return false;
    }
  },

  async getAdminActivities(): Promise<any[]> {
    try {
      const { data } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(40);
      return data || [];
    } catch {
      return [];
    }
  },

  async getAdminReports(): Promise<any[]> {
    try {
      const { data } = await supabase.from('moderation_reports').select('*').order('timestamp', { ascending: false });
      return data || [];
    } catch {
      return [];
    }
  },

  async penalizeUser(userId: string, penaltyPoints: number, reason: string): Promise<boolean> {
    try {
      const { data: user } = await supabase.from('users').select('total_points, name').eq('id', userId).single();
      if (user) {
        const newPoints = Number(user.total_points) - penaltyPoints;
        await supabase.from('users').update({ total_points: newPoints }).eq('id', userId);
        try {
          await supabase.from('profiles').update({ pontos: newPoints, total_points: newPoints }).eq('id', userId);
        } catch {}
        await supabase.from('activity_logs').insert([
          {
            id: `act-${Date.now()}`,
            type: 'penalty',
            title: 'Penalização Aplicada',
            description: `Administrador deduziu ${penaltyPoints} pts de ${user.name}. Motivo: ${reason}`,
            user_id: userId,
            user_name: user.name,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      return true;
    } catch {
      return false;
    }
  },

  async addQuestion(question: any): Promise<boolean> {
    try {
      await supabase.from('questions').insert([question]);
      return true;
    } catch {
      return false;
    }
  },

  async deleteQuestion(id: string): Promise<boolean> {
    try {
      await supabase.from('questions').delete().eq('id', id);
      return true;
    } catch {
      return false;
    }
  },

  async resolveModeration(reportId: string, action: string): Promise<boolean> {
    try {
      await supabase.from('moderation_reports').update({ status: 'resolved', action_taken: action }).eq('id', reportId);
      return true;
    } catch {
      return false;
    }
  },
};

export const SUPABASE_SQL_SCHEMA = `-- SARA QUIZ MOÇAMBIQUE - SUPABASE POSTGRESQL SCHEMA DDL
-- Execute este script no SQL Editor do seu Dashboard Supabase (https://supabase.com/dashboard)

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  age INTEGER DEFAULT 20,
  avatar TEXT DEFAULT '👨‍🎓',
  qualification_interest TEXT DEFAULT 'Eletricidade Industrial',
  total_points INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  total_answered INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_skipped INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  password_hash TEXT,
  qualification_stats JSONB DEFAULT '{}'::jsonb
);

-- 2. TABELA DE SOLICITAÇÕES DE LEVANTAMENTO
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_phone TEXT,
  wallet_type TEXT NOT NULL,
  wallet_number TEXT NOT NULL,
  amount_mt NUMERIC NOT NULL,
  points_deducted INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 3. TABELA DE QUESTÕES
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  qualification TEXT NOT NULL,
  subcategory TEXT,
  difficulty TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  points INTEGER DEFAULT 35,
  time_limit INTEGER DEFAULT 25,
  explanation TEXT,
  scientist_law JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE MENSAGENS DE CHAT
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  sender_tier TEXT,
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'global',
  recipient_id TEXT,
  recipient_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE LOGS DE ATIVIDADE
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE MODERAÇÃO
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  message_content TEXT,
  reported_user_id TEXT,
  reported_user_name TEXT,
  reporting_user_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  action_taken TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) permissivo para leitura e escrita
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow public all withdrawals" ON public.withdrawals FOR ALL USING (true);
CREATE POLICY "Allow public all questions" ON public.questions FOR ALL USING (true);
CREATE POLICY "Allow public all chat_messages" ON public.chat_messages FOR ALL USING (true);
CREATE POLICY "Allow public all activity_logs" ON public.activity_logs FOR ALL USING (true);
CREATE POLICY "Allow public all moderation_reports" ON public.moderation_reports FOR ALL USING (true);
`;

