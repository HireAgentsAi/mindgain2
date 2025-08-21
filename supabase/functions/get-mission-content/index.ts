import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid token')
    }

    let missionId: string | null = null
    let roomType: string | null = null

    // Handle both GET and POST requests
    if (req.method === 'GET') {
      const url = new URL(req.url)
      missionId = url.searchParams.get('mission_id')
      roomType = url.searchParams.get('room_type')
    } else if (req.method === 'POST') {
      const body = await req.json()
      missionId = body.mission_id || body.missionId
      roomType = body.room_type || body.roomType
    }

    if (!missionId) {
      throw new Error('Mission ID is required')
    }

    // Verify user owns this mission
    const { data: mission, error: missionError } = await supabaseClient
      .from('missions')
      .select('*')
      .eq('id', missionId)
      .eq('user_id', user.id)
      .single()

    if (missionError || !mission) {
      throw new Error('Mission not found or access denied')
    }

    let content: any = {}

    // Get learning content
    const { data: learningContent } = await supabaseClient
      .from('learning_content')
      .select('*')
      .eq('mission_id', missionId)
      .single()

    // If we have learning content, transform it to the expected format
    if (learningContent) {
      // Transform the learning content to the expected format
      const transformedContent = {
        overview: learningContent.overview || "Learning content overview",
        contentType: mission.content_type || "general",
        examFocus: "upsc", // Default to UPSC
        tabs: [],
        keyHighlights: learningContent.key_points || [],
        examTips: ["Focus on memorizing dates and key events", "Pay attention to cause-effect relationships"],
        difficulty: learningContent.difficulty || "intermediate",
        estimatedTime: learningContent.estimated_time || "15 minutes"
      };

      // Add tabs based on available content
      if (learningContent.timeline && Array.isArray(learningContent.timeline) && learningContent.timeline.length > 0) {
        transformedContent.tabs.push({
          id: "timeline",
          title: "Timeline",
          type: "timeline",
          content: learningContent.timeline
        });
      }

      if (learningContent.concepts && Array.isArray(learningContent.concepts) && learningContent.concepts.length > 0) {
        transformedContent.tabs.push({
          id: "concepts",
          title: "Key Concepts",
          type: "concepts",
          content: learningContent.concepts
        });
      }

      // Add a points tab with key points if available
      if (learningContent.key_points && Array.isArray(learningContent.key_points) && learningContent.key_points.length > 0) {
        transformedContent.tabs.push({
          id: "key_points",
          title: "Key Points",
          type: "points",
          content: learningContent.key_points
        });
      }

      // If no tabs were added, add a default one
      if (transformedContent.tabs.length === 0) {
        transformedContent.tabs.push({
          id: "overview_tab",
          title: "Overview",
          type: "points",
          content: [
            "Content is being generated...",
            "Please check back in a moment."
          ]
        });
      }

      content.learning_content = transformedContent;
    } else {
      // If no learning content exists yet, create a placeholder
      content.learning_content = {
        overview: "Learning content is being generated. This may take a moment.",
        contentType: mission.content_type || "general",
        examFocus: "upsc",
        tabs: [{
          id: "overview_tab",
          title: "Overview",
          type: "points",
          content: [
            "Content is being generated...",
            "Please check back in a moment."
          ]
        }],
        keyHighlights: [],
        examTips: ["Content is being prepared..."],
        difficulty: "intermediate",
        estimatedTime: "15 minutes"
      };

      // Trigger content generation in the background
      generateContentInBackground(supabaseClient, mission, user.id, roomType);
    }

    // Get room-specific content
    if (roomType) {
      switch (roomType) {
        case 'quiz':
          const { data: quizQuestions } = await supabaseClient
            .from('quiz_questions')
            .select('*')
            .eq('mission_id', missionId)
            .order('created_at')

          content.quiz_questions = quizQuestions || [];
          
          // If no quiz questions, generate placeholder ones
          if (!quizQuestions || quizQuestions.length === 0) {
            content.quiz_questions = generatePlaceholderQuizQuestions();
            
            // Trigger quiz generation in background
            generateQuizInBackground(supabaseClient, mission, user.id);
          }
          break;

        case 'memory':
          const { data: flashcards } = await supabaseClient
            .from('flashcards')
            .select('*')
            .eq('mission_id', missionId)
            .order('created_at')

          content.flashcards = flashcards || [];
          
          // If no flashcards, generate placeholder ones
          if (!flashcards || flashcards.length === 0) {
            content.flashcards = generatePlaceholderFlashcards();
            
            // Trigger flashcards generation in background
            generateFlashcardsInBackground(supabaseClient, mission, user.id);
          }
          break;

        case 'test':
          const { data: testQuestions } = await supabaseClient
            .from('test_questions')
            .select('*')
            .eq('mission_id', missionId)
            .order('created_at')

          content.test_questions = testQuestions || [];
          
          // If no test questions, generate placeholder ones
          if (!testQuestions || testQuestions.length === 0) {
            content.test_questions = generatePlaceholderTestQuestions();
            
            // Trigger test questions generation in background
            generateTestInBackground(supabaseClient, mission, user.id);
          }
          break;
      }
    }

    // Get user's progress for this mission
    const { data: progress } = await supabaseClient
      .from('mission_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('mission_id', missionId)

    content.progress = progress || [];

    return new Response(
      JSON.stringify({
        success: true,
        mission,
        content
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error getting mission content:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to get mission content' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Background content generation functions
async function generateContentInBackground(supabaseClient: any, mission: any, userId: string, roomType: string | null) {
  try {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      console.log('⚠️ Claude API key not configured, skipping content generation');
      return;
    }
    
    const contentToAnalyze = mission.content_text || mission.content_url || mission.title;
    
    // Generate content based on room type
    if (!roomType || roomType === 'clarity') {
      const clarityContent = await generateClarityContent(contentToAnalyze, claudeApiKey);
      
      // Store learning content
      await supabaseClient
        .from('learning_content')
        .upsert({
          mission_id: mission.id,
          overview: clarityContent.overview,
          key_points: clarityContent.keyHighlights,
          timeline: clarityContent.tabs.find((t: any) => t.type === 'timeline')?.content || [],
          concepts: clarityContent.tabs.find((t: any) => t.type === 'concepts')?.content || [],
          difficulty: clarityContent.difficulty,
          estimated_time: clarityContent.estimatedTime
        });
    }
  } catch (error) {
    console.error('Background content generation error:', error);
  }
}

async function generateQuizInBackground(supabaseClient: any, mission: any, userId: string) {
  try {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      console.log('⚠️ Claude API key not configured, skipping quiz generation');
      return;
    }
    
    const contentToAnalyze = mission.content_text || mission.content_url || mission.title;
    
    // Get existing learning content
    const { data: learningContent } = await supabaseClient
      .from('learning_content')
      .select('*')
      .eq('mission_id', mission.id)
      .single();
    
    // Generate quiz questions
    const quizQuestions = await generateQuizQuestions(contentToAnalyze, learningContent, claudeApiKey);
    
    // Store quiz questions
    if (quizQuestions && quizQuestions.length > 0) {
      await supabaseClient
        .from('quiz_questions')
        .insert(
          quizQuestions.map((q: any) => ({
            mission_id: mission.id,
            ...q
          }))
        );
    }
  } catch (error) {
    console.error('Background quiz generation error:', error);
  }
}

async function generateFlashcardsInBackground(supabaseClient: any, mission: any, userId: string) {
  try {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      console.log('⚠️ Claude API key not configured, skipping flashcards generation');
      return;
    }
    
    const contentToAnalyze = mission.content_text || mission.content_url || mission.title;
    
    // Get existing learning content
    const { data: learningContent } = await supabaseClient
      .from('learning_content')
      .select('*')
      .eq('mission_id', mission.id)
      .single();
    
    // Generate flashcards
    const flashcards = await generateFlashcards(contentToAnalyze, learningContent, claudeApiKey);
    
    // Store flashcards
    if (flashcards && flashcards.length > 0) {
      await supabaseClient
        .from('flashcards')
        .insert(
          flashcards.map((f: any) => ({
            mission_id: mission.id,
            ...f
          }))
        );
    }
  } catch (error) {
    console.error('Background flashcards generation error:', error);
  }
}

async function generateTestInBackground(supabaseClient: any, mission: any, userId: string) {
  try {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      console.log('⚠️ Claude API key not configured, skipping test generation');
      return;
    }
    
    const contentToAnalyze = mission.content_text || mission.content_url || mission.title;
    
    // Get existing learning content
    const { data: learningContent } = await supabaseClient
      .from('learning_content')
      .select('*')
      .eq('mission_id', mission.id)
      .single();
    
    // Generate test questions
    const testQuestions = await generateTestQuestions(contentToAnalyze, learningContent, claudeApiKey);
    
    // Store test questions
    if (testQuestions && testQuestions.length > 0) {
      await supabaseClient
        .from('test_questions')
        .insert(
          testQuestions.map((q: any) => ({
            mission_id: mission.id,
            ...q
          }))
        );
    }
  } catch (error) {
    console.error('Background test generation error:', error);
  }
}

