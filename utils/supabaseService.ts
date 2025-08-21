import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DailyQuiz {
  id: string;
  date: string;
  questions: DailyQuizQuestion[];
  total_points: number;
  difficulty_distribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  subjects_covered: string[];
  generated_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface DailyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  subject: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  exam_relevance?: string;
}

export interface BattleRoom {
  id: string;
  name: string;
  host_id: string;
  topic_id?: string;
  subject_name?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  bet_amount: number;
  max_participants: number;
  current_participants: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  questions?: any[];
  room_code?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  winner_id?: string;
  time_limit: number;
}

export class SupabaseService {
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { user: data.user, error };
    } catch (error) {
      console.error('Error signing in:', error);
      return { user: null, error };
    }
  }

  static async signUp(email: string, password: string, fullName: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      // Create profile using edge function
      if (data.user) {
        await supabase.functions.invoke('create-user-profile', {
          body: {
            userId: data.user.id,
            email: data.user.email,
            fullName,
          },
        });
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error signing up:', error);
      return { user: null, error };
    }
  }

  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  static async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  }

  static async updateProfile(userId: string, updates: any) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  static async getUserStats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Create default stats if none exist
      if (!data) {
        const { data: newStats, error: createError } = await supabase
          .from('user_stats')
          .insert({
            user_id: userId,
            total_xp: 0,
            current_level: 1,
            missions_completed: 0,
            streak_days: 0,
            rank: 'Beginner',
            total_study_time: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        return newStats;
      }

      return data;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  static async ensureTodayQuiz(): Promise<DailyQuiz | null> {
    try {
      console.log('🔍 Ensuring today\'s quiz exists...');
      
      // Get current date in Indian timezone
      const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
      const today = new Date(indianTime).toISOString().split('T')[0];
      
      console.log('📅 Today\'s date (IST):', today);

      // Check if quiz already exists for today
      const { data: existingQuiz, error: checkError } = await supabase
        .from('daily_quizzes')
        .select('*')
        .eq('date', today)
        .eq('is_active', true)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking existing quiz:', checkError);
      }

      if (existingQuiz && existingQuiz.questions && Array.isArray(existingQuiz.questions) && existingQuiz.questions.length > 0) {
        console.log('✅ Found existing quiz with', existingQuiz.questions.length, 'questions');
        return existingQuiz;
      }

      console.log('🤖 No valid quiz found, generating new one...');

      // Generate new quiz using edge function
      const { data: generatedQuiz, error: generateError } = await supabase.functions.invoke('daily-quiz-generator', {
        body: { 
          force: true,
          date: today 
        }
      });

      if (generateError) {
        console.error('❌ Edge function error:', generateError);
        throw new Error(`Quiz generation failed: ${generateError.message}`);
      }

      if (!generatedQuiz || !generatedQuiz.success) {
        console.error('❌ Quiz generation failed:', generatedQuiz);
        throw new Error(generatedQuiz?.error || 'Quiz generation failed');
      }

      console.log('✅ Quiz generated successfully:', {
        questionsCount: generatedQuiz.quiz?.questions?.length || 0,
        method: generatedQuiz.generation_method
      });

      return generatedQuiz.quiz;
    } catch (error) {
      console.error('❌ Error ensuring today\'s quiz:', error);
      throw error;
    }
  }

  static async submitDailyQuiz(quizId: string, answers: number[], timeSpent: number) {
    try {
      console.log('📤 Submitting daily quiz:', { quizId, answersLength: answers.length, timeSpent });

      const { data, error } = await supabase.functions.invoke('submit-daily-quiz', {
        body: {
          daily_quiz_id: quizId,
          answers,
          time_spent: timeSpent
        }
      });

      if (error) {
        console.error('❌ Submit quiz error:', error);
        throw new Error(error.message || 'Failed to submit quiz');
      }

      console.log('✅ Quiz submitted successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error submitting daily quiz:', error);
      throw error;
    }
  }

  static async checkUserLimits(userId: string) {
    try {
      // Check user subscription
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .single();

      const isPremium = !!subscription;

      // Check today's usage
      const today = new Date().toISOString().split('T')[0];
      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      const dailyQuizzesTaken = usage?.daily_quizzes_taken || 0;
      const aiGenerationsUsed = usage?.ai_generations_used || 0;

      return {
        isPremium,
        dailyLimit: isPremium ? -1 : 3,
        dailyQuizzesTaken,
        remaining: isPremium ? 999 : Math.max(0, 3 - dailyQuizzesTaken),
        canTakeQuiz: isPremium || dailyQuizzesTaken < 3,
        aiGenerationsUsed,
        dailyAiLimit: isPremium ? -1 : 5,
        canUseAI: isPremium || aiGenerationsUsed < 5,
      };
    } catch (error) {
      console.error('Error checking user limits:', error);
      // Return permissive defaults on error
      return {
        isPremium: false,
        dailyLimit: 3,
        dailyQuizzesTaken: 0,
        remaining: 3,
        canTakeQuiz: true,
        aiGenerationsUsed: 0,
        dailyAiLimit: 5,
        canUseAI: true,
      };
    }
  }

  static async getIndianSubjects() {
    try {
      const { data, error } = await supabase
        .from('indian_subjects')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting Indian subjects:', error);
      return [];
    }
  }

  static async getSubjectTopics(subjectId: string) {
    try {
      const { data, error } = await supabase
        .from('subject_topics')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting subject topics:', error);
      return [];
    }
  }

  static async getTopicQuestions(topicId: string) {
    try {
      const { data, error } = await supabase
        .from('topic_questions')
        .select('*')
        .eq('topic_id', topicId)
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting topic questions:', error);
      return [];
    }
  }

  static async generateTopicQuiz(topicName: string, subjectName: string, difficulty: string, questionCount: number) {
    try {
      console.log('🎯 Generating topic quiz:', { topicName, subjectName, difficulty, questionCount });

      const { data, error } = await supabase.functions.invoke('topic-quiz-generator', {
        body: {
          topic_name: topicName,
          subject_name: subjectName,
          difficulty,
          question_count: questionCount
        }
      });

      if (error) {
        console.error('❌ Topic quiz generation error:', error);
        throw new Error(error.message || 'Failed to generate topic quiz');
      }

      console.log('✅ Topic quiz generated:', data);
      return data;
    } catch (error) {
      console.error('❌ Error generating topic quiz:', error);
      throw error;
    }
  }

  static async updateTopicProgress(progressData: any) {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('update-quiz-progress', {
        body: {
          userId: user.id,
          quiz_type: 'subject',
          ...progressData
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating topic progress:', error);
      throw error;
    }
  }

  static async getLeaderboard(type: 'global' | 'weekly' | 'friends' | 'local') {
    try {
      // Get top users based on total XP
      const { data, error } = await supabase
        .from('user_stats')
        .select(`
          *,
          profiles (
            id,
            full_name,
            avatar_url
          )
        `)
        .order('total_xp', { ascending: false })
        .limit(50);

      if (error) throw error;

      const currentUser = await this.getCurrentUser();
      
      return (data || []).map((stat, index) => ({
        id: stat.profiles?.id || stat.user_id,
        full_name: stat.profiles?.full_name || 'Anonymous',
        avatar_url: stat.profiles?.avatar_url,
        total_xp: stat.total_xp || 0,
        current_level: stat.current_level || 1,
        streak_days: stat.streak_days || 0,
        rank: index + 1,
        location: 'India', // Default location
        is_current_user: stat.user_id === currentUser?.id,
        status: 'online' as const,
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  static async getUserCoins(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_coins')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Create default coins for new user
        const { data: newCoins, error: createError } = await supabase
          .from('user_coins')
          .insert({
            user_id: userId,
            balance: 5000,
            total_earned: 5000,
            total_spent: 0
          })
          .select()
          .single();

        if (createError) throw createError;
        return newCoins;
      }

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user coins:', error);
      return { balance: 5000, total_earned: 5000, total_spent: 0 };
    }
  }

  static async getBattleRooms() {
    try {
      const { data, error } = await supabase
        .from('battle_rooms')
        .select(`
          *,
          profiles!battle_rooms_host_id_fkey (
            full_name
          ),
          battle_participants (
            user_id,
            profiles (
              full_name
            )
          )
        `)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting battle rooms:', error);
      return [];
    }
  }

  static async createBattleRoom(roomData: any) {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('battle-operations', {
        body: {
          action: 'create_battle_room',
          ...roomData,
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating battle room:', error);
      throw error;
    }
  }

  static async joinBattleRoom(roomCode: string) {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('battle-operations', {
        body: {
          action: 'join_battle_room',
          room_code: roomCode,
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error joining battle room:', error);
      throw error;
    }
  }

  static async findOrCreateQuickBattle(battleConfig: any) {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('battle-operations', {
        body: {
          action: 'find_or_create_battle',
          ...battleConfig,
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error finding/creating quick battle:', error);
      throw error;
    }
  }

  static async getBattleRoomDetails(roomId: string) {
    try {
      const { data: room, error: roomError } = await supabase
        .from('battle_rooms')
        .select(`
          *,
          profiles!battle_rooms_host_id_fkey (
            full_name
          )
        `)
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      const { data: participants, error: participantsError } = await supabase
        .from('battle_participants')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('battle_room_id', roomId)
        .order('joined_at');

      if (participantsError) throw participantsError;

      return {
        room,
        participants: participants || []
      };
    } catch (error) {
      console.error('Error getting battle room details:', error);
      throw error;
    }
  }

  static async submitBattleAnswer(battleRoomId: string, questionIndex: number, selectedAnswer: number, timeTaken: number) {
    try {
      const { data, error } = await supabase.functions.invoke('battle-operations', {
        body: {
          action: 'submit_answer',
          battle_room_id: battleRoomId,
          question_index: questionIndex,
          selected_answer: selectedAnswer,
          time_taken: timeTaken,
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error submitting battle answer:', error);
      throw error;
    }
  }

  static async completeBattle(battleRoomId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('battle-operations', {
        body: {
          action: 'complete_battle',
          battle_room_id: battleRoomId,
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error completing battle:', error);
      throw error;
    }
  }

  static async makeBattleRequest(action: string, params: any = {}) {
    try {
      const { data, error } = await supabase.functions.invoke('battle-operations', {
        body: {
          action,
          ...params,
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error with battle action ${action}:`, error);
      throw error;
    }
  }

  static async createMission(missionData: any) {
    try {
      console.log('🚀 Creating mission:', missionData);

      const { data, error } = await supabase.functions.invoke('create-mission', {
        body: missionData
      });

      if (error) {
        console.error('❌ Create mission error:', error);
        throw new Error(error.message || 'Failed to create mission');
      }

      if (!data || !data.success) {
        console.error('❌ Mission creation failed:', data);
        throw new Error(data?.error || 'Mission creation failed');
      }

      console.log('✅ Mission created successfully:', data.mission);
      return data.mission;
    } catch (error) {
      console.error('❌ Error creating mission:', error);
      throw error;
    }
  }

  static async getMissionContent(missionId: string, roomType?: string) {
    try {
      const { data, error } = await supabase.functions.invoke('get-mission-content', {
        body: {
          mission_id: missionId,
          room_type: roomType
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting mission content:', error);
      throw error;
    }
  }

  static async updateProgress(progressData: any) {
    try {
      const { data, error } = await supabase.functions.invoke('update-progress', {
        body: progressData
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  }

  static async trackUserActivity(userId: string, activityType: string, metadata: any = {}) {
    try {
      // Simple activity tracking - could be expanded
      console.log('📊 Tracking activity:', { userId, activityType, metadata });
      return { success: true };
    } catch (error) {
      console.error('Error tracking activity:', error);
      return { success: false };
    }
  }

  static async callEdgeFunction(functionName: string, params: any) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: params
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error calling edge function ${functionName}:`, error);
      throw error;
    }
  }

  static async getSubjectProgress(userId: string, subjectId: string) {
    try {
      const { data, error } = await supabase
        .from('user_topic_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('topic_id', subjectId);

      if (error) throw error;

      const progress = data || [];
      const totalAttempted = progress.length;
      const averageScore = totalAttempted > 0 
        ? Math.round(progress.reduce((sum, p) => sum + (p.best_score || 0), 0) / totalAttempted)
        : 0;

      return {
        topics_attempted: totalAttempted,
        average_score: averageScore,
        proficiency_level: averageScore >= 80 ? 'advanced' : averageScore >= 60 ? 'intermediate' : 'beginner'
      };
    } catch (error) {
      console.error('Error getting subject progress:', error);
      return {
        topics_attempted: 0,
        average_score: 0,
        proficiency_level: 'beginner'
      };
    }
  }

  static async getAllAchievements() {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting achievements:', error);
      return [];
    }
  }

  static async getUserAchievements(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return [];
    }
  }

  static async getSubscriptionPlans() {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      return [];
    }
  }

  static async getAdminStats() {
    try {
      const [usersResult, questionsResult, subjectsResult, topicsResult] = await Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('topic_questions').select('id', { count: 'exact', head: true }),
        supabase.from('indian_subjects').select('id', { count: 'exact', head: true }),
        supabase.from('subject_topics').select('id', { count: 'exact', head: true }),
      ]);

      return {
        totalUsers: usersResult.status === 'fulfilled' ? usersResult.value.count || 0 : 0,
        totalQuestions: questionsResult.status === 'fulfilled' ? questionsResult.value.count || 0 : 0,
        totalSubjects: subjectsResult.status === 'fulfilled' ? subjectsResult.value.count || 0 : 0,
        totalTopics: topicsResult.status === 'fulfilled' ? topicsResult.value.count || 0 : 0,
        questionsPerTopic: {},
        lastGenerated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      return {
        totalUsers: 0,
        totalQuestions: 0,
        totalSubjects: 0,
        totalTopics: 0,
        questionsPerTopic: {},
        lastGenerated: new Date().toISOString(),
      };
    }
  }

  static async regenerateAllTopicQuestions(progressCallback?: (progress: number, topic: string) => void) {
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-topic-questions', {
        body: {}
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error regenerating all questions:', error);
      throw error;
    }
  }

  static async regenerateSubjectQuestions(subjectName: string) {
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-topic-questions', {
        body: {
          subject_name: subjectName
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error regenerating subject questions:', error);
      throw error;
    }
  }

  static async validateDailyQuiz() {
    try {
      const { data, error } = await supabase.functions.invoke('validate-daily-quiz', {
        body: {}
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error validating daily quiz:', error);
      throw error;
    }
  }

  // Real-time subscriptions for battle system
  static subscribeToBattleRoom(roomId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`battle_room_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_participants',
        filter: `battle_room_id=eq.${roomId}`
      }, callback)
      .subscribe();
  }

  static subscribeToBattleUpdates(roomId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`battle_updates_${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battle_rooms',
        filter: `id=eq.${roomId}`
      }, callback)
      .subscribe();
  }
}

export const supabaseService = SupabaseService;