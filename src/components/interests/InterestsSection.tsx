'use client'

import { useState, useCallback } from 'react'
import { Heart, Loader2, Check, Pencil } from 'lucide-react'
import InterestChips, { AXE_CHIPS } from '@/components/interests/InterestChips'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { UserInterests } from '@/lib/supabase/types'
import { useSaveInterests } from '@/lib/hooks/useSaveInterests'
import { useUser } from '@/lib/hooks/useUser'

// Section « Centres d'intérêt » de la page Profil : permet de modifier les
// intérêts déclarés à l'onboarding. Lecture/écriture via le store partagé
// `useUser` + `useSaveInterests` (client session-utilisateur, jamais service
// role). Garde-fou clé : ne JAMAIS réécrire `interests` à NULL depuis le profil
// (NULL = « pas onboardé » → re-trigger onboarding). Une sélection vidée est
// persistée comme `{ categories: [], axes: [] }` (non-null).
export default function InterestsSection() {
  const { profile, loading, mutateInterests, refetch } = useUser()
  const { saveInterests, saving, error } = useSaveInterests()

  // Valeur courante affichée (depuis le store partagé). NULL traité comme vide
  // pour l'affichage uniquement — jamais réécrit tel quel.
  const current: UserInterests = profile?.interests ?? { categories: [], axes: [] }

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<UserInterests>(current)
  const [savedOk, setSavedOk] = useState(false)

  const startEdit = useCallback(() => {
    setDraft(profile?.interests ?? { categories: [], axes: [] })
    setSavedOk(false)
    setEditing(true)
  }, [profile])

  const cancelEdit = useCallback(() => {
    setEditing(false)
  }, [])

  const handleSave = useCallback(async () => {
    // Sélection vidée → persiste un objet vide non-null (pas de re-onboarding).
    const payload: UserInterests = {
      categories: draft.categories,
      axes: draft.axes,
    }
    const ok = await saveInterests(payload)
    if (!ok) return
    // Reflet immédiat dans tout l'UI (home « Pour vous » incluse) sans reload.
    mutateInterests(payload)
    await refetch()
    setEditing(false)
    setSavedOk(true)
  }, [draft, saveInterests, mutateInterests, refetch])

  const isEmpty = current.categories.length === 0 && current.axes.length === 0

  // Évite un flash « Aucun centre d'intérêt » pendant l'hydratation du store
  // partagé (profil pas encore chargé), avant que la vraie valeur arrive.
  if (loading && !profile) {
    return (
      <section>
        <h2 className="text-base font-bold text-[#e5e5e5] flex items-center gap-2 mb-3">
          <Heart size={18} className="text-[#EC4899]" />
          Centres d&apos;intérêt
        </h2>
        <div
          className="flex items-center justify-center p-6"
          style={{ background: '#242424', border: '0.5px solid #333', borderRadius: '16px' }}
        >
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-[#e5e5e5] flex items-center gap-2">
          <Heart size={18} className="text-[#EC4899]" />
          Centres d&apos;intérêt
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-[#e5e5e5]" />
            <span className="text-xs font-semibold text-[#e5e5e5]">Modifier</span>
          </button>
        )}
      </div>

      {editing ? (
        <div
          className="p-4"
          style={{ background: '#242424', border: '0.5px solid #333', borderRadius: '16px' }}
        >
          <InterestChips value={draft} onChange={setDraft} />

          {error && (
            <p className="mb-3 text-xs text-red-400">
              Échec de l&apos;enregistrement : {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white/90 disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div
          className="p-4"
          style={{ background: '#242424', border: '0.5px solid #333', borderRadius: '16px' }}
        >
          {isEmpty ? (
            <p className="text-sm text-[#6b7280]">
              Aucun centre d&apos;intérêt sélectionné. Touchez « Modifier » pour
              personnaliser votre accueil.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {current.categories.map((slug) => {
                const config = getCategoryConfig(slug)
                return (
                  <span
                    key={slug}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
                    style={{
                      background: `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`,
                    }}
                  >
                    <span aria-hidden>{config.emoji}</span>
                    <span>{config.name}</span>
                  </span>
                )
              })}
              {current.axes.map((axe) => {
                const chip = AXE_CHIPS.find((c) => c.axe === axe)
                if (!chip) return null
                return (
                  <span
                    key={`axe-${axe}`}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
                    style={{ background: chip.color }}
                  >
                    <span aria-hidden>{chip.emoji}</span>
                    <span>{chip.label}</span>
                  </span>
                )
              })}
            </div>
          )}

          {savedOk && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Centres d&apos;intérêt mis à jour
            </p>
          )}
        </div>
      )}
    </section>
  )
}
