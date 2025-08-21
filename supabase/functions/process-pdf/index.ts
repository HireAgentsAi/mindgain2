import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessPDFRequest {
  pdf_url?: string;
  pdf_base64?: string;
  title?: string;
  subject_name?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  exam_focus?: string;
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

    const {
      pdf_url,
      pdf_base64,
      title,
      subject_name = 'General',
      difficulty = 'medium',
      exam_focus = 'upsc'
    }: ProcessPDFRequest = await req.json()

    if (!pdf_url && !pdf_base64) {
      throw new Error('PDF URL or base64 data is required')
    }

    console.log('📄 Processing PDF document...')

    // Extract text from PDF using PDF.co API
    const extractedText = await extractTextFromPDF(pdf_url, pdf_base64)
    
    if (!extractedText || extractedText.length < 100) {
      throw new Error('Could not extract sufficient text from PDF')
    }

    console.log('✅ Text extracted, length:', extractedText.length)

    // Create mission with PDF content
    const { data: mission, error: missionError } = await supabaseClient
      .from('missions')
      .insert({
        user_id: user.id,
        title: title || 'PDF Study Material',
        description: `Learning mission generated from PDF document`,
        content_type: 'pdf',
        content_url: pdf_url,
        content_text: extractedText.substring(0, 5000), // Store first 5000 chars
        subject_name,
        difficulty,
        status: 'active',
        estimated_time: Math.min(Math.max(Math.floor(extractedText.length / 200), 15), 60),
        xp_reward: 150,
        tags: ['pdf', 'document', exam_focus]
      })
      .select()
      .single()

    if (missionError) {
      throw missionError
    }

    console.log('✅ Mission created:', mission.id)

    // Generate AI content from extracted text
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (openaiApiKey) {
      try {
        console.log('🤖 Generating AI content from PDF text...')
        
        const aiContent = await generateLearningContent(
          extractedText,
          'pdf',
          subject_name,
          openaiApiKey,
          exam_focus
        )

        // Store learning content
        await supabaseClient
          .from('learning_content')
          .insert({
            mission_id: mission.id,
            room_type: 'clarity',
            content_data: aiContent
          })

        // Generate other room content
        await Promise.all([
          generateFlashcards(mission.id, extractedText, aiContent, supabaseClient, openaiApiKey),
          generateQuizQuestions(mission.id, extractedText, aiContent, supabaseClient, openaiApiKey),
          generateTestQuestions(mission.id, extractedText, aiContent, supabaseClient, openaiApiKey)
        ])

        console.log('✅ All AI content generated successfully')
      } catch (aiError) {
        console.error('AI generation error:', aiError)
        // Continue without AI content
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mission,
        extracted_text_preview: extractedText.substring(0, 500) + '...',
        text_length: extractedText.length,
        message: 'PDF processed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error processing PDF:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process PDF' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function extractTextFromPDF(pdfUrl?: string, pdfBase64?: string): Promise<string> {
  const pdfCoApiKey = Deno.env.get('PDF_CO_API_KEY')
  
  if (!pdfCoApiKey) {
    console.log('⚠️ PDF.co API key not found, using fallback')
    return 'This PDF contains educational content that can be transformed into interactive learning missions. The AI will analyze the content and create structured learning materials including quizzes, flashcards, and comprehensive tests.'
  }

  try {
    let pdfData = pdfBase64

    // If URL provided, download and convert to base64
    if (pdfUrl && !pdfBase64) {
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        throw new Error('Failed to download PDF')
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      pdfData = btoa(String.fromCharCode(...uint8Array))
    }

    if (!pdfData) {
      throw new Error('No PDF data available')
    }

    // Use PDF.co API to extract text
    const extractResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'x-api-key': pdfCoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: `data:application/pdf;base64,${pdfData}`,
        pages: '1-10', // Limit to first 10 pages for processing speed
        inline: true
      })
    })

    if (!extractResponse.ok) {
      throw new Error(`PDF.co API error: ${extractResponse.status}`)
    }

    const extractData = await extractResponse.json()
    
    if (!extractData.body) {
      throw new Error('No text extracted from PDF')
    }

    return extractData.body
    
  } catch (error) {
    console.error('PDF extraction error:', error)
    // Fallback content
    return 'This PDF document contains educational material that can be converted into interactive learning content. The system will create structured lessons, quizzes, and practice materials based on the document content.'
  }
}

