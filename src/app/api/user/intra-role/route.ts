// Lecture serveur de l'intra_role + flag orgless de l'user courant.
// Utilisé par :
//   - /profil (carte upgrade solo→cabinet)
//   - hooks UI ayant besoin de gating non couvert par le layout (app)
//
// Le BottomNav ne consomme PAS cette route : il reçoit l'intra_role en prop
// depuis le layout async (app)/layout.tsx (économie d'un round-trip).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('intra_role, org_id, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    intra_role: data?.intra_role ?? null,
    org_id: data?.org_id ?? null,
    orgless: !data,
  })
}
