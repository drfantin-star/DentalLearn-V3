'use client'

import React, { useState, useEffect } from 'react'
import {
  Loader2,
  Flame,
  ChevronRight,
  ClipboardCheck,
  Gamepad2,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORY_CONFIG,
  DEFAULT_CATEGORY_CONFIG,
  getCategoryConfig,
  type Formation,
} from '@/lib/supabase'

// ============================================
// THEMES CONFIG (avec icônes enrichies)
// ============================================

const THEMES_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'esthetique': { label: 'Esthétique Dentaire', icon: '✨', color: '#8B5CF6' },
  'restauratrice': { label: 'Dentisterie Restauratrice', icon: '🦷', color: '#F59E0B' },
  'endodontie': { label: 'Endodontie', icon: '🔬', color: '#6366F1' },
  'chirurgie': { label: 'Chirurgie Orale', icon: '🔪', color: '#EF4444' },
  'implant': { label: 'Implantologie', icon: '🔩', color: '#10B981' },
  'prothese': { label: 'Prothèse', icon: '👄', color: '#F97316' },
  'parodontologie': { label: 'Parodontologie', icon: '🫧', color: '#EC4899' },
  'radiologie': { label: 'Radiologie', icon: '📡', color: '#14B8A6' },
  'ergonomie': { label: 'Ergonomie', icon: '🪑', color: '#F59E0B' },
  'relation-patient': { label: 'Relation Patient', icon: '🤝', color: '#F97316' },
  'sante-pro': { label: 'Santé du Praticien', icon: '💚', color: '#10B981' },
  'numerique': { label: 'Numérique & IA', icon: '🤖', color: '#6366F1' },
  'environnement': { label: 'Environnement', icon: '🌿', color: '#22C55E' },
  'management': { label: 'Management', icon: '💼', color: '#78716C' },
  'organisation': { label: 'Organisation', icon: '📋', color: '#64748B' },
  'soft-skills': { label: 'Soft Skills', icon: '🤝', color: '#D97706' },
}

function getThemeConfig(slug: string) {
  return THEMES_CONFIG[slug] || { label: slug, icon: '📚', color: '#6B7280' }
}

// ============================================
// TYPES
// ============================================

interface ThemeData {
  slug: string
  label: string
  icon: string
  color: string
  formationsCount: number
  hasEpp: boolean
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function FormationPage() {
  const [themes, setThemes] = useState<ThemeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function loadThemes() {
      try {
        const supabase = createClient()

        // 1. Charger les formations publiées groupées par category
        const { data: formations, error: fError } = await supabase
          .from('formations')
          .select('id, category')
          .eq('is_published', true)

        if (fError) throw fError

        // 2. Charger les audits EPP publiés avec theme_slug
        const { data: eppAudits, error: eError } = await supabase
          .from('epp_audits')
          .select('id, theme_slug')
          .eq('is_published', true)

        if (eError) throw eError

        // 3. Grouper par catégorie
        const categoryMap = new Map<string, { count: number; hasEpp: boolean }>()

        for (const f of formations || []) {
          const cat = f.category?.toLowerCase() || 'autre'
          const existing = categoryMap.get(cat) || { count: 0, hasEpp: false }
          existing.count++
          categoryMap.set(cat, existing)
        }

        // Marquer les catégories ayant un audit EPP
        for (const audit of eppAudits || []) {
          if (audit.theme_slug) {
            const existing = categoryMap.get(audit.theme_slug) || { count: 0, hasEpp: false }
            existing.hasEpp = true
            categoryMap.set(audit.theme_slug, existing)
          }
        }

        // 4. Construire la liste des thématiques
        const themesList: ThemeData[] = Array.from(categoryMap.entries())
          .map(([slug, data]) => {
            const config = getThemeConfig(slug)
            return {
              slug,
              label: config.label,
              icon: config.icon,
              color: config.color,
              formationsCount: data.count,
              hasEpp: data.hasEpp,
            }
          })
          .sort((a, b) => a.label.localeCompare(b.label))

        setThemes(themesList)
      } catch (err) {
        console.error('Erreur loadThemes:', err)
        setError(err instanceof Error ? err : new Error('Erreur inconnue'))
      } finally {
        setLoading(false)
      }
    }

    loadThemes()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Erreur : {error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-100 rounded-xl text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-black text-gray-900">Formations</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Connaissances &amp; compétences &middot; Axes 1 &amp; 2
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-6">

        {/* Info box */}
        <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
          <p className="text-xs text-indigo-700 leading-relaxed">
            <strong>Certification Périodique</strong> — Chaque thématique peut contenir
            une formation gamifiée (Axe 1) et/ou un audit EPP (Axe 2).
            Choisissez une thématique pour commencer.
          </p>
        </div>

        {/* Grille des thématiques */}
        {themes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-500 text-sm">Aucune thématique disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {themes.map((theme) => (
              <Link
                key={theme.slug}
                href={`/formation/${theme.slug}`}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  {/* Icône thématique */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: theme.color + '15' }}
                  >
                    <span className="text-2xl">{theme.icon}</span>
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-[15px]">
                      {theme.label}
                    </h3>

                    {/* Badges Axe 1 / Axe 2 */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        <Gamepad2 size={10} />
                        Formation
                      </span>
                      {theme.hasEpp && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                          <ClipboardCheck size={10} />
                          Audit EPP
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {theme.formationsCount} formation{theme.formationsCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={16} className="text-gray-300 mt-3 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
