'use client'

import { GraduationCap, BookOpen, Star, Lock, ChevronRight } from 'lucide-react'
import Link from 'next/link'

// Données temporaires — sera remplacé par Supabase en 2.3
const MOCK_FORMATIONS = [
  {
    id: '1',
    title: 'Éclaircissements & Taches Blanches',
    instructor: 'Dr Laurent Elbeze',
    sequences: 15,
    progress: 33,
    isActive: true,
    cpEligible: true,
    accessType: 'full' as const,
  },
  {
    id: '2',
    title: 'Fêlures & Overlays',
    instructor: 'Dr Gauthier Weisrock',
    sequences: 15,
    progress: 0,
    isActive: false,
    cpEligible: true,
    accessType: 'demo' as const,
  },
  {
    id: '3',
    title: 'Composite Stratifié',
    instructor: 'Dentalschool',
    sequences: 15,
    progress: 0,
    isActive: false,
    cpEligible: false,
    accessType: 'demo' as const,
  },
]

export default function FormationPage() {
  return (
    <>
      {/* Header */}
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <GraduationCap size={20} className="text-[#2D1B96]" />
              </div>
              Formations
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Section CP */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-[#2D1B96] uppercase tracking-wide bg-indigo-50 px-2.5 py-1 rounded-full">
              Certification Périodique
            </span>
          </div>

          <div className="space-y-3">
            {MOCK_FORMATIONS.filter((f) => f.cpEligible).map((formation) => (
              <div
                key={formation.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">
                      {formation.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {formation.instructor} • {formation.sequences} séquences
                    </p>
                  </div>
                  {formation.accessType === 'demo' ? (
                    <Lock size={16} className="text-gray-300 mt-1" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-300 mt-1" />
                  )}
                </div>

                {formation.progress > 0 && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2D1B96] rounded-full transition-all"
                      style={{ width: `${formation.progress}%` }}
                    />
                  </div>
                )}

                {formation.isActive && (
                  <span className="inline-block mt-2 text-[10px] font-bold text-[#00D1C1] bg-teal-50 px-2 py-0.5 rounded-full">
                    En cours
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section Bonus */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-100 px-2.5 py-1 rounded-full">
              Bonus
            </span>
          </div>

          <div className="space-y-3">
            {MOCK_FORMATIONS.filter((f) => !f.cpEligible).map((formation) => (
              <div
                key={formation.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">
                      {formation.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {formation.instructor} • {formation.sequences} séquences
                    </p>
                  </div>
                  <Lock size={16} className="text-gray-300 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Info */}
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-start gap-3">
            <BookOpen size={18} className="text-[#2D1B96] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#2D1B96] font-medium leading-relaxed">
                La séquence 0 de chaque formation est gratuite. 
                Passez en Premium pour accéder à toutes les séquences.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
