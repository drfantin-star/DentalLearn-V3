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
  const [liveReminders, setLiveReminders] = useState(true)
  const [formateurPub, setFormateurPub] = useState(true)
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
          await supabase
            .from('user_notification_preferences')
            .upsert(
              {
                user_id: user.id,
                live_session_reminders: liveReminders,
                formateur_publications: formateurPub,
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
    [saveInterests, mutateInterests, refetch, router, user, liveReminders, formateurPub]
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
            <NotifToggles
              liveReminders={liveReminders}
              formateurPub={formateurPub}
              onToggleLive={() => setLiveReminders((v) => !v)}
              onToggleFormateur={() => setFormateurPub((v) => !v)}
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

// ── Toggles notifications (étape 5) ──────────────────────────────────

interface NotifTogglesProps {
  liveReminders: boolean
  formateurPub: boolean
  onToggleLive: () => void
  onToggleFormateur: () => void
}

function NotifToggles({
  liveReminders,
  formateurPub,
  onToggleLive,
  onToggleFormateur,
}: NotifTogglesProps) {
  return (
    <div className="flex flex-col gap-3">
      <ToggleRow
        label="Rappels sessions live"
        active={liveReminders}
        onToggle={onToggleLive}
      />
      <ToggleRow
        label="Publications des formateurs"
        active={formateurPub}
        onToggle={onToggleFormateur}
      />
    </div>
  )
}

function ToggleRow({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-sm font-medium transition active:scale-[0.99]"
      style={
        active
          ? {
              background: 'rgba(0,188,212,0.10)',
              borderColor: 'rgba(0,188,212,0.35)',
              color: 'rgba(0,188,212,1)',
            }
          : {
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.70)',
            }
      }
    >
      <span>{label}</span>
      <span
        className="flex h-6 w-11 items-center rounded-full px-0.5 transition-all duration-200"
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
