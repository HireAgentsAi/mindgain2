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
      youtube_url,
      title,
      description,
      subject_name,
      difficulty = 'medium',
      exam_focus = 'upsc'
    }: ProcessYouTubeRequest = await req.json()

    if (!youtube_url) {
      throw new Error('YouTube URL is required')
    }

    // Extract video ID from URL
    const videoId = extractVideoId(youtube_url)
    if (!videoId) {
      throw new Error('Invalid YouTube URL')
    }

    console.log('📺 Processing YouTube video:', videoId)

    // Get video metadata using YouTube API
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
        subject_name: subject_name || 'General',
        difficulty,
        status: 'active',
        estimated_time: Math.ceil(videoData.duration / 60), // Convert seconds to minutes
        xp_reward: 100,
        tags: ['youtube', 'video', exam_focus]
      })
      .select()
      .single()

    if (missionError) {
      throw missionError
    }

    console.log('✅ Mission created:', mission.id)

    // Generate AI content from transcript
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (openaiApiKey && videoData.transcript) {
      try {
        console.log('🤖 Generating AI content from transcript...')
        
        const aiContent = await generateLearningContent(
          videoData.transcript,
          'youtube',
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

        // Generate other room content in parallel
        await Promise.all([
          generateFlashcards(mission.id, videoData.transcript, aiContent, supabaseClient, openaiApiKey),
          generateQuizQuestions(mission.id, videoData.transcript, aiContent, supabaseClient, openaiApiKey),
          generateTestQuestions(mission.id, videoData.transcript, aiContent, supabaseClient, openaiApiKey)
        ])

        console.log('✅ All AI content generated successfully')
      } catch (aiError) {
        console.error('AI generation error:', aiError)
        // Continue without AI content - mission still created
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mission,
        video_data: {
          title: videoData.title,
          duration: videoData.duration,
          thumbnail: videoData.thumbnail,
          transcript_length: videoData.transcript?.length || 0
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
  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')
  
  if (!youtubeApiKey) {
    console.log('⚠️ YouTube API key not found, using fallback')
    return {
      title: 'Educational Video Content',
      description: 'Learning content from YouTube video',
      duration: 900, // 15 minutes in seconds
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      transcript: 'This video contains educational content that can be transformed into interactive learning missions. The AI will analyze the content and create structured learning materials.'
    }
  }

  try {
    // Get video metadata
    const metadataResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${youtubeApiKey}&part=snippet,contentDetails`
    )

    if (!metadataResponse.ok) {
      throw new Error('Failed to fetch video metadata')
    }

    const metadataData = await metadataResponse.json()
    const video = metadataData.items?.[0]

    if (!video) {
      throw new Error('Video not found')
    }

    // Parse duration (PT15M33S format)
    const duration = parseDuration(video.contentDetails.duration)

    // Get captions/transcript
    let transcript = ''
    try {
      const captionsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&key=${youtubeApiKey}&part=snippet`
      )
      
      if (captionsResponse.ok) {
        const captionsData = await captionsResponse.json()
        // Note: Getting actual transcript requires additional API calls and permissions
        // For now, we'll use the video description as content
        transcript = video.snippet.description || 'Educational video content for learning'
      }
    } catch (captionError) {
      console.log('Captions not available, using description')
      transcript = video.snippet.description || 'Educational video content for learning'
    }

    return {
      title: video.snippet.title,
      description: video.snippet.description,
      duration: duration,
      thumbnail: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url,
      transcript: transcript
    }
  } catch (error) {
    console.error('YouTube API error:', error)
    // Fallback to basic data
    return {
      title: 'Educational Video Content',
      description: 'Learning content from YouTube video',
      duration: 900,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      transcript: 'Educational video content that can be transformed into learning missions.'
    }
  }
}

function parseDuration(duration: string): number {
  // Parse ISO 8601 duration (PT15M33S) to seconds
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 900 // Default 15 minutes
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  
  return hours * 3600 + minutes * 60 + seconds
}

async function generateLearningContent(
  transcript: string,
  contentType: string,
  subject?: string,
  apiKey?: string,
  examFocus?: string
) {
  if (!apiKey) throw new Error('OpenAI API key not available')

  const examFocusPrompt = examFocus ? `Focus specifically on ${examFocus.toUpperCase()} exam requirements and patterns.` : ''

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
          content: `You are an AI tutor creating educational content from YouTube videos for Indian competitive exams. ${examFocusPrompt} Generate comprehensive learning material in JSON format:
          {
            "overview": "Brief overview of the video content (2-3 sentences)",
            "key_points": ["point1", "point2", "point3", "point4", "point5"],
            "timeline": [{"timestamp": "00:00", "event": "Event", "description": "Description"}],
            "concepts": [{"term": "Term", "definition": "Definition"}],
            "sample_answers": ["answer1", "answer2"],
            "difficulty": "beginner|intermediate|advanced",
            "estimated_time": "time in minutes"
          }`
        },
        {
          role: 'user',
          content: `Create learning content from this YouTube video transcript: ${transcript.substring(0, 3000)}. Subject: ${subject || 'General'}. Make it relevant for Indian competitive exams.`
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
  transcript: string,
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
          content: `Create EXACTLY 8 flashcards for memorization from this YouTube video content. Return JSON array:
          [{"front": "Question/Term", "back": "Answer/Definition", "category": "Category", "difficulty": "easy|medium|hard", "hint": "Optional hint"}]`
        },
        {
          role: 'user',
          content: `Create 8 flashcards from this video transcript: ${transcript.substring(0, 2000)}`
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
  transcript: string,
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
          content: `Create EXACTLY 6 multiple choice questions from this YouTube video content. Return JSON array:
          [{"question": "Question text", "options": ["A", "B", "C", "D"], "correct_answer": 0, "explanation": "Why correct", "difficulty": "easy|medium|hard", "points": 10}]`
        },
        {
          role: 'user',
          content: `Create 6 quiz questions from this video transcript: ${transcript.substring(0, 2000)}`
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
  transcript: string,
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
          content: `Create 5 test questions (mix of MCQ and short answer) from this YouTube video content. Return JSON array:
          [{"question": "Question", "question_type": "mcq|short", "options": ["A","B","C","D"], "correct_answer": 0, "points": 10, "explanation": "Explanation", "difficulty": "easy|medium|hard"}]`
        },
        {
          role: 'user',
          content: `Create test questions from this video transcript: ${transcript.substring(0, 2000)}`
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