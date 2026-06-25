import type { NewsCard } from '@/types/news'

export const NEWS_COVERS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ui-assets/news-covers`

/**
 * Retourne la liste ordonnee d'URLs de couverture a tenter pour une news.
 * Cascade : cover_image_url -> theme dominant -> specialite.
 */
export function getNewsCoverChain(
  news: Pick<NewsCard, 'cover_image_url' | 'themes' | 'specialite'>
): string[] {
  const chain: string[] = []
  if (news.cover_image_url) chain.push(news.cover_image_url)
  if (news.themes?.[0]) chain.push(`${NEWS_COVERS_BASE}/news-theme-${news.themes[0]}.webp`)
  if (news.specialite) chain.push(`${NEWS_COVERS_BASE}/news-spec-${news.specialite}.webp`)
  return chain
}

// Mapping specialite -> couleur de base (source : SPECIALITE_COLORS de NewsCardSVG)
const SPEC_COLORS: Record<string, string> = {
  'dent-resto': '#2A6EBB', 'paro': '#2E7D32', 'implanto': '#6A1B9A',
  'chir-orale': '#C62828', 'odf': '#E65100', 'endo': '#00695C',
  'occluso': '#AD1457', 'proth': '#4527A0', 'sante-pub': '#00838F',
  'pedo': '#F9A825', 'gero': '#5D4037', 'actu-pro': '#37474F',
}
const DEFAULT_SPEC_COLOR = '#1A1A2E'

function darkenHex(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const ch = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - amount))
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${h(ch(0))}${h(ch(2))}${h(ch(4))}`
}

/** Retourne le degrade CSS 135deg base sur la specialite (reutilise les hex existants). */
export function getSpecialiteGradient(specialite: string | null): string {
  const accent = (specialite && SPEC_COLORS[specialite]) || DEFAULT_SPEC_COLOR
  return `linear-gradient(135deg, ${accent}, ${darkenHex(accent, 0.35)})`
}
