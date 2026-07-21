import { createClient } from '@/lib/supabase/server'

/**
 * Accès données de l'espace Comité Scientifique (/cs).
 *
 * Isolé ici volontairement — ne touche PAS `src/lib/supabase/hooks.ts`
 * (périmètre protégé). Toutes les fonctions sont server-side et s'appuient
 * sur la session du user (RLS active) :
 *   - lecture : policies `editorial_validations_cs_read` /
 *     `..._public_read_current`, `cs_members_public_read_active` ;
 *   - écriture lead : policy `editorial_validations_cs_insert` ;
 *   - co-signature : RPC `add_secondary_validation` (côté client).
 *
 * NB schéma : `validated_by_lead` / `validated_by_secondary` référencent
 * `cs_members.id` (FK), pas `auth.uid()`.
 */

export type CsContentType = 'formation' | 'news_episode' | 'news_synthesis'

export const CS_CONTENT_TYPES: CsContentType[] = [
  'formation',
  'news_episode',
  'news_synthesis',
]

export function isCsContentType(v: string): v is CsContentType {
  return (CS_CONTENT_TYPES as string[]).includes(v)
}

export function contentTypeLabel(t: CsContentType): string {
  switch (t) {
    case 'formation':
      return 'Formation'
    case 'news_episode':
      return 'Actu (épisode)'
    case 'news_synthesis':
      return 'Synthèse'
  }
}

export interface QueueItem {
  content_type: CsContentType
  content_id: string
  title: string
  published_at: string | null
}

export interface ValidationStatus {
  validated: boolean
  is_stale: boolean
  validation_id: string | null
  validated_at: string | null
  lead_name: string | null
  lead_title: string | null
  secondary_name: string | null
  secondary_title: string | null
  comments: string | null
}

export interface ContentPreview {
  title: string
  content_type: CsContentType
  content_hash: string | null
  meta: string[]
  sections: string[]
  // Blocs structurés (label + texte long) — utilisés pour le noyau
  // scientifique d'une synthèse ; vide pour formation/épisode.
  fields?: { label: string; value: string }[]
}

/**
 * Forme d'une ligne renvoyée par la RPC `get_syntheses_for_validation`
 * (canal de lecture des synthèses, arbitrage 8A — colonnes sûres uniquement).
 */
interface SynthesisRow {
  id: string
  display_title: string | null
  summary_fr: string | null
  method: string | null
  key_figures: string[] | null
  evidence_level: string | null
  clinical_impact: string | null
  caveats: string | null
  specialite: string | null
  published_at: string | null
}

export interface MyValidationRow {
  id: string
  content_type: CsContentType
  content_id: string
  title: string
  validated_at: string
  is_current: boolean
  role: 'lead' | 'secondary'
  has_secondary: boolean
  is_stale: boolean
}

/**
 * `id` de la ligne `cs_members` active du user courant, ou null s'il n'en a
 * pas (indispensable pour attribuer une validation : c'est la valeur de
 * `validated_by_lead`).
 */
export async function getCurrentCsMemberId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('cs_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

  return (data?.id as string | undefined) ?? null
}

/** Statut de validation courant d'un contenu (wrapper de la RPC). */
export async function getValidationStatus(
  contentType: CsContentType,
  contentId: string
): Promise<ValidationStatus> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_validation_status', {
    p_content_type: contentType,
    p_content_id: contentId,
  })

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return {
      validated: false,
      is_stale: false,
      validation_id: null,
      validated_at: null,
      lead_name: null,
      lead_title: null,
      secondary_name: null,
      secondary_title: null,
      comments: null,
    }
  }
  return {
    validated: row.validated === true,
    is_stale: row.is_stale === true,
    validation_id: (row.validation_id as string | null) ?? null,
    validated_at: (row.validated_at as string | null) ?? null,
    lead_name: (row.lead_name as string | null) ?? null,
    lead_title: (row.lead_title as string | null) ?? null,
    secondary_name: (row.secondary_name as string | null) ?? null,
    secondary_title: (row.secondary_title as string | null) ?? null,
    comments: (row.comments as string | null) ?? null,
  }
}

/**
 * File d'attente : contenus publiés SANS validation courante.
 * (Un contenu déjà validé — même « périmé » — n'apparaît pas ici ; il reste
 * accessible via son écran de validation pour co-signature.)
 */
