'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Loader2, LogOut, Sparkles, UserCircle } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, getCategoryConfig } from '@/lib/supabase/types'
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
import type { JournalEpisode, NewsCard } from '@/types/news'
import type { ForYouItem } from '@/types/forYou'
import type { EvenementItemData } from '@/types/evenements'

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${date} à ${time}`
}

export default function HomePage() {
  const [showDailyQuiz, setShowDailyQuiz] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const { user, profile, streak, loading: userLoading, refetch: refetchUser } = useUser()

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

  // Événements — 3 prochains (live_events + live_sessions)
  const [evenements, setEvenements] = useState<EvenementItemData[]>([])
  const [formationProgress, setFormationProgress] = useState<
    Record<string, { isStarted: boolean; isCompleted: boolean }>
  >({})

  // Refs carousels
  const forYouScrollRef = useRef<HTMLDivElement>(null)
  const recentScrollRef = useRef<HTMLDivElement>(null)
  const axe12ScrollRef = useRef<HTMLDivElement>(null)
  const axe3ScrollRef = useRef<HTMLDivElement>(null)
  const axe4ScrollRef = useRef<HTMLDivElement>(null)

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
      .catch(() => setForYouItems([]))
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

  // Dédup : « Pour vous » est prioritaire → on retire de « Fraîchement arrivé »
  // les formations déjà présentes dans le feed perso (id `formation-<uuid>`).
  const forYouFormationIds = new Set(
    forYouItems
      .filter((i) => i.type === 'formation')
      .map((i) => i.id.replace(/^formation-/, ''))
  )
  const dedupedRecentFormations = recentFormations.filter(
    (f) => !forYouFormationIds.has(f.id)
  )

  // Catégories par axe
  const axe12Categories = CATEGORIES.filter(c => c.type === 'cp')
  const axe3Categories = CATEGORIES.filter(c => c.type === 'axe3')
  const axe4Categories = CATEGORIES.filter(c => c.type === 'axe4')

  // Composant carousel catégories réutilisable
  const CategoryCarousel = ({
    categories,
    scrollRef,
  }: {
    categories: typeof CATEGORIES
    scrollRef: React.RefObject<HTMLDivElement>
  }) => (
    <div className="-mx-4">
      {/* Zone cards */}
      <div className="py-2 relative" style={{ paddingLeft: '16px', paddingRight: '0' }}>
        <button
          onClick={() => scroll(scrollRef, 'left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
        >
          <ChevronLeft size={18} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory pr-4"
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                const from = cat.type === 'axe3'
                  ? '/patient'
                  : cat.type === 'axe4'
                  ? '/sante'
                  : '/formation'
                window.location.href = `/formation/${cat.id}?from=${from}`
              }}
              className="flex-shrink-0 snap-start rounded-2xl overflow-hidden"
              style={{
                width: 'calc(50vw - 24px)',
                maxWidth: '220px',
                minWidth: '148px',
                aspectRatio: '3/2',
                position: 'relative',
                border: 'none',
                flexShrink: 0,
              }}
            >
              {/* Image de fond pleine */}
              {cat.labelImageUrl ? (
                <img
                  src={cat.labelImageUrl}
                  alt={cat.name}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : (
                <div
                  className="w-full h-full absolute inset-0"
                  style={{ background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})` }}
                />
              )}
              {/* Overlay gradient pour lisibilité texte */}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
              />
              {/* Label texte */}
              <span
                className="absolute font-bold text-white leading-tight"
                style={{
                  bottom: '10px',
                  left: '10px',
                  fontSize: '15px',
                  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  maxWidth: 'calc(100% - 20px)',
                }}
              >
                {cat.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => scroll(scrollRef, 'right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-accent px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/30 flex-shrink-0">
            {profile?.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <span className="text-white font-bold text-base">
                  {profile?.first_name?.[0] || 'U'}
                </span>
              </div>
            )}
          </div>
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
          <Link href="/profil" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 hover:bg-white/25 transition-colors">
            <UserCircle size={24} className="text-white" />
          </Link>
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

        {/* 1ʳᵉ ligne unifiée : Quiz du jour / Journal / Événements (HomeHeroCard) */}
        <section>
          <div className="flex items-stretch gap-3">
            <DailyQuizButton
              userId={user?.id}
              onStart={() => setShowDailyQuiz(true)}
              refreshTrigger={refreshTrigger}
              variant="square"
            />
            <JournalWeekCard journal={journal} />
            <HomeHeroCard
              surface="neutral"
              icon={<Calendar size={26} />}
              eyebrow="Événements"
              title={evenements.length > 0 ? evenements[0].title : 'Rien à l’horizon'}
              subtitle={
                evenements.length > 0
                  ? formatEventDate(evenements[0].starts_at)
                  : 'Aucun événement programmé'
              }
              cta={{
                label: 'Voir le calendrier',
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
              className="flex-shrink-0 w-[200px] rounded-xl bg-gradient-to-br
                         from-violet-600 to-violet-900 flex flex-col items-center
                         justify-center cursor-pointer hover:scale-[1.02] transition"
              onClick={() => router.push('/news')}
            >
              <span className="text-white text-sm font-medium text-center px-4">
                Voir toutes les actus →
              </span>
            </div>
          </div>
        </section>

        {/* Fraîchement arrivé */}
        <section>
          <h2 className="text-base font-bold text-[#e5e5e5] mb-3">⚡ Fraîchement arrivé</h2>
          {recentLoading ? (
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
                {dedupedRecentFormations.map((f) => {
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

        {/* Explorer */}
        <section>
          <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
            🔍 Explorer
          </h2>
          <Link
            href="/formation"
            className="group mb-3 flex w-fit items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <h3 className="text-base font-bold text-white">Pratiques cliniques</h3>
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="text-white/60 transition-all group-hover:translate-x-0.5 group-hover:text-white"
            />
          </Link>
          <CategoryCarousel
            categories={axe12Categories}
            scrollRef={axe12ScrollRef}
          />
          <Link
            href="/patient"
            className="group mt-6 mb-3 flex w-fit items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <h3 className="text-base font-bold text-white">Relation Patient</h3>
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="text-white/60 transition-all group-hover:translate-x-0.5 group-hover:text-white"
            />
          </Link>
          <CategoryCarousel
            categories={axe3Categories}
            scrollRef={axe3ScrollRef}
          />
          <Link
            href="/sante"
            className="group mt-6 mb-3 flex w-fit items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <h3 className="text-base font-bold text-white">Santé Praticien</h3>
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="text-white/60 transition-all group-hover:translate-x-0.5 group-hover:text-white"
            />
          </Link>
          <CategoryCarousel
            categories={axe4Categories}
            scrollRef={axe4ScrollRef}
          />
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
    </>
  )
}
