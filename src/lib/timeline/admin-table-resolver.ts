/**
 * Helper partagé entre les routes admin /api/admin/timelines/[type]/[id]/...
 * Centralise la table BDD, les colonnes et le segment de path Storage selon
 * `type ∈ {formation, news}`. Évite la duplication entre routes.
 *
 * Décision D1 BLOC 1 : éditeur universel — `type` est toujours connu côté
 * URL et côté Storage path (`audio-timelines/{type}/{source_id}/{ISO}.json`).
 */

import { TimelineSchema, type Timeline } from '@/lib/timeline/schema'

export type TimelineSourceType = 'formation' | 'news'

export interface TimelineTableConfig {
  table: 'sequences' | 'news_syntheses'
  column: 'timeline_url'
  publishColumn: 'timeline_published'
  folderName: 'formation' | 'news'
}

export function resolveTableAndColumn(
  type: TimelineSourceType
): TimelineTableConfig {
  return type === 'formation'
    ? {
        table: 'sequences',
        column: 'timeline_url',
        publishColumn: 'timeline_published',
        folderName: 'formation',
      }
    : {
        table: 'news_syntheses',
        column: 'timeline_url',
        publishColumn: 'timeline_published',
        folderName: 'news',
      }
}

/**
 * Bucket Supabase Storage utilisé pour la persistance Timeline (cf. T1).
 */
export const TIMELINE_STORAGE_BUCKET = 'audio-timelines'

/**
 * Construit le path à l'intérieur du bucket pour une nouvelle version.
 * Pattern décision D2 BLOC 1.
 */
export function buildTimelinePath(
  folderName: 'formation' | 'news',
  sourceId: string,
  isoStamp: string
): string {
  return `${folderName}/${sourceId}/${isoStamp}.json`
}

/**
 * Construit le préfixe (dossier) listant toutes les versions d'une source.
 * Utilisé par GET pour `versions[]`.
 */
export function buildVersionsFolder(
  folderName: 'formation' | 'news',
  sourceId: string
): string {
  return `${folderName}/${sourceId}`
}

/**
 * Génère un timestamp ISO compatible Storage path (':' interdit côté URL,
 * '.' interdit pour rester compact). Ex : `2026-05-08T12-56-44-142Z`.
 */
export function isoStampForStorage(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export interface LoadedTimeline {
  timeline: Timeline | null
  /**
   * Message d'erreur lisible quand le fetch ou la validation Zod échoue.
   * `null` = pas de timeline (URL absente) OU chargement réussi. Permet à
   * l'éditeur d'afficher la vraie cause (champ invalide) au lieu du message
   * trompeur « Génère d'abord l'audio ».
   */
  loadError: string | null
}

/**
 * Charge + valide la timeline depuis son URL publique Storage.
 *
 * Contrairement à l'ancien chargement inline (qui avalait silencieusement les
 * échecs `fetch`/Zod, d'où le bandeau « Génère d'abord l'audio » trompeur),
 * cette fonction renvoie un `loadError` explicite listant les premiers champs
 * invalides (ex. `scenes.9.template.cards.1.subtitle : …`) pour reformulation.
 */
export async function loadTimelineFromUrl(
  timelineUrl: string | null
): Promise<LoadedTimeline> {
  if (!timelineUrl) return { timeline: null, loadError: null }
  try {
    const resp = await fetch(timelineUrl, { cache: 'no-store' })
    if (!resp.ok) {
      return {
        timeline: null,
        loadError: `Échec de chargement du fichier timeline (HTTP ${resp.status}).`,
      }
    }
    const json = await resp.json()
    const parsed = TimelineSchema.safeParse(json)
    if (parsed.success) return { timeline: parsed.data, loadError: null }
    const detail = parsed.error.issues
      .slice(0, 3)
      .map((iss) => `${iss.path.join('.') || '(racine)'} : ${iss.message}`)
      .join(' · ')
    return {
      timeline: null,
      loadError: `Timeline invalide — ${detail || 'schéma non conforme'}`,
    }
  } catch {
    return {
      timeline: null,
      loadError: 'Timeline illisible (fetch ou JSON invalide).',
    }
  }
}
