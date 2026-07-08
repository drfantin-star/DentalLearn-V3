import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_CONFIG } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const ITEMS_BY_MINUTES: Record<number, number> = { 15: 2, 30: 3, 60: 4 }
const EST: Record<string, number> = { formation: 20, epp: 30, autoeval: 15, attestation: 10 }

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ── Focus derivation ─────────────────────────────────────────────────────────

interface FocusGroups {
  cpSlugs: string[]
  axe3Slugs: string[]
  axe4Slugs: string[]
}

function deriveFocus(focus: string[]): FocusGroups {
  const cpSlugs: string[] = []
  const axe3Slugs: string[] = []
  const axe4Slugs: string[] = []
  for (const slug of focus) {
    const cfg = CATEGORY_CONFIG[slug]
    if (!cfg) continue
    if (cfg.type === 'cp') cpSlugs.push(slug)
    else if (cfg.type === 'axe3') axe3Slugs.push(slug)
    else if (cfg.type === 'axe4') axe4Slugs.push(slug)
  }
  return { cpSlugs, axe3Slugs, axe4Slugs }
}

// ── Normalized item ───────────────────────────────────────────────────────────

interface NormalizedItem {
  item_type: 'formation' | 'epp' | 'autoeval' | 'attestation'
  ref_id: string | null
  ref_key: string
  axe_id: number
  title: string
  href: string
  est_minutes: number
}

// ── DB row helpers ────────────────────────────────────────────────────────────

interface UserFormationRow { formation_id: string }
interface UserEppRow { audit_id: string }
interface AutoevalCompletionRow { questionnaire_id: string }
interface UserAttestationRow { axe_cp: number; type: string }
interface FormationRow { id: string; title: string; slug: string; category: string; axe_cp: number }
interface EppAuditRow { id: string; title: string; theme_slug: string }
interface QuestionnaireRow { id: string; titre: string }
interface AxeRow { id: number; short_name: string }
interface PlanRow {
  id: string
  item_type: string
  axe_id: number
  title: string
  est_minutes: number | null
  status: string
  href: string
  ordre: number
}

// ── Providers ─────────────────────────────────────────────────────────────────