// Content generation functions
async function generateClarityContent(content: string, claudeApiKey: string) {
  const systemPrompt = `You are Twizzle, an AI study buddy specialized in Indian competitive exams. Create adaptive, exam-focused learning content that's concise yet comprehensive. Structure content in tabs based on the topic type.

CRITICAL INSTRUCTIONS:
1. Keep content BRIEF and EXAM-FOCUSED
2. Each tab should have 3-5 items maximum
3. Focus on facts that appear in Indian competitive exams
4. Use simple, clear language
5. Include specific years, numbers, and names
6. Highlight exam-important points
7. Return ONLY valid JSON in this exact structure:

{
  "overview": "Brief 2-3 line overview",
  "contentType": "general",
  "examFocus": "upsc",
  "tabs": [
    {
      "id": "key_points",
      "title": "Key Points",
      "type": "points",
      "content": ["Important point 1", "Important point 2"]
    },
    {
      "id": "details",
      "title": "Detailed Information",
      "type": "concepts",
      "content": [
        {
          "concept": "Concept Name",
          "definition": "Definition",
          "explanation": "Explanation"
        }
      ]
    }
  ],
  "keyHighlights": ["highlight1", "highlight2"],
  "examTips": ["tip1", "tip2"],
  "difficulty": "intermediate",
  "estimatedTime": "15 minutes"
}`;

  const userPrompt = `Create exam-focused learning content for: "${content}"
Make it concise, exam-relevant, and structured with appropriate tabs. Focus on facts that frequently appear in Indian competitive exams.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': claudeApiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307', // Fastest Claude model
      max_tokens: 3000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${userPrompt}`
        }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const claudeResponse = await response.json();
  return JSON.parse(claudeResponse.content[0].text);
}

