'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Loader2, LogOut, Sparkles, Trophy } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { Formation } from '@/lib/supabase/types'
import { getAnonymousName, getAnonymousEmoji } from '@/lib/utils/anonymousNames'
import Link from 'next/link'
import DailyQuizButton from '@/components/home/DailyQuizButton'
import DailyQuizModal from '@/components/home/DailyQuizModal'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'
import { JournalWeekCard } from '@/components/home/JournalWeekCard'
import { HomeHeroCard } from '@/components/home/HomeHeroCard'
import NewsCardItem from '@/components/news/NewsCardItem'
import NewsModal from '@/components/news/NewsModal'
import ForYouCard from '@/components/home/ForYouCard'
import { mediaCardSizeStyle } from '@/components/home/MediaCard'
import type { JournalEpisode, NewsCard } from '@/types/news'
import type { ForYouItem } from '@/types/forYou'
import type { EvenementItemData } from '@/types/evenements'
import LeaderboardModal from '@/components/leaderboard/LeaderboardModal'
import { useLeaderboard } from '@/lib/hooks/useLeaderboard'

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${date} à ${time}`
}

export default function HomePage() {
  const [showDailyQuiz, setShowDailyQuiz] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const { user, profile, streak, loading: userLoading, refetch: refetchUser } = useUser()
  const { userRank: lifetimeRank } = useLeaderboard(user?.id, 'lifetime')

  const [newsItems, setNewsItems] = useState<NewsCard[]>([])
  const [modalNewsId, setModalNewsId] = useState<string | null>(null)
  const [journal, setJournal] = useState<JournalEpisode | null>(null)
  const router = useRouter()

  // Formations "Fraîchement arrivé" — 5 dernières tous axes
  const [recentFormations, setRecentFormations] = useState<Formation[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  // Feed « Pour vous » — personnalisé sur les intérêts déclarés (cf. /api/for-you)
  const [forYouItems, setForYouItems] = useState<ForYouItem[]>([])
  const [forYouLoading, setForYouLoading] = useState(true)
  // True si le feed perso a échoué/timeout → « Fraîchement arrivé » bascule en
  // fallback gracieux (base sans dédup) plutôt que de rester vide/bloqué.
  const [forYouError, setForYouError] = useState(false)

  // Événements — 3 prochains (live_events + live_sessions)
  const [evenements, setEvenements] = useState<EvenementItemData[]>([])
  const [formationProgress, setFormationProgress] = useState<
    Record<string, { isStarted: boolean; isCompleted: boolean }>
  >({})

  // Refs carousels
  const forYouScrollRef = useRef<HTMLDivElement>(null)
  const recentScrollRef = useRef<HTMLDivElement>(null)

  const scroll = (ref: React.RefObject<HTMLDivElement>, dir: 'left' | 'right') => {
    ref.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  useEffect(() => {
    async function fetchRecent() {
      const supabase = createClient()
      const { data } = await supabase
        .from('formations')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) setRecentFormations(data)
      setRecentLoading(false)
    }
    fetchRecent()
  }, [])

  useEffect(() => {
    fetch('/api/news/syntheses?limit=5')
      .then(r => r.json())
      .then(d => setNewsItems(d.data ?? []))
      .catch(() => {})
  }, [])

  // Feed « Pour vous » — la route renvoie { items: [] } si l'utilisateur n'a
  // pas d'intérêts (onboarding skippé) → la section ne sera pas rendue.
  useEffect(() => {
    fetch('/api/for-you')
      .then(r => r.json())
      .then(d => setForYouItems(d.items ?? []))
      .catch(() => { setForYouItems([]); setForYouError(true) })
      .finally(() => setForYouLoading(false))
  }, [])

  // T11 : journal hebdo publié — l'API renvoie 200 + null si aucun journal
  // disponible (cf. /api/news/journal/current)
  useEffect(() => {
    fetch('/api/news/journal/current')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: JournalEpisode | null) => setJournal(data))
      .catch(() => setJournal(null))
  }, [])

  useEffect(() => {
    if (!user?.id || recentFormations.length === 0) return
    async function fetchProgress() {
      const supabase = createClient()
      const { data } = await supabase
        .from('user_formations')
        .select('formation_id, current_sequence, completed_at')
        .eq('user_id', user!.id)
      if (data) {
        const map: Record<string, { isStarted: boolean; isCompleted: boolean }> = {}
        data.forEach((uf) => {
          map[uf.formation_id] = {
            isStarted: true,
            isCompleted: !!uf.completed_at,
          }
        })
        setFormationProgress(map)
      }
    }
    fetchProgress()
  }, [user?.id, recentFormations])

  useEffect(() => {
    async function fetchEvenements() {
      const supabase = createClient()
      const now = new Date().toISOString()
      const [{ data: events }, { data: sessions }] = await Promise.all([
        supabase
          .from('live_events')
          .select('id, title, starts_at, formateur_user_id')
          .eq('is_published', true)
          .is('deleted_at', null)
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(3),
        supabase
          .from('live_sessions')
          .select('id, title, starts_at, formateur_user_id')
          .eq('is_published', true)
          .is('deleted_at', null)
          .gte('starts_at', now)
          .neq('status', 'cancelled')
          .order('starts_at', { ascending: true })
          .limit(3),
      ])
      const allIds = Array.from(new Set(
        [...(events ?? []), ...(sessions ?? [])].map((e) => e.formateur_user_id).filter(Boolean)
      ))
      const profileMap: Record<string, string | null> = {}
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('formateur_profiles')
          .select('user_id, display_name')
          .in('user_id', allIds)
        for (const p of profiles ?? []) {
          profileMap[p.user_id] = p.display_name ?? null
        }
      }
      const merged: EvenementItemData[] = [
        ...(events ?? []).map((e) => ({
          id: e.id,
          type: 'presentiel' as const,
          title: e.title,
          starts_at: e.starts_at,
          formateur_display_name: profileMap[e.formateur_user_id] ?? null,
        })),
        ...(sessions ?? []).map((s) => ({
          id: s.id,
          type: 'virtuel' as const,
          title: s.title,
          starts_at: s.starts_at,
          formateur_display_name: profileMap[s.formateur_user_id] ?? null,
        })),
      ]
      merged.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      setEvenements(merged.slice(0, 3))
    }
    void fetchEvenements()
  }, [])

  const handleDailyQuizComplete = async (score: number, totalPoints: number) => {
    setShowDailyQuiz(false)
    setRefreshTrigger(prev => prev + 1)
    refetchUser()
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // « Fraîchement arrivé » — plancher de cartes affichées avant de tolérer le
  // doublon avec « Pour vous ». Ajustable. À 3 : si la dédup descend sous 3
  // cartes, on recomplète avec les formations exclues (cas catalogue maigre).
  const FRESHLY_ARRIVED_FLOOR = 3

  // Dédup : « Pour vous » est prioritaire → on retire de « Fraîchement arrivé »
  // les formations déjà présentes dans le feed perso (id `formation-<uuid>`).
  // Le rendu DOIT dériver de ce calcul (et pas d'un state écrasé en deux temps)
  // pour ne jamais flasher l'état pré-dédup pendant que « Pour vous » se résout.
  const freshlyArrivedFormations = useMemo(() => {
    // base = requête « Fraîchement arrivé » telle quelle (is_published, DESC, 5).
    const base = recentFormations
    // Fallback gracieux : « Pour vous » a échoué/timeout → on affiche la base
    // sans dédup plutôt que de rester vide.
    if (forYouError) return base.slice(0, 5)

    const excluded = new Set(
      forYouItems
        .filter((i) => i.type === 'formation')
        .map((i) => i.id.replace(/^formation-/, ''))
    )
    const deduped = base.filter((f) => !excluded.has(f.id))

    if (deduped.length >= FRESHLY_ARRIVED_FLOOR) {
      return deduped.slice(0, 5)
    }

    // Sous le plancher : recompléter avec les exclues (ordre created_at DESC,
    // déjà l'ordre de `base`) jusqu'à min(plancher, base.length) cartes.
    const target = Math.min(FRESHLY_ARRIVED_FLOOR, base.length)
    const result = [...deduped]
    for (const f of base) {
      if (result.length >= target) break
      if (!result.some((r) => r.id === f.id)) result.push(f)
    }
    return result.slice(0, 5)
  }, [recentFormations, forYouItems, forYouError])

  // La liste d'exclusion (« Pour vous ») est résolue dès que son fetch a
  // abouti (succès, vide, ou erreur → forYouLoading=false). Tant qu'elle ne
  // l'est pas, on n'affiche aucune carte (skeleton/loader).
  const freshlyArrivedResolving = recentLoading || forYouLoading

  return (
    <>
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-accent px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/profil" className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/30 flex-shrink-0 hover:ring-white/60 transition-all">
            {profile?.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <span className="text-white font-bold text-base">
                  {profile?.first_name?.[0] || 'U'}
                </span>
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black uppercase truncate" style={{ fontSize: '18px', lineHeight: '1.3' }}>
              Bonjour, {profile?.first_name || 'Utilisateur'}
              <span className="hidden md:inline ml-2 font-bold" style={{ fontSize: '13px', opacity: 0.6 }}>
                {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
              </span>
            </p>
            <p className="md:hidden text-white/60 font-bold uppercase" style={{ fontSize: '11px' }}>
              {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 flex-shrink-0">
            <span className="text-white text-xs font-bold">🔥 {streak?.current_streak ?? 0}</span>
            <span className="text-white/40 text-xs">·</span>
            <span className="text-white text-xs font-bold">{lifetimeRank?.points ?? 0} pts</span>
          </div>
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 hover:bg-white/25 transition-colors"
            >
              <LogOut size={20} className="text-white" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-8 min-h-screen" style={{ background: '#0F0F0F' }}>

        {/* 1ʳᵉ ligne unifiée : Quiz du jour / Journal / Événements (HomeHeroCard).
            Mobile/tablette (< lg) : pattern hero → Quiz pleine largeur (col-span-2)
            puis Journal + Événements en 2 colonnes. Desktop (≥ lg) : 3 colonnes
            égales, identiques au rendu précédent (flex-1 → grid-cols-3). */}
        <section>
          <div className="grid grid-cols-2 gap-3 [grid-auto-rows:1fr]">
            <DailyQuizButton
              userId={user?.id}
              onStart={() => setShowDailyQuiz(true)}
              refreshTrigger={refreshTrigger}
              variant="square"
            />
            <HomeHeroCard
              surface="gradient"
              gradient="linear-gradient(160deg, #0F766E, #0D9488)"
              icon={<Trophy size={26} />}
              eyebrow="Classement"
              title="Voir ta place"
              cta={{
                label: "Ouvrir",
                icon: <Trophy size={15} />,
                onClick: () => setShowLeaderboard(true),
              }}
            />
            <JournalWeekCard journal={journal} />
            <HomeHeroCard
              surface="neutral"
              icon={<Calendar size={26} />}
              eyebrow="Événements"
              title={evenements.length > 0 ? evenements[0].title : "Rien à l'horizon"}
              cta={{
                label: "Voir le calendrier",
                icon: <CalendarDays size={15} />,
                onClick: () => router.push('/evenements'),
              }}
            />
          </div>
        </section>

        {/* Pour vous — rendue seulement si le feed renvoie ≥1 item (un user
            ayant skippé l'onboarding reçoit { items: [] } → pas de section). */}
        {!forYouLoading && forYouItems.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-[#e5e5e5] mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-violet-400" /> Pour vous
            </h2>
            <div className="relative">
              <button
                onClick={() => scroll(forYouScrollRef, 'left')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
                aria-label="Précédent"
              >
                <ChevronLeft size={20} />
              </button>
              <div
                ref={forYouScrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
              >
                {forYouItems.map((item) => (
                  <ForYouCard key={item.id} item={item} />
                ))}
              </div>
              <button
                onClick={() => scroll(forYouScrollRef, 'right')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
                aria-label="Suivant"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* News */}
        <section>
          <div className="flex items-center mb-4">
            <h2 className="text-base font-bold text-[#e5e5e5] flex items-center gap-2">
              📰 Actualités
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide -mx-4 px-4 pb-2">
            {newsItems.map((item) => (
              <NewsCardItem
                key={item.id}
                news={item}
                variant="carousel"
                onClick={(n) => setModalNewsId(n.id)}
              />
            ))}
            <div
              className="flex-shrink-0 rounded-2xl bg-gradient-to-br
                         from-violet-600 to-violet-900 flex flex-col items-center
                         justify-center cursor-pointer hover:scale-[1.02] transition"
              style={mediaCardSizeStyle('landscape')}
              onClick={() => router.push('/news')}
            >
              <span className="text-white text-sm font-medium text-center px-4">
                Voir toutes les actus →
              </span>
            </div>
          </div>
        </section>

        {/* Fraîchement arrivé — masquée si, exclusion résolue, il ne reste
            aucune carte (catalogue réellement vide). Tant que « Pour vous »
            n'est pas résolu : skeleton/loader, jamais l'état pré-dédup. */}
        {(freshlyArrivedResolving || freshlyArrivedFormations.length > 0) && (
        <section>
          <h2 className="text-base font-bold text-[#e5e5e5] mb-3">⚡ Fraîchement arrivé</h2>
          {freshlyArrivedResolving ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => scroll(recentScrollRef, 'left')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
              >
                <ChevronLeft size={20} />
              </button>
              <div
                ref={recentScrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
              >
                {freshlyArrivedFormations.map((f) => {
                  const config = getCategoryConfig(f.category)
                  const from = config.type === 'axe3'
                    ? '/patient'
                    : config.type === 'axe4'
                    ? '/sante'
                    : '/formation'
                  return (
                    <FormationCardOverlay
                      key={f.id}
                      formation={f}
                      progress={formationProgress[f.id]}
                      onClick={() => {
                        window.location.href = `/formation/${f.category}?formation=${f.slug}&from=${from}`
                      }}
                    />
                  )
                })}
              </div>
              <button
                onClick={() => scroll(recentScrollRef, 'right')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </section>
        )}


      </main>

      {showDailyQuiz && user && (
        <DailyQuizModal
          userId={user.id}
          onClose={() => setShowDailyQuiz(false)}
          onComplete={handleDailyQuizComplete}
        />
      )}

      <NewsModal newsId={modalNewsId} onClose={() => setModalNewsId(null)} />

      <LeaderboardModal
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        userId={user?.id}
      />
    </>
  )
}
