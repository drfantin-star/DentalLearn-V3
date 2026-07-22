'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import InterestChips from '@/components/interests/InterestChips'
import type { InterestSection } from '@/components/interests/InterestChips'
import SophieBubble from '@/components/sophie/SophieBubble'
import type { UserInterests } from '@/lib/supabase/types'
import { useSaveInterests } from '@/lib/hooks/useSaveInterests'
import { useUser } from '@/lib/hooks/useUser'
import QrAppCard from '@/components/push/QrAppCard'
import { createClient } from '@/lib/supabase/client'

// ── Configuration des étapes ──────────────────────────────────────────

interface Step {
  bubble: string
  sections?: InterestSection[]
  isNotif?: true
}

const STEPS: Step[] = [
  {
    bubble: "Pour commencer, qu'est-ce qui te plaît le plus en clinique ?",
    sections: ['clinical'],
  },
  {
    bubble: "Et côté relation avec tes patients, qu'est-ce qui t'intéresse ?",
    sections: ['axe3'],
  },
  {
    bubble: "Parlons un peu de toi : quels sujets autour de ta santé au travail ?",
    sections: ['axe4'],
  },
  {
    bubble: "La gestion du cabinet, un terrain pour toi ?",
    sections: ['bonus'],
  },
  {
    bubble: "Dernière chose : comment je te tiens au courant ?",
    isNotif: true,
  },
]

const TOTAL = STEPS.length

// ── Page ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { saveInterests, saving } = useSaveInterests()
  const { user, profile, loading, refetch, mutateInterests } = useUser()
  const guardDoneRef = useRef(false)

  const [stepIndex, setStepIndex] = useState(0)
  const [selection, setSelection] = useState<UserInterests>({ categories: [], axes: [] })
  // Mobile (M1/U1) : interrupteur général unique piloté par le master push
  // user_notification_preferences.notifications_enabled. Déclaratif — l'étape
  // n'écrit que la préférence et ne déclenche AUCUN prompt système (le prompt
  // arrive plus tard, après une victoire). Défaut true (déjà le défaut base).
  const [masterEnabled, setMasterEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [outro, setOutro] = useState(false)

  // Garde-fou one-shot (inchangé par rapport au correctif PR2b-fix)
  useEffect(() => {
    if (loading || guardDoneRef.current) return
    if (!user) {
      guardDoneRef.current = true
      router.replace('/login')
      return
    }
    if (profile && profile.interests !== null) {
      guardDoneRef.current = true
      router.replace('/')
    }
  }, [loading, user, profile, router])

  // Upsert prefs + persistAndGo (ordre inchangé : saveInterests → mutateInterests → refetch → replace)
  const persistAndGo = useCallback(
    async (interests: UserInterests) => {
      setSubmitting(true)

      // best-effort : ne bloque pas le redirect si erreur
      try {
        const supabase = createClient()
        if (user) {
          // Question déclarative → on écrit le master push (consentement de
          // compte) sans jamais déclencher de prompt navigateur. Le device push
          // se fera plus tard sur mobile (QR → soft-ask après victoire).
          //   • Desktop (§4.6) : le push n'y est jamais demandé → on affirme le
          //     consentement de compte à true (comportement inchangé).
          //   • Mobile (U1) : l'interrupteur général pilote notifications_enabled.
          // Les 8 autres colonnes ne sont pas écrites ici → elles gardent leur
          // défaut base (true).
          const isDesktop =
            typeof window !== 'undefined' &&
            window.matchMedia('(min-width: 1024px)').matches
          await supabase
            .from('user_notification_preferences')
            .upsert(
              {
                user_id: user.id,
                notifications_enabled: isDesktop ? true : masterEnabled,
              },
              { onConflict: 'user_id' }
            )
        }
      } catch {
        // ignore
      }

      const ok = await saveInterests(interests)
      if (!ok) {
        setSubmitting(false)
        return
      }
      guardDoneRef.current = true
      mutateInterests(interests)
      await refetch()
      router.replace('/')
    },
    [saveInterests, mutateInterests, refetch, router, user, masterEnabled]
  )

  const handleContinue = useCallback(async () => {
    if (stepIndex < TOTAL - 1) {
      setStepIndex((i) => i + 1)
    } else {
      setOutro(true)
      await persistAndGo(selection)
    }
  }, [stepIndex, persistAndGo, selection])

  const handleSkip = useCallback(async () => {
    setOutro(true)
    await persistAndGo(selection)
  }, [persistAndGo, selection])

  const redirecting = !user || (!!profile && profile.interests !== null)
  if (loading || redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-white/60" />
      </div>
    )
  }

  const step = STEPS[stepIndex]
  const isBusy = saving || submitting

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-40 pt-10">

      {/* Barre de progression */}
      <div className="mb-6 flex gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              background: i <= stepIndex ? 'var(--color-accent, #00BCD4)' : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>

      {/* Intro (étape 1 uniquement) */}
      {stepIndex === 0 && (
        <p className="mb-5 text-sm text-white/50">
          Coucou, moi c&apos;est Sophie 👋 On fait connaissance en 1 min ? Passe ce que tu veux.
        </p>
      )}

      {/* Bulle Sophie */}
      <div className="mb-7">
        <SophieBubble message={outro ? "C'est noté, j'te prépare tout ça 🎉" : step.bubble} />
      </div>

      {/* Contenu de l'étape */}
      {!outro && (
        <>
          {step.isNotif ? (
            <NotifStep
              masterEnabled={masterEnabled}
              onToggleMaster={() => setMasterEnabled((v) => !v)}
            />
          ) : (
            <InterestChips
              value={selection}
              onChange={setSelection}
              sections={step.sections}
            />
          )}
        </>
      )}

      {/* Navigation fixe */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-white/10 px-5 pb-6 pt-4"
        style={{ background: 'rgba(15,15,15,0.92)', backdropFilter: 'blur(8px)' }}
      >
        <div className="mx-auto w-full max-w-2xl">
          {/* Bouton retour (sobre, optionnel) */}
          {stepIndex > 0 && !outro && (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i - 1)}
              disabled={isBusy}
              className="mb-2 w-full text-center text-xs text-white/30 transition hover:text-white/60 disabled:opacity-40"
            >
              ← Étape précédente
            </button>
          )}

          <button
            type="button"
            onClick={() => { void handleContinue() }}
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-base font-semibold text-black transition active:scale-[0.99] disabled:opacity-60"
          >
            {isBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : stepIndex < TOTAL - 1 ? (
              'Continuer'
            ) : (
              "C'est parti !"
            )}
          </button>

          <button
            type="button"
            onClick={() => { void handleSkip() }}
            disabled={isBusy}
            className="mt-3 w-full text-center text-sm text-white/50 transition hover:text-white/80 disabled:opacity-60"
          >
            Je choisirai plus tard
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Étape notifications (étape 5) ────────────────────────────────────
//
// Desktop (P1) : le push n'est jamais demandé (un refus navigateur est
//   définitif) → pas de réglage granulaire ici. On affiche le QR (« continue
//   sur ton téléphone ») + une ligne discrète renvoyant vers le profil.
// Mobile (M1/U1) : un seul interrupteur général qui pilote le master push
//   (notifications_enabled). Déclaratif : il n'écrit que la préférence, ne
//   déclenche aucun prompt système. Le détail des 9 toggles reste dans /profil.

