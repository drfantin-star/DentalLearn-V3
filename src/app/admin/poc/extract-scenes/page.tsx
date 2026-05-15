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

  type RawSeq = {
    id: string
    sequence_number: number
    title: string
    timeline_url: string | null
    formation_id: string | null
    formations: { title: string }[] | null
  }

  const rows = (sequences ?? []) as RawSeq[]

  const getFormationTitle = (f: { title: string }[] | null): string =>
    f?.[0]?.title ?? ''

  const sorted = rows.slice().sort((a, b) => {
    const fa = getFormationTitle(a.formations).localeCompare(getFormationTitle(b.formations), 'fr')
    return fa !== 0 ? fa : a.title.localeCompare(b.title, 'fr')
  })

  const candidates: SequenceLite[] = sorted.map((s) => ({
    id: s.id,
    sequence_number: s.sequence_number ?? 0,
    title: s.title ?? '(sans titre)',
    timeline_url: s.timeline_url,
    formation_id: s.formation_id,
    formation_title: getFormationTitle(s.formations) || null,
  }))

  return <ExtractScenesClient sequences={candidates} />
}
