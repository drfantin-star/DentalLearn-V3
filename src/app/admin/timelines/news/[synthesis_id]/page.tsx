/**
 * Page admin éditeur timeline — source NEWS (POC-T6.1.c).
 *
 * Server component : auth super_admin + chargement initial. Pour les news,
 * la table source est `news_syntheses` (pas de colonne `title` — on dérive
 * un libellé court depuis `summary_fr`).
 */

import { redirect } from 'next/navigation'

import { TimelineEditorClient } from '@/app/admin/timelines/[type]/[id]/TimelineEditorClient'
import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  TIMELINE_STORAGE_BUCKET,
  buildVersionsFolder,
} from '@/lib/timeline/admin-table-resolver'
import { TimelineSchema, type Timeline } from '@/lib/timeline/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { synthesis_id: string }
}

function deriveTitle(summary: string | null | undefined): string {
  const s = (summary ?? '').trim()
  if (!s) return '(synthèse sans résumé)'
  // Première phrase ou 80 char max.
  const firstSentence = s.split(/[.!?]/)[0] ?? s
  return firstSentence.length > 80
    ? firstSentence.slice(0, 77) + '…'
    : firstSentence
}

export default async function NewsTimelineEditorPage({ params }: PageProps) {
  // ─── Auth ────────────────────────────────────────────────
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  if (!(await isSuperAdmin(user.id))) {
    redirect('/')
  }

  // ─── Données ─────────────────────────────────────────────
  const admin = createAdminClient()
  const { data: synth } = await admin
    .from('news_syntheses')
    .select('id, summary_fr, timeline_url, timeline_published')
    .eq('id', params.synthesis_id)
    .maybeSingle()

  if (!synth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Synthèse introuvable : {params.synthesis_id}
        </p>
      </main>
    )
  }

  const sourceTitle = deriveTitle(synth.summary_fr as string | null)
  const timelineUrl = (synth.timeline_url as string | null) ?? null
  const published = Boolean(synth.timeline_published ?? false)

  let initialTimeline: Timeline | null = null
  if (timelineUrl) {
    try {
      const resp = await fetch(timelineUrl, { cache: 'no-store' })
      if (resp.ok) {
        const json = await resp.json()
        const parsed = TimelineSchema.safeParse(json)
        if (parsed.success) initialTimeline = parsed.data
      }
    } catch {
      // ignore
    }
  }

  const folder = buildVersionsFolder('news', params.synthesis_id)
  const { data: files } = await admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .list(folder, {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    })
  const initialVersions = (files ?? [])
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => f.name.replace(/\.json$/, ''))

  return (
    <TimelineEditorClient
      type="news"
      id={params.synthesis_id}
      initialTimeline={initialTimeline}
      initialPublished={published}
      initialVersions={initialVersions}
      sourceTitle={sourceTitle}
      noTimelineMessage="Aucune timeline générée pour cette synthèse — disponible après T8 (pipeline news déterministe)."
    />
  )
}
