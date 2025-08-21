import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OCRRequest {
  image_base64: string;
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
      image_base64,
      title,
      subject_name = 'General',
      difficulty = 'medium',
      exam_focus = 'upsc'
    }: OCRRequest = await req.json()

    if (!image_base64) {
      throw new Error('Image data is required')
    }

    console.log('📸 Processing scanned image with OCR...')

    // Extract text from image using Google Vision API
    const extractedText = await extractTextFromImage(image_base64)
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from image. Please ensure the image contains clear, readable text.')
    }

    console.log('✅ Text extracted from image, length:', extractedText.length)

    // Create mission with scanned content
    const { data: mission, error: missionError } = await supabaseClient
      .from('missions')
      .insert({
        user_id: user.id,
        title: title || `Scanned Notes - ${new Date().toLocaleDateString()}`,
        description: `Learning mission generated from scanned study material`,
        content_type: 'camera',
        content_text: extractedText.substring(0, 5000),
        subject_name,
        difficulty,
        status: 'active',
        estimated_time: Math.min(Math.max(Math.floor(extractedText.length / 150), 10), 45),
        xp_reward: 120,
        tags: ['camera', 'scan', 'notes', exam_focus]
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
        console.log('🤖 Generating AI content from scanned text...')
        
        const aiContent = await generateLearningContent(
          extractedText,
          'camera',
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
        message: 'Image processed successfully with OCR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error processing image OCR:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process image' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function extractTextFromImage(imageBase64: string): Promise<string> {
  const googleVisionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  
  if (!googleVisionApiKey) {
    console.log('⚠️ Google Vision API key not found, using OpenAI Vision as fallback')
    return await extractTextWithOpenAI(imageBase64)
  }

  try {
    console.log('🔍 Using Google Vision API for OCR...')
    
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageBase64
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1
              }
            ]
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`)
    }

    const result = await response.json()
    const textAnnotations = result.responses[0]?.textAnnotations
    
    if (!textAnnotations || textAnnotations.length === 0) {
      throw new Error('No text detected in image')
    }

    return textAnnotations[0].description || ''
    
  } catch (error) {
    console.error('Google Vision API error:', error)
    // Fallback to OpenAI Vision
    return await extractTextWithOpenAI(imageBase64)
  }
}

async function extractTextWithOpenAI(imageBase64: string): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    throw new Error('No OCR API keys configured')
  }

  try {
    console.log('🔍 Using OpenAI Vision API for OCR...')
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text content from this image. Focus on educational content like notes, textbooks, or study materials. Return only the extracted text, maintaining structure and formatting. If you see handwritten notes, transcribe them accurately.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI Vision API error:', errorText)
      throw new Error(`OpenAI Vision API error: ${response.status}`)
    }

    const result = await response.json()
    return result.choices[0].message.content || ''
    
  } catch (error) {
    console.error('OpenAI Vision OCR error:', error)
    throw new Error('Failed to extract text from image using OCR')
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

  const examFocusPrompt = examFocus ? `Focus on ${examFocus.toUpperCase()} exam patterns.` : ''

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
            "overview": "Brief overview (2-3 sentences)",
            "key_points": ["point1", "point2", "point3"],
            "concepts": [{"term": "Term", "definition": "Definition"}],
            "examples": ["example1", "example2"],
            "difficulty": "beginner|intermediate|advanced",
            "estimated_time": "time in minutes"
          }`
        },
        {
          role: 'user',
          content: `Create learning content from: ${text.substring(0, 3000)}. Subject: ${subject || 'General'}. Content type: ${contentType}.`
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
          content: `Create EXACTLY 8 flashcards. Return JSON array:
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