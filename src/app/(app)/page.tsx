'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import {
  GraduationCap, UserCircle, ChevronLeft, ChevronRight,
  BookOpen, Loader2, Zap,
} from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { useFormations } from '@/lib/hooks/useFormations'
import { useDemarches } from '@/lib/hooks/useDemarches'
import { useNews } from '@/lib/hooks/useNews'
import { getAnonymousName, getAnonymousEmoji } from '@/lib/utils/anonymousNames'

// Composants
import StatsCards from '@/components/home/StatsCards'
import DailyQuizButton from '@/components/home/DailyQuizButton'
import DailyQuizModal from '@/components/home/DailyQuizModal'
import DemarcheCard from '@/components/home/DemarcheCard'
import NewsSection from '@/components/home/NewsSection'

// ============================================
// PAGE PRINCIPALE — ACCUEIL
// ============================================

export default function HomePage() {
  const [showDailyQuiz, setShowDailyQuiz] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  // Hooks Supabase
  const { user, profile, displayName, streak, loading: userLoading, refetch: refetchUser } = useUser()
  const { currentFormation, loading: formationLoading } = useFormations(user?.id)
  const { demarches, loading: demarchesLoading } = useDemarches(user?.id)
  const { news, loading: newsLoading } = useNews(4)

  const handleDailyQuizComplete = async (score: number, totalPoints: number) => {
    setShowDailyQuiz(false)
    setRefreshTrigger(prev => prev + 1)
    refetchUser()
  }

  return (
    <>
      {/* Header Accueil */}
      <header className="bg-gradient-to-br from-[#2D1B96] to-[#00D1C1] px-5 py-4">
        <div className="flex items-center justify-between gap-3">

          {/* Avatar */}
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

          {/* Textes — flex-1 pour occuper tout l'espace jusqu'au bouton notif */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-black uppercase truncate"
               style={{ fontSize: '18px', lineHeight: '1.3' }}>
              Bonjour, {profile?.first_name || 'Utilisateur'}
              <span className="hidden md:inline ml-2 font-bold"
                    style={{ fontSize: '13px', opacity: 0.6 }}>
                {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
              </span>
            </p>
            <p className="md:hidden text-white/60 font-bold uppercase"
               style={{ fontSize: '11px' }}>
              {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
            </p>
          </div>

          {/* Notif */}
          <Link href="/profil"
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 hover:bg-white/25 transition-colors">
            <UserCircle size={24} className="text-white" />
          </Link>

        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {userLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-[#2D1B96]" size={32} />
          </div>
        ) : (
          <>
            {/* Mes stats */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Zap size={20} className="text-[#F59E0B]" />
                  Mes stats
                </h2>
              </div>
              <StatsCards
                userId={user?.id}
                currentStreak={streak?.current_streak || 0}
                refreshTrigger={refreshTrigger}
              />
            </section>

            {/* Quiz du jour */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Zap size={20} className="text-[#F59E0B]" />
                  Quiz du jour
                </h2>
              </div>
              <DailyQuizButton
                userId={user?.id}
                onStart={() => setShowDailyQuiz(true)}
                refreshTrigger={refreshTrigger}
              />
            </section>

            {/* Mes démarches en cours */}
            <section>
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen size={20} className="text-[#8B5CF6]" />
                  Mes démarches en cours
                </h2>
              </div>

              {demarchesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : demarches.length > 0 ? (
                <div className="relative">
                  {/* Flèche gauche — desktop only */}
                  <button
                    onClick={scrollLeft}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  {/* Carousel */}
                  <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
                  >
                    {demarches.map((d) => (
                      <DemarcheCard key={d.id} demarche={d} />
                    ))}
                  </div>

                  {/* Flèche droite — desktop only */}
                  <button
                    onClick={scrollRight}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-violet-50 flex items-center justify-center">
                    <GraduationCap size={24} className="text-violet-400" />
                  </div>
                  <p className="text-gray-500 text-sm mb-4">
                    Aucune démarche en cours
                  </p>
                  <Link
                    href="/formation"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00D1C1] text-white rounded-xl text-sm font-bold hover:bg-[#00b8a9] transition-colors"
                  >
                    Commencer une formation
                  </Link>
                </div>
              )}
            </section>

            {/* Veille métier */}
            <NewsSection news={news} loading={newsLoading} />
          </>
        )}
      </main>

      {/* Modal Daily Quiz */}
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
