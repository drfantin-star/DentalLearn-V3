import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { UserInterests } from '@/lib/supabase/types'
import type { NewsCard } from '@/types/news'
import type { ForYouItem, ForYouType } from '@/types/forYou'
import { fetchForYouNews } from '@/lib/news/forYouNews'

export const dynamic = 'force-dynamic'

// ── Plafonds d'assemblage (anti-flood, cf. PR2b-fix Tâche 2b) ──────────────
// Sans plafond, le feed renvoyait jusqu'à ~21 cartes pédago (12 fiches noyant
// le reste) et zéro news. On plafonne par type, on réserve des slots news
// (jamais évincées), et on plafonne le total.
const TOTAL_CAP = 12 // conformité incluse
const NEWS_RESERVED = 5
const SUBCAP: Record<'formation' | 'epp' | 'autoeval' | 'fiche', number> = {
  formation: 4,
  fiche: 4,
  epp: 2,
  autoeval: 1,
}
// Ordre de round-robin inter-types (variété : 1 de chaque type par tour avant
// d'en reprendre un 2e). Le scoring reste l'ordre INTRA-type.
const PEDAGO_ROTATION: Array<'formation' | 'fiche' | 'autoeval' | 'epp'> = [
  'formation',
  'fiche',
  'autoeval',
  'epp',
]
const NEWS_FETCH_LIMIT = 12

// Libellés d'axe pour le microcopy « Parce que… ».
const AXE_LABELS: Record<number, string> = {
  1: 'Connaissances',
  2: 'Pratiques/EPP',
  3: 'Relation patient',
  4: 'Santé du praticien',
}

function categoryLabel(category: string | null): string {
  if (!category) return 'ce sujet'
  return getCategoryConfig(category).name
}

function asInterests(raw: unknown): { categories: string[]; axes: number[] } {
  const i = raw as UserInterests | null
  const categories = Array.isArray(i?.categories) ? i!.categories : []
  const axes = Array.isArray(i?.axes) ? i!.axes : []
  return { categories, axes }
}

function dateKey(d: string | null | undefined): number {
  if (!d) return 0
  const t = new Date(d).getTime()
  return Number.isFinite(t) ? t : 0
}

// Carte conformité = promo de feature, jamais une progression dynamique
// (les tables cabinet_compliance_* ne sont pas câblées, cf. audit Phase 0-bis).
const CONFORMITE_PROMO: ForYouItem = {
  id: 'conformite-promo',
  type: 'conformite',
  title: 'Conformité cabinet',
  href: '/conformite',
  axe: null,
  category: null,
  matchReason: '52 points pour sécuriser votre cabinet',
}

