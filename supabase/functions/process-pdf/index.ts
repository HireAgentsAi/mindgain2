import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PDFRequest {
  userId: string;
  pdfUrl: string;
  fileName: string;
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

    const { userId, pdfUrl, fileName }: PDFRequest = await req.json()

    if (!userId || !pdfUrl) {
      throw new Error('User ID and PDF URL are required')
    }

    // Extract text from PDF using OpenAI's vision API or PDF parsing
    const extractedText = await extractTextFromPDF(pdfUrl)
    
    if (!extractedText || extractedText.length < 100) {
      throw new Error('Could not extract sufficient text from PDF')
    }

    // Generate learning content using AI
    const learningContent = await generateLearningContent(extractedText, fileName)

    // Create mission in database
    const { data: mission, error: missionError } = await supabaseClient
      .from('missions')
      .insert({
        user_id: userId,
        title: `PDF Study: ${fileName}`,
        description: `Learning mission generated from ${fileName}`,
        content_type: 'pdf',
        content_url: pdfUrl,
        content_text: extractedText.substring(0, 5000), // Store first 5000 chars
        difficulty: 'medium',
        estimated_time: Math.min(Math.max(Math.floor(extractedText.length / 100), 15), 60),
        xp_reward: 150,
        tags: ['pdf', 'document', 'study']
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
    console.error('Error processing PDF:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process PDF' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  try {
    // Download PDF
    const response = await fetch(pdfUrl)
    if (!response.ok) {
      throw new Error('Failed to download PDF')
    }

    const pdfBuffer = await response.arrayBuffer()
    
    // For now, return a placeholder - in production you'd use a PDF parsing library
    // or send to a service that can extract text from PDFs
    return `Extracted text from PDF document. This would contain the actual PDF content in a real implementation. The PDF processing would extract all text content, maintain formatting, and prepare it for AI analysis to generate educational content.`
    
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

async function generateLearningContent(text: string, fileName: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    // Fallback content
    return {
      clarity: {
        summary: `Summary of ${fileName}`,
        keyPoints: ['Key concept 1', 'Key concept 2', 'Key concept 3'],
        examples: ['Example 1', 'Example 2']
      },
      quiz: [
        {
          question: `What is the main topic discussed in ${fileName}?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct: 0,
          explanation: 'This covers the main theme of the document.'
        }
      ],
      memory: [
        {
          front: 'Key Term',
          back: 'Definition from the document'
        }
      ],
      test: [
        {
          question: `Analyze the main arguments presented in ${fileName}`,
          type: 'long',
          points: 20
        }
      ]
    }
  }

  const prompt = `Analyze this PDF content and create educational material:

Content: ${text.substring(0, 3000)}

Generate learning content in JSON format:
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
          content: 'You are an educational content generator. Create comprehensive learning materials from documents.'
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