import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { LiveSessionReviewSchema } from '@/lib/schemas/live-session-review'

export const dynamic = 'force-dynamic'

// POST /api/formateur/sessions/[id]/review
// Le formateur accepte ou refuse une masterclass proposée par le superadmin
// (awaiting = 'formateur'). Refus : motif obligatoire (imposé par le RPC).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = LiveSessionReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.rpc('review_live_session', {
    p_session_id: id,
    p_decision: parsed.data.decision,
    p_comment: parsed.data.comment ?? null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
