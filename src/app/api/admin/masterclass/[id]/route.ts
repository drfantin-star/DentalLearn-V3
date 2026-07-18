import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  is_published: z.boolean(),
})

// PATCH /api/admin/masterclass/[id]
// Publier/dépublier une masterclass. La publication n'est autorisée que si
// la masterclass est `approved` ET que created_by_role = 'admin' (règle
// "seul l'auteur publie") — verrouillé côté DB par le trigger
// live_sessions_enforce_publish_approval, cette route ne fait que relayer.
export async function PATCH(
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

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation échouée' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('live_sessions')
    .update({ is_published: parsed.data.is_published, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
