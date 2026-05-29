'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ShieldCheck, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  generateActionFPDF,
  getActionFPDFFilename,
  type ActionFRessourceSnapshot,
} from '@/lib/attestations/generateActionFPDF'
import {
  generateVerificationCode,
  downloadBlob,
} from '@/lib/attestations/saveAttestation'

const ATTESTATION_TYPE = 'action_cnp_info_patient'
const ATTESTATION_TITLE = "Démarche d'information du patient — Action F"

interface RessourceRow {
  id: string
  titre: string
  source: string
  type: 'internal' | 'external'
  categorie: string | null
}

/**
 * Bouton + modale permettant au praticien d'attester sa démarche d'information
 * patient (Certification Périodique, Axe 3, Action F). La liste des ressources
 * est lue en live depuis `bibliotheque_ressources` (axe=3) pour refléter les
 * ajouts/suppressions effectués dans /admin/bibliotheque.
 */
export function AttesterActionFButton() {
  const [open, setOpen] = useState(false)
  const [ressources, setRessources] = useState<RessourceRow[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [rppsMissing, setRppsMissing] = useState(false)
  const [successCode, setSuccessCode] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeModal = useCallback(() => {
    setOpen(false)
    setGenError(null)
    setRppsMissing(false)
    triggerRef.current?.focus()
  }, [])

  // Chargement live des ressources axe 3 à l'ouverture de la modale.
  useEffect(() => {
    if (!open) return
    let active = true
    setLoadingList(true)
    setListError(null)
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('bibliotheque_ressources')
          .select('id, titre, source, type, categorie')
          .eq('axe', 3)
          .order('categorie', { ascending: true })
          .order('ordre', { ascending: true })
        if (error) throw error
        if (!active) return
        const rows = (data ?? []) as RessourceRow[]
        setRessources(rows)
        // État par défaut : toutes les cases cochées.
        setChecked(Object.fromEntries(rows.map((r) => [r.id, true])))
      } catch (err: any) {
        if (active) setListError(err.message || 'Erreur de chargement des ressources')
      } finally {
        if (active) setLoadingList(false)
      }
    })()
    return () => {
      active = false
    }
  }, [open])

  // Accessibilité : Échap ferme, focus piégé dans la modale, focus initial.
  useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeModal()
        return
      }
      if (e.key === 'Tab' && node) {
        const focusables = node.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    // Focus initial sur la modale.
    requestAnimationFrame(() => dialogRef.current?.focus())
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, closeModal])

  const selectedCount = ressources.filter((r) => checked[r.id]).length

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)
    setRppsMissing(false)

    try {
      const supabase = createClient()

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Non authentifié')

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, rpps, profession')
        .eq('id', user.id)
        .single()
      if (!profile) throw new Error('Profil introuvable')

      if (!profile.rpps || profile.rpps.trim() === '') {
        setRppsMissing(true)
        return
      }

      const participant = {
        nom_complet: `Dr ${(profile.last_name || '').toUpperCase()} ${profile.first_name || ''}`.trim(),
        rpps: profile.rpps,
        profession: profile.profession || 'Chirurgien-dentiste',
      }

      // Snapshot des ressources cochées (figées dans metadata + PDF).
      const selected = ressources.filter((r) => checked[r.id])
      if (selected.length === 0) {
        throw new Error('Sélectionnez au moins une ressource.')
      }
      const snapshots: ActionFRessourceSnapshot[] = selected.map((r) => ({
        ressource_id: r.id,
        titre: r.titre,
        source: r.source,
        type: r.type,
        categorie: r.categorie ?? undefined,
      }))

      const code = generateVerificationCode()
      const today = new Date()
      const todayDate = today.toISOString().split('T')[0]
      const verifyUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/verify/${code}`
          : undefined

      const blob = await generateActionFPDF({
        participant,
        declaration_date: today,
        ressources: snapshots,
        verification_code: code,
        verify_url: verifyUrl,
      })

      // 1. Upload PDF (bucket privé `attestations`, 1er dossier = user_id pour RLS).
      const pdfPath = `${user.id}/${ATTESTATION_TYPE}/${code}.pdf`
      const { error: uploadErr } = await supabase.storage
        .from('attestations')
        .upload(pdfPath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        })
      if (uploadErr) {
        throw new Error(
          `Échec de l'envoi du PDF : ${uploadErr.message}. Veuillez réessayer.`
        )
      }

      // 2. Insert user_attestations (le trigger crée la ligne de vérification miroir).
      const { error: insertErr } = await supabase
        .from('user_attestations')
        .insert({
          user_id: user.id,
          type: ATTESTATION_TYPE,
          axe_cp: 3,
          type_action_cnp: 'F',
          title: ATTESTATION_TITLE,
          completed_at: todayDate,
          verification_code: code,
          pdf_path: pdfPath,
          metadata: {
            ressources_attestees: snapshots,
            nb_ressources: snapshots.length,
          },
        })
      if (insertErr) {
        // Rollback : supprimer le PDF uploadé pour ne pas laisser de fichier orphelin.
        await supabase.storage.from('attestations').remove([pdfPath])
        throw new Error(`Enregistrement échoué : ${insertErr.message}`)
      }

      // 3. Téléchargement immédiat + succès.
      downloadBlob(blob, getActionFPDFFilename())
      setSuccessCode(code)
      setOpen(false)
    } catch (err: any) {
      console.error('Erreur génération attestation Action F :', err)
      setGenError(err.message || 'Erreur inconnue')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mt-10 flex flex-col items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setSuccessCode(null)
          setOpen(true)
        }}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-[#ea6a0c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ShieldCheck size={18} aria-hidden="true" />
        Attester ma démarche d&apos;information patient (Action F)
      </button>

      {successCode && (
        <div className="mt-4 flex w-full max-w-md items-start gap-2 rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-sm text-emerald-300">
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p>
            Attestation générée : code{' '}
            <span className="font-mono font-semibold">{successCode}</span>. Le PDF a
            été téléchargé et figure désormais dans{' '}
            <a href="/profil/attestations" className="underline">
              Mes attestations
            </a>
            .
          </p>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-f-title"
            tabIndex={-1}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-gray-800 bg-[#141414] shadow-2xl focus:outline-none sm:rounded-3xl"
          >
            {/* En-tête */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-800 p-5">
              <div>
                <h2
                  id="action-f-title"
                  className="text-lg font-black text-white"
                >
                  Attester votre démarche d&apos;information patient
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  Cochez les ressources que vous mettez effectivement à
                  disposition de vos patients. Cette déclaration constitue un
                  élément de preuve pour votre Certification Périodique (Axe 3,
                  Action F).
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer"
                className="-mr-1 -mt-1 flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <X size={20} />
              </button>
            </div>

            {/* Liste des ressources */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingList && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              )}

              {listError && !loadingList && (
                <div className="flex items-start gap-2 rounded-xl border border-red-700/40 bg-red-900/20 p-3 text-sm text-red-300">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{listError}</span>
                </div>
              )}

              {!loadingList && !listError && ressources.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  Aucune ressource disponible pour le moment.
                </p>
              )}

              {!loadingList && !listError && ressources.length > 0 && (
                <ul className="space-y-2">
                  {ressources.map((r) => (
                    <li key={r.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-800 bg-[#1a1a1a] p-3 transition-colors hover:border-gray-700">
                        <input
                          type="checkbox"
                          checked={!!checked[r.id]}
                          onChange={(e) =>
                            setChecked((prev) => ({
                              ...prev,
                              [r.id]: e.target.checked,
                            }))
                          }
                          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#F97316]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold leading-snug text-white">
                              {r.titre}
                            </span>
                            <span className="flex-shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                              {r.source}
                            </span>
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pied : compteur + actions */}
            <div className="border-t border-gray-800 p-5">
              <p className="mb-3 text-center text-xs font-medium text-gray-400">
                {selectedCount} / {ressources.length} ressource
                {ressources.length > 1 ? 's' : ''} sélectionnée
                {selectedCount > 1 ? 's' : ''}
              </p>

              {rppsMissing && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-700/40 bg-amber-900/20 p-3 text-xs text-amber-300">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Votre numéro RPPS est requis pour générer cette attestation.{' '}
                    <a href="/profil/edit" className="underline">
                      Compléter mon profil
                    </a>
                  </span>
                </div>
              )}

              {genError && (
                <p className="mb-3 text-center text-xs text-red-400">{genError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-gray-700 px-4 py-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || selectedCount === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F97316] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#ea6a0c] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Génération…
                    </>
                  ) : (
                    "Générer l'attestation"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
