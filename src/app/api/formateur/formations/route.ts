import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { getFormateurFormations } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

// GET /api/formateur/formations
// Retourne les formations auxquelles le formateur connecté est assigné
// Utilisé pour le dropdown dans la modale de création/édition d'events
export async function GET(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const formations = await getFormateurFormations(user.id)

  return NextResponse.json(formations)
}
