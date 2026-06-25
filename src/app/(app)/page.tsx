'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Calendar, CalendarDays, ChevronLeft, ChevronRight, LogOut, Sparkles } from 'lucide-react'
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

function formationToForYouItem(f: Formation): ForYouItem {
  const config = getCategoryConfig(f.category)
  const from =
    config.type === 'axe3' ? '/patient' : config.type === 'axe4' ? '/sante' : '/formation'
  return {
    id: `formation-${f.id}`,
    type: 'formation',
    title: f.title,
    href: `/formation/${f.category}?formation=${f.slug}&from=${from}`,
    axe: (f.axe_cp as 1 | 2 | 3 | 4 | null) ?? null,
    category: f.category,
    cover: f.cover_image_url,
  }
}

export default function HomePage() {
  const [showDailyQuiz, setShowDailyQuiz] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const { user, profile, streak, refetch: refetchUser } = useUser()
  const { userRank: lifetimeRank } = useLeaderboard(user?.id, 'lifetime')

  const [newsItems, setNewsItems] = useState<NewsCard[]>([])
  const [modalNewsId, setModalNewsId] = useState<string | null>(null)
  const [journal, setJournal] = useState<JournalEpisode | null>(null)
  const router = useRouter()

  // Formations recentes — source pour completer "Pour toi"
  const [recentFormations, setRecentFormations] = useState<Formation[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  // Formations commencees non terminees (section "Reprendre")
  const [inProgressFormations, setInProgressFormations] = useState<Formation[]>([])
  const [inProgressProgress, setInProgressProgress] = useState<
    Record<string, { isStarted: boolean; isCompleted: boolean }>
  >({})
  const [inProgressLoading, setInProgressLoading] = useState(true)

  // Feed "Pour vous"
  const [forYouItems, setForYouItems] = useState<ForYouItem[]>([])
  const [forYouLoading, setForYouLoading] = useState(true)

  // Evenements
  const [evenements, setEvenements] = useState<EvenementItemData[]>([])

  // Refs carousels
  const forYouScrollRef = useRef<HTMLDivElement>(null)
  const ressourcesScrollRef = useRef<HTMLDivElement>(null)
  const reprendreScrollRef = useRef<HTMLDivElement>(null)

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
        .limit(8)
      if (data) setRecentFormations(data)
      setRecentLoading(false)
    }
    fetchRecent()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setInProgressLoading(false)
      return
    }
    async function fetchInProgress() {
      const supabase = createClient()
      const { data: ufRows } = await supabase
        .from('user_formations')
        .select('formation_id')
        .eq('user_id', user!.id)
        .is('completed_at', null)
      if (!ufRows || ufRows.length === 0) {
        setInProgressLoading(false)
        return
      }
      const ids = ufRows.map((r) => r.formation_id)
      const { data: formations } = await supabase
        .from('formations')
        .select('*')
        .in('id', ids)
        .eq('is_published', true)
      if (formations) {
        setInProgressFormations(formations)
        const map: Record<string, { isStarted: boolean; isCompleted: boolean }> = {}
        formations.forEach((f) => {
          map[f.id] = { isStarted: true, isCompleted: false }
        })
        setInProgressProgress(map)
      }
      setInProgressLoading(false)
    }
    fetchInProgress()
  }, [user?.id])

  useEffect(() => {
    fetch('/api/news/syntheses?limit=5')
      .then((r) => r.json())
      .then((d) => setNewsItems(d.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/for-you')
      .then((r) => r.json())
      .then((d) => setForYouItems(d.items ?? []))
      .catch(() => setForYouItems([]))
      .finally(() => setForYouLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/news/journal/current')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: JournalEpisode | null) => setJournal(data))
      .catch(() => setJournal(null))
  }, [])

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
      const allIds = Array.from(
        new Set(
          [...(events ?? []), ...(sessions ?? [])]
            .map((e) => e.formateur_user_id)
            .filter(Boolean),
        ),
      )
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

  const handleDailyQuizComplete = async (_score: number, _totalPoints: number) => {
    setShowDailyQuiz(false)
    setRefreshTrigger((prev) => prev + 1)
    refetchUser()
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // "Pour toi" : formations + EPP du feed, completes avec recentFormations jusqu'a ~8 cartes
  const pourToiItems = useMemo(() => {
    const feedItems = forYouItems.filter((i) => i.type === 'formation' || i.type === 'epp')
    const feedFormationIds = new Set(
      feedItems
        .filter((i) => i.type === 'formation')
        .map((i) => i.id.replace(/^formation-/, '')),
    )
    const extras = recentFormations
      .filter((f) => !feedFormationIds.has(f.id))
      .map(formationToForYouItem)
    return [...feedItems, ...extras].slice(0, 8)
  }, [forYouItems, recentFormations])

  // "Ressources pour toi" : fiches + autoevals du feed
  const ressourcesItems = useMemo(
    () => forYouItems.filter((i) => i.type === 'fiche' || i.type === 'autoeval'),
    [forYouItems],
  )

  return (
    <>
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-accent px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/profil"
            className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/30 flex-shrink-0 hover:ring-white/60 transition-all"
          >
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
            <p
              className="text-white font-black uppercase truncate"
              style={{ fontSize: '18px', lineHeight: '1.3' }}
            >
              Bonjour, {profile?.first_name || 'Utilisateur'}
              <span
                className="hidden md:inline ml-2 font-bold"
                style={{ fontSize: '13px', opacity: 0.6 }}
              >
                {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
              </span>
            </p>
            <p className="md:hidden text-white/60 font-bold uppercase" style={{ fontSize: '11px' }}>
              {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLeaderboard(true)}
            aria-label="Voir le classement"
            className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 flex-shrink-0 hover:bg-white/25 transition-colors"
          >
            <span className="text-white text-xs font-bold">🔥 {streak?.current_streak ?? 0}</span>
            <span className="text-white/40 text-xs">·</span>
            <span className="text-white text-xs font-bold">{lifetimeRank?.points ?? 0} pts</span>
          </button>
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Se deconnecter"
              title="Se deconnecter"
              className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 hover:bg-white/25 transition-colors"
            >
              <LogOut size={20} className="text-white" />
            </button>
          )}
        </div>
      </header>

      <main
        className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-8 min-h-screen"
        style={{ background: '#0F0F0F' }}
      >
        {/* Quiz du jour — carte seule pleine largeur */}
        <section>
          <DailyQuizButton
            userId={user?.id}
            onStart={() => setShowDailyQuiz(true)}
            refreshTrigger={refreshTrigger}
            variant="square"
          />
        </section>

        {/* Journal hebdo */}
        <section>
          <JournalWeekCard journal={journal} />
        </section>

        {/* Reprendre — formations commencees non terminees */}
        {!inProgressLoading && inProgressFormations.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-[#e5e5e5] mb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-violet-400" /> Reprendre
            </h2>
            <div className="relative">
              <button
                onClick={() => scroll(reprendreScrollRef, 'left')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
                aria-label="Precedent"
              >
                <ChevronLeft size={20} />
              </button>
              <div
                ref={reprendreScrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
              >
                {inProgressFormations.map((f) => {
                  const config = getCategoryConfig(f.category)
                  const from =
                    config.type === 'axe3'
                      ? '/patient'
                      : config.type === 'axe4'
                      ? '/sante'
                      : '/formation'
                  return (
                    <FormationCardOverlay
                      key={f.id}
                      formation={f}
                      progress={inProgressProgress[f.id]}
                      aspect="landscape"
                      hideBadge
                      bgOpacity={0.8}
                      onClick={() => {
                        window.location.href = `/formation/${f.category}?formation=${f.slug}&from=${from}`
                      }}
                    />
                  )
                })}
              </div>
              <button
                onClick={() => scroll(reprendreScrollRef, 'right')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
                aria-label="Suivant"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* Pour toi — formations + EPP */}
        {!forYouLoading && !recentLoading && pourToiItems.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-[#e5e5e5] mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-violet-400" /> Pour toi
            </h2>
            <div className="relative">
              <button
                onClick={() => scroll(forYouScrollRef, 'left')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
                aria-label="Precedent"
              >
                <ChevronLeft size={20} />
              </button>
              <div
                ref={forYouScrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
              >
                {pourToiItems.map((item) => (
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

        {/* Ressources pour toi — fiches + autoevals */}
        {!forYouLoading && ressourcesItems.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-[#e5e5e5] mb-3 flex items-center gap-2">
              📚 Ressources pour toi
            </h2>
            <div className="relative">
              <button
                onClick={() => scroll(ressourcesScrollRef, 'left')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
                aria-label="Precedent"
              >
                <ChevronLeft size={20} />
              </button>
              <div
                ref={ressourcesScrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
              >
                {ressourcesItems.map((item) => (
                  <ForYouCard key={item.id} item={item} />
                ))}
              </div>
              <button
                onClick={() => scroll(ressourcesScrollRef, 'right')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
                aria-label="Suivant"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* Evenements — masque si vide */}
        {evenements.length > 0 && (
          <section>
            <HomeHeroCard
              surface="neutral"
              icon={<Calendar size={26} />}
              eyebrow="Evenements"
              title={evenements[0].title}
              compact
              cta={{
                label: 'Voir le calendrier',
                icon: <CalendarDays size={15} />,
                onClick: () => router.push('/evenements'),
              }}
            />
          </section>
        )}

        {/* Actualites — inchange */}
        <section>
          <div className="flex items-center mb-4">
            <h2 className="text-base font-bold text-[#e5e5e5] flex items-center gap-2">
              📰 Actualites
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
