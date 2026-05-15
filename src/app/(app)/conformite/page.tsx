'use client'

import {
  ShieldCheck,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileText,
  ChevronRight,
} from 'lucide-react'

// Catégories conformité — sera remplacé par Supabase
const CONFORMITE_CATEGORIES = [
  {
    id: 'hygiene',
    title: 'Hygiène & Stérilisation',
    icon: '🧫',
    itemsTotal: 12,
    itemsDone: 0,
  },
  {
    id: 'securite',
    title: 'Sécurité du cabinet',
    icon: '🔒',
    itemsTotal: 8,
    itemsDone: 0,
  },
  {
    id: 'radioprotection',
    title: 'Radioprotection',
    icon: '☢️',
    itemsTotal: 6,
    itemsDone: 0,
  },
  {
    id: 'dechets',
    title: 'Gestion des déchets',
    icon: '🗑️',
    itemsTotal: 5,
    itemsDone: 0,
  },
  {
    id: 'affichages',
    title: 'Affichages obligatoires',
    icon: '📋',
    itemsTotal: 9,
    itemsDone: 0,
  },
  {
    id: 'rh',
    title: 'RH & Personnel',
    icon: '👥',
    itemsTotal: 7,
    itemsDone: 0,
  },
  {
    id: 'duerp',
    title: 'DUERP',
    icon: '📄',
    itemsTotal: 5,
    itemsDone: 0,
  },
]

export default function ConformitePage() {
  const totalItems = CONFORMITE_CATEGORIES.reduce((sum, c) => sum + c.itemsTotal, 0)
  const totalDone = CONFORMITE_CATEGORIES.reduce((sum, c) => sum + c.itemsDone, 0)
  const progressPercent = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

  return (
    <>
      {/* Header */}
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <ShieldCheck size={20} className="text-accent" />
            </div>
            Conformité
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Score global */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Conformité cabinet
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalDone}/{totalItems} items validés
              </p>
            </div>
            <div
              className="text-2xl font-black"
              style={{ color: '#00D1C1' }}
            >
              {progressPercent}%
            </div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Catégories */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
            Catégories
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CONFORMITE_CATEGORIES.map((category) => {
              const percent =
                category.itemsTotal > 0
                  ? Math.round(
                      (category.itemsDone / category.itemsTotal) * 100
                    )
                  : 0

              return (
                <button
                  key={category.id}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-900 text-sm truncate">
                          {category.title}
                        </h3>
                        <ChevronRight
                          size={16}
                          className="text-gray-300 shrink-0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {category.itemsDone}/{category.itemsTotal}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Générateur DUERP */}
        <div className="bg-gradient-to-br from-accent to-accent-hover rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <FileText size={24} className="shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-base mb-1">Générateur DUERP</h3>
              <p className="text-white/80 text-xs leading-relaxed mb-3">
                Générez votre Document Unique d&apos;Évaluation des Risques
                Professionnels adapté à l&apos;odontologie.
              </p>
              <button className="px-4 py-2 bg-white text-accent rounded-xl text-sm font-bold hover:bg-white/90 transition-colors">
                Bientôt disponible
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
