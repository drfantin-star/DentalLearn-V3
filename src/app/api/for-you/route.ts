import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { UserInterests } from '@/lib/supabase/types'
import type { NewsCard } from '@/types/news'
import type { ForYouItem } from '@/types/forYou'

export const dynamic = 'force-dynamic'

// Cibles de remplissage (décision figée, cf. brief PR2b A1) :
//  - news matchées plafonnées à 6 (anti-noyade : ~21 items pédagogiques only).
//  - si le total reste < MIN_BEFORE_FALLBACK, on complète avec des news récentes.
//  - une carte conformité (promo) ajoutée une fois, en fin de liste.
const MAX_MATCHED_NEWS = 6
const MIN_BEFORE_FALLBACK = 9
const NEWS_POOL_LIMIT = 50

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

export async function GET(request: Request) {
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
    // Volumes très faibles (~21 items au total, cf. audit) : on lit tout le
    // contenu publié puis on filtre/score en JS, plus simple et robuste que
    // des `.or()` Supabase. News traitées séparément (voir plus bas).
    const [formationsRes, eppRes, questRes, ficheRes, newsRes] = await Promise.all([
      supabase
        .from('formations')
        .select('id, title, slug, category, axe_cp, cover_image_url, created_at')
        .eq('is_published', true),
      supabase
        .from('epp_audits')
        .select('id, title, slug, theme_slug')
        .eq('is_published', true),
      supabase
        .from('questionnaires')
        .select('id, titre, slug, axe_cp, time_estimate_min')
        .eq('actif', true),
      supabase
        .from('bibliotheque_ressources')
        .select('id, titre, axe'),
      fetchNews(request),
    ])

    // Items pédagogiques avec score : category match = 2, axe match = 1.
    const pedago: Array<{ item: ForYouItem; score: number }> = []

    for (const f of formationsRes.data ?? []) {
      const catMatch = f.category != null && catSet.has(f.category)
      const axeMatch = f.axe_cp != null && axeSet.has(f.axe_cp)
      if (!catMatch && !axeMatch) continue
      const score = catMatch ? 2 : 1
      const reasonLabel = catMatch
        ? categoryLabel(f.category)
        : AXE_LABELS[f.axe_cp as number] ?? 'ce sujet'
      pedago.push({
        score,
        item: {
          id: `formation-${f.id}`,
          type: 'formation',
          title: f.title,
          href: `/formation/${f.category}?formation=${f.slug}`,
          axe: (f.axe_cp as ForYouItem['axe']) ?? null,
          category: f.category,
          cover: f.cover_image_url,
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
      pedago.push({
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
      pedago.push({
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
      pedago.push({
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

    // Tri pédagogique : score desc puis date desc (ils sont tous gardés).
    pedago.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return dateKey(b.item.publishedAt) - dateKey(a.item.publishedAt)
    })

    // ── News ──────────────────────────────────────────────────────────────
    const allNews: NewsCard[] = newsRes
    const matchedNews = allNews
      .filter(
        (n) => n.formation_category_match != null && catSet.has(n.formation_category_match)
      )
      .sort((a, b) => dateKey(b.published_at) - dateKey(a.published_at))
      .slice(0, MAX_MATCHED_NEWS)
      .map((n) => newsToItem(n, `Parce que ${categoryLabel(n.formation_category_match)} vous intéresse`))

    // ── Assemblage ──────────────────────────────────────────────────────
    const items: ForYouItem[] = [...pedago.map((p) => p.item), ...matchedNews]

    // Fallback : compléter avec des news actives récentes si le feed est mince,
    // pour ne jamais rendre une section vide quand l'utilisateur a des intérêts.
    if (items.length < MIN_BEFORE_FALLBACK) {
      const usedIds = new Set(items.map((i) => i.id))
      const recent = allNews
        .sort((a, b) => dateKey(b.published_at) - dateKey(a.published_at))
        .map((n) => newsToItem(n, 'Actualité récente'))
        .filter((i) => !usedIds.has(i.id))
        .slice(0, MIN_BEFORE_FALLBACK - items.length)
      items.push(...recent)
    }

    // Carte conformité (promo) ajoutée une fois, en fin de liste.
    items.push(CONFORMITE_PROMO)

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
    type: 'news',
    title: n.display_title,
    href: '/news',
    axe: null,
    category: n.formation_category_match,
    cover: n.cover_image_url,
    publishedAt: n.published_at,
    matchReason,
  }
}

function dateKey(d: string | null | undefined): number {
  if (!d) return 0
  const t = new Date(d).getTime()
  return Number.isFinite(t) ? t : 0
}

// News non lisibles par le client session (RLS : SELECT réservé au service_role).
// On réutilise donc l'endpoint public existant `/api/news/syntheses` (qui porte
// déjà l'accès service-role) plutôt que d'introduire un service role ici.
async function fetchNews(request: Request): Promise<NewsCard[]> {
  try {
    const origin = new URL(request.url).origin
    const res = await fetch(`${origin}/api/news/syntheses?limit=${NEWS_POOL_LIMIT}`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json?.data ?? []) as NewsCard[]
  } catch {
    return []
  }
}
