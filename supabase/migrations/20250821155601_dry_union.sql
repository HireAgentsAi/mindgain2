/*
  # Rebuild Daily Quiz System from Scratch

  1. New Tables
    - `daily_quiz_questions` - Pre-generated question bank
    - `daily_quiz_sessions` - Today's active quiz session
    - `user_daily_attempts` - User attempts tracking
    - `user_quiz_limits` - Daily limits and subscription tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for user access control

  3. Functions
    - Simple quiz generation and attempt tracking
    - No complex edge functions needed
*/

-- Drop existing daily quiz tables if they exist
DROP TABLE IF EXISTS daily_quiz_attempts CASCADE;
DROP TABLE IF EXISTS daily_quizzes CASCADE;

-- Create question bank table
CREATE TABLE IF NOT EXISTS daily_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer integer NOT NULL CHECK (correct_answer >= 0 AND correct_answer <= 3),
  explanation text NOT NULL,
  subject text NOT NULL,
  subtopic text,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points integer NOT NULL DEFAULT 10,
  exam_relevance text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create daily quiz sessions table (one per day)
CREATE TABLE IF NOT EXISTS daily_quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_date date UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  selected_questions uuid[] NOT NULL, -- Array of question IDs
  total_questions integer NOT NULL DEFAULT 20,
  total_points integer NOT NULL DEFAULT 200,
  difficulty_distribution jsonb DEFAULT '{"easy": 8, "medium": 8, "hard": 4}'::jsonb,
  subjects_covered text[] DEFAULT ARRAY['History', 'Polity', 'Geography', 'Economy', 'Science & Technology', 'Current Affairs'],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create user attempts table
CREATE TABLE IF NOT EXISTS user_daily_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_session_id uuid NOT NULL REFERENCES daily_quiz_sessions(id) ON DELETE CASCADE,
  quiz_date date NOT NULL,
  answers integer[] NOT NULL, -- Array of selected answers (0-3, -1 for no answer)
  correct_answers integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 20,
  score_percentage integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  time_spent integer NOT NULL DEFAULT 0, -- seconds
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quiz_date)
);

