/**
 * Page admin éditeur timeline — source FORMATION (POC-T6.1.c).
 *
 * Server component : auth super_admin + chargement initial des données
 * (titre séquence, timeline JSON, versions[], published).
 */

import { redirect } from 'next/navigation'

import { TimelineEditorClient } from '@/app/admin/timelines/[type]/[id]/TimelineEditorClient'
import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  TIMELINE_STORAGE_BUCKET,
  buildVersionsFolder,
  loadTimelineFromUrl,
} from '@/lib/timeline/admin-table-resolver'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ sequence_id: string }>
}

export default async function FormationTimelineEditorPage({
  params,
}: PageProps) {
  const { sequence_id } = await params
  // ─── Auth ────────────────────────────────────────────────
  const supabase = await createClient()
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
  // Patch E — SELECT explicite des colonnes utilisées. La colonne titre
  // s'appelle `title` dans `public.sequences` (cf. types.ts + migration
  // initiale) — surtout pas `course_title`.
  // `course_duration_seconds` peut être NULL (cas observé sur la séquence
  // pilote) — on ne s'en sert pas pour calculer les nouvelles scènes ;
  // le client utilise `timeline.duration_sec` (priorité 1) et
  // `audio.duration` runtime (priorité 2). Cf. Patch A.
  const { data: seq, error: seqError } = await admin
    .from('sequences')
    .select(
      'id, title, sequence_number, course_media_url, course_duration_seconds, timeline_url, timeline_published'
    )
    .eq('id', sequence_id)
    .maybeSingle()

  if (seqError || !seq) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Séquence introuvable : {sequence_id}
          {seqError ? ` (${seqError.message})` : ''}
        </p>
      </main>
    )
  }

  // Fallback titre en cascade — sequence_number et title peuvent être null
  // sur des séquences brouillon non finalisées.
  const seqNum = seq.sequence_number as number | null
  const seqTitle = (seq.title as string | null)?.trim() || ''
  const sourceTitle = [
    seqNum != null ? `#${seqNum}` : 'Séquence',
    seqTitle || 'Sans titre',
  ].join(' — ')

  const timelineUrl = (seq.timeline_url as string | null) ?? null
  const published = Boolean(seq.timeline_published ?? false)

  const { timeline: initialTimeline, loadError } =
    await loadTimelineFromUrl(timelineUrl)

  // Versions Storage (best-effort).
  const folder = buildVersionsFolder('formation', sequence_id)
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
      type="formation"
      id={sequence_id}
      initialTimeline={initialTimeline}
      initialTimelineUrl={timelineUrl}
      initialPublished={published}
      initialVersions={initialVersions}
      sourceTitle={sourceTitle}
      loadError={loadError ?? undefined}
      noTimelineMessage="Aucune timeline pour cette séquence. Génère d'abord l'audio depuis la page séquence (bloc Audio du cours) — l'extraction des scènes se déclenche ensuite automatiquement."
    />
  )
}
