```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type Difficulty = 'easy' | 'medium' | 'hard';

interface DailyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  subject: string;
  subtopic: string;
  difficulty: Difficulty;
  points: number;
  exam_relevance?: string;
}

Deno.serve(async (req: Request) => {
  console.log('🚀 Daily quiz generator function called');
  
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get current date in Indian timezone
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const today = new Date(indianTime).toISOString().split('T')[0];
    
    console.log('📅 Generating daily quiz for Indian date:', today);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Check if quiz already exists for today
    const { data: existingQuiz, error: checkError } = await supabase
      .from('daily_quizzes')
      .select('*')
      .eq('date', today)
      .eq('is_active', true)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means "no rows"
      console.error('❌ Database check error:', checkError);
      throw checkError;
    }

    if (existingQuiz) {
      console.log('✅ Daily quiz already exists for today');
      return new Response(
        JSON.stringify({
          success: true,
          quiz: existingQuiz,
          message: 'Daily quiz already exists for today'
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🤖 Generating new daily quiz with AI...');

    // Generate questions using AI with fallback
    const questions = await generateDailyQuizQuestions();
    
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    
    const dailyQuiz = {
      date: today,
      questions: questions,
      total_points: totalPoints,
      difficulty_distribution: {
        easy: questions.filter(q => q.difficulty === 'easy').length,
        medium: questions.filter(q => q.difficulty === 'medium').length,
        hard: questions.filter(q => q.difficulty === 'hard').length
      },
      subjects_covered: [...new Set(questions.map(q => q.subject))],
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      is_active: true
    };

    console.log('💾 Saving daily quiz to database...');

    // Save to database
    const { data: savedQuiz, error: saveError } = await supabase
      .from('daily_quizzes')
      .insert(dailyQuiz)
      .select()
      .single();

    if (saveError) {
      console.error('❌ Error saving quiz:', saveError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to save quiz to database',
          details: saveError.message
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🎉 Daily quiz generated and saved successfully');
    console.log('📊 Questions:', questions.length);
    console.log('🎯 Subjects:', dailyQuiz.subjects_covered.join(', '));

    return new Response(
      JSON.stringify({
        success: true,
        quiz: savedQuiz,
        message: 'Daily quiz generated successfully'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('💥 Error in daily quiz generator:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate daily quiz',
        message: 'Daily quiz generation failed'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});

async function generateDailyQuizQuestions(): Promise<DailyQuizQuestion[]> {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const grokApiKey = Deno.env.get('GROK_API_KEY');
  
  console.log('🔑 Checking AI API keys...');
  console.log('Claude key available:', !!claudeApiKey);
  console.log('OpenAI key available:', !!openaiApiKey);
  console.log('Grok key available:', !!grokApiKey);

  const prompt = `Generate exactly 20 high-quality multiple-choice questions for Indian competitive exam preparation (UPSC, SSC, Banking, State PCS, Railway, etc.).

SUBJECT DISTRIBUTION (exactly):
- History: 4 questions (Ancient India, Medieval India, Modern India, Freedom Movement)
- Polity: 4 questions (Constitution, Governance, Rights, Amendments)
- Geography: 3 questions (Physical, Economic, Indian Geography)
- Economy: 3 questions (Indian Economy, Banking, Current Economic Policies)
- Science & Technology: 3 questions (Space, Defense, IT, Biotechnology)
- Current Affairs: 3 questions (Recent 6 months, Government Schemes, International Relations)

DIFFICULTY DISTRIBUTION (exactly):
- Easy: 8 questions (basic facts, definitions, direct questions)
- Medium: 8 questions (application, analysis, moderate complexity)
- Hard: 4 questions (synthesis, evaluation, complex analysis)

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": "unique_id_string",
      "question": "Clear, exam-focused question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Detailed explanation with context and exam relevance",
      "subject": "History|Polity|Geography|Economy|Science & Technology|Current Affairs",
      "subtopic": "Specific subtopic within the subject",
      "difficulty": "easy|medium|hard",
      "points": 5,
      "exam_relevance": "Why this is important for competitive exams"
    }
  ]
}

