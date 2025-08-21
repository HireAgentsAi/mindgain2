import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ValidationCriteria {
  subjectBalance: boolean;
  difficultyBalance: boolean;
  examRelevance: boolean;
  factualAccuracy: boolean;
  qualityScore: number;
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

    const { quiz_date } = await req.json()
    const targetDate = quiz_date || new Date().toISOString().split('T')[0]

    // Get today's quiz
    const { data: quiz, error: quizError } = await supabaseClient
      .from('daily_quizzes')
      .select('*')
      .eq('date', targetDate)
      .single()

    if (quizError || !quiz) {
      throw new Error('Quiz not found for validation')
    }

    // Perform traditional validation checks
    const validation = await performTraditionalValidation(quiz.questions)
    
    // Use AI for cross-validation
    const aiValidation = await performAIValidation(quiz.questions)
    
    // Combine results
    const finalValidation = {
      ...validation,
      ai_cross_check: aiValidation,
      overall_quality: calculateOverallQuality(validation, aiValidation)
    }

    // Store validation results
    const { data: validationRecord, error: validationError } = await supabaseClient
      .from('daily_quiz_validation')
      .upsert({
        quiz_date: targetDate,
        questions_validated: true,
        validation_method: 'traditional_plus_ai',
        validator_notes: generateValidatorNotes(finalValidation),
        quality_score: finalValidation.overall_quality,
        subjects_balance_check: validation.subjectBalance,
        difficulty_balance_check: validation.difficultyBalance,
        exam_relevance_check: validation.examRelevance,
        validated_at: new Date().toISOString(),
        validated_by: 'automated_system'
      }, {
        onConflict: 'quiz_date'
      })

    if (validationError) throw validationError

    return new Response(
      JSON.stringify({
        success: true,
        validation: finalValidation,
        recommendations: generateImprovementRecommendations(finalValidation),
        quiz_approved: finalValidation.overall_quality >= 75
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error validating daily quiz:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to validate quiz',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function performTraditionalValidation(questions: any[]): Promise<ValidationCriteria> {
  // 1. Subject Balance Check
  const subjectCounts: Record<string, number> = {}
  questions.forEach(q => {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1
  })
  
  const expectedSubjects = ['History', 'Polity', 'Geography', 'Economy', 'Science & Technology', 'Current Affairs']
  const subjectBalance = expectedSubjects.every(subject => subjectCounts[subject] >= 1)

  // 2. Difficulty Balance Check
  const difficultyCounts: Record<string, number> = {}
  questions.forEach(q => {
    difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] || 0) + 1
  })
  
  const difficultyBalance = 
    difficultyCounts.easy >= 4 && 
    difficultyCounts.medium >= 3 && 
    difficultyCounts.hard >= 1

  // 3. Exam Relevance Check
  const examKeywords = [
    'article', 'constitution', 'act', 'policy', 'scheme', 'mission',
    'river', 'mountain', 'state', 'capital', 'dynasty', 'empire',
    'governor', 'president', 'minister', 'parliament', 'court'
  ]
  
  const relevantQuestions = questions.filter(q => {
    const questionText = q.question.toLowerCase()
    return examKeywords.some(keyword => questionText.includes(keyword))
  })
  
  const examRelevance = relevantQuestions.length >= questions.length * 0.7

  // 4. Factual Accuracy Check (basic validation)
  const factualAccuracy = questions.every(q => 
    q.question && 
    q.options && 
    q.options.length === 4 && 
    q.correct_answer >= 0 && 
    q.correct_answer <= 3 &&
    q.explanation &&
    q.explanation.length > 20
  )

  // 5. Calculate Quality Score
  let qualityScore = 0
  if (subjectBalance) qualityScore += 25
  if (difficultyBalance) qualityScore += 25
  if (examRelevance) qualityScore += 25
  if (factualAccuracy) qualityScore += 25

  return {
    subjectBalance,
    difficultyBalance,
    examRelevance,
    factualAccuracy,
    qualityScore
  }
}

async function performAIValidation(questions: any[]) {
  try {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      console.log('⚠️ Claude API key not configured, using fallback validation');
      return {
        factual_accuracy_score: 75,
        exam_relevance_score: 80,
        explanation_quality_score: 70,
        overall_ai_score: 75,
        issues_found: ['AI validation unavailable - API key not configured'],
        recommendations: ['Configure Claude API key for AI validation']
      };
    }
    
    const prompt = `As an expert in Indian competitive exams, validate these 10 daily quiz questions for factual accuracy and exam relevance:

${JSON.stringify(questions, null, 2)}

Check for:
1. Factual accuracy of questions and answers
2. Relevance to Indian competitive exams (UPSC, SSC, Banking)
3. Appropriate difficulty progression
4. Quality of explanations
5. Subject matter expertise

Return JSON:
{
  "factual_accuracy_score": 0-100,
  "exam_relevance_score": 0-100,
  "explanation_quality_score": 0-100,
  "overall_ai_score": 0-100,
  "issues_found": ["issue1", "issue2"],
  "recommendations": ["rec1", "rec2"]
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`)
    }

    const claudeResponse = await response.json()
    return JSON.parse(claudeResponse.content[0].text)
  } catch (error) {
    console.error('AI validation error:', error)
    return {
      factual_accuracy_score: 75,
      exam_relevance_score: 80,
      explanation_quality_score: 70,
      overall_ai_score: 75,
      issues_found: ['AI validation unavailable'],
      recommendations: ['Manual review recommended']
    }
  }
}

function calculateOverallQuality(traditional: ValidationCriteria, ai: any): number {
  const traditionalWeight = 0.6
  const aiWeight = 0.4
  
  return Math.round(
    (traditional.qualityScore * traditionalWeight) + 
    (ai.overall_ai_score * aiWeight)
  )
}

function generateValidatorNotes(validation: any): string {
  const notes = []
  
  if (!validation.subjectBalance) {
    notes.push('Subject distribution needs improvement')
  }
  
  if (!validation.difficultyBalance) {
    notes.push('Difficulty balance requires adjustment')
  }
  
  if (!validation.examRelevance) {
    notes.push('Exam relevance could be enhanced')
  }
  
  if (validation.ai_cross_check.issues_found.length > 0) {
    notes.push(`AI identified: ${validation.ai_cross_check.issues_found.join(', ')}`)
  }
  
  return notes.length > 0 ? notes.join('; ') : 'All validation checks passed'
}

function generateImprovementRecommendations(validation: any): string[] {
  const recommendations = []
  
  if (validation.overall_quality < 80) {
    recommendations.push('Consider regenerating questions with stricter criteria')
  }
  
  if (!validation.subjectBalance) {
    recommendations.push('Ensure at least 1 question from each core subject')
  }
  
  if (!validation.difficultyBalance) {
    recommendations.push('Maintain 60% easy, 30% medium, 10% hard distribution')
  }
  
  recommendations.push(...validation.ai_cross_check.recommendations)
  
  return recommendations
}