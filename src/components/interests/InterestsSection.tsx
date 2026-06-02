'use client'

import { useState, useCallback } from 'react'
import { Heart, Loader2, ChevronRight, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import InterestChips from '@/components/interests/InterestChips'
import type { UserInterests } from '@/lib/supabase/types'
import { useSaveInterests } from '@/lib/hooks/useSaveInterests'
import { useUser } from '@/lib/hooks/useUser'

// Section « Centres d'intérêt » de la page Profil : une carte (même pattern
// visuel que « Créer mon cabinet » / « Mes attestations ») qui ouvre un modal
// sombre contenant l'éditeur de chips partagé `InterestChips`. Lecture/écriture
// via le store partagé `useUser` + `useSaveInterests` (client session-utilisateur,
// jamais service role). Garde-fou clé : ne JAMAIS réécrire `interests` à NULL
// depuis le profil (NULL = « pas onboardé » → re-trigger onboarding). Une
// sélection vidée est persistée comme `{ categories: [], axes: [] }` (non-null).
//
// NB modal : <Modal> est réutilisé pour tout son comportement (esc / backdrop /
// scroll-lock / a11y). Son `variant="dark"` n'assombrit que le backdrop ; le
// corps du panel est donc forcé sombre via className (`bg-neutral-900`, twMerge
// override de `bg-white`) + header/footer maison sombres. Une variante sombre
// native de <Modal> (corps + header) reste une dette DS à traiter à part.
export default function InterestsSection() {
  const { profile, loading, mutateInterests, refetch } = useUser()
  const { saveInterests, saving, error } = useSaveInterests()

  // Valeur courante affichée (depuis le store partagé). NULL traité comme vide
  // pour l'affichage uniquement — jamais réécrit tel quel.
  const current: UserInterests = profile?.interests ?? { categories: [], axes: [] }
  const count = current.categories.length + current.axes.length

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<UserInterests>(current)

  const openModal = useCallback(() => {
    setDraft(profile?.interests ?? { categories: [], axes: [] })
    setOpen(true)
  }, [profile])

  const closeModal = useCallback(() => {
    if (saving) return
    setOpen(false)
  }, [saving])

  const handleSave = useCallback(async () => {
    // Sélection vidée → persiste un objet vide non-null (pas de re-onboarding).
    const payload: UserInterests = {
      categories: draft.categories,
      axes: draft.axes,
    }
    const ok = await saveInterests(payload)
    if (!ok) return
    // Reflet immédiat dans tout l'UI (home « Pour vous » incluse) sans reload :
    // sync optimiste du store partagé PUIS refetch, AVANT de fermer.
    mutateInterests(payload)
    await refetch()
    setOpen(false)
  }, [draft, saveInterests, mutateInterests, refetch])

  const subtitle =
    count === 0
      ? 'Personnalisez votre accueil'
      : `${count} centre${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`

  return (
    <>
      {/* Carte (pattern « Créer mon cabinet ») → ouvre le modal d'édition */}
      <button
        type="button"
        onClick={openModal}
        disabled={loading && !profile}
        className="w-full p-4 text-left hover:border-pink-500/60 transition-colors disabled:opacity-60"
        style={{ background: '#242424', border: '0.5px solid #333', borderRadius: '16px' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/15 flex items-center justify-center">
            <Heart className="w-5 h-5 text-pink-400" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-neutral-200 text-sm">
              Centres d&apos;intérêt
            </div>
            <div className="text-xs text-gray-500">{subtitle}</div>
          </div>
          {loading && !profile ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </button>

      {/* Modal sombre : corps = InterestChips existant, footer = Enregistrer */}
      <Modal
        open={open}
        onClose={closeModal}
        variant="dark"
        size="lg"
        ariaLabel="Vos centres d'intérêt"
        className="bg-neutral-900 border border-neutral-800"
      >
        {/* Header maison sombre (Modal.Header est light, non réutilisé ici) */}
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white">Vos centres d&apos;intérêt</h2>
          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Fermer"
            className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps : éditeur de chips partagé, réutilisé tel quel */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          <InterestChips value={draft} onChange={setDraft} />

          {error && (
            <p className="text-xs text-red-400">
              Échec de l&apos;enregistrement : {error}
            </p>
          )}
        </div>

        {/* Footer maison sombre */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-800">
          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white/90 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
          </button>
        </div>
      </Modal>
    </>
  )
}
