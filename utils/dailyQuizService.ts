import { supabase } from './supabaseService';

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

export interface DailyQuizSession {
  id: string;
  quiz_date: string;
  questions: DailyQuizQuestion[];
  total_questions: number;
  total_points: number;
  difficulty_distribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  subjects_covered: string[];
}

export interface QuizLimits {
  can_attempt: boolean;
  remaining_attempts: number;
  is_premium: boolean;
  daily_limit: number;
  attempts_today: number;
}

export interface QuizResult {
  attempt_id: string;
  correct_answers: number;
  total_questions: number;
  score_percentage: number;
  total_points: number;
  xp_earned: number;
  time_spent: number;
}

export class DailyQuizService {
  /**
   * Get today's quiz session with questions
   */
  static async getTodayQuiz(): Promise<DailyQuizSession | null> {
    try {
      console.log('📅 Getting today\'s quiz...');
      
      // First, ensure today's session exists
      const { data: sessionId, error: sessionError } = await supabase
        .rpc('create_daily_quiz_session');
      
      if (sessionError) {
        console.error('❌ Error creating session:', sessionError);
        throw sessionError;
      }
      
      console.log('✅ Session ID:', sessionId);
      
      // Get the session with questions
      const { data: session, error: getError } = await supabase
        .from('daily_quiz_sessions')
        .select('*')
        .eq('quiz_date', new Date().toISOString().split('T')[0])
        .single();
      
      if (getError) {
        console.error('❌ Error getting session:', getError);
        throw getError;
      }
      
      if (!session || !session.selected_questions) {
        throw new Error('No quiz session found');
      }
      
      console.log('📋 Session found with', session.selected_questions.length, 'questions');
      
      // Get the actual questions
      const { data: questions, error: questionsError } = await supabase
        .from('daily_quiz_questions')
        .select('*')
        .in('id', session.selected_questions)
        .eq('is_active', true);
      
      if (questionsError) {
        console.error('❌ Error getting questions:', questionsError);
        throw questionsError;
      }
      
      if (!questions || questions.length === 0) {
        throw new Error('No questions found for today\'s quiz');
      }
      
      console.log('✅ Found', questions.length, 'questions');
      
      // Sort questions by the order in selected_questions array
      const sortedQuestions = session.selected_questions.map(id => 
        questions.find(q => q.id === id)
      ).filter(Boolean);
      
      // Convert to expected format
      const formattedQuestions: DailyQuizQuestion[] = sortedQuestions.map(q => ({
        id: q.id,
        question: q.question,
        options: [q.option_a, q.option_b, q.option_c, q.option_d],
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        subject: q.subject,
        subtopic: q.subtopic || q.subject,
        difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
        points: q.points,
        exam_relevance: q.exam_relevance,
      }));
      
      return {
        id: session.id,
        quiz_date: session.quiz_date,
        questions: formattedQuestions,
        total_questions: session.total_questions,
        total_points: session.total_points,
        difficulty_distribution: session.difficulty_distribution as any,
        subjects_covered: session.subjects_covered,
      };
      
    } catch (error) {
      console.error('❌ Error in getTodayQuiz:', error);
      return null;
    }
  }

  /**
   * Check if user can take today's quiz
   */
  static async checkUserLimits(userId: string): Promise<QuizLimits> {
    try {
      const { data, error } = await supabase
        .rpc('check_user_quiz_limit', { p_user_id: userId });
      
      if (error) {
        console.error('❌ Error checking limits:', error);
        // Return permissive defaults on error
        return {
          can_attempt: true,
          remaining_attempts: 1,
          is_premium: false,
          daily_limit: 1,
          attempts_today: 0,
        };
      }
      
      return data as QuizLimits;
    } catch (error) {
      console.error('❌ Error in checkUserLimits:', error);
      // Return permissive defaults on error
      return {
        can_attempt: true,
        remaining_attempts: 1,
        is_premium: false,
        daily_limit: 1,
        attempts_today: 0,
      };
    }
  }

  /**
   * Submit quiz attempt
   */
  static async submitQuizAttempt(
    userId: string, 
    answers: number[], 
    timeSpent: number
  ): Promise<QuizResult> {
    try {
      console.log('📤 Submitting quiz attempt:', { userId, answersLength: answers.length, timeSpent });
      
      const { data, error } = await supabase
        .rpc('submit_daily_quiz_attempt', {
          p_user_id: userId,
          p_answers: answers,
          p_time_spent: timeSpent
        });
      
      if (error) {
        console.error('❌ Error submitting attempt:', error);
        throw error;
      }
      
      console.log('✅ Quiz submitted successfully:', data);
      return data as QuizResult;
    } catch (error) {
      console.error('❌ Error in submitQuizAttempt:', error);
      throw error;
    }
  }

  /**
   * Get user's quiz history
   */
  static async getUserQuizHistory(userId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('user_daily_attempts')
        .select(`
          *,
          daily_quiz_sessions (
            quiz_date,
            total_questions
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error getting quiz history:', error);
      return [];
    }
  }

  /**
   * Get quiz statistics
   */
  static async getQuizStats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_daily_attempts')
        .select('score_percentage, total_points, time_spent')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return {
          total_attempts: 0,
          average_score: 0,
          total_points: 0,
          average_time: 0,
          best_score: 0,
        };
      }
      
      const totalAttempts = data.length;
      const averageScore = Math.round(
        data.reduce((sum, attempt) => sum + attempt.score_percentage, 0) / totalAttempts
      );
      const totalPoints = data.reduce((sum, attempt) => sum + attempt.total_points, 0);
      const averageTime = Math.round(
        data.reduce((sum, attempt) => sum + attempt.time_spent, 0) / totalAttempts
      );
      const bestScore = Math.max(...data.map(attempt => attempt.score_percentage));
      
      return {
        total_attempts: totalAttempts,
        average_score: averageScore,
        total_points: totalPoints,
        average_time: averageTime,
        best_score: bestScore,
      };
    } catch (error) {
      console.error('❌ Error getting quiz stats:', error);
      return {
        total_attempts: 0,
        average_score: 0,
        total_points: 0,
        average_time: 0,
        best_score: 0,
      };
    }
  }

  /**
   * Upgrade user to premium
   */
  static async upgradeToPremium(userId: string, months: number = 1) {
    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);
      
      const { data, error } = await supabase
        .from('user_quiz_limits')
        .upsert({
          user_id: userId,
          is_premium: true,
          premium_expires_at: expiresAt.toISOString(),
          daily_limit: 999, // Unlimited
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error upgrading to premium:', error);
      throw error;
    }
  }
}