async function generateQuizQuestions(content: string, learningContent: any, claudeApiKey: string) {
  const systemPrompt = `You are Twizzle, creating engaging quiz questions for Indian students. Generate 5 multiple choice questions based on the content. Format as JSON array:
[
  {
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correct_answer": 0,
    "explanation": "Why this is correct",
    "difficulty": "easy|medium|hard",
    "points": 10
  }
]`;

  const userPrompt = `Create 5 quiz questions based on: "${content}"
${learningContent ? `Additional context: ${JSON.stringify(learningContent)}` : ''}
Make questions relevant for Indian competitive exams.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': claudeApiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${userPrompt}`
        }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const claudeResponse = await response.json();
  return JSON.parse(claudeResponse.content[0].text);
}

async function generateFlashcards(content: string, learningContent: any, claudeApiKey: string) {
  const systemPrompt = `You are Twizzle, creating memory flashcards for Indian students. Generate 8 flashcards that help memorize key concepts. Format as JSON array:
[
  {
    "front": "Question or term",
    "back": "Answer or definition",
    "category": "Category name",
    "difficulty": "easy|medium|hard",
    "hint": "Optional hint"
  }
]`;

  const userPrompt = `Create 8 flashcards based on: "${content}"
${learningContent ? `Additional context: ${JSON.stringify(learningContent)}` : ''}
Make flashcards relevant for Indian competitive exams.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': claudeApiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${userPrompt}`
        }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const claudeResponse = await response.json();
  return JSON.parse(claudeResponse.content[0].text);
}

