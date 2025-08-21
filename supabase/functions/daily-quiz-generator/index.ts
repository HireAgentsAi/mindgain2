import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface DailyQuizQuestion {
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if quiz already exists for today
    const { data: existingQuiz, error: checkError } = await supabase
      .from('daily_quizzes')
      .select('*')
      .eq('date', today)
      .eq('is_active', true)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Database check error:', checkError);
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

    // Generate 20 questions using AI
    const questions = await generateDailyQuizWithAI();
    
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
      // Return quiz anyway even if save fails
      return new Response(
        JSON.stringify({
          success: true,
          quiz: dailyQuiz,
          message: 'Daily quiz generated (save failed but quiz available)',
          generation_method: 'ai_generated'
        }),
        {
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
        message: 'Daily quiz generated successfully with AI',
        generation_method: 'ai_generated'
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

async function generateDailyQuizWithAI(): Promise<DailyQuizQuestion[]> {
  const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!claudeApiKey && !openaiApiKey) {
    throw new Error('No AI API keys configured');
  }

  // Universal prompt for Indian competitive exam daily quiz
  const universalPrompt = `Generate exactly 20 high-quality multiple-choice questions for Indian competitive exam preparation (UPSC, SSC, Banking, State PCS, Railway, etc.).

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

QUESTION REQUIREMENTS:
1. Each question must be factually accurate and verifiable
2. Focus on topics frequently asked in Indian competitive exams
3. Include specific dates, names, numbers, and facts
4. Cover recent developments and current affairs (last 6 months)
5. Include questions on freedom fighters, constitutional articles, government schemes
6. Ensure questions test different cognitive levels

SPECIAL FOCUS AREAS:
- Freedom fighters: Bhagat Singh, Chandrashekhar Azad, Subhas Chandra Bose
- Constitutional articles: Article 370, Article 35A, recent amendments
- Current schemes: PM-KISAN, Ayushman Bharat, Digital India initiatives
- Recent achievements: Chandrayaan-3, G20 presidency, sports achievements
- Economic policies: Budget 2024, RBI policies, GST updates

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
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

  // Try Claude first (better for Indian content)
  if (claudeApiKey) {
    try {
      console.log('🤖 Generating questions with Claude...');
      return await generateWithClaude(universalPrompt, claudeApiKey);
    } catch (claudeError) {
      console.log('⚠️ Claude failed, trying OpenAI:', claudeError.message);
    }
  }

  // Fallback to OpenAI
  if (openaiApiKey) {
    try {
      console.log('🤖 Generating questions with OpenAI...');
      return await generateWithOpenAI(universalPrompt, openaiApiKey);
    } catch (openaiError) {
      console.log('⚠️ OpenAI failed:', openaiError.message);
    }
  }

  throw new Error('All AI providers failed');
}

async function generateWithClaude(prompt: string, apiKey: string): Promise<DailyQuizQuestion[]> {
  try {
    console.log('🤖 Making request to Claude API...');
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
            content: `You are an expert question setter for Indian competitive exams with deep knowledge of UPSC, SSC, Banking, and State PCS patterns. You understand the Indian education system and exam requirements perfectly.

${prompt}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const claudeResponse = await response.json();
    const content = JSON.parse(claudeResponse.content[0].text);
  } catch (fetchError) {
    console.error('❌ Claude fetch error:', {
      message: fetchError.message,
      stack: fetchError.stack,
      name: fetchError.name
    });
    throw new Error(`Claude API fetch failed: ${fetchError.message}`);
  }
  
  // Validate and format questions
  const questions = content.questions.map((q: any, index: number) => ({
    id: `dq${index + 1}`,
    question: q.question,
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: typeof q.correct_answer === 'number' && q.correct_answer >= 0 && q.correct_answer <= 3 ? q.correct_answer : 0,
    explanation: q.explanation || 'Explanation not available',
    subject: q.subject || 'General',
    subtopic: q.subtopic || 'General',
    difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
    points: q.difficulty === 'easy' ? 5 : q.difficulty === 'hard' ? 15 : 10,
    exam_relevance: q.exam_relevance
  }));

  console.log('✅ Generated', questions.length, 'questions with Claude');
  return questions.slice(0, 20); // Ensure exactly 20 questions
}

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<DailyQuizQuestion[]> {
  try {
    console.log('🤖 Making request to OpenAI API...');
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
            content: 'You are an expert question setter for Indian competitive exams with deep knowledge of UPSC, SSC, Banking, and State PCS patterns. You understand the Indian education system and exam requirements perfectly.'
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
      console.error('❌ OpenAI API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = JSON.parse(aiResponse.choices[0].message.content);
  } catch (fetchError) {
    console.error('❌ OpenAI fetch error:', {
      message: fetchError.message,
      stack: fetchError.stack,
      name: fetchError.name
    });
    throw new Error(`OpenAI API fetch failed: ${fetchError.message}`);
  }
  
  // Validate and format questions
  const questions = content.questions.map((q: any, index: number) => ({
    id: `dq${index + 1}`,
    question: q.question,
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: typeof q.correct_answer === 'number' && q.correct_answer >= 0 && q.correct_answer <= 3 ? q.correct_answer : 0,
    explanation: q.explanation || 'Explanation not available',
    subject: q.subject || 'General',
    subtopic: q.subtopic || 'General',
    difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
    points: q.difficulty === 'easy' ? 5 : q.difficulty === 'hard' ? 15 : 10,
    exam_relevance: q.exam_relevance
  }));

  console.log('✅ Generated', questions.length, 'questions with OpenAI');
  return questions.slice(0, 20); // Ensure exactly 20 questions
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
          content: 'You are an expert question setter for Indian competitive exams with deep knowledge of UPSC, SSC, Banking, and State PCS patterns. You understand the Indian education system and exam requirements perfectly. Add a touch of wit where appropriate.'
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
  
  // Validate and format questions
  const questions = content.questions.map((q: any, index: number) => ({
    id: `dq${index + 1}`,
    question: q.question,
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: typeof q.correct_answer === 'number' && q.correct_answer >= 0 && q.correct_answer <= 3 ? q.correct_answer : 0,
    explanation: q.explanation || 'Explanation not available',
    subject: q.subject || 'General',
    subtopic: q.subtopic || 'General',
    difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
    points: q.difficulty === 'easy' ? 5 : q.difficulty === 'hard' ? 15 : 10,
    exam_relevance: q.exam_relevance
  }));

  console.log('✅ Generated', questions.length, 'questions with Grok');
  return questions.slice(0, 20); // Ensure exactly 20 questions
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
    }
  ];
}