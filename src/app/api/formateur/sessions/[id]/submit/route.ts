import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/formateur/sessions/[id]/submit
// Soumet un brouillon (ou une masterclass refusée) pour validation superadmin.
// Toute la logique d'autorisation/transition vit dans le RPC (seul write path).
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

  const { data, error } = await supabase.rpc('submit_live_session_for_review', {
    p_session_id: id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
