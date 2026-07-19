import type { NewsCard } from '@/types/news'
import { getCategoryStyle, NEWS_SPECIALITE_SLUGS } from '@/lib/design/categoryStyle'

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

// Couleur de fond par defaut d'une news sans specialite/theme reconnu — un
// bleu nuit propre a la surface news, distinct du neutre systeme
// #6B7280 (cf. getCategoryStyle). Source unique : reexporte par
// NewsCardSVG.tsx plutot que redeclare.
export const NEWS_DEFAULT_COLOR = '#1A1A2E'
const DEFAULT_SPEC_COLOR = NEWS_DEFAULT_COLOR

function darkenHex(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const ch = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - amount))
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${h(ch(0))}${h(ch(2))}${h(ch(4))}`
}

/** Retourne le degrade CSS 135deg base sur la specialite. */
export function getSpecialiteGradient(specialite: string | null): string {
  const accent = getSpecialiteColor(specialite)
  return `linear-gradient(135deg, ${accent}, ${darkenHex(accent, 0.35)})`
}

/** Retourne la couleur de base (from) pour un degrade radial. */
export function getSpecialiteColor(specialite: string | null): string {
  if (specialite && (NEWS_SPECIALITE_SLUGS as readonly string[]).includes(specialite)) {
    return getCategoryStyle(specialite).from
  }
  return DEFAULT_SPEC_COLOR
}
