import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { QuestionType } from '@/types/questions'

const ADMIN_EMAIL = 'drfantin@gmail.com'

// Validation des options par type de question (même logique que route.ts)
function validateOptionsByType(questionType: QuestionType, options: unknown): string | null {
  if (!options) {
    return 'Les options sont requises'
  }

  switch (questionType) {
    case 'mcq':
    case 'mcq_image': {
      if (!Array.isArray(options)) return 'Les options doivent être un tableau'
      if (options.length < 2) return 'Il faut au moins 2 options'
      const correctCount = options.filter((o: { correct?: boolean }) => o.correct).length
      if (correctCount !== 1) return 'Il faut exactement 1 réponse correcte'
      if (options.some((o: { text?: string }) => !o.text?.trim())) {
        return 'Toutes les options doivent avoir un texte'
      }
      break
    }

    case 'true_false': {
      if (!Array.isArray(options)) return 'Les options doivent être un tableau'
      if (options.length !== 2) return 'Vrai/Faux doit avoir exactement 2 options'
      const correctCount = options.filter((o: { correct?: boolean }) => o.correct).length
      if (correctCount !== 1) return 'Il faut exactement 1 réponse correcte'
      break
    }

    case 'checkbox': {
      if (!Array.isArray(options)) return 'Les options doivent être un tableau'
      if (options.length < 3) return 'Il faut au moins 3 options pour les cases à cocher'
      const correctCount = options.filter((o: { correct?: boolean }) => o.correct).length
      if (correctCount < 1) return 'Il faut au moins 1 réponse correcte'
      if (options.some((o: { text?: string }) => !o.text?.trim())) {
        return 'Toutes les options doivent avoir un texte'
      }
      break
    }

    case 'highlight': {
      if (!Array.isArray(options)) return 'Les options doivent être un tableau'
      if (options.length < 3) return 'Il faut au moins 3 options pour barrer les intrus'
      const intrus = options.filter((o: { correct?: boolean }) => !o.correct).length
      if (intrus < 1 || intrus > 2) return 'Il doit y avoir 1 ou 2 intrus'
      if (options.some((o: { text?: string }) => !o.text?.trim())) {
        return 'Toutes les options doivent avoir un texte'
      }
      break
    }

    case 'matching': {
      const matchingOpts = options as { pairs?: Array<{ left?: string; right?: string }> }
      if (!matchingOpts.pairs || !Array.isArray(matchingOpts.pairs)) {
        return 'Les paires doivent être définies'
      }
      if (matchingOpts.pairs.length < 2) return 'Il faut au moins 2 paires'
      if (matchingOpts.pairs.some(p => !p.left?.trim() || !p.right?.trim())) {
        return 'Toutes les paires doivent être complètes'
      }
      break
    }

    case 'ordering': {
      if (!Array.isArray(options)) return 'Les options doivent être un tableau'
      if (options.length < 2) return 'Il faut au moins 2 éléments à ordonner'
      if (options.some((o: { text?: string }) => !o.text?.trim())) {
        return 'Tous les éléments doivent avoir un texte'
      }
      break
    }

    case 'fill_blank': {
      const fillOpts = options as { blanks?: Array<{ correctAnswer?: string }>; wordBank?: string[] }
      if (!fillOpts.blanks || !Array.isArray(fillOpts.blanks)) {
        return 'Les blancs doivent être définis'
      }
      if (fillOpts.blanks.length < 1) return 'Il faut au moins 1 blanc'
      if (fillOpts.blanks.some(b => !b.correctAnswer?.trim())) {
        return 'Toutes les réponses correctes doivent être définies'
      }
      break
    }

    case 'case_study': {
      const caseOpts = options as {
        context?: { patient?: string; chief_complaint?: string }
        questions?: Array<{
          text?: string
          choices?: Array<{ correct?: boolean; text?: string }>
          feedback?: string
        }>
      }
      if (!caseOpts.context) return 'Le contexte est requis'
      if (!caseOpts.context.patient?.trim()) return 'Le patient est requis'
      if (!caseOpts.context.chief_complaint?.trim()) return 'Le motif de consultation est requis'
      if (!caseOpts.questions || caseOpts.questions.length < 1) {
        return 'Au moins 1 sous-question est requise'
      }
      for (let i = 0; i < caseOpts.questions.length; i++) {
        const q = caseOpts.questions[i]
        if (!q.text?.trim()) return `La sous-question ${i + 1} doit avoir un texte`
        if (!q.choices || !Array.isArray(q.choices)) {
          return `La sous-question ${i + 1} doit avoir des choix`
        }
        if (!q.choices.some(c => c.correct)) {
          return `La sous-question ${i + 1} doit avoir une réponse correcte`
        }
        if (q.choices.some(c => !c.text?.trim())) {
          return `Tous les choix de la sous-question ${i + 1} doivent avoir un texte`
        }
        if (!q.feedback?.trim()) return `Le feedback de la sous-question ${i + 1} est requis`
      }
      break
    }

    case 'drag_drop':
    case 'image':
    default:
      // Validation flexible pour les types legacy
      break
  }

  return null
}

// PATCH: Mettre à jour une question
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const { question_type, question_text, options, feedback_correct, feedback_incorrect, image_url, points } = body

    // Validation de base
    if (!question_text?.trim()) {
      return NextResponse.json({ error: 'Le texte de la question est requis' }, { status: 400 })
    }
    if (!feedback_correct?.trim()) {
      return NextResponse.json({ error: 'Le feedback correct est requis' }, { status: 400 })
    }

    // Validation des options par type
    if (question_type && options) {
      const optionsError = validateOptionsByType(question_type, options)
      if (optionsError) {
        return NextResponse.json({ error: optionsError }, { status: 400 })
      }
    }

    const adminSupabase = createAdminClient()

    const { error } = await adminSupabase
      .from('questions')
      .update({
        question_type,
        question_text: question_text.trim(),
        options,
        feedback_correct: feedback_correct.trim(),
        feedback_incorrect: feedback_incorrect?.trim() || '',
        image_url: image_url?.trim() || null,
        points
      })
      .eq('id', questionId)

    if (error) {
      console.error('Erreur mise à jour question:', error)
      return NextResponse.json({ error: 'Erreur mise à jour: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur API admin/questions PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE: Supprimer une question
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { error } = await adminSupabase
      .from('questions')
      .delete()
      .eq('id', questionId)

    if (error) {
      console.error('Erreur suppression question:', error)
      return NextResponse.json({ error: 'Erreur suppression: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur API admin/questions DELETE:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
