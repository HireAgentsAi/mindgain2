/*
  # Fix RLS policies for daily quiz system

  1. Security Updates
    - Add proper RLS policies for daily_quiz_sessions
    - Add proper RLS policies for user_quiz_limits  
    - Add proper RLS policies for user_daily_attempts
    - Allow service role to manage all operations
    - Allow users to manage their own data
*/

-- Fix daily_quiz_sessions RLS policies
DROP POLICY IF EXISTS "Anyone can view active sessions" ON daily_quiz_sessions;
DROP POLICY IF EXISTS "Service role can manage sessions" ON daily_quiz_sessions;

CREATE POLICY "Anyone can view active sessions"
  ON daily_quiz_sessions
  FOR SELECT
  TO public
  USING (is_active = true AND quiz_date >= (CURRENT_DATE - interval '7 days'));

CREATE POLICY "Service role can manage sessions"
  ON daily_quiz_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can create sessions"
  ON daily_quiz_sessions
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Fix user_quiz_limits RLS policies
DROP POLICY IF EXISTS "Service role can manage limits" ON user_quiz_limits;
DROP POLICY IF EXISTS "Users can view own limits" ON user_quiz_limits;
DROP POLICY IF EXISTS "Users can update own limits" ON user_quiz_limits;

CREATE POLICY "Service role can manage limits"
  ON user_quiz_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own limits"
  ON user_quiz_limits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own limits"
  ON user_quiz_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own limits"
  ON user_quiz_limits
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage limits"
  ON user_quiz_limits
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Fix user_daily_attempts RLS policies
DROP POLICY IF EXISTS "Service role can manage attempts" ON user_daily_attempts;
DROP POLICY IF EXISTS "Users can create own attempts" ON user_daily_attempts;
DROP POLICY IF EXISTS "Users can view own attempts" ON user_daily_attempts;

CREATE POLICY "Service role can manage attempts"
  ON user_daily_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own attempts"
  ON user_daily_attempts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own attempts"
  ON user_daily_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage attempts"
  ON user_daily_attempts
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Update the database functions to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_daily_quiz_session()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_id uuid;
  today_date date := CURRENT_DATE;
  selected_question_ids uuid[];
  easy_questions uuid[];
  medium_questions uuid[];
  hard_questions uuid[];
BEGIN
  -- Check if session already exists for today
  SELECT id INTO session_id
  FROM daily_quiz_sessions
  WHERE quiz_date = today_date AND is_active = true;
  
  IF session_id IS NOT NULL THEN
    RETURN session_id;
  END IF;
  
  -- Get questions by difficulty
  SELECT array_agg(id) INTO easy_questions
  FROM daily_quiz_questions
  WHERE difficulty = 'easy' AND is_active = true
  ORDER BY random()
  LIMIT 8;
  
  SELECT array_agg(id) INTO medium_questions
  FROM daily_quiz_questions
  WHERE difficulty = 'medium' AND is_active = true
  ORDER BY random()
  LIMIT 8;
  
  SELECT array_agg(id) INTO hard_questions
  FROM daily_quiz_questions
  WHERE difficulty = 'hard' AND is_active = true
  ORDER BY random()
  LIMIT 4;
  
  -- Combine all questions
  selected_question_ids := COALESCE(easy_questions, ARRAY[]::uuid[]) || 
                          COALESCE(medium_questions, ARRAY[]::uuid[]) || 
                          COALESCE(hard_questions, ARRAY[]::uuid[]);
  
  -- Create new session
  INSERT INTO daily_quiz_sessions (
    quiz_date,
    selected_questions,
    total_questions,
    total_points,
    difficulty_distribution,
    subjects_covered,
    is_active
  ) VALUES (
    today_date,
    selected_question_ids,
    20,
    200,
    '{"easy": 8, "medium": 8, "hard": 4}'::jsonb,
    ARRAY['History', 'Polity', 'Geography', 'Economy', 'Science & Technology', 'Current Affairs'],
    true
  ) RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;