interface NotifStepProps {
  masterEnabled: boolean
  onToggleMaster: () => void
}

function NotifStep({ masterEnabled, onToggleMaster }: NotifStepProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Mobile uniquement : interrupteur général unique (master push). */}
      <div className="lg:hidden">
        <MasterSwitch active={masterEnabled} onToggle={onToggleMaster} />
      </div>

      {/* Desktop uniquement : QR vers app.certily.fr (jamais de prompt ici)
          + renvoi discret vers le profil pour le réglage granulaire. */}
      <div className="hidden lg:block">
        <QrAppCard caption="Scanne pour installer Certily et recevoir tes rappels." />
        <p className="mt-3 text-center text-xs text-white/45">
          Tu régleras tes préférences de notifications dans ton profil.
        </p>
      </div>
    </div>
  )
}

// Interrupteur général mobile : titre + sous-ligne renvoyant vers le profil.
function MasterSwitch({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      className="flex w-full items-start justify-between gap-4 rounded-xl border px-4 py-3.5 text-left transition active:scale-[0.99]"
      style={
        active
          ? {
              background: 'rgba(0,188,212,0.10)',
              borderColor: 'rgba(0,188,212,0.35)',
            }
          : {
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.10)',
            }
      }
    >
      <span className="flex flex-col gap-1">
        <span
          className="text-sm font-semibold"
          style={{ color: active ? 'rgba(0,188,212,1)' : 'rgba(255,255,255,0.85)' }}
        >
          Recevoir mes rappels et notifications
        </span>
        <span className="text-xs text-white/50">
          Tu pourras choisir précisément quoi activer ou désactiver dans ton profil.
        </span>
      </span>
      <span
        className="mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-all duration-200"
        style={{
          background: active ? 'rgba(0,188,212,0.6)' : 'rgba(255,255,255,0.15)',
          justifyContent: active ? 'flex-end' : 'flex-start',
        }}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </button>
  )
}
