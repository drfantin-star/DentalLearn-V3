'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, UserCircle } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { useNews } from '@/lib/hooks/useNews'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, getCategoryConfig } from '@/lib/supabase/types'
import type { Formation } from '@/lib/supabase/types'
import { getAnonymousName, getAnonymousEmoji } from '@/lib/utils/anonymousNames'
import Link from 'next/link'
import DailyQuizButton from '@/components/home/DailyQuizButton'
import DailyQuizModal from '@/components/home/DailyQuizModal'
import NewsSection from '@/components/home/NewsSection'

export default function HomePage() {
  const [showDailyQuiz, setShowDailyQuiz] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const { user, profile, streak, loading: userLoading, refetch: refetchUser } = useUser()
  const { news, loading: newsLoading } = useNews(4)

  // Formations "Fraîchement arrivé" — 5 dernières tous axes
  const [recentFormations, setRecentFormations] = useState<Formation[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [formationProgress, setFormationProgress] = useState<
    Record<string, { isStarted: boolean; isCompleted: boolean }>
  >({})

  // Refs carousels
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

  const handleDailyQuizComplete = async (score: number, totalPoints: number) => {
    setShowDailyQuiz(false)
    setRefreshTrigger(prev => prev + 1)
    refetchUser()
  }

  // Catégories par axe
  const axe12Categories = CATEGORIES.filter(c => c.type === 'cp')
  const axe3Categories = CATEGORIES.filter(c => c.type === 'axe3')
  const axe4Categories = CATEGORIES.filter(c => c.type === 'axe4')

  // Composant carousel catégories réutilisable
  const CategoryCarousel = ({
    categories,
    scrollRef,
    bandeauGradient,
    bandeauTitle,
    bandeauSubtitle,
  }: {
    categories: typeof CATEGORIES
    scrollRef: React.RefObject<HTMLDivElement>
    bandeauGradient: string
    bandeauTitle: string
    bandeauSubtitle: string
  }) => (
    <div
      className="overflow-hidden -mx-4"
      style={{ background: bandeauGradient }}
    >
      {/* Bandeau header */}
      <div className="px-5 py-3">
        <h2 className="text-base font-bold text-white">{bandeauTitle}</h2>
        <p className="text-xs text-white/70 mt-0.5">{bandeauSubtitle}</p>
      </div>

      {/* Zone cards */}
      <div className="px-4 py-3 relative" style={{ background: 'transparent' }}>
        <button
          onClick={() => scroll(scrollRef, 'left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
        >
          <ChevronLeft size={18} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory"
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => window.location.href = `/formation/${cat.id}`}
              className="flex-shrink-0 snap-start rounded-2xl flex flex-col items-start gap-2.5 p-3"
              style={{
                width: 'calc(50vw - 24px)',
                maxWidth: '160px',
                minWidth: '120px',
                background: '#242424',
                border: '0.5px solid #333',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-2xl leading-none"
                style={{ background: `${cat.gradient.from}25` }}
              >
                {cat.emoji}
              </div>
              <span
                className="font-bold leading-tight text-sm w-full"
                style={{
                  color: cat.gradient.from,
                  wordBreak: 'break-word',
                  hyphens: 'auto',
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
      <header className="bg-gradient-to-br from-[#2D1B96] to-[#00D1C1] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/30 flex-shrink-0">
            {profile?.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#00D1C1] to-[#2D1B96] flex items-center justify-center">
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
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-8 min-h-screen" style={{ background: '#0F0F0F' }}>

        {/* Quiz du jour */}
        <section>
          <DailyQuizButton
            userId={user?.id}
            onStart={() => setShowDailyQuiz(true)}
            refreshTrigger={refreshTrigger}
          />
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
                {recentFormations.map((f) => {
                  const config = getCategoryConfig(f.category)
                  const progress = formationProgress[f.id]
                  const ctaLabel = progress?.isCompleted ? '✓ Terminé'
                    : progress?.isStarted ? 'Continuer →' : 'Découvrir'
                  const ctaGradient = progress?.isCompleted
                    ? 'linear-gradient(135deg, #059669, #10B981)'
                    : `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`
                  return (
                    <button
                      key={f.id}
                      onClick={() => window.location.href = `/formation/${f.category}?formation=${f.slug}`}
                      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left"
                      style={{ width: 'calc(50vw - 24px)', maxWidth: '220px', minWidth: '148px', display: 'flex', flexDirection: 'column', background: '#242424', border: '0.5px solid #333' }}
                    >
                      <div
                        className="w-full aspect-square flex items-center justify-center"
                        style={{ background: !f.cover_image_url ? `linear-gradient(135deg, ${config.gradient.from}33, ${config.gradient.from}66)` : undefined }}
                      >
                        {f.cover_image_url ? (
                          <img src={f.cover_image_url} alt={f.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-5xl">{config.emoji}</span>
                        )}
                      </div>
                      <div className="p-2.5 flex flex-col gap-2" style={{ flex: 1 }}>
                        <p className="text-xs font-semibold text-[#e5e5e5] leading-snug line-clamp-2" style={{ flex: 1, marginBottom: '6px' }}>
                          {f.title}
                        </p>
                        <div
                          className="w-full text-center text-xs font-semibold text-white py-1.5 rounded-xl"
                          style={{ background: ctaGradient, marginTop: 'auto' }}
                        >
                          {ctaLabel}
                        </div>
                      </div>
                    </button>
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

        {/* Pratiques cliniques — Axe 1+2 */}
        <section>
          <CategoryCarousel
            categories={axe12Categories}
            scrollRef={axe12ScrollRef}
            bandeauGradient="linear-gradient(135deg, #1E40AF, #3B82F6)"
            bandeauTitle="🔬 Pratiques cliniques"
            bandeauSubtitle="Axe 1 & 2 · Certification Périodique"
          />
        </section>

        {/* Relation Patient — Axe 3 */}
        <section>
          <CategoryCarousel
            categories={axe3Categories}
            scrollRef={axe3ScrollRef}
            bandeauGradient="linear-gradient(135deg, #F97316, #FBBF24)"
            bandeauTitle="🤝 Relation Patient"
            bandeauSubtitle="Axe 3 · Certification Périodique"
          />
        </section>

        {/* Santé Praticien — Axe 4 */}
        <section>
          <CategoryCarousel
            categories={axe4Categories}
            scrollRef={axe4ScrollRef}
            bandeauGradient="linear-gradient(135deg, #EC4899, #A78BFA)"
            bandeauTitle="💚 Santé Praticien"
            bandeauSubtitle="Axe 4 · Certification Périodique"
          />
        </section>

        {/* News */}
        <NewsSection news={news} loading={newsLoading} />

      </main>

      {showDailyQuiz && user && (
        <DailyQuizModal
          userId={user.id}
          onClose={() => setShowDailyQuiz(false)}
          onComplete={handleDailyQuizComplete}
        />
      )}
    </>
  )
}
