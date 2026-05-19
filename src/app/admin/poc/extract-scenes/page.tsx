// Page POC admin — déclenchement de l'extraction Sonnet (T5.3).
//
// §7 handoff 19 mai 2026 — listing élargi :
//   - filtre `course_media_url IS NOT NULL AND course_duration_seconds IS NOT NULL`
//     (au lieu de `timeline_url IS NOT NULL` historiquement)
//   - le badge UI distingue mode word_index (timeline_url déjà présente) vs
//     mode approx_sec (timeline_url null, fallback Sonnet sur trigger_at_sec).

import { redirect } from 'next/navigation'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { ExtractScenesClient, type SequenceLite } from './ExtractScenesClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams?: { sequence_id?: string | string[] }
}

export default async function ExtractScenesPage({ searchParams }: PageProps) {
  const rawSequenceId = searchParams?.sequence_id
  const initialSequenceId = Array.isArray(rawSequenceId)
    ? rawSequenceId[0]
    : rawSequenceId

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
    .not('course_media_url', 'is', null)
    .not('course_duration_seconds', 'is', null)

  const formationIds = Array.from(
    new Set((sequences ?? []).map((s) => s.formation_id).filter(Boolean)),
  ) as string[]

  const { data: formations } = formationIds.length
    ? await admin.from('formations').select('id, title').in('id', formationIds)
    : { data: [] }

  const formationMap = new Map((formations ?? []).map((f) => [f.id, f.title]))

  const sorted = (sequences ?? []).slice().sort((a, b) => {
    const fa = (formationMap.get(a.formation_id ?? '') ?? '').localeCompare(
      formationMap.get(b.formation_id ?? '') ?? '',
      'fr',
    )
    return fa !== 0 ? fa : (a.title ?? '').localeCompare(b.title ?? '', 'fr')
  })

  const candidates: SequenceLite[] = sorted.map((s) => ({
    id: s.id,
    sequence_number: s.sequence_number ?? 0,
    title: s.title ?? '(sans titre)',
    timeline_url: s.timeline_url,
    formation_id: s.formation_id,
    formation_title: formationMap.get(s.formation_id ?? '') ?? null,
  }))

  const initialId =
    initialSequenceId && candidates.some((c) => c.id === initialSequenceId)
      ? initialSequenceId
      : null

  return (
    <ExtractScenesClient
      sequences={candidates}
      initialSequenceId={initialId}
    />
  )
}
