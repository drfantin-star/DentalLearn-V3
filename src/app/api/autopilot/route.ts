import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ITEMS_BY_MINUTES: Record<number, number> = { 15: 2, 30: 3, 60: 4 }
const DEFAULT_EST_MINUTES = 20

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface GapRow {
  axeId: number
  axeShortName: string
  actionsCompleted: number
  requiredActions: number
  progressPercent: number
  validated: boolean
  daysRemaining: number
}

async function buildGaps(supabase: SupabaseClient, userId: string): Promise<{ gaps: GapRow[]; priorityAxes: GapRow[] }> {
  const { data } = await supabase
    .from('cp_user_progress')
    .select('axe_id, axe_short_name, actions_completed, required_actions, progress_percent, axe_validated, days_remaining')
    .eq('user_id', userId)

  const rows: GapRow[] = (data ?? []).map((r) => ({
    axeId: r.axe_id as number,
    axeShortName: r.axe_short_name as string,
    actionsCompleted: Number(r.actions_completed),
    requiredActions: r.required_actions as number,
    progressPercent: Number(r.progress_percent),
    validated: r.axe_validated as boolean,
    daysRemaining: r.days_remaining as number,
  }))

  const gaps = rows
    .filter((r) => !r.validated)
    .sort((a, b) => a.progressPercent - b.progressPercent || a.daysRemaining - b.daysRemaining)

  const priorityAxes =
    gaps.length > 0
      ? gaps
      : [...rows].sort((a, b) => a.progressPercent - b.progressPercent)

  return { gaps, priorityAxes }
}

interface FormationRow {
  id: string
  title: string
  slug: string | null
  category: string | null
  axe_cp: number | null
}

