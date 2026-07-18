'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ChevronLeft, ChevronRight, LogOut, Sparkles } from 'lucide-react'
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
import EvenementsCarousel from '@/components/home/EvenementsCarousel'
import NewsCardItem from '@/components/news/NewsCardItem'
import NewsModal from '@/components/news/NewsModal'
import ForYouCard from '@/components/home/ForYouCard'
import ExploreRow from '@/components/home/ExploreRow'
import { useDemarches } from '@/lib/hooks/useDemarches'
import { mediaCardSizeStyle } from '@/components/home/MediaCard'
import type { JournalEpisode, NewsCard } from '@/types/news'
import type { ForYouItem } from '@/types/forYou'
import type { EvenementItemData } from '@/types/evenements'
import LeaderboardModal from '@/components/leaderboard/LeaderboardModal'
import { useLeaderboard } from '@/lib/hooks/useLeaderboard'
import ThemeQuizModal from '@/components/quiz/ThemeQuizModal'
import { INTEREST_TO_NEWS_THEME, NEWS_SPECIALITE_LABELS } from '@/lib/constants/news'
import { NEWS_CUTOUTS_BASE, getSpecialiteColor } from '@/lib/news-cover'
import CutoutCardRender from '@/components/home/CutoutCardRender'
import SophieAutopilotCard from '@/components/sophie/SophieAutopilotCard'
import PageContainer from '@/components/layout/PageContainer'
import NotificationBell from '@/components/notifications/NotificationBell'
import { useSignOut } from '@/lib/hooks/useSignOut'

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
    cutout: f.cover_cutout_url,
  }
}

