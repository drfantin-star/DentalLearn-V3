import type { SupabaseClient } from '@supabase/supabase-js'
import { generateFullAudio } from '@/lib/elevenlabs'
import { generateAndPersistTimeline } from '@/lib/news-audio'
import type { NewsSynthesisInput } from '@/lib/timeline/build-news-timeline'

// Heuristique 128 kbps : 1 seconde ≈ 16 000 octets (128 kbps / 8 bits).
const BYTES_PER_SECOND_128KBPS = 16_000

export interface GenerateEpisodeAudioOptions {
  episodeId: string
  scriptMd: string
  episodeType: 'journal' | 'insight' | 'digest'
  existingTimelineUrl?: string | null
}

export interface GenerateEpisodeAudioResult {
  audioUrl: string
  durationS: number
  timelineUrl: string | null
}

/**
 * Génère le MP3 d'un épisode (ElevenLabs), l'upload en Storage,
 * puis génère et persiste la timeline (non-bloquant).
 *
 * Ne fait aucun UPDATE news_episodes — responsabilité du caller.
 * Supporte journal (news_episode_syntheses) et insight/digest (news_episode_items).
 */
export async function generateEpisodeAudio(
  supabase: SupabaseClient,
  opts: GenerateEpisodeAudioOptions,
): Promise<GenerateEpisodeAudioResult> {
  const { episodeId, scriptMd, episodeType, existingTimelineUrl } = opts

  // ----- 1. Génération audio ElevenLabs -----
  let buffer: Buffer
  try {
    buffer = await generateFullAudio(scriptMd)
  } catch (err) {
    throw new Error(
      `Échec génération audio ElevenLabs : ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (buffer.byteLength === 0) {
    throw new Error('Buffer audio vide retourné par ElevenLabs')
  }

  // ----- 2. Upload Supabase Storage -----
  // Journals : sous-dossier journal/ pour distinguer des insights.
  // upsert: true — supporte la régénération sans suppression manuelle.
  const objectKey =
    episodeType === 'journal' ? `journal/${episodeId}.mp3` : `${episodeId}.mp3`

  const { error: uploadErr } = await supabase
    .storage
    .from('news-audio')
    .upload(objectKey, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (uploadErr) {
    throw new Error(`Upload Storage échoué : ${uploadErr.message}`)
  }

  const { data: publicUrlData } = supabase
    .storage
    .from('news-audio')
    .getPublicUrl(objectKey)

  const audioUrl = publicUrlData.publicUrl
  const durationS = Math.max(
    1,
    Math.round(buffer.byteLength / BYTES_PER_SECOND_128KBPS),
  )

  // ----- 3. Timeline (non-bloquant) -----
  let timelineUrl: string | null = null
  try {
    const syntheses = await fetchSynthesesForEpisode(supabase, episodeId, episodeType)
    if (syntheses.length > 0) {
      const result = await generateAndPersistTimeline({
        supabase,
        episode: {
          id: episodeId,
          type: episodeType === 'journal' ? 'journal' : (episodeType as 'digest' | 'insight'),
          audio_url: audioUrl,
          duration_s: durationS,
          existing_timeline_url: existingTimelineUrl ?? null,
        },
        syntheses,
      })
      timelineUrl = result.timeline_url
    }
  } catch (timelineErr) {
    console.warn(
      `[generateEpisodeAudio] Timeline generation failed for ${episodeId} (non-blocking):`,
      timelineErr,
    )
  }

  return { audioUrl, durationS, timelineUrl }
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

async function fetchSynthesesForEpisode(
  supabase: SupabaseClient,
  episodeId: string,
  episodeType: 'journal' | 'insight' | 'digest',
): Promise<NewsSynthesisInput[]> {
  const linksTable =
    episodeType === 'journal' ? 'news_episode_syntheses' : 'news_episode_items'
  // Colonne d'ordre propre à chaque table de liaison : `position` sur
  // news_episode_syntheses (journal), `order_idx` sur news_episode_items
  // (insight/digest). Sélectionner l'autre colonne fait échouer la requête
  // (42703) et donc toute la génération de timeline.
  const orderColumn = episodeType === 'journal' ? 'position' : 'order_idx'

  const { data: links, error: linksErr } = await supabase
    .from(linksTable)
    .select(`synthesis_id, ${orderColumn}`)
    .eq('episode_id', episodeId)
    .order(orderColumn, { ascending: true })

  if (linksErr) throw linksErr
  if (!links || links.length === 0) return []

  const typedLinksForIds = (links as Array<Record<string, unknown>>).map(
    (l) => ({
      synthesis_id: l.synthesis_id,
      position: l[orderColumn],
    }),
  )
  const synthesisIds = typedLinksForIds.map((l) => l.synthesis_id as string)

  const { data: synRows, error: synErr } = await supabase
    .from('news_syntheses')
    .select(
      'id, display_title, summary_fr, specialite, themes, key_figures, method, evidence_level, niveau_preuve, clinical_impact, caveats',
    )
    .in('id', synthesisIds)

  if (synErr) throw synErr

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

  return typedLinksForIds.flatMap((l) => {
    const base = synById.get(l.synthesis_id as string)
    return base ? [{ ...base, position: l.position as number }] : []
  })
}
