/* eslint-disable no-console */
/**
 * T8 — Backfill optionnel des Timelines news manquantes.
 *
 * Itère sur tous les `news_episodes` où `audio_url IS NOT NULL` et
 * `timeline_url IS NULL`, et appelle `generateAndPersistTimeline()` pour
 * chacun. Idempotent grâce à l'archivage automatique fait par le helper.
 *
 * ⚠️ Livré pour T8 mais NON exécuté (cf. prompt T8 v2 E4) — l'exécution
 * éventuelle = ticket T8-bis, à demander explicitement par Dr Fantin.
 *
 * Usage :
 *   tsx scripts/backfill-news-timelines.ts             # dry-run par défaut
 *   tsx scripts/backfill-news-timelines.ts --execute   # vraie exécution
 *
 * Variables d'env requises (mêmes que les routes admin) :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { generateAndPersistTimeline } from '../src/lib/news-audio'
import type { NewsSynthesisInput } from '../src/lib/timeline/build-news-timeline'

const DRY_RUN = !process.argv.includes('--execute')

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.')
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`[backfill] mode = ${DRY_RUN ? 'DRY_RUN' : 'EXECUTE'}`)

  const { data: episodes, error } = await supabase
    .from('news_episodes')
    .select('id, type, audio_url, duration_s')
    .not('audio_url', 'is', null)
    .is('timeline_url', null)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`fetch episodes: ${error.message}`)
  }

  console.log(`[backfill] ${episodes?.length ?? 0} épisodes éligibles.`)

  for (const ep of episodes ?? []) {
    const type = ep.type as 'digest' | 'insight' | 'journal'
    const linkTable =
      type === 'journal' ? 'news_episode_syntheses' : 'news_episode_items'

    const { data: links, error: linksErr } = await supabase
      .from(linkTable)
      .select('synthesis_id, position')
      .eq('episode_id', ep.id)
      .order('position', { ascending: true })

    if (linksErr) {
      console.warn(`[backfill] ${ep.id} skipped (links error): ${linksErr.message}`)
      continue
    }
    if (!links || links.length === 0) {
      console.warn(`[backfill] ${ep.id} skipped (no syntheses)`)
      continue
    }

    const { data: synRows, error: synErr } = await supabase
      .from('news_syntheses')
      .select(
        'id, display_title, summary_fr, specialite, themes, key_figures, method, evidence_level, niveau_preuve, clinical_impact, caveats',
      )
      .in(
        'id',
        links.map((l) => l.synthesis_id as string),
      )

    if (synErr) {
      console.warn(`[backfill] ${ep.id} skipped (synthesis error): ${synErr.message}`)
      continue
    }

    const synById = new Map<string, NewsSynthesisInput>()
    for (const s of synRows ?? []) {
      const row = s as Record<string, unknown>
      synById.set(row.id as string, {
        id: row.id as string,
        display_title: (row.display_title as string | null) ?? null,
        summary_fr: (row.summary_fr as string | null) ?? null,
        specialite: (row.specialite as string | null) ?? null,
        themes: (row.themes as string[] | null) ?? null,
        key_figures: (row.key_figures as string[] | null) ?? null,
        method: (row.method as string | null) ?? null,
        evidence_level: (row.evidence_level as string | null) ?? null,
        niveau_preuve: (row.niveau_preuve as string | null) ?? null,
        clinical_impact: (row.clinical_impact as string | null) ?? null,
        caveats: (row.caveats as string | null) ?? null,
      })
    }

    const orderedSyntheses: NewsSynthesisInput[] = links.flatMap((l) => {
      const base = synById.get(l.synthesis_id as string)
      return base ? [{ ...base, position: l.position as number }] : []
    })

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${ep.id} (${type}) — ${orderedSyntheses.length} synthèses, ${ep.duration_s}s → timeline serait générée.`,
      )
      continue
    }

    try {
      const result = await generateAndPersistTimeline({
        supabase,
        episode: {
          id: ep.id as string,
          type,
          audio_url: ep.audio_url as string,
          duration_s: ep.duration_s as number,
          existing_timeline_url: null,
        },
        syntheses: orderedSyntheses,
      })
      console.log(`[ok] ${ep.id} → ${result.storage_path}`)
    } catch (err) {
      console.warn(`[fail] ${ep.id}: ${(err as Error).message}`)
    }
  }

  console.log('[backfill] terminé.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