export default function HomePage() {
  const [showDailyQuiz, setShowDailyQuiz] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [quizTheme, setQuizTheme] = useState<{ specialite: string; label: string } | null>(null)

  const { user, profile, streak, refetch: refetchUser } = useUser()
  const { userRank: lifetimeRank } = useLeaderboard(user?.id, 'lifetime')
  // Demarches en cours — utilisees pour completer "Reprendre" avec les EPP
  // en cours (les formations viennent de user_formations plus bas).
  const { demarches: allDemarches } = useDemarches(user?.id)

  const [recentNews, setRecentNews] = useState<NewsCard[]>([])
  const [themeRows, setThemeRows] = useState<{ key: string; label: string; items: NewsCard[] }[]>([])
  const [modalNewsId, setModalNewsId] = useState<string | null>(null)
  const [journal, setJournal] = useState<JournalEpisode | null>(null)
  const router = useRouter()

  // Formations recentes — source pour completer "Pour toi"
  const [recentFormations, setRecentFormations] = useState<Formation[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  // Formations commencees non terminees (section "Reprendre")
  const [inProgressFormations, setInProgressFormations] = useState<Formation[]>([])
  const [inProgressProgress, setInProgressProgress] = useState<
    Record<string, { progressPercent: number }>
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
  // Refs des carrousels news (une entree par rangee, clef = titre).
  const newsScrollRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const scroll = (ref: React.RefObject<HTMLDivElement>, dir: 'left' | 'right') => {
    ref.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }
  const scrollEl = (el: HTMLDivElement | null, dir: 'left' | 'right') => {
    el?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
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
      const [{ data: formations }, { data: completedSeqs }] = await Promise.all([
        supabase
          .from('formations')
          .select('*')
          .in('id', ids)
          .eq('is_published', true),
        supabase
          .from('user_sequences')
          .select('sequences!inner(formation_id)')
          .eq('user_id', user!.id)
          .not('completed_at', 'is', null),
      ])
      if (formations) {
        setInProgressFormations(formations)
        const completedByFormation: Record<string, number> = {}
        for (const row of completedSeqs ?? []) {
          const fid = (row.sequences as { formation_id: string }).formation_id
          if (ids.includes(fid)) {
            completedByFormation[fid] = (completedByFormation[fid] ?? 0) + 1
          }
        }
        const map: Record<string, { progressPercent: number }> = {}
        formations.forEach((f) => {
          const completed = completedByFormation[f.id] ?? 0
          const total = f.total_sequences || 1
          map[f.id] = { progressPercent: Math.round((completed / total) * 100) }
        })
        setInProgressProgress(map)
      }
      setInProgressLoading(false)
    }
    fetchInProgress()
  }, [user?.id])

  useEffect(() => {
    fetch('/api/news/by-theme')
      .then((r) => r.json())
      .then((d) => {
        setRecentNews(d.recent ?? [])
        setThemeRows(d.rows ?? [])
      })
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
      // Réutilise /api/evenements (même logique que la page /evenements :
      // dégradé thématique + nom/photo formateur avec bypass RLS pour le
      // nom même si le profil public n'est pas publié) plutôt que de
      // dupliquer les requêtes ici.
      try {
        const res = await fetch('/api/evenements?limit=10')
        if (!res.ok) return
        const data: EvenementItemData[] = await res.json()
        setEvenements(data)
      } catch {
        // silencieux — la section est simplement masquée si vide
      }
    }
    void fetchEvenements()
  }, [])

  const handleDailyQuizComplete = async (_score: number, _totalPoints: number) => {
    setShowDailyQuiz(false)
    setRefreshTrigger((prev) => prev + 1)
    refetchUser()
  }

  const handleSignOut = useSignOut()

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

  // EPP en cours — affiches dans "Reprendre" a cote des formations.
  const inProgressEpp = useMemo(
    () => allDemarches.filter((d) => d.type === 'epp'),
    [allDemarches],
  )

  const quizSpecialiteFor = (rowKey: string): { specialite: string; label: string } | null => {
    const map = INTEREST_TO_NEWS_THEME[rowKey]
    if (!map || map.field !== 'specialite') return null
    return { specialite: map.value, label: NEWS_SPECIALITE_LABELS[map.value] ?? map.value }
  }

  const renderNewsRow = (
    title: string,
    items: NewsCard[],
    showSeeAll: boolean,
    headerCard?: React.ReactNode,
    hideCover?: boolean,
    hideBadge?: boolean,
  ) => (
    <section key={title}>
      <h2 className="text-base font-bold text-[#e5e5e5] mb-3 flex items-center gap-2">
        📰 {title}
      </h2>
      <div className="relative">
        <button
          onClick={() => scrollEl(newsScrollRefs.current[title], 'left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
          aria-label="Precedent"
        >
          <ChevronLeft size={20} />
        </button>
        <div
          ref={(el) => {
            newsScrollRefs.current[title] = el
          }}
          className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide pb-2"
        >
          {headerCard}
          {items.map((item) => (
            <NewsCardItem
              key={item.id}
              news={item}
              variant="carousel"
              onClick={(n) => setModalNewsId(n.id)}
              hideCover={hideCover}
              hideBadge={hideBadge}
            />
          ))}
          {showSeeAll && (
            <div
              className="flex-shrink-0 rounded-2xl bg-gradient-to-br from-primary to-primary
                         flex flex-col items-center justify-center cursor-pointer
                         hover:scale-[1.02] transition-premium glow-accent"
              style={mediaCardSizeStyle('landscape')}
              onClick={() => router.push('/news')}
            >
              <span className="text-white text-sm font-medium text-center px-4">
                Voir toutes les actus →
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => scrollEl(newsScrollRefs.current[title], 'right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
          aria-label="Suivant"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
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
          {user && <NotificationBell />}
          {/* Déconnexion retirée du header en mobile (surcharge visuelle) —
              déplacée dans /profil > Sécurité. Reste visible en desktop (lg+). */}
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Se deconnecter"
              title="Se deconnecter"
              className="hidden lg:flex w-10 h-10 rounded-full bg-white/15 items-center justify-center flex-shrink-0 hover:bg-white/25 transition-colors"
            >
              <LogOut size={20} className="text-white" />
            </button>
          )}
        </div>
      </header>

      <main className="min-h-screen" style={{ background: '#0F0F0F' }}>
       <PageContainer className="py-6 space-y-8">
        {/* Sophie / Quiz / Journal — 3 cartes uniformisees.
            Desktop (lg:) : grille 3 colonnes, hauteurs egales (auto-rows-fr +
            h-full des HomeFeedCard). Mobile inchange (pile verticale). */}
        <section className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:auto-rows-fr lg:gap-4">
          <SophieAutopilotCard />
          <DailyQuizButton
            userId={user?.id}
            onStart={() => setShowDailyQuiz(true)}
            refreshTrigger={refreshTrigger}
            variant="square"
          />
          <JournalWeekCard journal={journal} />
        </section>

        {/* Reprendre — formations commencees non terminees + EPP en cours */}
        {!inProgressLoading &&
          (inProgressFormations.length > 0 || inProgressEpp.length > 0) && (
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
                className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
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
                      progressPercent={inProgressProgress[f.id]?.progressPercent ?? 0}
                      aspect="landscape"
                      onClick={() => {
                        window.location.href = `/formation/${f.category}?formation=${f.slug}&from=${from}`
                      }}
                    />
                  )
                })}
                {/* EPP en cours — carte degrade teal (axe 2), titre centre,
                    meme langage visuel que les cartes sans image. */}
                {inProgressEpp.map((epp) => (
                  <button
                    key={epp.id}
                    type="button"
                    onClick={() => router.push(epp.ctaUrl)}
                    aria-label={epp.title}
                    className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform duration-150 relative"
                    style={{
                      ...mediaCardSizeStyle('landscape'),
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'radial-gradient(ellipse at 70% 40%, #0F7B6Ccc 0%, #0F7B6C44 55%, #0d0d1a 100%)',
                      }}
                    />
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.35) 100%)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '14px',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'white',
                          lineHeight: 1.3,
                          textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {epp.title}
                      </p>
                    </div>
                  </button>
                ))}
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
                className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
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
                className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
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

        {/* Explorer — acces rapide aux 3 espaces.
            Masquee sur desktop (lg) : redondante avec les liens de la SideNav.
            Conservee sur mobile ou il n'y a pas de sidebar. */}
        <section className="lg:hidden">
          <h2 className="text-base font-bold text-[#e5e5e5] mb-3 flex items-center gap-2">
            🧭 Explorer
          </h2>
          <ExploreRow />
        </section>

        {/* Evenements — masque si vide. Meme carrousel (MediaCard) que les
            autres rangees de la home ; carte "Agenda" cliquable en fin de
            carrousel a la place du lien "Voir tout". */}
        <EvenementsCarousel items={evenements} />

        {/* Actualites — eclatees par theme (Session 1bis) */}
        {recentNews.length > 0 && renderNewsRow('Les dernieres actus', recentNews, true, undefined, undefined, true)}
        {themeRows.map((row) => {
          const themeMap = INTEREST_TO_NEWS_THEME[row.key]
          const specialiteSlug = themeMap?.field === 'specialite' ? themeMap.value : null
          const cutoutUrl = specialiteSlug
            ? `${NEWS_CUTOUTS_BASE}/news-spec-${specialiteSlug}.webp`
            : null
          const headerColor = getSpecialiteColor(specialiteSlug)

          const headerCard = (
            <div
              key={`header-${row.key}`}
              className="flex-shrink-0 snap-start rounded-2xl overflow-hidden relative"
              style={{ ...mediaCardSizeStyle('landscape'), position: 'relative', background: '#0d0d1a' }}
            >
              {cutoutUrl ? (
                // Carte "label" : image centrée, sans zone de texte.
                <CutoutCardRender
                  cutoutSrc={cutoutUrl}
                  colorFrom={headerColor}
                  title=""
                  variant="compact"
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(135deg, ${headerColor}, ${headerColor}88)`,
                  }}
                />
              )}
            </div>
          )

          const quiz = quizSpecialiteFor(row.key)
          return (
            <React.Fragment key={row.key}>
              {renderNewsRow(`Parce que tu t'interesses a ${row.label}`, row.items, false, headerCard, true, true)}
              {quiz && (
                <button
                  type="button"
                  onClick={() => setQuizTheme(quiz)}
                  className="w-full glass-card glow-accent transition-premium rounded-2xl
                             px-4 py-3 flex items-center justify-between text-left
                             hover:scale-[1.01] mb-6"
                  aria-label={`Teste-toi en ${quiz.label}`}
                >
                  <span className="text-white text-sm font-semibold flex items-center gap-2">
                    🎯 Teste-toi en {quiz.label}
                  </span>
                  <span className="text-white/60 text-xs">10 questions ·</span>
                </button>
              )}
            </React.Fragment>
          )
        })}
       </PageContainer>
      </main>

      {showDailyQuiz && user && (
        <DailyQuizModal
          userId={user.id}
          onClose={() => setShowDailyQuiz(false)}
          onComplete={handleDailyQuizComplete}
        />
      )}

      <NewsModal newsId={modalNewsId} onClose={() => setModalNewsId(null)} />

      {quizTheme && (
        <ThemeQuizModal
          specialite={quizTheme.specialite}
          label={quizTheme.label}
          onClose={() => setQuizTheme(null)}
        />
      )}

      <LeaderboardModal
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        userId={user?.id}
      />
    </>
  )
}
