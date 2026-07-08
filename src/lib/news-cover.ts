import type { NewsCard } from '@/types/news'

export const NEWS_COVERS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ui-assets/news-covers`
export const NEWS_CUTOUTS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ui-assets/news-covers-cutouts`

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

/**
 * Retourne l'URL du detourage pour cette news (theme d'abord, specialite ensuite).
 * Undefined si ni theme ni specialite disponible.
 */
export function getNewsCutoutUrl(
  news: Pick<NewsCard, 'themes' | 'specialite'>
): string | undefined {
  if (news.themes?.[0]) return `${NEWS_CUTOUTS_BASE}/news-theme-${news.themes[0]}.webp`
  if (news.specialite) return `${NEWS_CUTOUTS_BASE}/news-spec-${news.specialite}.webp`
  return undefined
}

// Alignes palette Certily (Option A — 03/07/2026)
const SPEC_COLORS: Record<string, string> = {
  'dent-resto': '#F59E0B', 'paro': '#EC4899', 'implanto': '#10B981',
  'chir-orale': '#EF4444', 'odf': '#8B5CF6', 'endo': '#6366F1',
  'occluso': '#0F7B6C', 'proth': '#F97316', 'sante-pub': '#155E75',
  'pedo': '#1E2A9A', 'gero': '#A78BFA', 'actu-pro': '#0F7B6C',
}
const DEFAULT_SPEC_COLOR = '#1A1A2E'

function darkenHex(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const ch = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - amount))
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${h(ch(0))}${h(ch(2))}${h(ch(4))}`
}

/** Retourne le degrade CSS 135deg base sur la specialite. */
export function getSpecialiteGradient(specialite: string | null): string {
  const accent = (specialite && SPEC_COLORS[specialite]) || DEFAULT_SPEC_COLOR
  return `linear-gradient(135deg, ${accent}, ${darkenHex(accent, 0.35)})`
}

/** Retourne la couleur de base (from) pour un degrade radial. */
export function getSpecialiteColor(specialite: string | null): string {
  return (specialite && SPEC_COLORS[specialite]) || DEFAULT_SPEC_COLOR
}