Points allocation: easy=5, medium=10, hard=15`;

  // Try Claude first
  if (claudeApiKey) {
    try {
      console.log('🤖 Generating questions with Claude...');
      const questions = await generateWithClaude(prompt, claudeApiKey);
      if (questions.length === 20) return questions;
    } catch (error) {
      console.log('⚠️ Claude failed:', error.message);
    }
  }

  // Try OpenAI
  if (openaiApiKey) {
    try {
      console.log('🤖 Generating questions with OpenAI...');
      const questions = await generateWithOpenAI(prompt, openaiApiKey);
      if (questions.length === 20) return questions;
    } catch (error) {
      console.log('⚠️ OpenAI failed:', error.message);
    }
  }

  // Try Grok
  if (grokApiKey) {
    try {
      console.log('🤖 Generating questions with Grok...');
      const questions = await generateWithGrok(prompt, grokApiKey);
      if (questions.length === 20) return questions;
    } catch (error) {
      console.log('⚠️ Grok failed:', error.message);
    }
  }

  console.log('⚠️ All AI providers failed or not configured, using demo questions');
  return generateDemoQuestions();
}

async function generateWithClaude(prompt: string, apiKey: string): Promise<DailyQuizQuestion[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `You are an expert question setter for Indian competitive exams. ${prompt}`
        }
      ]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const claudeResponse = await response.json();
  const content = JSON.parse(claudeResponse.content[0].text);
  
  return content.questions.map((q: any, index: number) => ({
    id: `dq_claude_${index + 1}`,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    subject: q.subject,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    points: q.difficulty === 'easy' ? 5 : q.difficulty === 'hard' ? 15 : 10,
    exam_relevance: q.exam_relevance
  })).slice(0, 20);
}

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<DailyQuizQuestion[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert question setter for Indian competitive exams.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const aiResponse = await response.json();
  const content = JSON.parse(aiResponse.choices[0].message.content);
  
  return content.questions.map((q: any, index: number) => ({
    id: `dq_openai_${index + 1}`,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    subject: q.subject,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    points: q.difficulty === 'easy' ? 5 : q.difficulty === 'hard' ? 15 : 10,
    exam_relevance: q.exam_relevance
  })).slice(0, 20);
}

async function generateWithGrok(prompt: string, apiKey: string): Promise<DailyQuizQuestion[]> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [
        {
          role: 'system',
          content: 'You are an expert question setter for Indian competitive exams.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${errorText}`);
  }

  const grokResponse = await response.json();
  const content = JSON.parse(grokResponse.choices[0].message.content);
  
  return content.questions.map((q: any, index: number) => ({
    id: `dq_grok_${index + 1}`,
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    subject: q.subject,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    points: q.difficulty === 'easy' ? 5 : q.difficulty === 'hard' ? 15 : 10,
    exam_relevance: q.exam_relevance
  })).slice(0, 20);
}

