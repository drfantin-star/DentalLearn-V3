import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { LiveSessionReviewSchema } from '@/lib/schemas/live-session-review'

export const dynamic = 'force-dynamic'

// POST /api/admin/masterclass/[id]/review
// Le superadmin valide ou refuse une masterclass soumise par un formateur
// (awaiting = 'admin'). Refus : motif obligatoire (imposé par le RPC).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

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
