import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { QuestionType } from '@/types/questions'
import { isSuperAdmin } from '@/lib/auth/rbac'

// Validation NEW format matching (post-migration 20260527e).
// Plus stricte que la contrainte CHECK DB : protège la qualité pédagogique
// (intégrité référentielle, unicité, regex stricts). Identique à route.ts.
function validateMatchingNew(options: unknown): { error: string; details: string[] } | null {
  if (!options || typeof options !== 'object') {
    return { error: 'matching_validation_failed', details: ['missing_options_object'] }
  }
  const o = options as Record<string, unknown>
  const details: string[] = []

  if (!Array.isArray(o.pairs) || o.pairs.length === 0) details.push('pairs_missing_or_empty')
  if (!Array.isArray(o.options) || o.options.length === 0) details.push('options_missing_or_empty')
  if (!Array.isArray(o.correctAnswers) || o.correctAnswers.length === 0) {
    details.push('correctAnswers_missing_or_empty')
  }
  if (details.length > 0) return { error: 'matching_validation_failed', details }

  const pairs = o.pairs as unknown[]
  const opts = o.options as unknown[]
  const answers = o.correctAnswers as unknown[]

  if (pairs.length !== opts.length || pairs.length !== answers.length) details.push('lengths_mismatch')
  if (pairs.length < 2) details.push('too_few_pairs')
  if (details.length > 0) return { error: 'matching_validation_failed', details }

  const RID_RE = /^[A-Z]+$/

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]
    if (!p || typeof p !== 'object') { details.push(`pair_${i}_not_object`); continue }
    const pp = p as Record<string, unknown>
    const keys = Object.keys(pp).sort()
    if (keys.length !== 2 || keys[0] !== 'left' || keys[1] !== 'rightId') {
      details.push(`pair_${i}_unexpected_keys`)
    }
    if (typeof pp.left !== 'string' || !pp.left.trim()) details.push(`pair_${i}_left_empty`)
    if (typeof pp.rightId !== 'string' || !pp.rightId || !RID_RE.test(pp.rightId)) {
      details.push(`pair_${i}_rightId_invalid`)
    }
  }

  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i]
    if (!opt || typeof opt !== 'object') { details.push(`option_${i}_not_object`); continue }
    const oo = opt as Record<string, unknown>
    const keys = Object.keys(oo).sort()
    if (keys.length !== 2 || keys[0] !== 'id' || keys[1] !== 'text') {
      details.push(`option_${i}_unexpected_keys`)
    }
    if (typeof oo.id !== 'string' || !oo.id || !RID_RE.test(oo.id)) {
      details.push(`option_${i}_id_invalid`)
    }
    if (typeof oo.text !== 'string' || !oo.text.trim()) details.push(`option_${i}_text_empty`)
  }
  const optionIds = new Set<string>()
  for (const opt of opts) {
    const id = (opt as { id?: unknown })?.id
    if (typeof id === 'string') optionIds.add(id)
  }
  if (optionIds.size !== opts.length) details.push('option_ids_not_unique')
  if (details.length > 0) return { error: 'matching_validation_failed', details }

  const pairRids = (pairs as { rightId: string }[]).map((p) => p.rightId)
  const pairRidSet = new Set(pairRids)
  for (const rid of pairRids) {
    if (!optionIds.has(rid)) details.push(`pair_rightId_${rid}_no_matching_option`)
  }
  for (const optId of optionIds) {
    if (!pairRidSet.has(optId)) details.push(`option_id_${optId}_orphaned`)
  }

  const ANS_RE = /^(\d+)-([A-Z]+)$/
  for (let i = 0; i < answers.length; i++) {
    const ans = answers[i]
    if (typeof ans !== 'string') { details.push(`correctAnswer_${i}_not_string`); continue }
    const m = ans.match(ANS_RE)
    if (!m) { details.push(`correctAnswer_${i}_format_invalid`); continue }
    const idx = parseInt(m[1], 10)
    const aid = m[2]
    if (idx < 1 || idx > pairs.length) details.push(`correctAnswer_${i}_index_out_of_range`)
    if (!optionIds.has(aid)) details.push(`correctAnswer_${i}_id_unknown`)
    const expected = `${i + 1}-${(pairs[i] as { rightId: string }).rightId}`
    if (ans !== expected) details.push(`correctAnswer_${i}_mismatch_with_pair`)
  }

  return details.length > 0 ? { error: 'matching_validation_failed', details } : null
}

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

    case 'matching':
      // Géré séparément par validateMatchingNew avec réponse structurée
      break

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

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const { question_type, question_text, options, feedback_correct, feedback_incorrect, image_url, points, recommended_time_seconds } = body

    // Validation de base
    if (!question_text?.trim()) {
      return NextResponse.json({ error: 'Le texte de la question est requis' }, { status: 400 })
    }
    if (!feedback_correct?.trim()) {
      return NextResponse.json({ error: 'Le feedback correct est requis' }, { status: 400 })
    }

    // Validation des options par type
    if (question_type && options) {
      if (question_type === 'matching') {
        const matchingError = validateMatchingNew(options)
        if (matchingError) {
          return NextResponse.json(matchingError, { status: 400 })
        }
      } else {
        const optionsError = validateOptionsByType(question_type, options)
        if (optionsError) {
          return NextResponse.json({ error: optionsError }, { status: 400 })
        }
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
        points,
        recommended_time_seconds: recommended_time_seconds ?? null
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

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!(await isSuperAdmin(session.user.id))) {
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
