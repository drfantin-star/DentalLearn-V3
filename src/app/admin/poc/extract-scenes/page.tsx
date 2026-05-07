// Page POC admin — déclenchement de l'extraction Sonnet (T5.3).
//
// Liste les séquences ayant déjà une `timeline_url` (T2 livré). L'extraction
// LLM (T5) lit le transcript depuis ce fichier existant pour reconstituer
// le script_text et appeler Sonnet. Si une séquence n'a pas de timeline_url,
// elle ne peut pas être extraite — il faut d'abord faire tourner le pipeline
// Python T2 sur cette séquence.

import { redirect } from 'next/navigation'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { ExtractScenesClient, type SequenceLite } from './ExtractScenesClient'

export const dynamic = 'force-dynamic'

export default async function ExtractScenesPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }
  if (!(await isSuperAdmin(session.user.id))) {
    redirect('/')
  }

  const admin = createAdminClient()
  const { data: sequences } = await admin
    .from('sequences')
    .select('id, sequence_number, title, timeline_url, formation_id')
    .not('timeline_url', 'is', null)
    .order('sequence_number', { ascending: true })

  const candidates: SequenceLite[] = (sequences ?? []).map((s) => ({
    id: s.id as string,
    sequence_number: (s.sequence_number as number) ?? 0,
    title: (s.title as string) ?? '(sans titre)',
    timeline_url: s.timeline_url as string | null,
    formation_id: (s.formation_id as string | null) ?? null,
  }))

  return <ExtractScenesClient sequences={candidates} />
}
