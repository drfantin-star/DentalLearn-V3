import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering — prevents Next.js from caching the response
export const dynamic = 'force-dynamic'

// Seeded PRNG (mulberry32) for deterministic daily shuffle
function mulberry32(seed: number) {
  let t = seed
  return () => {
    t = (t + 0x6D2B79F5) | 0
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const rng = mulberry32(seed)
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function dailySeedFromDate(dateStr: string): number {
  // Convert date string "YYYY-MM-DD" to a numeric seed
  // Different each day, deterministic for the same day
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// GET: Fetch today's 10 daily quiz questions
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = session.user.id

    // Check if user already completed today's quiz
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('daily_quiz_results')
      .select('id')
      .eq('user_id', userId)
      .eq('quiz_date', today)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Quiz du jour deja complete' },
        { status: 409 }
      )
    }

    // Call the RPC function to get deterministic daily questions
    const { data: questions, error } = await supabase.rpc('get_daily_quiz', {
      p_user_id: userId,
    })

    if (error) {
      console.error('RPC get_daily_quiz error:', error)

      // Fallback: fetch all eligible questions and shuffle with daily seed
      const { data: fallbackQuestions, error: fallbackError } = await supabase
        .from('questions')
        .select(`
          id,
          question_text,
          options,
          feedback_correct,
          feedback_incorrect,
          points,
          question_type,
          image_url,
          sequence:sequences!questions_sequence_id_fkey (
            formation:formations!sequences_formation_id_fkey (
              title
            )
          )
        `)
        .eq('is_daily_quiz_eligible', true)

      if (fallbackError) {
        return NextResponse.json(
          { error: 'Impossible de charger les questions' },
          { status: 500 }
        )
      }

      // Shuffle all eligible questions with a date-based seed, then take 10
      const seed = dailySeedFromDate(today)
      const allQuestions = (fallbackQuestions || []) as Record<string, unknown>[]
      const shuffled = seededShuffle(allQuestions, seed)
      const selected = shuffled.slice(0, 10)

      const formatted = selected.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options,
        feedback_correct: q.feedback_correct,
        feedback_incorrect: q.feedback_incorrect,
        points: q.points,
        question_type: q.question_type,
        image_url: q.image_url || null,
        formation_title: (q.sequence as Record<string, unknown>)?.formation
          ? ((q.sequence as Record<string, unknown>).formation as Record<string, unknown>).title
          : null,
      }))

      return NextResponse.json({ questions: formatted })
    }

    return NextResponse.json({ questions: questions || [] })
  } catch (err) {
    console.error('Daily quiz GET error:', err)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST: Save daily quiz results
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { score, total_questions, total_points, question_ids } = body

    const today = new Date().toISOString().split('T')[0]

    // Save quiz result
    const { error: insertError } = await supabase
      .from('daily_quiz_results')
      .upsert(
        {
          user_id: userId,
          quiz_date: today,
          score,
          total_questions,
          total_points,
          question_ids,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,quiz_date' }
      )

    if (insertError) {
      console.error('Error saving quiz result:', insertError)
      return NextResponse.json(
        { error: 'Impossible de sauvegarder le resultat' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Daily quiz POST error:', err)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
