'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Bell, ChevronRight,
  BookOpen, Loader2, Zap,
} from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { useFormations } from '@/lib/hooks/useFormations'
import { useNews } from '@/lib/hooks/useNews'
import { getAnonymousName, getAnonymousEmoji } from '@/lib/utils/anonymousNames'

// Composants
import StatsCards from '@/components/home/StatsCards'
import DailyQuizButton from '@/components/home/DailyQuizButton'
import DailyQuizModal from '@/components/home/DailyQuizModal'
import FormationCard from '@/components/home/FormationCard'
import NewsSection from '@/components/home/NewsSection'
import type { FormationEnCours } from '@/components/home/FormationCard'

// ============================================
// MOCK FORMATIONS EN COURS (temporaire — sera Supabase)
// ============================================

const mockFormations: FormationEnCours[] = [
  {
    id: '1',
    slug: 'dyschromies-eclaircissements-dentaires',
    title: 'Éclaircissements & Taches Blanches',
    category: 'Esthétique',
    currentSequence: 6,
    totalSequences: 15,
    progressPercent: 40,
    likes: 124,
    isCP: true,
    badge: 'POPULAIRE',
  },
  {
    id: '2',
    slug: 'onlays-overlays-felures-dentaires',
    title: 'Fêlures & Overlays',
    category: 'Dentisterie Restauratrice',
    currentSequence: 2,
    totalSequences: 15,
    progressPercent: 13,
    likes: 89,
    isCP: true,
    badge: 'NOUVEAU',
  },
]

// ============================================
// PAGE PRINCIPALE — ACCUEIL
// ============================================

export default function HomePage() {
  const [showDailyQuiz, setShowDailyQuiz] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Hooks Supabase
  const { user, profile, displayName, streak, loading: userLoading, refetch: refetchUser } = useUser()
  const { currentFormation, loading: formationLoading } = useFormations(user?.id)
  const { news, loading: newsLoading } = useNews(4)

  const handleDailyQuizComplete = async (score: number, totalPoints: number) => {
    setShowDailyQuiz(false)
    // Update streak after daily quiz completion
    try {
      await fetch('/api/streaks/update', { method: 'POST' })
    } catch (err) {
      console.error('Error updating streak:', err)
    }
    setRefreshTrigger(prev => prev + 1)
    refetchUser()
  }

  return (
    <>
      {/* Header Accueil */}
      <header className="bg-white sticky top-0 z-30 shadow-sm">
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
                <p className="text-xs text-gray-400">Welcome,</p>
                <h1 className="text-lg font-bold text-gray-900">
                  {profile?.first_name || 'Utilisateur'}
                </h1>
                <p className="text-xs text-[#00D1C1]">
                  {getAnonymousEmoji(user?.id || '')} {getAnonymousName(user?.id || '')}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button className="relative p-2.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                <Bell size={20} className="text-gray-600" />
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

            {/* Mes formations en cours */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen size={20} className="text-[#8B5CF6]" />
                  Mes formations en cours
                </h2>
                <Link
                  href="/formation"
                  className="text-xs font-bold text-[#2D1B96] flex items-center gap-1 hover:underline"
                >
                  Tout voir <ChevronRight size={14} />
                </Link>
              </div>

              {formationLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : mockFormations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mockFormations.map((f) => (
                    <FormationCard key={f.id} formation={f} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-violet-50 flex items-center justify-center">
                    <GraduationCap size={24} className="text-violet-400" />
                  </div>
                  <p className="text-gray-500 text-sm mb-4">
                    Aucune formation en cours
                  </p>
                  <Link
                    href="/formation"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00D1C1] text-white rounded-xl text-sm font-bold hover:bg-[#00b8a9] transition-colors"
                  >
                    Voir le catalogue
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
