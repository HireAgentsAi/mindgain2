import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MascotRequest {
  userId: string;
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

    const { userId }: MascotRequest = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    // Get user stats and memory
    const [userStats, userMemory, recentAttempts] = await Promise.all([
      supabaseClient
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single(),
      supabaseClient
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .order('proficiency_score', { ascending: true })
        .limit(5),
      supabaseClient
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    // Generate personalized recommendations using AI
    const recommendations = await generateRecommendations(
      userStats.data,
      userMemory.data || [],
      recentAttempts.data || []
    )

    // Store recommendations
    const { data: storedRecommendations, error } = await supabaseClient
      .from('mascot_recommendations')
      .insert(
        recommendations.map(rec => ({
          user_id: userId,
          recommendation_text: rec.text,
          recommendation_type: rec.type,
          subject: rec.subject
        }))
      )
      .select()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        recommendations: recommendations.map(r => r.text)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating mascot recommendations:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate recommendations' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function generateRecommendations(userStats: any, userMemory: any[], recentAttempts: any[]) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiApiKey) {
    console.log('OpenAI API key not found, using fallback recommendations')
    return [
      {
        text: "Keep up the great work! Ready for today's challenge? 🚀",
        type: "daily_motivation",
        subject: "General"
      },
      {
        text: "Your streak is building! Let's tackle some weak areas 💪",
        type: "streak_motivation", 
        subject: "General"
      },
      {
        text: "Time for some focused practice! Pick your favorite subject 📚",
        type: "study_tip",
        subject: "General"
      }
    ]
  }

  const weakAreas = userMemory.filter(m => m.proficiency_score < 60)
  const strongAreas = userMemory.filter(m => m.proficiency_score >= 80)
  const streakDays = userStats?.streak_days || 0

  const context = `
User Stats:
- Current Level: ${userStats?.current_level || 1}
- Streak Days: ${streakDays}
- Total XP: ${userStats?.total_xp || 0}

Weak Areas: ${weakAreas.map(w => `${w.topic} (${w.proficiency_score}%)`).join(', ') || 'None identified'}
Strong Areas: ${strongAreas.map(s => `${s.topic} (${s.proficiency_score}%)`).join(', ') || 'None yet'}

Recent Performance: ${recentAttempts.slice(0, 3).map(a => `${a.subject}: ${a.score_percentage}%`).join(', ') || 'No recent attempts'}
`

  const prompt = `As MINDGAINS mascot, generate 3 personalized recommendations for this Indian student. Be encouraging, specific, and focus on Indian subjects (History, Polity, Geography, Economy, Science & Technology, Current Affairs).

${context}

Generate recommendations that:
1. Address weak areas with specific suggestions
2. Motivate streak continuation
3. Celebrate achievements
4. Suggest relevant Indian topics to study

Return JSON:
{
  "recommendations": [
    {
      "text": "Personalized message with emoji",
      "type": "weak_area|streak_motivation|achievement_unlock|study_tip",
      "subject": "Subject name"
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
          content: 'You are the MINDGAINS mascot - friendly, encouraging, and focused on Indian education. Keep messages under 100 characters.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    console.error(`OpenAI API error: ${response.status} - ${response.statusText}`)
    const errorText = await response.text()
    console.error('OpenAI error details:', errorText)
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const aiResponse = await response.json()
  const result = JSON.parse(aiResponse.choices[0].message.content)
  
  return result.recommendations || [
    {
      text: "Keep learning and growing! You're doing amazing! 🌟",
      type: "daily_motivation",
      subject: "General"
    }
  ]
}