import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OCRRequest {
  userId: string;
  imageBase64: string;
  fileName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, imageBase64, fileName }: OCRRequest = await req.json()

    if (!userId || !imageBase64) {
      throw new Error('User ID and image data are required')
    }

    // Extract text from image using OpenAI Vision API
    const extractedText = await extractTextFromImage(imageBase64)
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from image')
    }

    // Generate learning content using AI
    const learningContent = await generateLearningContent(extractedText, fileName || 'Scanned Image')

    // Create mission in database
    const { data: mission, error: missionError } = await supabaseClient
      .from('missions')
      .insert({
        user_id: userId,
        title: `Camera Scan: ${fileName || 'Study Notes'}`,
        description: `Learning mission generated from scanned image`,
        content_type: 'camera',
        content_text: extractedText.substring(0, 5000),
        difficulty: 'medium',
        estimated_time: Math.min(Math.max(Math.floor(extractedText.length / 80), 10), 45),
        xp_reward: 120,
        tags: ['camera', 'scan', 'notes']
      })
      .select()
      .single()

    if (missionError) throw missionError

    // Store learning content for each room
    const contentPromises = Object.entries(learningContent).map(([roomType, content]) =>
      supabaseClient
        .from('learning_content')
        .insert({
          mission_id: mission.id,
          room_type: roomType,
          content_data: content
        })
    )

    await Promise.all(contentPromises)

    return new Response(
      JSON.stringify({
        success: true,
        extractedText: extractedText.substring(0, 500) + '...',
        mission: {
          id: mission.id,
          title: mission.title,
          description: mission.description,
          estimated_time: mission.estimated_time,
          xp_reward: mission.xp_reward
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing image OCR:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process image' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function extractTextFromImage(imageBase64: string): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
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
                text: 'Extract all text content from this image. Focus on educational content like notes, textbooks, or study materials. Return only the extracted text, maintaining structure and formatting.'
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
    console.error('OCR extraction error:', error)
    throw new Error('Failed to extract text from image')
  }
}

async function generateLearningContent(text: string, fileName: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    // Fallback content
    return {
      clarity: {
        summary: `Summary of scanned content from ${fileName}`,
        keyPoints: ['Key concept 1', 'Key concept 2', 'Key concept 3'],
        examples: ['Example 1', 'Example 2']
      },
      quiz: [
        {
          question: 'What is the main topic in the scanned content?',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct: 0,
          explanation: 'This covers the main theme of the scanned material.'
        }
      ],
      memory: [
        {
          front: 'Key Term',
          back: 'Definition from scanned content'
        }
      ],
      test: [
        {
          question: 'Analyze the main concepts from the scanned material',
          type: 'long',
          points: 20
        }
      ]
    }
  }

  const prompt = `Create educational content from this scanned text:

Content: ${text.substring(0, 3000)}

Generate learning material in JSON format:
{
  "clarity": {
    "summary": "Clear summary",
    "keyPoints": ["point1", "point2", "point3"],
    "examples": ["example1", "example2"]
  },
  "quiz": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "Why this is correct"
    }
  ],
  "memory": [
    {
      "front": "Term/Concept",
      "back": "Definition/Explanation"
    }
  ],
  "test": [
    {
      "question": "Analysis question",
      "type": "long",
      "points": 20
    }
  ]
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an educational content generator. Create comprehensive learning materials from scanned documents.'
        },
        {
          role: 'user',
          content: prompt
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