type Scored = { item: ForYouItem; score: number }

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ items: [] })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('interests')
      .eq('id', user.id)
      .single()

    if (!profile || profile.interests === null) {
      return NextResponse.json({ items: [] })
    }

    const { categories, axes } = asInterests(profile.interests)
    if (categories.length === 0 && axes.length === 0) {
      return NextResponse.json({ items: [] })
    }

    const catSet = new Set(categories)
    const axeSet = new Set(axes)

    // ── Sources pédagogiques (client SSR session, RLS appliquée) ──────────
    // News lues séparément via fonction serveur partagée (colonnes sûres) —
    // jamais d'URL relative serveur→serveur.
    const [formationsRes, eppRes, questRes, ficheRes, news] = await Promise.all([
      supabase
        .from('formations')
        .select('id, title, slug, category, axe_cp, cover_image_url, cover_cutout_url, created_at')
        .eq('is_published', true),
      supabase
        .from('epp_audits')
        .select('id, title, slug, theme_slug')
        .eq('is_published', true),
      supabase
        .from('questionnaires')
        .select('id, titre, slug, axe_cp, time_estimate_min')
        .eq('actif', true),
      supabase.from('bibliotheque_ressources').select('id, titre, axe'),
      fetchForYouNews(categories, {
        matchedLimit: NEWS_FETCH_LIMIT,
        recentLimit: NEWS_FETCH_LIMIT,
      }),
    ])

    // Buckets par type — score : category match = 2, axe match = 1.
    const buckets: Record<'formation' | 'epp' | 'autoeval' | 'fiche', Scored[]> = {
      formation: [],
      epp: [],
      autoeval: [],
      fiche: [],
    }

    for (const f of formationsRes.data ?? []) {
      const catMatch = f.category != null && catSet.has(f.category)
      const axeMatch = f.axe_cp != null && axeSet.has(f.axe_cp)
      if (!catMatch && !axeMatch) continue
      const score = catMatch ? 2 : 1
      const reasonLabel = catMatch
        ? categoryLabel(f.category)
        : AXE_LABELS[f.axe_cp as number] ?? 'ce sujet'
      buckets.formation.push({
        score,
        item: {
          id: `formation-${f.id}`,
          type: 'formation',
          title: f.title,
          href: `/formation/${f.category}?formation=${f.slug}`,
          axe: (f.axe_cp as ForYouItem['axe']) ?? null,
          category: f.category,
          cover: f.cover_image_url,
          cutout: f.cover_cutout_url,
          publishedAt: f.created_at,
          matchReason: `Parce que ${reasonLabel} vous intéresse`,
        },
      })
    }

    for (const e of eppRes.data ?? []) {
      const catMatch = e.theme_slug != null && catSet.has(e.theme_slug)
      const axeMatch = axeSet.has(2)
      if (!catMatch && !axeMatch) continue
      const score = catMatch ? 2 : 1
      const reasonLabel = catMatch ? categoryLabel(e.theme_slug) : AXE_LABELS[2]
      buckets.epp.push({
        score,
        item: {
          id: `epp-${e.id}`,
          type: 'epp',
          title: e.title,
          href: `/formation/${e.theme_slug}/epp`,
          axe: 2,
          category: e.theme_slug,
          matchReason: `Parce que ${reasonLabel} vous intéresse`,
        },
      })
    }

    for (const q of questRes.data ?? []) {
      if (q.axe_cp == null || !axeSet.has(q.axe_cp)) continue
      // Garde-fou auto-éval : wording neutre, non culpabilisant. On expose la
      // définition (« point santé annuel »), jamais une reco fondée sur les réponses.
      buckets.autoeval.push({
        score: 1,
        item: {
          id: `autoeval-${q.id}`,
          type: 'autoeval',
          title: q.titre,
          href: '/sante/auto-evaluation',
          axe: (q.axe_cp as ForYouItem['axe']) ?? null,
          category: null,
          estMinutes: q.time_estimate_min,
          matchReason: 'Votre point santé annuel',
        },
      })
    }

    for (const r of ficheRes.data ?? []) {
      if (r.axe == null || !axeSet.has(r.axe)) continue
      buckets.fiche.push({
        score: 1,
        item: {
          id: `fiche-${r.id}`,
          type: 'fiche',
          title: r.titre,
          href: `${ficheBibliothequeBase(r.axe)}/bibliotheque`,
          axe: (r.axe as ForYouItem['axe']) ?? null,
          category: null,
          matchReason: `Parce que vous suivez ${AXE_LABELS[r.axe] ?? 'ce parcours'}`,
        },
      })
    }

    // Tri intra-type (score desc, puis date desc) + sous-plafond par type.
    for (const key of Object.keys(buckets) as Array<keyof typeof buckets>) {
      buckets[key].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return dateKey(b.item.publishedAt) - dateKey(a.item.publishedAt)
      })
      buckets[key] = buckets[key].slice(0, SUBCAP[key])
    }

    // ── News : matchées d'abord, fallback récentes (dédup) ────────────────
    const matchedItems = news.matched.map((n) =>
      newsToItem(n, `Parce que ${categoryLabel(n.formation_category_match)} vous intéresse`)
    )
    const newsItems: ForYouItem[] = []
    const usedNewsIds = new Set<string>()
    for (const it of matchedItems) {
      if (newsItems.length >= NEWS_RESERVED) break
      if (usedNewsIds.has(it.id)) continue
      usedNewsIds.add(it.id)
      newsItems.push(it)
    }
    if (newsItems.length < NEWS_RESERVED) {
      for (const n of news.recent) {
        if (newsItems.length >= NEWS_RESERVED) break
        const it = newsToItem(n, 'Actualité récente')
        if (usedNewsIds.has(it.id)) continue
        usedNewsIds.add(it.id)
        newsItems.push(it)
      }
    }

    // ── Pédago : round-robin inter-types jusqu'au budget restant ──────────
    // Budget pédago = (cap total − conformité) − news réservées. Si peu de news,
    // le pédago récupère les slots libérés (feed jamais sous-rempli).
    const pedagoSlots = Math.max(0, TOTAL_CAP - 1 - newsItems.length)
    const pedagoItems: ForYouItem[] = []
    const cursors: Record<string, number> = { formation: 0, fiche: 0, autoeval: 0, epp: 0 }
    let progressed = true
    while (pedagoItems.length < pedagoSlots && progressed) {
      progressed = false
      for (const type of PEDAGO_ROTATION) {
        if (pedagoItems.length >= pedagoSlots) break
        const bucket = buckets[type as keyof typeof buckets]
        const idx = cursors[type]
        if (idx < bucket.length) {
          pedagoItems.push(bucket[idx].item)
          cursors[type] = idx + 1
          progressed = true
        }
      }
    }

    const items: ForYouItem[] = [...pedagoItems, ...newsItems, CONFORMITE_PROMO]

    return NextResponse.json({ items })
  } catch (err) {
    console.error('for-you GET error:', err)
    return NextResponse.json({ items: [] }, { status: 200 })
  }
}

// Base de route bibliothèque selon l'axe (1→formation, 3→patient, 4→sante).
function ficheBibliothequeBase(axe: number): string {
  if (axe === 3) return '/patient'
  if (axe === 4) return '/sante'
  return '/formation'
}

function newsToItem(n: NewsCard, matchReason: string | null): ForYouItem {
  return {
    id: `news-${n.id}`,
    type: 'news' as ForYouType,
    title: n.display_title,
    href: '/news',
    axe: null,
    category: n.formation_category_match,
    cover: n.cover_image_url,
    publishedAt: n.published_at,
    matchReason,
  }
}
