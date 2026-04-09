'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Bell,
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
      <header className="bg-gradient-to-br from-[#2D1B96] to-[#00D1C1] sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/profil" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00D1C1] to-[#2D1B96] p-0.5">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {profile?.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt="Photo de profil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#2D1B96] font-bold text-sm">
                      {profile?.first_name?.[0] || 'U'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-white/70">Welcome,</p>
                <h1 className="text-lg font-bold text-white">
                  {profile?.first_name || 'Utilisateur'}
                </h1>
                <p className="text-xs text-white/60">
                  {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button className="relative p-2.5 bg-white/20 text-white border-0 rounded-full hover:bg-white/30 transition-colors">
                <Bell size={20} className="text-white" />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              </button>
            </div>
          </div>
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
                <div className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                  {demarches.map((d) => (
                    <DemarcheCard key={d.id} demarche={d} />
                  ))}
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
