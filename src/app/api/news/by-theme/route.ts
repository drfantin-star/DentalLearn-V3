import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  INTEREST_TO_NEWS_THEME,
  THEME_ROW_MIN,
  THEME_ROW_CAP,
  THEME_ROW_ITEMS,
  NEWS_SPECIALITE_LABELS,
  FORMATION_CATEGORY_LABELS,
} from '@/lib/constants/news'
import type { NewsCard } from '@/types/news'

export const dynamic = 'force-dynamic'

// Sous-ensemble de colonnes sûres — DOIT rester aligné avec
// /api/news/syntheses (NEWS_CARD_COLUMNS) et lib/news/forYouNews (SAFE_NEWS_COLUMNS).
const SAFE_NEWS_COLUMNS = [
  'id', 'display_title', 'specialite', 'category_editorial',
  'formation_category_match', 'published_at', 'cover_image_url',
  'summary_fr', 'clinical_impact', 'key_figures', 'evidence_level', 'caveats',
].join(', ')

type ThemeRow = { key: string; label: string; items: NewsCard[] }

function labelFor(field: string, value: string): string {
  return field === 'specialite'
    ? (NEWS_SPECIALITE_LABELS[value] ?? value)
    : (FORMATION_CATEGORY_LABELS[value as keyof typeof FORMATION_CATEGORY_LABELS] ?? value)
}

export async function GET() {
  try {
    const admin = createAdminClient()

    // « Dernières actus » — toujours (fallback, et seule rangée si pas de prefs)
    const { data: recentData } = await admin
      .from('news_syntheses')
      .select(SAFE_NEWS_COLUMNS)
      .eq('status', 'active')
      .eq('is_editorially_validated', true)
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(THEME_ROW_ITEMS)

    const recent = ((recentData ?? []) as unknown) as NewsCard[]

    // Préférences de l'utilisateur (session SSR)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let categories: string[] = []
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('interests')
        .eq('id', user.id)
        .single()
      const raw = (profile?.interests as { categories?: unknown } | null)?.categories
      if (Array.isArray(raw)) categories = raw.filter((c): c is string => typeof c === 'string')
    }

    // Rangées thème, dans l'ordre des préférences, cap 3, seuil 20
    const rows: ThemeRow[] = []
    for (const cat of categories) {
      if (rows.length >= THEME_ROW_CAP) break
      const map = INTEREST_TO_NEWS_THEME[cat]
      if (!map) continue

      const { data, count } = await admin
        .from('news_syntheses')
        .select(SAFE_NEWS_COLUMNS, { count: 'exact' })
        .eq('status', 'active')
        .eq('is_editorially_validated', true)
        .eq(map.field, map.value)
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(THEME_ROW_ITEMS)

      if ((count ?? 0) < THEME_ROW_MIN) continue

      rows.push({
        key: cat,
        label: labelFor(map.field, map.value),
        items: ((data ?? []) as unknown) as NewsCard[],
      })
    }

    return NextResponse.json({ recent, rows })
  } catch (err) {
    console.error('news/by-theme GET error:', err)
    return NextResponse.json({ recent: [], rows: [] }, { status: 200 })
  }
}