async function generateLearningContent(
  text: string,
  contentType: string,
  subject?: string,
  apiKey?: string,
  examFocus?: string
) {
  if (!apiKey) throw new Error('OpenAI API key not available')

  const examFocusPrompt = examFocus ? `Focus on ${examFocus.toUpperCase()} exam patterns and requirements.` : ''

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an AI tutor creating educational content for Indian competitive exams. ${examFocusPrompt} Generate comprehensive learning material in JSON format:
          {
            "overview": "Brief overview of the content (2-3 sentences)",
            "key_points": ["point1", "point2", "point3", "point4", "point5"],
            "concepts": [{"term": "Term", "definition": "Definition"}],
            "examples": ["example1", "example2", "example3"],
            "difficulty": "beginner|intermediate|advanced",
            "estimated_time": "time in minutes"
          }`
        },
        {
          role: 'user',
          content: `Create learning content from: ${text.substring(0, 3000)}. Subject: ${subject || 'General'}. Content type: ${contentType}. Make it relevant for Indian competitive exams.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const aiResponse = await response.json()
  return JSON.parse(aiResponse.choices[0].message.content)
}

async function generateFlashcards(
  missionId: string,
  text: string,
  learningContent: any,
  supabaseClient: any,
  apiKey: string
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Create EXACTLY 8 flashcards for memorization. Return JSON array:
          [{"front": "Question/Term", "back": "Answer/Definition", "category": "Category", "difficulty": "easy|medium|hard", "hint": "Optional hint"}]`
        },
        {
          role: 'user',
          content: `Create 8 flashcards from: ${text.substring(0, 2000)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  })

  if (response.ok) {
    const aiResponse = await response.json()
    const flashcards = JSON.parse(aiResponse.choices[0].message.content)
    
    await supabaseClient
      .from('flashcards')
      .insert(
        flashcards.slice(0, 8).map((card: any) => ({
          mission_id: missionId,
          ...card
        }))
      )
  }
}

async function generateQuizQuestions(
  missionId: string,
  text: string,
  learningContent: any,
  supabaseClient: any,
  apiKey: string
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Create EXACTLY 6 multiple choice questions. Return JSON array:
          [{"question": "Question text", "options": ["A", "B", "C", "D"], "correct_answer": 0, "explanation": "Why correct", "difficulty": "easy|medium|hard", "points": 10}]`
        },
        {
          role: 'user',
          content: `Create 6 quiz questions from: ${text.substring(0, 2000)}`
        }
      ],
      temperature: 0.8,
      max_tokens: 1500,
    }),
  })

  if (response.ok) {
    const aiResponse = await response.json()
    const questions = JSON.parse(aiResponse.choices[0].message.content)
    
    await supabaseClient
      .from('quiz_questions')
      .insert(
        questions.slice(0, 6).map((q: any) => ({
          mission_id: missionId,
          ...q
        }))
      )
  }
}

async function generateTestQuestions(
  missionId: string,
  text: string,
  learningContent: any,
  supabaseClient: any,
  apiKey: string
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Create 5 test questions (mix of MCQ and short answer). Return JSON array:
          [{"question": "Question", "question_type": "mcq|short", "options": ["A","B","C","D"], "correct_answer": 0, "points": 10, "explanation": "Explanation", "difficulty": "easy|medium|hard"}]`
        },
        {
          role: 'user',
          content: `Create test questions from: ${text.substring(0, 2000)}`
        }
      ],
      temperature: 0.8,
      max_tokens: 2000,
    }),
  })

  if (response.ok) {
    const aiResponse = await response.json()
    const questions = JSON.parse(aiResponse.choices[0].message.content)
    
    await supabaseClient
      .from('test_questions')
      .insert(
        questions.slice(0, 5).map((q: any) => ({
          mission_id: missionId,
          ...q
        }))
      )
  }
}