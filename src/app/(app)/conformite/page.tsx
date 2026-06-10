'use client'

import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  FileText,
  ChevronRight,
  Radio,
  Thermometer,
  Trash2,
  Shield,
  Lock,
  Accessibility,
  Activity,
  MonitorSmartphone,
  Receipt,
  Users,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'
import { useCabinetCompliance, deriveEffectiveStatus } from '@/lib/hooks/useCabinetCompliance'
import CategoryItemsModal from '@/components/conformite/CategoryItemsModal'
import type { CabinetComplianceCategory } from '@/lib/supabase/types'

// Noms d'icônes lucide stockés en base (cabinet_compliance_categories.icon).
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  radio: Radio,
  thermometer: Thermometer,
  'trash-2': Trash2,
  shield: Shield,
  lock: Lock,
  accessibility: Accessibility,
  activity: Activity,
  'monitor-smartphone': MonitorSmartphone,
  'file-text': FileText,
  receipt: Receipt,
  users: Users,
  briefcase: Briefcase,
}

function categoryIcon(name: string | null): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || ShieldCheck
}

export default function ConformitePage() {
  const { categories, items, progressByItem, loading, setItemStatus } =
    useCabinetCompliance()
  const [openCategory, setOpenCategory] =
    useState<CabinetComplianceCategory | null>(null)

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Items groupés par catégorie.
  const itemsByCategory = useMemo(() => {
    const map: Record<string, typeof items> = {}
    for (const item of items) {
      ;(map[item.category_id] ??= []).push(item)
    }
    return map
  }, [items])

  // % = done / (total − not_applicable). 'expired' compte comme non conforme
  // (exclu du numérateur) mais reste au dénominateur.
  const computeStats = useMemo(() => {
    return (categoryId?: string) => {
      const scope = categoryId
        ? itemsByCategory[categoryId] ?? []
        : items
      let done = 0
      let denom = 0
      for (const item of scope) {
        const effective = deriveEffectiveStatus(progressByItem[item.id], todayISO)
        if (effective === 'not_applicable') continue
        denom += 1
        if (effective === 'done') done += 1
      }
      const percent = denom > 0 ? Math.round((done / denom) * 100) : 0
      return { done, denom, percent }
    }
  }, [items, itemsByCategory, progressByItem, todayISO])

  const global = computeStats()

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
                {loading
                  ? 'Chargement…'
                  : `${global.done}/${global.denom} items validés`}
              </p>
            </div>
            <div className="text-2xl font-black text-accent">
              {global.percent}%
            </div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700"
              style={{ width: `${global.percent}%` }}
            />
          </div>
        </div>

        {/* Catégories */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
            Catégories
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] bg-white rounded-2xl border border-gray-100 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map((category) => {
                const Icon = categoryIcon(category.icon)
                const stats = computeStats(category.id)
                const total = (itemsByCategory[category.id] ?? []).length

                return (
                  <button
                    key={category.id}
                    onClick={() => setOpenCategory(category)}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: category.color
                            ? `${category.color}1A`
                            : '#f3f4f6',
                          color: category.color ?? '#374151',
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-gray-900 text-sm truncate">
                            {category.name}
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
                              style={{ width: `${stats.percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {stats.done}/{total}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
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

      <CategoryItemsModal
        open={openCategory !== null}
        onClose={() => setOpenCategory(null)}
        category={openCategory}
        items={openCategory ? itemsByCategory[openCategory.id] ?? [] : []}
        progressByItem={progressByItem}
        todayISO={todayISO}
        onSetStatus={setItemStatus}
      />
    </>
  )
}