async function formationProvider(
  supabase: SupabaseClient,
  userId: string,
  cpSlugs: string[],
  axe3Slugs: string[],
  axe4Slugs: string[],
): Promise<NormalizedItem[]> {
  const allSlugs = [...cpSlugs, ...axe3Slugs, ...axe4Slugs]
  if (allSlugs.length === 0) return []

  const { data: doneRows } = await supabase
    .from('user_formations')
    .select('formation_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
  const doneIds = new Set((doneRows as UserFormationRow[] ?? []).map((r) => r.formation_id))

  const { data: formations } = await supabase
    .from('formations')
    .select('id, title, slug, category, axe_cp')
    .eq('is_published', true)
    .in('category', allSlugs)

  return (formations as FormationRow[] ?? [])
    .filter((f) => !doneIds.has(f.id))
    .map((f) => ({
      item_type: 'formation' as const,
      ref_id: f.id,
      ref_key: `formation:${f.id}`,
      axe_id: f.axe_cp ?? 1,
      title: f.title,
      href: `/formation/${f.category}?formation=${f.slug}&from=autopilot`,
      est_minutes: EST.formation,
    }))
}

async function eppProvider(
  supabase: SupabaseClient,
  userId: string,
  cpSlugs: string[],
): Promise<NormalizedItem[]> {
  if (cpSlugs.length === 0) return []

  const { data: doneRows } = await supabase
    .from('user_epp_sessions')
    .select('audit_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
  const doneIds = new Set((doneRows as UserEppRow[] ?? []).map((r) => r.audit_id))

  const { data: audits } = await supabase
    .from('epp_audits')
    .select('id, title, theme_slug')
    .eq('is_published', true)
    .in('theme_slug', cpSlugs)

  return (audits as EppAuditRow[] ?? [])
    .filter((a) => !doneIds.has(a.id))
    .map((a) => ({
      item_type: 'epp' as const,
      ref_id: a.id,
      ref_key: `epp:${a.id}`,
      axe_id: 2,
      title: a.title,
      href: `/formation/${a.theme_slug}/epp`,
      est_minutes: EST.epp,
    }))
}

async function autoevalProvider(
  supabase: SupabaseClient,
  userId: string,
  axe4Slugs: string[],
): Promise<NormalizedItem[]> {
  if (axe4Slugs.length === 0) return []

  const { data: doneRows } = await supabase
    .from('autoeval_completions')
    .select('questionnaire_id')
    .eq('user_id', userId)
  const doneIds = new Set((doneRows as AutoevalCompletionRow[] ?? []).map((r) => r.questionnaire_id))

  const { data: questionnaires } = await supabase
    .from('questionnaires')
    .select('id, titre')
    .eq('axe_cp', 4)
    .eq('actif', true)

  return (questionnaires as QuestionnaireRow[] ?? [])
    .filter((q) => !doneIds.has(q.id))
    .map((q) => ({
      item_type: 'autoeval' as const,
      ref_id: q.id,
      ref_key: `autoeval:${q.id}`,
      axe_id: 4,
      title: q.titre || 'Auto-evaluation sante',
      href: '/sante/auto-evaluation',
      est_minutes: EST.autoeval,
    }))
}

async function attestationProvider(
  supabase: SupabaseClient,
  userId: string,
  axe3Active: boolean,
  axe4Active: boolean,
): Promise<NormalizedItem[]> {
  if (!axe3Active && !axe4Active) return []

  const { data: doneRows } = await supabase
    .from('user_attestations')
    .select('axe_cp, type')
    .eq('user_id', userId)
    .neq('type', 'formation_online')

  const doneAxes = new Set((doneRows as UserAttestationRow[] ?? []).map((r) => r.axe_cp))

  const items: NormalizedItem[] = []
  if (axe3Active && !doneAxes.has(3)) {
    items.push({
      item_type: 'attestation',
      ref_id: null,
      ref_key: 'attestation:axe3',
      axe_id: 3,
      title: "Attester ta demarche d'information patient",
      href: '/patient/bibliotheque',
      est_minutes: EST.attestation,
    })
  }
  if (axe4Active && !doneAxes.has(4)) {
    items.push({
      item_type: 'attestation',
      ref_id: null,
      ref_key: 'attestation:axe4',
      axe_id: 4,
      title: 'Attester ta demarche sante au travail',
      href: '/sante/bibliotheque',
      est_minutes: EST.attestation,
    })
  }
  return items
}

// ── Generation ────────────────────────────────────────────────────────────────

async function generatePlan(
  supabase: SupabaseClient,
  userId: string,
  weeklyMinutes: number,
  focus: string[],
  mk: string,
): Promise<void> {
  const { cpSlugs, axe3Slugs, axe4Slugs } = deriveFocus(focus)
  const axe3Active = axe3Slugs.length > 0
  const axe4Active = axe4Slugs.length > 0
  const axe1Active = cpSlugs.length > 0
  const axe2Active = cpSlugs.length > 0

  const [formations, epps, autoevals, attestations] = await Promise.all([
    formationProvider(supabase, userId, cpSlugs, axe3Slugs, axe4Slugs),
    eppProvider(supabase, userId, cpSlugs),
    autoevalProvider(supabase, userId, axe4Slugs),
    attestationProvider(supabase, userId, axe3Active, axe4Active),
  ])

  // Group by axe, priority: formation > epp > autoeval > attestation
  const byAxe = new Map<number, NormalizedItem[]>()
  const addToAxe = (item: NormalizedItem) => {
    if (!byAxe.has(item.axe_id)) byAxe.set(item.axe_id, [])
    byAxe.get(item.axe_id)!.push(item)
  }
  for (const item of [...formations, ...epps, ...autoevals, ...attestations]) {
    addToAxe(item)
  }

  const activeAxes: number[] = []
  if (axe1Active) activeAxes.push(1)
  if (axe2Active) activeAxes.push(2)
  if (axe3Active) activeAxes.push(3)
  if (axe4Active) activeAxes.push(4)

  const nbItems = ITEMS_BY_MINUTES[weeklyMinutes] ?? 3
  const selected: NormalizedItem[] = []
  let axeIdx = 0
  const maxTries = activeAxes.length > 0 ? activeAxes.length * (nbItems + 2) : 0

  while (selected.length < nbItems && axeIdx < maxTries) {
    const axeId = activeAxes[axeIdx % activeAxes.length]
    axeIdx++
    const pool = byAxe.get(axeId) ?? []
    if (pool.length > 0) {
      selected.push(pool.shift()!)
    }
  }

  if (selected.length === 0) return

  const rows = selected.map((item, i) => ({
    user_id: userId,
    month_key: mk,
    axe_id: item.axe_id,
    item_type: item.item_type,
    ref_id: item.ref_id,
    ref_key: item.ref_key,
    title: item.title,
    href: item.href,
    est_minutes: item.est_minutes,
    status: 'todo' as const,
    ordre: i,
  }))

  await supabase
    .from('autopilot_plan')
    .upsert(rows, { onConflict: 'user_id,month_key,ref_key' })
}

// ── Read items ────────────────────────────────────────────────────────────────

interface PlanItem {
  id: string
  itemType: string
  axeId: number
  axeShortName: string
  title: string
  estMinutes: number | null
  status: string
  href: string
}

async function readItems(
  supabase: SupabaseClient,
  userId: string,
  mk: string,
): Promise<PlanItem[]> {
  const { data } = await supabase
    .from('autopilot_plan')
    .select('id, item_type, axe_id, title, est_minutes, status, href, ordre')
    .eq('user_id', userId)
    .eq('month_key', mk)
    .order('ordre')

  if (!data || data.length === 0) return []

  const rows = data as PlanRow[]
  const axeIds = [...new Set(rows.map((r) => r.axe_id))]
  const { data: axes } = await supabase
    .from('cp_axes')
    .select('id, short_name')
    .in('id', axeIds)
  const axeMap = new Map((axes as AxeRow[] ?? []).map((a) => [a.id, a.short_name]))

  return rows.map((r) => ({
    id: r.id,
    itemType: r.item_type,
    axeId: r.axe_id,
    axeShortName: axeMap.get(r.axe_id) ?? '',
    title: r.title,
    estMinutes: r.est_minutes,
    status: r.status,
    href: r.href,
  }))
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const mk = currentMonthKey()

  const { data: settings } = await supabase
    .from('autopilot_settings')
    .select('weekly_minutes, focus')
    .eq('user_id', user.id)
    .single()

  if (!settings) {
    return NextResponse.json({ needsSetup: true, weeklyMinutes: null, focus: [], monthKey: mk, items: [] })
  }

  const weeklyMinutes = (settings as { weekly_minutes: number; focus: string[] }).weekly_minutes
  const focus = (settings as { weekly_minutes: number; focus: string[] }).focus ?? []

  const existing = await readItems(supabase, user.id, mk)
  if (existing.length > 0) {
    return NextResponse.json({ needsSetup: false, weeklyMinutes, focus, monthKey: mk, items: existing })
  }

  await generatePlan(supabase, user.id, weeklyMinutes, focus, mk)
  const items = await readItems(supabase, user.id, mk)
  return NextResponse.json({ needsSetup: false, weeklyMinutes, focus, monthKey: mk, items })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const body = await request.json() as { weeklyMinutes: number; focus: string[] }
  const weeklyMinutes = body.weeklyMinutes
  const focus = body.focus ?? []

  if (![15, 30, 60].includes(weeklyMinutes)) {
    return NextResponse.json({ error: 'weeklyMinutes invalide' }, { status: 400 })
  }

  await supabase.from('autopilot_settings').upsert(
    { user_id: user.id, weekly_minutes: weeklyMinutes, focus, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )

  const mk = currentMonthKey()
  await supabase
    .from('autopilot_plan')
    .delete()
    .eq('user_id', user.id)
    .eq('month_key', mk)

  await generatePlan(supabase, user.id, weeklyMinutes, focus, mk)
  const items = await readItems(supabase, user.id, mk)
  return NextResponse.json({ needsSetup: false, weeklyMinutes, focus, monthKey: mk, items })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const { id, status } = await request.json() as { id: string; status: 'todo' | 'done' }
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
