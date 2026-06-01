'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'
import { getCategoryConfig } from '@/lib/supabase/types'
import { useSaveInterests } from '@/lib/hooks/useSaveInterests'
import { useUser } from '@/lib/hooks/useUser'

// ── Définition des chips ──────────────────────────────────────────────
// Cliniques & bonus → poussent leur slug dans categories[] (libellés/couleurs
// réutilisés via getCategoryConfig). Chips d'axe → poussent un entier dans
// axes[] (couleurs canoniques du design system : axe 3 #D97706, axe 4 #EC4899).

const CLINICAL_SLUGS = [
  'esthetique',
  'restauratrice',
  'chirurgie',
  'implant',
  'prothese',
  'parodontologie',
  'endodontie',
  'radiologie',
  'numerique',
] as const

const BONUS_SLUGS = ['management', 'organisation', 'soft-skills'] as const

const AXE_CHIPS: { label: string; axe: number; color: string; emoji: string }[] = [
  { label: 'Relation patient', axe: 3, color: '#D97706', emoji: '🗣️' },
  { label: 'Santé du praticien', axe: 4, color: '#EC4899', emoji: '🪷' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { saveInterests, saving } = useSaveInterests()
  // Même source d'`interests` qu'AppShell (store partagé) → pas de divergence.
  const { user, profile, loading, refetch, mutateInterests } = useUser()
  const guardDoneRef = useRef(false)

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedAxes, setSelectedAxes] = useState<Set<number>>(() => new Set())

  // Garde-fou one-shot : pas d'utilisateur → /login ; interests déjà non-NULL
  // (onboarding déjà vu) → home. Lit le store partagé (jamais un refetch direct
  // divergent). `guardDoneRef` empêche toute redirection répétée (idempotence).
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

  const toggleCategory = useCallback((slug: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }, [])

  const toggleAxe = useCallback((axe: number) => {
    setSelectedAxes((prev) => {
      const next = new Set(prev)
      if (next.has(axe)) next.delete(axe)
      else next.add(axe)
      return next
    })
  }, [])

  const persistAndGo = useCallback(
    async (categories: string[], axes: number[]) => {
      const ok = await saveInterests({ categories, axes })
      if (!ok) return
      // Synchroniser l'état partagé AVANT de naviguer : AppShell doit voir
      // `interests` non-null tout de suite (sinon il redirige vers /onboarding
      // → loop). On supprime aussi le garde-fou local pour éviter une double nav.
      guardDoneRef.current = true
      mutateInterests({ categories, axes }) // optimiste (synchrone)
      await refetch() // réconciliation DB
      router.replace('/')
    },
    [saveInterests, mutateInterests, refetch, router]
  )

  const handleContinue = useCallback(() => {
    persistAndGo(Array.from(selectedCategories), Array.from(selectedAxes))
  }, [persistAndGo, selectedCategories, selectedAxes])

  const handleSkip = useCallback(() => {
    persistAndGo([], [])
  }, [persistAndGo])

  // Loader tant que l'état n'est pas prêt OU qu'une redirection (guard) est en
  // cours (pas d'utilisateur, ou interests déjà renseignés).
  const redirecting = !user || (!!profile && profile.interests !== null)
  if (loading || redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-white/60" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-32 pt-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Qu&apos;est-ce qui vous intéresse&nbsp;?
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Sélectionnez vos sujets favoris pour personnaliser votre accueil. Vous
          pourrez toujours les modifier plus tard.
        </p>
      </header>

      <ChipSection title="Cliniques">
        {CLINICAL_SLUGS.map((slug) => (
          <CategoryChip
            key={slug}
            slug={slug}
            selected={selectedCategories.has(slug)}
            onToggle={toggleCategory}
          />
        ))}
      </ChipSection>

      <ChipSection title="Parcours CP">
        {AXE_CHIPS.map((chip) => (
          <AxeChip
            key={chip.axe}
            chip={chip}
            selected={selectedAxes.has(chip.axe)}
            onToggle={toggleAxe}
          />
        ))}
      </ChipSection>

      <ChipSection title="Gestion de cabinet">
        {BONUS_SLUGS.map((slug) => (
          <CategoryChip
            key={slug}
            slug={slug}
            selected={selectedCategories.has(slug)}
            onToggle={toggleCategory}
          />
        ))}
      </ChipSection>

      {/* CTA fixe en bas */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-white/10 px-5 pb-6 pt-4"
        style={{ background: 'rgba(15,15,15,0.92)', backdropFilter: 'blur(8px)' }}
      >
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-base font-semibold text-black transition active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Continuer'
            )}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="mt-3 w-full text-center text-sm text-white/50 transition hover:text-white/80 disabled:opacity-60"
          >
            Je choisirai plus tard
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sous-composants ───────────────────────────────────────────────────

function ChipSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </section>
  )
}

function CategoryChip({
  slug,
  selected,
  onToggle,
}: {
  slug: string
  selected: boolean
  onToggle: (slug: string) => void
}) {
  const config = getCategoryConfig(slug)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(slug)}
      className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition active:scale-[0.97]"
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`,
              borderColor: 'transparent',
              color: '#fff',
            }
          : {
              background: '#242424',
              borderColor: 'rgba(255,255,255,0.12)',
              color: '#e5e5e5',
            }
      }
    >
      <span aria-hidden>{config.emoji}</span>
      <span>{config.name}</span>
      {selected && <Check className="h-4 w-4" />}
    </button>
  )
}

function AxeChip({
  chip,
  selected,
  onToggle,
}: {
  chip: { label: string; axe: number; color: string; emoji: string }
  selected: boolean
  onToggle: (axe: number) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(chip.axe)}
      className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition active:scale-[0.97]"
      style={
        selected
          ? {
              background: chip.color,
              borderColor: 'transparent',
              color: '#fff',
            }
          : {
              background: '#242424',
              borderColor: 'rgba(255,255,255,0.12)',
              color: '#e5e5e5',
            }
      }
    >
      <span aria-hidden>{chip.emoji}</span>
      <span>{chip.label}</span>
      {selected && <Check className="h-4 w-4" />}
    </button>
  )
}