async function generatePlan(
  supabase: SupabaseClient,
  userId: string,
  weeklyMinutes: number,
  mk: string,
): Promise<void> {
  const { priorityAxes } = await buildGaps(supabase, userId)
  const nbItems = ITEMS_BY_MINUTES[weeklyMinutes] ?? 3

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('interests')
    .eq('id', userId)
    .single()
  const interests: string[] =
    (profile?.interests as { categories?: string[] } | null)?.categories ?? []

  const { data: doneRows } = await supabase
    .from('user_formations')
    .select('formation_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
  const doneIds = new Set((doneRows ?? []).map((r) => r.formation_id as string))

  const { data: planRows } = await supabase
    .from('autopilot_plan')
    .select('ref_id')
    .eq('user_id', userId)
    .eq('month_key', mk)
  const planIds = new Set((planRows ?? []).map((r) => r.ref_id as string))

  const { data: rawFormations } = await supabase
    .from('formations')
    .select('id, title, slug, category, axe_cp')
    .eq('is_published', true)
    .not('axe_cp', 'is', null)

  const eligible = (rawFormations as FormationRow[] ?? []).filter(
    (f) => !doneIds.has(f.id) && !planIds.has(f.id),
  )

  const byAxe = new Map<number, FormationRow[]>()
  for (const f of eligible) {
    const axeId = f.axe_cp as number
    if (!byAxe.has(axeId)) byAxe.set(axeId, [])
    byAxe.get(axeId)!.push(f)
  }

  function pickFromAxe(axeId: number): FormationRow | null {
    const candidates = byAxe.get(axeId) ?? []
    if (candidates.length === 0) return null
    const preferred = candidates.filter((f) => f.category && interests.includes(f.category))
    const pick = preferred.length > 0 ? preferred[0] : candidates[0]
    byAxe.set(axeId, byAxe.get(axeId)!.filter((f) => f.id !== pick.id))
    return pick
  }

  const selected: FormationRow[] = []
  let axeIdx = 0
  const maxTries = priorityAxes.length * (nbItems + 1)

  while (selected.length < nbItems && axeIdx < maxTries) {
    if (priorityAxes.length === 0) break
    const axe = priorityAxes[axeIdx % priorityAxes.length]
    axeIdx++
    const pick = pickFromAxe(axe.axeId)
    if (pick) selected.push(pick)
    if ([...byAxe.values()].every((arr) => arr.length === 0)) break
  }

  // Fallback: formations in progress
  if (selected.length < nbItems) {
    const { data: inProgressRows } = await supabase
      .from('user_formations')
      .select('formation_id')
      .eq('user_id', userId)
      .is('completed_at', null)
    const ipIds = (inProgressRows ?? []).map((r) => r.formation_id as string)
    if (ipIds.length > 0) {
      const { data: ipFormations } = await supabase
        .from('formations')
        .select('id, title, slug, category, axe_cp')
        .eq('is_published', true)
        .in('id', ipIds)
      for (const f of (ipFormations as FormationRow[] ?? [])) {
        if (selected.length >= nbItems) break
        if (!planIds.has(f.id) && !selected.find((s) => s.id === f.id)) selected.push(f)
      }
    }
  }

  // Fallback: any published formation
  if (selected.length < nbItems) {
    const { data: anyFormations } = await supabase
      .from('formations')
      .select('id, title, slug, category, axe_cp')
      .eq('is_published', true)
      .limit(20)
    for (const f of (anyFormations as FormationRow[] ?? [])) {
      if (selected.length >= nbItems) break
      if (!planIds.has(f.id) && !doneIds.has(f.id) && !selected.find((s) => s.id === f.id)) {
        selected.push(f)
      }
    }
  }

  if (selected.length === 0) return

  const fallbackAxeId = priorityAxes[0]?.axeId ?? 1

  const rows = selected.map((f, i) => ({
    user_id: userId,
    month_key: mk,
    axe_id: f.axe_cp ?? fallbackAxeId,
    item_type: 'formation' as const,
    ref_id: f.id,
    title: f.title,
    est_minutes: DEFAULT_EST_MINUTES,
    status: 'todo' as const,
    ordre: i,
  }))

  await supabase
    .from('autopilot_plan')
    .upsert(rows, { onConflict: 'user_id,month_key,item_type,ref_id' })
}

interface PlanItem {
  id: string
  axeId: number
  axeShortName: string
  title: string
  estMinutes: number | null
  status: string
  category: string | null
  slug: string | null
}

async function readItems(
  supabase: SupabaseClient,
  userId: string,
  mk: string,
): Promise<PlanItem[]> {
  const { data } = await supabase
    .from('autopilot_plan')
    .select('id, axe_id, title, est_minutes, status, ref_id, ordre')
    .eq('user_id', userId)
    .eq('month_key', mk)
    .order('ordre')

  if (!data || data.length === 0) return []

  const refIds = (data.map((r) => r.ref_id).filter(Boolean)) as string[]
  type FormationMeta = { id: string; category: string | null; slug: string | null }
  const formationsRes: { data: FormationMeta[] | null } = refIds.length > 0
    ? await supabase.from('formations').select('id, category, slug').in('id', refIds)
    : { data: [] }

  const fMap = new Map((formationsRes.data ?? []).map((f) => [f.id, f]))

  const axeIds = [...new Set(data.map((r) => r.axe_id as number))]
  const { data: axes } = await supabase
    .from('cp_axes')
    .select('id, short_name')
    .in('id', axeIds)
  const axeMap = new Map((axes ?? []).map((a) => [a.id as number, a.short_name as string]))

  return data.map((r) => {
    const f = r.ref_id ? fMap.get(r.ref_id as string) : null
    return {
      id: r.id as string,
      axeId: r.axe_id as number,
      axeShortName: axeMap.get(r.axe_id as number) ?? '',
      title: r.title as string,
      estMinutes: r.est_minutes as number | null,
      status: r.status as string,
      category: f?.category ?? null,
      slug: f?.slug ?? null,
    }
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const mk = currentMonthKey()
  const { gaps } = await buildGaps(supabase, user.id)

  const { data: settings } = await supabase
    .from('autopilot_settings')
    .select('weekly_minutes')
    .eq('user_id', user.id)
    .single()

  if (!settings) {
    return NextResponse.json({ needsSetup: true, weeklyMinutes: null, monthKey: mk, gaps, items: [] })
  }

  const weeklyMinutes = settings.weekly_minutes as number
  const existing = await readItems(supabase, user.id, mk)

  if (existing.length > 0) {
    return NextResponse.json({ needsSetup: false, weeklyMinutes, monthKey: mk, gaps, items: existing })
  }

  await generatePlan(supabase, user.id, weeklyMinutes, mk)
  const items = await readItems(supabase, user.id, mk)
  return NextResponse.json({ needsSetup: false, weeklyMinutes, monthKey: mk, gaps, items })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const body = await request.json()
  const weeklyMinutes = body.weeklyMinutes as number
  if (![15, 30, 60].includes(weeklyMinutes)) {
    return NextResponse.json({ error: 'weeklyMinutes invalide' }, { status: 400 })
  }

  await supabase.from('autopilot_settings').upsert(
    { user_id: user.id, weekly_minutes: weeklyMinutes, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )

  const mk = currentMonthKey()
  const { gaps } = await buildGaps(supabase, user.id)
  const existing = await readItems(supabase, user.id, mk)

  if (existing.length === 0) {
    await generatePlan(supabase, user.id, weeklyMinutes, mk)
  }

  const items = await readItems(supabase, user.id, mk)
  return NextResponse.json({ needsSetup: false, weeklyMinutes, monthKey: mk, gaps, items })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const body = await request.json()
  const { id, status } = body as { id: string; status: 'todo' | 'done' }

  if (!id || !['todo', 'done'].includes(status)) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('autopilot_plan')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
