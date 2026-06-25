import type { NewsCard } from '@/types/news'

const COVERS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ui-assets/news-covers`

/**
 * Retourne la liste ordonnee d'URLs de couverture a tenter pour une news.
 * La cascade : cover_image_url → theme dominant → specialite.
 * L'appelant parcourt le tableau et s'arrete sur le premier qui charge.
 */
export function getNewsCoverChain(
  news: Pick<NewsCard, 'cover_image_url' | 'themes' | 'specialite'>
): string[] {
  const chain: string[] = []
  if (news.cover_image_url) chain.push(news.cover_image_url)
  if (news.themes?.[0]) chain.push(`${COVERS_BASE}/news-theme-${news.themes[0]}.webp`)
  if (news.specialite) chain.push(`${COVERS_BASE}/news-spec-${news.specialite}.webp`)
  return chain
}