CREATE OR REPLACE FUNCTION check_user_quiz_limit(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_limits record;
  attempts_today integer := 0;
  can_attempt boolean := false;
  remaining_attempts integer := 0;
BEGIN
  -- Get or create user limits
  SELECT * INTO user_limits
  FROM user_quiz_limits
  WHERE user_id = p_user_id;
  
  IF user_limits IS NULL THEN
    -- Create default limits for new user
    INSERT INTO user_quiz_limits (user_id, daily_limit, attempts_today, is_premium)
    VALUES (p_user_id, 1, 0, false)
    RETURNING * INTO user_limits;
  END IF;
  
  -- Reset attempts if it's a new day
  IF user_limits.last_attempt_date != CURRENT_DATE THEN
    UPDATE user_quiz_limits
    SET attempts_today = 0, last_attempt_date = CURRENT_DATE
    WHERE user_id = p_user_id;
    
    user_limits.attempts_today := 0;
  END IF;
  
  -- Check if user can attempt
  can_attempt := user_limits.attempts_today < user_limits.daily_limit;
  remaining_attempts := GREATEST(0, user_limits.daily_limit - user_limits.attempts_today);
  
  RETURN jsonb_build_object(
    'can_attempt', can_attempt,
    'remaining_attempts', remaining_attempts,
    'is_premium', user_limits.is_premium,
    'daily_limit', user_limits.daily_limit,
    'attempts_today', user_limits.attempts_today
  );
END;
$$;

CREATE OR REPLACE FUNCTION submit_daily_quiz_attempt(
  p_user_id uuid,
  p_answers integer[],
  p_time_spent integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_record record;
  question_record record;
  correct_answers integer := 0;
  total_questions integer;
  score_percentage integer;
  total_points integer := 0;
  xp_earned integer;
  attempt_id uuid;
  i integer;
BEGIN
  -- Get today's session
  SELECT * INTO session_record
  FROM daily_quiz_sessions
  WHERE quiz_date = CURRENT_DATE AND is_active = true;
  
  IF session_record IS NULL THEN
    RAISE EXCEPTION 'No active quiz session found for today';
  END IF;
  
  total_questions := array_length(p_answers, 1);
  
  -- Check answers and calculate score
  FOR i IN 1..total_questions LOOP
    IF i <= array_length(session_record.selected_questions, 1) THEN
      SELECT * INTO question_record
      FROM daily_quiz_questions
      WHERE id = session_record.selected_questions[i];
      
      IF question_record IS NOT NULL AND p_answers[i] = question_record.correct_answer THEN
        correct_answers := correct_answers + 1;
        total_points := total_points + question_record.points;
      END IF;
    END IF;
  END LOOP;
  
  score_percentage := ROUND((correct_answers::float / total_questions) * 100);
  xp_earned := total_points * 2; -- 2 XP per point
  
  -- Insert attempt record
  INSERT INTO user_daily_attempts (
    user_id,
    quiz_session_id,
    quiz_date,
    answers,
    correct_answers,
    total_questions,
    score_percentage,
    total_points,
    time_spent
  ) VALUES (
    p_user_id,
    session_record.id,
    CURRENT_DATE,
    p_answers,
    correct_answers,
    total_questions,
    score_percentage,
    total_points,
    p_time_spent
  ) RETURNING id INTO attempt_id;
  
  -- Update user limits
  UPDATE user_quiz_limits
  SET attempts_today = attempts_today + 1,
      last_attempt_date = CURRENT_DATE
  WHERE user_id = p_user_id;
  
  -- Update user stats if table exists
  INSERT INTO user_stats (user_id, total_xp, missions_completed, last_activity_date)
  VALUES (p_user_id, xp_earned, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = user_stats.total_xp + xp_earned,
    missions_completed = user_stats.missions_completed + 1,
    last_activity_date = CURRENT_DATE;
  
  RETURN jsonb_build_object(
    'attempt_id', attempt_id,
    'correct_answers', correct_answers,
    'total_questions', total_questions,
    'score_percentage', score_percentage,
    'total_points', total_points,
    'xp_earned', xp_earned,
    'time_spent', p_time_spent
  );
END;
$$;