export async function getValidationQueue(): Promise<QueueItem[]> {
  const supabase = await createClient()

  const [formationsRes, episodesRes, synthesesRes, currentRes] =
    await Promise.all([
      supabase
        .from('formations')
        .select('id, title, created_at')
        .eq('is_published', true),
      supabase
        .from('news_episodes')
        .select('id, title, published_at, created_at')
        .eq('status', 'published'),
      // Synthèses : pas de SELECT client possible (arbitrage 8A) → RPC
      // SECURITY DEFINER à colonnes sûres.
      supabase.rpc('get_syntheses_for_validation'),
      supabase
        .from('editorial_validations')
        .select('content_type, content_id')
        .eq('is_current', true),
    ])

  const validated = new Set<string>(
    (currentRes.data ?? []).map(
      (r) => `${r.content_type}:${r.content_id}`
    )
  )

  const items: QueueItem[] = []

  for (const f of formationsRes.data ?? []) {
    const key = `formation:${f.id}`
    if (validated.has(key)) continue
    items.push({
      content_type: 'formation',
      content_id: f.id as string,
      title: (f.title as string) ?? 'Sans titre',
      published_at: (f.created_at as string | null) ?? null,
    })
  }

  for (const e of episodesRes.data ?? []) {
    const key = `news_episode:${e.id}`
    if (validated.has(key)) continue
    items.push({
      content_type: 'news_episode',
      content_id: e.id as string,
      title: (e.title as string) ?? 'Sans titre',
      published_at:
        (e.published_at as string | null) ??
        (e.created_at as string | null) ??
        null,
    })
  }

  for (const s of (synthesesRes.data ?? []) as SynthesisRow[]) {
    const key = `news_synthesis:${s.id}`
    if (validated.has(key)) continue
    items.push({
      content_type: 'news_synthesis',
      content_id: s.id,
      title: s.display_title ?? 'Sans titre',
      published_at: s.published_at ?? null,
    })
  }

  // Plus anciens d'abord : ce qui attend depuis le plus longtemps remonte.
  items.sort((a, b) => {
    const da = a.published_at ? Date.parse(a.published_at) : 0
    const db = b.published_at ? Date.parse(b.published_at) : 0
    return da - db
  })

  return items
}

/**
 * Contenu à valider, en lecture seule (identification + empreinte).
 * Retourne null si le contenu n'existe pas.
 */
export async function getContentPreview(
  contentType: CsContentType,
  contentId: string
): Promise<ContentPreview | null> {
  const supabase = await createClient()

  const { data: hashData } = await supabase.rpc('compute_content_hash', {
    p_content_type: contentType,
    p_content_id: contentId,
  })
  const content_hash = (hashData as string | null) ?? null

  if (contentType === 'formation') {
    const { data: f } = await supabase
      .from('formations')
      .select('title, axe_cp')
      .eq('id', contentId)
      .maybeSingle()
    if (!f) return null

    const { data: seqs } = await supabase
      .from('sequences')
      .select('title')
      .eq('formation_id', contentId)
      .order('id', { ascending: true })

    const meta: string[] = []
    if (f.axe_cp != null) meta.push(`Axe CP : ${String(f.axe_cp)}`)

    return {
      title: (f.title as string) ?? 'Sans titre',
      content_type: contentType,
      content_hash,
      meta,
      sections: (seqs ?? []).map(
        (s, i) => `${i + 1}. ${(s.title as string) ?? '—'}`
      ),
    }
  }

  if (contentType === 'news_synthesis') {
    // Pas de SELECT client sur news_syntheses (8A) : on lit via la RPC et on
    // isole la ligne demandée. La RPC ne renvoie que les synthèses actives.
    const { data: rows } = await supabase.rpc('get_syntheses_for_validation')
    const s = ((rows ?? []) as SynthesisRow[]).find((r) => r.id === contentId)
    if (!s) return null

    const meta: string[] = []
    if (s.specialite) meta.push(`Spécialité : ${s.specialite}`)
    if (s.evidence_level) meta.push(`Niveau de preuve : ${s.evidence_level}`)
    if (s.published_at) meta.push(`Publié le ${formatDateFr(s.published_at)}`)

    const fields: { label: string; value: string }[] = []
    if (s.summary_fr) fields.push({ label: 'Résumé', value: s.summary_fr })
    if (s.method) fields.push({ label: 'Méthode', value: s.method })
    if (s.key_figures && s.key_figures.length > 0) {
      fields.push({ label: 'Chiffres clés', value: s.key_figures.join('\n') })
    }
    if (s.clinical_impact) {
      fields.push({ label: 'Impact clinique', value: s.clinical_impact })
    }
    if (s.caveats) fields.push({ label: 'Limites', value: s.caveats })

    return {
      title: s.display_title ?? 'Sans titre',
      content_type: contentType,
      content_hash,
      meta,
      sections: [],
      fields,
    }
  }

  // news_episode
  const { data: e } = await supabase
    .from('news_episodes')
    .select('title, type, week_iso, published_at')
    .eq('id', contentId)
    .maybeSingle()
  if (!e) return null

  const meta: string[] = []
  if (e.type) meta.push(`Type : ${String(e.type)}`)
  if (e.week_iso) meta.push(`Semaine : ${String(e.week_iso)}`)

  return {
    title: (e.title as string) ?? 'Sans titre',
    content_type: contentType,
    content_hash,
    meta,
    sections: [],
  }
}

