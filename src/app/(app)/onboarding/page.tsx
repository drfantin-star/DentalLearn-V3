'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import InterestChips from '@/components/interests/InterestChips'
import type { UserInterests } from '@/lib/supabase/types'
import { useSaveInterests } from '@/lib/hooks/useSaveInterests'
import { useUser } from '@/lib/hooks/useUser'

export default function OnboardingPage() {
  const router = useRouter()
  const { saveInterests, saving } = useSaveInterests()
  // Même source d'`interests` qu'AppShell (store partagé) → pas de divergence.
  const { user, profile, loading, refetch, mutateInterests } = useUser()
  const guardDoneRef = useRef(false)

  // Sélection en cours (state React uniquement — jamais de persistance locale).
  const [selection, setSelection] = useState<UserInterests>({
    categories: [],
    axes: [],
  })

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

  const persistAndGo = useCallback(
    async (interests: UserInterests) => {
      const ok = await saveInterests(interests)
      if (!ok) return
      // Synchroniser l'état partagé AVANT de naviguer : AppShell doit voir
      // `interests` non-null tout de suite (sinon il redirige vers /onboarding
      // → loop). On supprime aussi le garde-fou local pour éviter une double nav.
      guardDoneRef.current = true
      mutateInterests(interests) // optimiste (synchrone)
      await refetch() // réconciliation DB
      router.replace('/')
    },
    [saveInterests, mutateInterests, refetch, router]
  )

  const handleContinue = useCallback(() => {
    persistAndGo(selection)
  }, [persistAndGo, selection])

  const handleSkip = useCallback(() => {
    persistAndGo({ categories: [], axes: [] })
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

      <InterestChips value={selection} onChange={setSelection} />

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
