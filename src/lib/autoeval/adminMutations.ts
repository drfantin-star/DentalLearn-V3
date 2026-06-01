// Helpers d'écriture ADMIN du questionnaire d'auto-évaluation (PR C).
//
// Principe NON NÉGOCIABLE : read-modify-write sur tout champ jsonb. On part de
// l'objet courant (chargé en mémoire), on ne mute QUE les clés autorisées, et on
// réécrit l'objet COMPLET. Jamais de jsonb partiel — sinon on écrase le câblage
// (value des options, key/triggerValues de routage, subscales CBI…).
//
// `updated_at` est posé par le trigger `autoeval_set_updated_at` (migration
// 20260529c) → aucun set manuel ici.
//
// Toute écriture passe par le client session-utilisateur (RLS super_admin).

import type { createClient } from '@/lib/supabase/client'
import type {
  ItemOption,
  QuestionnaireBlock,
  QuestionnaireItem,
  QuestionnaireRouting,
  RecapConfig,
  RoutingCard,
} from './types'

type Client = ReturnType<typeof createClient>
type Result = { error: string | null }

// ── Questionnaire (en-tête) ───────────────────────────────────────────────

export interface QuestionnaireHeaderPatch {
  titre: string
  description: string | null
  intro_text: string | null
  time_estimate_min: number | null
  actif: boolean
}

export async function updateQuestionnaireHeader(
  client: Client,
  id: string,
  patch: QuestionnaireHeaderPatch
): Promise<Result> {
  const { error } = await client
    .from('questionnaires')
    .update({
      titre: patch.titre,
      description: patch.description,
      intro_text: patch.intro_text,
      time_estimate_min: patch.time_estimate_min,
      actif: patch.actif,
    })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function toggleQuestionnaireActif(
  client: Client,
  id: string,
  actif: boolean
): Promise<Result> {
  const { error } = await client.from('questionnaires').update({ actif }).eq('id', id)
  return { error: error?.message ?? null }
}

// ── Blocs ─────────────────────────────────────────────────────────────────

/** Garde-fou : aucune écriture sur un bloc verrouillé (CBI, instrument validé). */
function assertEditable(block: QuestionnaireBlock): void {
  if (block.verrouille) {
    throw new Error('Bloc verrouillé (instrument validé) — écriture interdite.')
  }
}

export async function updateBlockTitre(
  client: Client,
  block: QuestionnaireBlock,
  titre: string
): Promise<Result> {
  assertEditable(block)
  const { error } = await client
    .from('questionnaire_blocks')
    .update({ titre })
    .eq('id', block.id)
  return { error: error?.message ?? null }
}

/**
 * Bloc RÉFLEXIF : `recap_config` = { messages: { vert, orange, rouge } }.
 * Read-modify-write : on conserve toutes les autres clés éventuelles de
 * `recap_config`, on ne remplace que `.messages`.
 */
export async function updateBlockRecapMessages(
  client: Client,
  block: QuestionnaireBlock,
  messages: { vert: string; orange: string; rouge: string }
): Promise<Result> {
  assertEditable(block)
  const current = (block.recap_config ?? {}) as Record<string, unknown>
  const next: RecapConfig = { ...current, messages }
  const { error } = await client
    .from('questionnaire_blocks')
    .update({ recap_config: next })
    .eq('id', block.id)
  return { error: error?.message ?? null }
}

/**
 * Bloc SUBSTANCES : `recap_config` = { neutralMessage }. PAS de vert/orange/rouge.
 * Read-modify-write : on ne remplace que `.neutralMessage`.
 */
export async function updateBlockRecapNeutral(
  client: Client,
  block: QuestionnaireBlock,
  neutralMessage: string
): Promise<Result> {
  assertEditable(block)
  const current = (block.recap_config ?? {}) as Record<string, unknown>
  const next: RecapConfig = { ...current, neutralMessage }
  const { error } = await client
    .from('questionnaire_blocks')
    .update({ recap_config: next })
    .eq('id', block.id)
  return { error: error?.message ?? null }
}

// ── Items ─────────────────────────────────────────────────────────────────

export async function updateItemLabels(
  client: Client,
  item: QuestionnaireItem,
  labels: { libelle: string; libelle_en: string | null }
): Promise<Result> {
  const { error } = await client
    .from('questionnaire_items')
    .update({ libelle: labels.libelle, libelle_en: labels.libelle_en })
    .eq('id', item.id)
  return { error: error?.message ?? null }
}

/**
 * Réécrit `options` en ne changeant QUE les `label`. La `value` (qui pilote le
 * scoring) est strictement conservée par position. `labels` doit avoir la même
 * longueur que `item.options`.
 */
export async function updateItemOptionLabels(
  client: Client,
  item: QuestionnaireItem,
  labels: string[]
): Promise<Result> {
  const current = item.options ?? []
  if (labels.length !== current.length) {
    return { error: 'Nombre de libellés d’options incohérent.' }
  }
  const next: ItemOption[] = current.map((opt, i) => ({
    ...opt, // conserve value (et toute clé future)
    label: labels[i],
  }))
  const { error } = await client
    .from('questionnaire_items')
    .update({ options: next })
    .eq('id', item.id)
  return { error: error?.message ?? null }
}

// ── Cartes de routage ─────────────────────────────────────────────────────

export interface RoutingCardTextPatch {
  title: string
  body: string
  phone: string | null
  variant: RoutingCard['variant']
  href: string | null
}

/**
 * Réécrit `carte` en ne changeant QUE les champs texte éditables (title, body,
 * variant, phone, href). `key` (câblage) est conservée. `condition.key` n'est
 * jamais touchée.
 */
export async function updateRoutingCardText(
  client: Client,
  routing: QuestionnaireRouting,
  patch: RoutingCardTextPatch
): Promise<Result> {
  const next: RoutingCard = {
    ...routing.carte, // conserve key et toute clé future
    title: patch.title,
    body: patch.body,
    variant: patch.variant,
  }
  // phone optionnel : on supprime la clé si vidée plutôt que de stocker "".
  if (patch.phone && patch.phone.trim()) {
    next.phone = patch.phone.trim()
  } else {
    delete next.phone
  }
  // href optionnel : même convention que phone. Le rendu user (ResourceCard)
  // teste `carte.href` en truthy → clé absente = aucun lien affiché.
  if (patch.href && patch.href.trim()) {
    next.href = patch.href.trim()
  } else {
    delete next.href
  }
  const { error } = await client
    .from('questionnaire_routing')
    .update({ carte: next })
    .eq('id', routing.id)
  return { error: error?.message ?? null }
}
