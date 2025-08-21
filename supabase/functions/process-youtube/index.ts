import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessYouTubeRequest {
  youtube_url: string;
  title?: string;
  description?: string;
  subject_name?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
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
      youtube_url,
      title,
      description,
      subject_name,
      difficulty = 'medium'
    }: ProcessYouTubeRequest = await req.json()

    if (!youtube_url) {
      throw new Error('YouTube URL is required')
    }

    // Extract video ID from URL
    const videoId = extractVideoId(youtube_url)
    if (!videoId) {
      throw new Error('Invalid YouTube URL')
    }

    // Get video metadata and transcript
    const videoData = await getVideoData(videoId)
    
    // Create mission with YouTube content
    const { data: mission, error: missionError } = await supabaseClient
      .from('missions')
      .insert({
        user_id: user.id,
        title: title || videoData.title,
        description: description || videoData.description,
        content_type: 'youtube',
        content_url: youtube_url,
        content_text: videoData.transcript,
        subject_name,
        difficulty,
        status: 'active'
      })
      .select()
      .single()

    if (missionError) {
      throw missionError
    }

    // Generate AI content from transcript
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (openaiApiKey && videoData.transcript) {
      try {
        const aiContent = await generateLearningContent(
          videoData.transcript,
          'youtube',
          subject_name,
          openaiApiKey
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
          generateFlashcards(mission.id, videoData.transcript, aiContent, supabaseClient, openaiApiKey),
          generateQuizQuestions(mission.id, videoData.transcript, aiContent, supabaseClient, openaiApiKey),
          generateTestQuestions(mission.id, videoData.transcript, aiContent, supabaseClient, openaiApiKey)
        ])
      } catch (aiError) {
        console.error('AI generation error:', aiError)
        // Continue without AI content
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mission,
        video_data: {
          title: videoData.title,
          duration: videoData.duration,
          thumbnail: videoData.thumbnail
        },
        message: 'YouTube video processed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error processing YouTube video:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process YouTube video' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

async function getVideoData(videoId: string) {
  // In a real implementation, you would use YouTube Data API
  // For now, return mock data
  return {
    title: 'Educational Video Content',
    description: 'Learning content from YouTube video',
    duration: '15:30',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    transcript: 'This is the video transcript content that would be extracted from the YouTube video. It contains educational information that can be transformed into learning missions.'
  }
}

async function generateLearningContent(transcript: string, contentType: string, subject?: string, apiKey?: string) {
  if (!apiKey) throw new Error('OpenAI API key not available')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an AI tutor creating educational content from YouTube videos for Indian competitive exams. Generate comprehensive learning material in JSON format.`
        },
        {
          role: 'user',
          content: `Create learning content from this video transcript: ${transcript}. Subject: ${subject || 'General'}. Make it relevant for Indian competitive exams.`
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

async function generateFlashcards(missionId: string, transcript: string, learningContent: any, supabaseClient: any, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Create 5 flashcards for memorization from this video content. Return JSON array: [{"front": "Question/Term", "back": "Answer/Definition", "category": "Category", "difficulty": "easy|medium|hard", "hint": "Optional hint"}]`
        },
        {
          role: 'user',
          content: `Create flashcards from: ${transcript}`
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
        flashcards.map((card: any) => ({
          mission_id: missionId,
          ...card
        }))
      )
  }
}

async function generateQuizQuestions(missionId: string, transcript: string, learningContent: any, supabaseClient: any, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Create 5 multiple choice questions from this video content. Return JSON array: [{"question": "Question text", "options": ["A", "B", "C", "D"], "correct_answer": 0, "explanation": "Why correct", "difficulty": "easy|medium|hard", "points": 10}]`
        },
        {
          role: 'user',
          content: `Create quiz questions from: ${transcript}`
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
        questions.map((q: any) => ({
          mission_id: missionId,
          ...q
        }))
      )
  }
}

async function generateTestQuestions(missionId: string, transcript: string, learningContent: any, supabaseClient: any, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Create 8 test questions (mix of MCQ and short answer) from this video content. Return JSON array: [{"question": "Question", "question_type": "mcq|short", "options": ["A","B","C","D"], "correct_answer": 0, "points": 10, "explanation": "Explanation", "difficulty": "easy|medium|hard"}]`
        },
        {
          role: 'user',
          content: `Create test questions from: ${transcript}`
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
        questions.map((q: any) => ({
          mission_id: missionId,
          ...q
        }))
      )
  }
}