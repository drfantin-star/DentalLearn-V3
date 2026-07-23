import { createAdminClient } from '@/lib/supabase/admin'
import type { NewsCard } from '@/types/news'

// ─────────────────────────────────────────────────────────────────────────
// Lecture news pour le feed « Pour vous » — fonction serveur partagée.
//
// Pourquoi pas une policy RLS `authenticated` sur news_syntheses ?
// La table contient des colonnes INTERNES (gdrive_file_id, gdrive_url,
// llm_model, validation_errors/warnings, failed_attempts, added_by,
// last_edited_by, embedding, raw_id, scored_id…). Une policy RLS est
// row-level : elle ne sait pas restreindre les colonnes → ouvrir la table en
// SELECT aux `authenticated` exposerait tout ce contenu interne. On lit donc
// ici un SOUS-ENSEMBLE de colonnes sûres (identiques à /api/news/syntheses,
// déjà exposées côté produit), via le client admin, dans une fonction
// importée directement par /api/for-you (pas de hop HTTP, pas d'URL relative).
// ─────────────────────────────────────────────────────────────────────────

const SAFE_NEWS_COLUMNS = [
  'id',
  'display_title',
  'specialite',
  'category_editorial',
  'formation_category_match',
  'published_at',
  'cover_image_url',
  'summary_fr',
  'clinical_impact',
  'key_figures',
  'evidence_level',
  'caveats',
].join(', ')

export interface ForYouNews {
  // News matchées sur les catégories d'intérêt (formation_category_match).
  matched: NewsCard[]
  // News actives les plus récentes, tous sujets (fallback anti-section-vide).
  recent: NewsCard[]
}

export async function fetchForYouNews(
  categories: string[],
  { matchedLimit = 12, recentLimit = 12 }: { matchedLimit?: number; recentLimit?: number } = {}
): Promise<ForYouNews> {
  const supabase = createAdminClient()

  const [matchedRes, recentRes] = await Promise.all([
    categories.length
      ? supabase
          .from('news_syntheses')
          .select(SAFE_NEWS_COLUMNS)
          .eq('status', 'active')
          .eq('is_editorially_validated', true)
          .in('formation_category_match', categories)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(matchedLimit)
      : null,
    supabase
      .from('news_syntheses')
      .select(SAFE_NEWS_COLUMNS)
      .eq('status', 'active')
      .eq('is_editorially_validated', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(recentLimit),
  ])

  return {
    matched: ((matchedRes?.data ?? []) as unknown) as NewsCard[],
    recent: ((recentRes.data ?? []) as unknown) as NewsCard[],
  }
}