async function generateTestQuestions(content: string, learningContent: any, claudeApiKey: string) {
  const systemPrompt = `You are Twizzle, creating comprehensive tests for Indian students. Generate 8 test questions of varying difficulty. Format as JSON array:
[
  {
    "question": "Question text",
    "question_type": "mcq|short|long",
    "options": ["A", "B", "C", "D"],
    "correct_answer": 0,
    "points": 10,
    "explanation": "Detailed explanation",
    "difficulty": "easy|medium|hard"
  }
]`;

  const userPrompt = `Create 8 test questions based on: "${content}"
${learningContent ? `Additional context: ${JSON.stringify(learningContent)}` : ''}
Make questions relevant for Indian competitive exams.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': claudeApiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${userPrompt}`
        }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const claudeResponse = await response.json();
  return JSON.parse(claudeResponse.content[0].text);
}

// Placeholder content generators
function generatePlaceholderQuizQuestions() {
  return [
    {
      id: "placeholder1",
      question: "What is the capital of India?",
      options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"],
      correct_answer: 1,
      explanation: "New Delhi is the capital city of India.",
      difficulty: "easy",
      points: 10
    },
    {
      id: "placeholder2",
      question: "Which article of the Indian Constitution abolishes untouchability?",
      options: ["Article 14", "Article 15", "Article 17", "Article 21"],
      correct_answer: 2,
      explanation: "Article 17 of the Indian Constitution abolishes untouchability.",
      difficulty: "medium",
      points: 15
    },
    {
      id: "placeholder3",
      question: "Who was the first Prime Minister of India?",
      options: ["Mahatma Gandhi", "Jawaharlal Nehru", "Sardar Patel", "B.R. Ambedkar"],
      correct_answer: 1,
      explanation: "Jawaharlal Nehru was the first Prime Minister of India.",
      difficulty: "easy",
      points: 10
    }
  ];
}

function generatePlaceholderFlashcards() {
  return [
    {
      id: "placeholder1",
      front: "Capital of India",
      back: "New Delhi",
      category: "Geography",
      difficulty: "easy"
    },
    {
      id: "placeholder2",
      front: "Article 17 of the Indian Constitution",
      back: "Abolishes untouchability",
      category: "Polity",
      difficulty: "medium"
    },
    {
      id: "placeholder3",
      front: "First Prime Minister of India",
      back: "Jawaharlal Nehru",
      category: "History",
      difficulty: "easy"
    }
  ];
}

function generatePlaceholderTestQuestions() {
  return [
    {
      id: "placeholder1",
      question: "Explain the significance of the Fundamental Rights in the Indian Constitution.",
      question_type: "long",
      points: 20,
      explanation: "Fundamental Rights are essential for the overall development of individuals and to preserve human dignity.",
      difficulty: "medium"
    },
    {
      id: "placeholder2",
      question: "What is the capital of India?",
      question_type: "mcq",
      options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"],
      correct_answer: 1,
      points: 10,
      explanation: "New Delhi is the capital city of India.",
      difficulty: "easy"
    },
    {
      id: "placeholder3",
      question: "Name the first Prime Minister of India.",
      question_type: "short",
      points: 10,
      explanation: "Jawaharlal Nehru was the first Prime Minister of India.",
      difficulty: "easy"
    }
  ];
}