import { createClient } from '@/lib/supabase/client'
import type { AttestationType } from './types'

interface SaveAttestationInput {
  userId: string
  type: AttestationType
  sourceId: string
  blob: Blob
  verificationCode: string
  metadata: {
    title: string
    axe_cp: number | null
    type_action_cnp: string
    formateur?: string
    completed_at: string
    duree_heures: number
    // Formation-specific
    started_at?: string
    nb_sequences?: number
    nb_sequences_total?: number
    taux_reussite_quiz?: number
    taux_completion?: number
    // EPP-specific
    score_t1?: number
    score_t2?: number
    delta_score?: number
    nb_dossiers_t1?: number
    nb_dossiers_t2?: number
    duree_breakdown?: Record<string, number>
  }
}

/**
 * Upload le PDF dans Storage puis insère la ligne user_attestations.
 * Retourne { attestationId, pdfPath } ou throw en cas d'erreur.
 */
export async function saveAttestation(
  input: SaveAttestationInput
): Promise<{ attestationId: string; pdfPath: string }> {
  const supabase = createClient()

  // 1. Upload PDF vers Storage
  const pdfPath = `${input.userId}/${input.type}/${Date.now()}.pdf`
  const { error: uploadErr } = await supabase.storage
    .from('attestations')
    .upload(pdfPath, input.blob, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadErr) {
    console.error('Erreur upload PDF :', uploadErr)
    throw new Error(`Upload PDF échoué : ${uploadErr.message}`)
  }

  // 2. Insert dans user_attestations
  const { data: attestation, error: insertErr } = await supabase
    .from('user_attestations')
    .insert({
      user_id: input.userId,
      type: input.type,
      source_id: input.sourceId,
      axe_cp: input.metadata.axe_cp,
      type_action_cnp: input.metadata.type_action_cnp,
      cnp_labellisation: 'en_cours',
      title: input.metadata.title,
      formateur: input.metadata.formateur || null,
      comite_scientifique: 'Dr J. Fantin, Dr L. Elbeze, Dr A. Gaudin, Dr P. Bargman',
      started_at: input.metadata.started_at || null,
      completed_at: input.metadata.completed_at,
      duree_heures: input.metadata.duree_heures,
      duree_breakdown: input.metadata.duree_breakdown || null,
      taux_reussite_quiz: input.metadata.taux_reussite_quiz ?? null,
      taux_completion: input.metadata.taux_completion ?? null,
      nb_sequences: input.metadata.nb_sequences ?? null,
      nb_sequences_total: input.metadata.nb_sequences_total ?? null,
      score_t1: input.metadata.score_t1 ?? null,
      score_t2: input.metadata.score_t2 ?? null,
      delta_score: input.metadata.delta_score ?? null,
      nb_dossiers_t1: input.metadata.nb_dossiers_t1 ?? null,
      nb_dossiers_t2: input.metadata.nb_dossiers_t2 ?? null,
      pdf_path: pdfPath,
      verification_code: input.verificationCode,
    })
    .select('id')
    .single()

  if (insertErr) {
    // Rollback : supprimer le PDF uploadé
    await supabase.storage.from('attestations').remove([pdfPath])
    throw new Error(`Insertion DB échouée : ${insertErr.message}`)
  }

  return { attestationId: attestation.id, pdfPath }
}

/**
 * Génère un code de vérification unique au format DL-XXXXXX-XXXX.
 */
export function generateVerificationCode(): string {
  const part1 = Date.now().toString(36).toUpperCase().slice(-6)
  const part2 = Math.random().toString(36).toUpperCase().slice(-4)
  return `DL-${part1}-${part2}`
}

/**
 * Déclenche le téléchargement d'un Blob côté navigateur.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
