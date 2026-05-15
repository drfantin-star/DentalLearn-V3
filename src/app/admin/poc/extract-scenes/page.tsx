// Page POC admin — déclenchement de l'extraction Sonnet (T5.3).
//
// Liste les séquences ayant un audio source (course_media_url non null).
// Le but du POC est précisément de générer des timelines sur des séquences
// qui n'en ont pas encore — pas de filtre sur timeline_url ou timeline_published.

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
    .select('id, sequence_number, title, timeline_url, formation_id, formations(title)')
    .not('course_media_url', 'is', null)
    .order('title', { ascending: true })

  const sorted = (sequences ?? []).slice().sort((a, b) => {
    const fa = ((a.formations as { title: string } | null)?.title ?? '').localeCompare(
      (b.formations as { title: string } | null)?.title ?? '',
      'fr'
    )
    return fa !== 0 ? fa : ((a.title as string) ?? '').localeCompare((b.title as string) ?? '', 'fr')
  })

  const candidates: SequenceLite[] = sorted.map((s) => ({
    id: s.id as string,
    sequence_number: (s.sequence_number as number) ?? 0,
    title: (s.title as string) ?? '(sans titre)',
    timeline_url: s.timeline_url as string | null,
    formation_id: (s.formation_id as string | null) ?? null,
    formation_title: ((s.formations as { title: string } | null)?.title) ?? null,
  }))

  return <ExtractScenesClient sequences={candidates} />
}