function generateDemoQuestions(): DailyQuizQuestion[] {
  console.log('📝 Generating demo questions as fallback');
  
  return [
    {
      id: 'demo1',
      question: 'Who was known as the "Iron Man of India"?',
      options: ['Jawaharlal Nehru', 'Sardar Vallabhbhai Patel', 'Subhas Chandra Bose', 'Bhagat Singh'],
      correct_answer: 1,
      explanation: 'Sardar Vallabhbhai Patel was called the "Iron Man of India" for his role in the integration of princely states.',
      subject: 'History',
      subtopic: 'Freedom Movement',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Frequently asked in UPSC and SSC exams'
    },
    {
      id: 'demo2',
      question: 'Which Article of the Indian Constitution guarantees Right to Equality?',
      options: ['Article 12', 'Article 14', 'Article 16', 'Article 19'],
      correct_answer: 1,
      explanation: 'Article 14 guarantees equality before law and equal protection of laws to all persons.',
      subject: 'Polity',
      subtopic: 'Fundamental Rights',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Core constitutional provision tested in all competitive exams'
    },
    {
      id: 'demo3',
      question: 'Which is the longest river in India?',
      options: ['Yamuna', 'Ganga', 'Godavari', 'Narmada'],
      correct_answer: 1,
      explanation: 'The Ganga is the longest river in India, flowing for about 2,525 kilometers.',
      subject: 'Geography',
      subtopic: 'Indian Rivers',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Basic geography fact important for all competitive exams'
    },
    {
      id: 'demo4',
      question: 'What is the current repo rate set by RBI (as of 2024)?',
      options: ['6.50%', '6.25%', '6.75%', '7.00%'],
      correct_answer: 0,
      explanation: 'The RBI has maintained the repo rate at 6.50% to balance growth and inflation concerns.',
      subject: 'Economy',
      subtopic: 'Monetary Policy',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Current economic policy important for banking and other exams'
    },
    {
      id: 'demo5',
      question: 'Which mission successfully landed on the Moon\'s south pole in 2023?',
      options: ['Chandrayaan-2', 'Chandrayaan-3', 'Mangalyaan', 'Aditya-L1'],
      correct_answer: 1,
      explanation: 'Chandrayaan-3 successfully landed on the Moon\'s south pole in August 2023, making India the fourth country to land on the Moon.',
      subject: 'Science & Technology',
      subtopic: 'Space Technology',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Recent achievement frequently asked in current affairs'
    },
    {
      id: 'demo6',
      question: 'Who is known as the Father of the Indian Constitution?',
      options: ['Mahatma Gandhi', 'B.R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Patel'],
      correct_answer: 1,
      explanation: 'Dr. B.R. Ambedkar is known as the Father of the Indian Constitution for his role as chairman of the drafting committee.',
      subject: 'Polity',
      subtopic: 'Constitution',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Fundamental knowledge for all competitive exams'
    },
    {
      id: 'demo7',
      question: 'Which Indian state has the highest literacy rate?',
      options: ['Kerala', 'Goa', 'Himachal Pradesh', 'Mizoram'],
      correct_answer: 0,
      explanation: 'Kerala has the highest literacy rate in India at over 93%.',
      subject: 'Geography',
      subtopic: 'Social Geography',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Important demographic data for competitive exams'
    },
    {
      id: 'demo8',
      question: 'What is the full form of GST?',
      options: ['General Sales Tax', 'Goods and Services Tax', 'Government Service Tax', 'Global Sales Tax'],
      correct_answer: 1,
      explanation: 'GST stands for Goods and Services Tax, implemented in India in 2017.',
      subject: 'Economy',
      subtopic: 'Taxation',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Current economic policy important for all competitive exams'
    },
    {
      id: 'demo9',
      question: 'Which Indian scientist won the Nobel Prize in Physics in 1930?',
      options: ['C.V. Raman', 'Homi Bhabha', 'A.P.J. Abdul Kalam', 'Vikram Sarabhai'],
      correct_answer: 0,
      explanation: 'C.V. Raman won the Nobel Prize in Physics in 1930 for his work on light scattering.',
      subject: 'Science & Technology',
      subtopic: 'Nobel Laureates',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Important scientific achievement frequently asked in exams'
    },
    {
      id: 'demo10',
      question: 'Which scheme was launched for financial inclusion of the poor?',
      options: ['Jan Dhan Yojana', 'Ayushman Bharat', 'PM-KISAN', 'Swachh Bharat'],
      correct_answer: 0,
      explanation: 'Pradhan Mantri Jan Dhan Yojana was launched for financial inclusion and banking services for the poor.',
      subject: 'Current Affairs',
      subtopic: 'Government Schemes',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Important government initiative for competitive exams'
    },
    {
      id: 'demo11',
      question: 'In which year did India gain independence?',
      options: ['1946', '1947', '1948', '1949'],
      correct_answer: 1,
      explanation: 'India gained independence from British rule on August 15, 1947.',
      subject: 'History',
      subtopic: 'Freedom Movement',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Fundamental historical fact for all competitive exams'
    },
    {
      id: 'demo12',
      question: 'Which mountain range separates India from China?',
      options: ['Western Ghats', 'Eastern Ghats', 'Himalayas', 'Aravalli'],
      correct_answer: 2,
      explanation: 'The Himalayas form the natural boundary between India and China.',
      subject: 'Geography',
      subtopic: 'Physical Features',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Basic geographical knowledge for competitive exams'
    },
    {
      id: 'demo13',
      question: 'What is the currency of India?',
      options: ['Dollar', 'Rupee', 'Pound', 'Euro'],
      correct_answer: 1,
      explanation: 'The Indian Rupee (INR) is the official currency of India.',
      subject: 'Economy',
      subtopic: 'Currency',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Basic economic knowledge for competitive exams'
    },
    {
      id: 'demo14',
      question: 'Which organization launched Chandrayaan-3?',
      options: ['DRDO', 'ISRO', 'CSIR', 'DAE'],
      correct_answer: 1,
      explanation: 'ISRO (Indian Space Research Organisation) successfully launched Chandrayaan-3.',
      subject: 'Science & Technology',
      subtopic: 'Space Technology',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Recent achievement important for current affairs'
    },
    {
      id: 'demo15',
      question: 'Who is the current President of India (as of 2024)?',
      options: ['Ram Nath Kovind', 'Droupadi Murmu', 'Pranab Mukherjee', 'A.P.J. Abdul Kalam'],
      correct_answer: 1,
      explanation: 'Droupadi Murmu is the current President of India, taking office in 2022.',
      subject: 'Current Affairs',
      subtopic: 'Government',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Current political knowledge for competitive exams'
    },
    {
      id: 'demo16',
      question: 'Which Mughal emperor built the Taj Mahal?',
      options: ['Akbar', 'Shah Jahan', 'Aurangzeb', 'Humayun'],
      correct_answer: 1,
      explanation: 'Shah Jahan built the Taj Mahal in memory of his wife Mumtaz Mahal.',
      subject: 'History',
      subtopic: 'Mughal Empire',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Important historical monument frequently asked in exams'
    },
    {
      id: 'demo17',
      question: 'Which state in India has the largest area?',
      options: ['Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan', 'Maharashtra'],
      correct_answer: 2,
      explanation: 'Rajasthan is the largest state in India by area, covering 342,239 square kilometers.',
      subject: 'Geography',
      subtopic: 'Indian States',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Important geographical fact for competitive exams'
    },
    {
      id: 'demo18',
      question: 'What is the full form of RBI?',
      options: ['Reserve Bank of India', 'Regional Bank of India', 'Rural Bank of India', 'Retail Bank of India'],
      correct_answer: 0,
      explanation: 'RBI stands for Reserve Bank of India, the central bank of the country.',
      subject: 'Economy',
      subtopic: 'Banking',
      difficulty: 'easy',
      points: 5,
      exam_relevance: 'Fundamental banking knowledge for competitive exams'
    },
    {
      id: 'demo19',
      question: 'Which Indian satellite was used for the first successful Mars mission?',
      options: ['Aryabhata', 'Mangalyaan', 'Chandrayaan', 'INSAT'],
      correct_answer: 1,
      explanation: 'Mangalyaan (Mars Orbiter Mission) was India\'s first successful Mars mission launched in 2013.',
      subject: 'Science & Technology',
      subtopic: 'Space Missions',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Important space achievement for current affairs'
    },
    {
      id: 'demo20',
      question: 'Which scheme provides cooking gas connections to poor households?',
      options: ['Ujjwala Yojana', 'Swachh Bharat', 'Digital India', 'Make in India'],
      correct_answer: 0,
      explanation: 'Pradhan Mantri Ujjwala Yojana provides LPG connections to women from poor households.',
      subject: 'Current Affairs',
      subtopic: 'Government Schemes',
      difficulty: 'medium',
      points: 10,
      exam_relevance: 'Important welfare scheme for competitive exams'
    }
  ];
}
```