-- Create user quiz limits table
CREATE TABLE IF NOT EXISTS user_quiz_limits (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  daily_limit integer NOT NULL DEFAULT 1, -- Free users get 1 attempt
  attempts_today integer NOT NULL DEFAULT 0,
  last_attempt_date date DEFAULT CURRENT_DATE,
  is_premium boolean DEFAULT false,
  premium_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE daily_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_quiz_questions
CREATE POLICY "Anyone can view active questions"
  ON daily_quiz_questions
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Service role can manage questions"
  ON daily_quiz_questions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for daily_quiz_sessions
CREATE POLICY "Anyone can view active sessions"
  ON daily_quiz_sessions
  FOR SELECT
  TO public
  USING (is_active = true AND quiz_date >= CURRENT_DATE - INTERVAL '7 days');

CREATE POLICY "Service role can manage sessions"
  ON daily_quiz_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_daily_attempts
CREATE POLICY "Users can view own attempts"
  ON user_daily_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own attempts"
  ON user_daily_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage attempts"
  ON user_daily_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_quiz_limits
CREATE POLICY "Users can view own limits"
  ON user_quiz_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own limits"
  ON user_quiz_limits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage limits"
  ON user_quiz_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert sample questions for immediate functionality
INSERT INTO daily_quiz_questions (question, option_a, option_b, option_c, option_d, correct_answer, explanation, subject, subtopic, difficulty, points, exam_relevance) VALUES
('Which Article of the Indian Constitution guarantees Right to Equality?', 'Article 12', 'Article 14', 'Article 16', 'Article 19', 1, 'Article 14 guarantees equality before law and equal protection of laws to all persons within the territory of India.', 'Polity', 'Fundamental Rights', 'medium', 10, 'UPSC, SSC, Banking'),
('Who was the first President of India?', 'Dr. A.P.J. Abdul Kalam', 'Dr. Rajendra Prasad', 'Dr. S. Radhakrishnan', 'Dr. Zakir Hussain', 1, 'Dr. Rajendra Prasad was the first President of India, serving from 1950 to 1962.', 'History', 'Modern India', 'easy', 10, 'UPSC, SSC, State PCS'),
('Which is the longest river in India?', 'Yamuna', 'Ganga', 'Godavari', 'Brahmaputra', 1, 'The Ganga is the longest river in India, flowing approximately 2,525 kilometers from the Himalayas to the Bay of Bengal.', 'Geography', 'Physical Geography', 'easy', 10, 'UPSC, SSC, Railway'),
('The Reserve Bank of India was established in which year?', '1930', '1935', '1940', '1945', 1, 'The Reserve Bank of India was established on April 1, 1935, under the Reserve Bank of India Act, 1934.', 'Economy', 'Banking', 'medium', 10, 'Banking, UPSC, SSC'),
('Which Indian space mission was the first to reach Mars?', 'Chandrayaan-1', 'Mangalyaan', 'Chandrayaan-2', 'Aditya-L1', 1, 'Mangalyaan (Mars Orbiter Mission) was India''s first interplanetary mission and successfully reached Mars orbit in 2014.', 'Science & Technology', 'Space Technology', 'medium', 10, 'UPSC, SSC, Railway'),
('Who is known as the "Iron Man of India"?', 'Jawaharlal Nehru', 'Sardar Vallabhbhai Patel', 'Subhas Chandra Bose', 'Bhagat Singh', 1, 'Sardar Vallabhbhai Patel is known as the "Iron Man of India" for his role in the integration of princely states.', 'History', 'Freedom Struggle', 'easy', 10, 'UPSC, SSC, State PCS'),
('Which Amendment is known as the "Mini Constitution"?', '42nd Amendment', '44th Amendment', '73rd Amendment', '74th Amendment', 0, 'The 42nd Amendment (1976) is called the "Mini Constitution" because it made extensive changes to the Constitution.', 'Polity', 'Constitutional Amendments', 'hard', 15, 'UPSC, Judiciary'),
('The Tropic of Cancer passes through how many Indian states?', '6', '7', '8', '9', 2, 'The Tropic of Cancer passes through 8 Indian states: Gujarat, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, West Bengal, Tripura, and Mizoram.', 'Geography', 'Physical Geography', 'medium', 10, 'UPSC, SSC, Railway'),
('Which Five Year Plan was terminated prematurely?', 'Fourth Plan', 'Fifth Plan', 'Sixth Plan', 'Seventh Plan', 1, 'The Fifth Five Year Plan (1974-79) was terminated in 1978 by the Janata Government and replaced with the Sixth Plan.', 'Economy', 'Planning', 'hard', 15, 'UPSC, Banking'),
('The Indian National Congress was founded in which year?', '1883', '1885', '1887', '1889', 1, 'The Indian National Congress was founded in 1885 by Allan Octavian Hume, Dadabhai Naoroji, and Dinshaw Wacha.', 'History', 'Freedom Struggle', 'easy', 10, 'UPSC, SSC, State PCS'),
('Which Article deals with the Right to Constitutional Remedies?', 'Article 30', 'Article 32', 'Article 34', 'Article 36', 1, 'Article 32 is known as the "Right to Constitutional Remedies" and is called the "heart and soul" of the Constitution by Dr. B.R. Ambedkar.', 'Polity', 'Fundamental Rights', 'medium', 10, 'UPSC, Judiciary'),
('The headquarters of the Indian Space Research Organisation (ISRO) is located in?', 'Mumbai', 'Bangalore', 'Chennai', 'Hyderabad', 1, 'ISRO headquarters is located in Bangalore (Bengaluru), Karnataka.', 'Science & Technology', 'Space Technology', 'easy', 10, 'UPSC, SSC'),
('Which river is known as the "Sorrow of Bengal"?', 'Ganga', 'Damodar', 'Hooghly', 'Brahmaputra', 1, 'The Damodar River is known as the "Sorrow of Bengal" due to its frequent floods before the construction of dams.', 'Geography', 'Rivers', 'medium', 10, 'UPSC, SSC, Railway'),
('The concept of "Directive Principles of State Policy" is borrowed from which country?', 'USA', 'UK', 'Ireland', 'Canada', 2, 'The Directive Principles of State Policy are borrowed from the Irish Constitution.', 'Polity', 'Constitutional Sources', 'medium', 10, 'UPSC, State PCS'),
('Which is the smallest state in India by area?', 'Sikkim', 'Tripura', 'Goa', 'Manipur', 2, 'Goa is the smallest state in India by area, covering 3,702 square kilometers.', 'Geography', 'Political Geography', 'easy', 10, 'UPSC, SSC, Railway'),
('The Green Revolution in India was primarily associated with?', 'Cotton', 'Wheat and Rice', 'Sugarcane', 'Jute', 1, 'The Green Revolution in India (1960s-70s) was primarily associated with increased production of wheat and rice through high-yielding varieties.', 'Economy', 'Agriculture', 'medium', 10, 'UPSC, Banking'),
('Who wrote the book "Hind Swaraj"?', 'Jawaharlal Nehru', 'Mahatma Gandhi', 'Bal Gangadhar Tilak', 'Gopal Krishna Gokhale', 1, 'Mahatma Gandhi wrote "Hind Swaraj" in 1909, outlining his vision of Indian self-rule.', 'History', 'Literature', 'medium', 10, 'UPSC, SSC'),
('The Panchayati Raj system was constitutionally recognized through which amendment?', '72nd Amendment', '73rd Amendment', '74th Amendment', '75th Amendment', 1, 'The 73rd Amendment Act, 1992 gave constitutional status to Panchayati Raj institutions.', 'Polity', 'Local Government', 'medium', 10, 'UPSC, State PCS'),
('Which Indian city is known as the "Manchester of India"?', 'Mumbai', 'Ahmedabad', 'Coimbatore', 'Kanpur', 1, 'Ahmedabad is known as the "Manchester of India" due to its textile industry.', 'Geography', 'Economic Geography', 'easy', 10, 'UPSC, SSC, Railway'),
('The National Emergency can be declared under which Article?', 'Article 352', 'Article 356', 'Article 360', 'Article 365', 0, 'Article 352 deals with National Emergency, which can be declared in case of war, external aggression, or armed rebellion.', 'Polity', 'Emergency Provisions', 'hard', 15, 'UPSC, Judiciary');

-- Function to create today's quiz session
CREATE OR REPLACE FUNCTION create_daily_quiz_session()
RETURNS uuid AS $$
DECLARE
  session_id uuid;
  question_ids uuid[];
  easy_questions uuid[];
  medium_questions uuid[];
  hard_questions uuid[];
BEGIN
  -- Check if today's session already exists
  SELECT id INTO session_id
  FROM daily_quiz_sessions
  WHERE quiz_date = CURRENT_DATE;
  
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
  question_ids := easy_questions || medium_questions || hard_questions;
  
  -- Create new session
  INSERT INTO daily_quiz_sessions (
    quiz_date,
    selected_questions,
    total_questions,
    total_points
  ) VALUES (
    CURRENT_DATE,
    question_ids,
    array_length(question_ids, 1),
    array_length(question_ids, 1) * 10
  ) RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check user quiz limits
CREATE OR REPLACE FUNCTION check_user_quiz_limit(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_limits record;
  can_attempt boolean := false;
  remaining_attempts integer := 0;
BEGIN
  -- Get or create user limits
  INSERT INTO user_quiz_limits (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Get current limits
  SELECT * INTO user_limits
  FROM user_quiz_limits
  WHERE user_id = p_user_id;
  
  -- Reset daily counter if new day
  IF user_limits.last_attempt_date < CURRENT_DATE THEN
    UPDATE user_quiz_limits
    SET attempts_today = 0,
        last_attempt_date = CURRENT_DATE
    WHERE user_id = p_user_id;
    
    user_limits.attempts_today := 0;
  END IF;
  
  -- Check if user can attempt
  IF user_limits.is_premium AND (user_limits.premium_expires_at IS NULL OR user_limits.premium_expires_at > now()) THEN
    can_attempt := true;
    remaining_attempts := 999; -- Unlimited for premium
  ELSE
    can_attempt := user_limits.attempts_today < user_limits.daily_limit;
    remaining_attempts := user_limits.daily_limit - user_limits.attempts_today;
  END IF;
  
  RETURN jsonb_build_object(
    'can_attempt', can_attempt,
    'remaining_attempts', remaining_attempts,
    'is_premium', user_limits.is_premium,
    'daily_limit', user_limits.daily_limit,
    'attempts_today', user_limits.attempts_today
  );
END;
$$ LANGUAGE plpgsql;

-- Function to submit quiz attempt
CREATE OR REPLACE FUNCTION submit_daily_quiz_attempt(
  p_user_id uuid,
  p_answers integer[],
  p_time_spent integer
)
RETURNS jsonb AS $$
DECLARE
  session_record record;
  question_record record;
  correct_count integer := 0;
  total_points integer := 0;
  attempt_id uuid;
  i integer;
  user_answer integer;
  xp_reward integer;
BEGIN
  -- Get today's session
  SELECT * INTO session_record
  FROM daily_quiz_sessions
  WHERE quiz_date = CURRENT_DATE AND is_active = true;
  
  IF session_record IS NULL THEN
    RAISE EXCEPTION 'No active quiz session for today';
  END IF;
  
  -- Check user limits
  IF NOT (check_user_quiz_limit(p_user_id)->>'can_attempt')::boolean THEN
    RAISE EXCEPTION 'Daily quiz limit exceeded';
  END IF;
  
  -- Calculate score
  FOR i IN 1..array_length(session_record.selected_questions, 1) LOOP
    user_answer := p_answers[i];
    
    SELECT * INTO question_record
    FROM daily_quiz_questions
    WHERE id = session_record.selected_questions[i];
    
    IF user_answer = question_record.correct_answer THEN
      correct_count := correct_count + 1;
      total_points := total_points + question_record.points;
    END IF;
  END LOOP;
  
  -- Create attempt record
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
    correct_count,
    array_length(session_record.selected_questions, 1),
    round((correct_count::float / array_length(session_record.selected_questions, 1)) * 100),
    total_points,
    p_time_spent
  ) RETURNING id INTO attempt_id;
  
  -- Update user limits
  UPDATE user_quiz_limits
  SET attempts_today = attempts_today + 1,
      last_attempt_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Calculate XP reward
  xp_reward := 50 + (correct_count * 5); -- Base 50 + 5 per correct answer
  
  -- Update user stats
  UPDATE user_stats
  SET total_xp = total_xp + xp_reward,
      current_level = floor((total_xp + xp_reward) / 1000) + 1,
      last_activity_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'attempt_id', attempt_id,
    'correct_answers', correct_count,
    'total_questions', array_length(session_record.selected_questions, 1),
    'score_percentage', round((correct_count::float / array_length(session_record.selected_questions, 1)) * 100),
    'total_points', total_points,
    'xp_earned', xp_reward,
    'time_spent', p_time_spent
  );
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_difficulty ON daily_quiz_questions(difficulty, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_subject ON daily_quiz_questions(subject, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_quiz_sessions_date ON daily_quiz_sessions(quiz_date);
CREATE INDEX IF NOT EXISTS idx_user_daily_attempts_user_date ON user_daily_attempts(user_id, quiz_date);
CREATE INDEX IF NOT EXISTS idx_user_quiz_limits_user ON user_quiz_limits(user_id);