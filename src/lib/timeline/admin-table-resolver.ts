/**
 * Helper partagé entre les routes admin /api/admin/timelines/[type]/[id]/...
 * Centralise la table BDD, les colonnes et le segment de path Storage selon
 * `type ∈ {formation, news}`. Évite la duplication entre routes.
 *
 * Décision D1 BLOC 1 : éditeur universel — `type` est toujours connu côté
 * URL et côté Storage path (`audio-timelines/{type}/{source_id}/{ISO}.json`).
 */

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