/** Historique : validations signées (lead ou secondary) par un membre. */
export async function getMyValidations(
  memberId: string
): Promise<MyValidationRow[]> {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('editorial_validations')
    .select(
      'id, content_type, content_id, content_hash, validated_at, is_current, validated_by_lead, validated_by_secondary'
    )
    .or(
      `validated_by_lead.eq.${memberId},validated_by_secondary.eq.${memberId}`
    )
    .order('validated_at', { ascending: false })

  const list = rows ?? []
  if (list.length === 0) return []

  // Titres, batchés par type.
  const formationIds = list
    .filter((r) => r.content_type === 'formation')
    .map((r) => r.content_id as string)
  const episodeIds = list
    .filter((r) => r.content_type === 'news_episode')
    .map((r) => r.content_id as string)
  const synthesisIds = new Set(
    list
      .filter((r) => r.content_type === 'news_synthesis')
      .map((r) => r.content_id as string)
  )

  const titles = new Map<string, string>()
  const [fTitles, eTitles, sRows] = await Promise.all([
    formationIds.length
      ? supabase.from('formations').select('id, title').in('id', formationIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    episodeIds.length
      ? supabase.from('news_episodes').select('id, title').in('id', episodeIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    // Titres de synthèses via la RPC (pas de SELECT client — 8A). La RPC ne
    // renvoie que les synthèses actives ; une synthèse supprimée retombera
    // sur le libellé « (contenu supprimé) ».
    synthesisIds.size
      ? supabase.rpc('get_syntheses_for_validation')
      : Promise.resolve({ data: [] as SynthesisRow[] }),
  ])
  for (const f of fTitles.data ?? [])
    titles.set(`formation:${f.id}`, (f.title as string) ?? 'Sans titre')
  for (const e of eTitles.data ?? [])
    titles.set(`news_episode:${e.id}`, (e.title as string) ?? 'Sans titre')
  for (const s of (sRows.data ?? []) as SynthesisRow[]) {
    if (!synthesisIds.has(s.id)) continue
    titles.set(`news_synthesis:${s.id}`, s.display_title ?? 'Sans titre')
  }

  // Péremption : l'empreinte stockée correspond-elle encore au contenu live ?
  const staleFlags = await Promise.all(
    list.map(async (r) => {
      const { data } = await supabase.rpc('compute_content_hash', {
        p_content_type: r.content_type,
        p_content_id: r.content_id,
      })
      const live = (data as string | null) ?? null
      return live != null && live !== r.content_hash
    })
  )

  return list.map((r, i) => ({
    id: r.id as string,
    content_type: r.content_type as CsContentType,
    content_id: r.content_id as string,
    title: titles.get(`${r.content_type}:${r.content_id}`) ?? '(contenu supprimé)',
    validated_at: r.validated_at as string,
    is_current: r.is_current === true,
    role: r.validated_by_lead === memberId ? 'lead' : 'secondary',
    has_secondary: r.validated_by_secondary != null,
    is_stale: staleFlags[i],
  }))
}

/** Formatage de date court FR (jj/mm/aaaa) tolérant au null. */
export function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
