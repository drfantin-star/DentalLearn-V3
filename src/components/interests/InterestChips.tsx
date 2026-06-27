'use client'

import { Check } from 'lucide-react'
import { getCategoryConfig, CATEGORY_CONFIG } from '@/lib/supabase/types'
import type { UserInterests } from '@/lib/supabase/types'

// ── Slugs dérivés de CATEGORY_CONFIG (source unique) ─────────────────
// Ne pas dupliquer les listes ici : on filtre CATEGORY_CONFIG par type.

export const CLINICAL_SLUGS = Object.entries(CATEGORY_CONFIG)
  .filter(([, c]) => c.type === 'cp')
  .map(([slug]) => slug)

export const AXE3_SLUGS = Object.entries(CATEGORY_CONFIG)
  .filter(([, c]) => c.type === 'axe3')
  .map(([slug]) => slug)

export const AXE4_SLUGS = Object.entries(CATEGORY_CONFIG)
  .filter(([, c]) => c.type === 'axe4')
  .map(([slug]) => slug)

export const BONUS_SLUGS = Object.entries(CATEGORY_CONFIG)
  .filter(([, c]) => c.type === 'bonus')
  .map(([slug]) => slug)

export type InterestSection = 'clinical' | 'axe3' | 'axe4' | 'bonus'

const SECTION_META: Record<
  InterestSection,
  { title: string; slugs: string[] }
> = {
  clinical: { title: 'Cliniques', slugs: CLINICAL_SLUGS },
  axe3: { title: 'Relation patient (axe 3)', slugs: AXE3_SLUGS },
  axe4: { title: 'Ta santé au travail (axe 4)', slugs: AXE4_SLUGS },
  bonus: { title: 'Gestion de cabinet', slugs: BONUS_SLUGS },
}

const ALL_SECTIONS: InterestSection[] = ['clinical', 'axe3', 'axe4', 'bonus']

interface InterestChipsProps {
  value: UserInterests
  onChange: (value: UserInterests) => void
  /** Filtre les sections affichées. Défaut = les 4 (comportement Profil inchangé). */
  sections?: InterestSection[]
}

// Composant contrôlé (value/onChange) : ne tient AUCUN état interne.
// axes[] est recalculé à chaque toggle depuis les catégories sélectionnées :
//   3 ∈ axes  ⟺  au moins une catégorie sélectionnée a type='axe3'
//   4 ∈ axes  ⟺  au moins une catégorie sélectionnée a type='axe4'
// La dérivation lit value.categories en entier → non impactée par le filtrage sections.
export default function InterestChips({
  value,
  onChange,
  sections = ALL_SECTIONS,
}: InterestChipsProps) {
  const toggleCategory = (slug: string) => {
    const has = value.categories.includes(slug)
    const nextCategories = has
      ? value.categories.filter((c) => c !== slug)
      : [...value.categories, slug]

    const hasAxe3 = nextCategories.some((c) => CATEGORY_CONFIG[c]?.type === 'axe3')
    const hasAxe4 = nextCategories.some((c) => CATEGORY_CONFIG[c]?.type === 'axe4')

    const baseAxes = value.axes.filter((a) => a !== 3 && a !== 4)
    const nextAxes = [
      ...baseAxes,
      ...(hasAxe3 ? [3] : []),
      ...(hasAxe4 ? [4] : []),
    ]

    onChange({ ...value, categories: nextCategories, axes: nextAxes })
  }

  return (
    <>
      {sections.map((key) => {
        const { title, slugs } = SECTION_META[key]
        return (
          <ChipSection key={key} title={title}>
            {slugs.map((slug) => (
              <CategoryChip
                key={slug}
                slug={slug}
                selected={value.categories.includes(slug)}
                onToggle={toggleCategory}
              />
            ))}
          </ChipSection>
        )
      })}
    </>
  )
}

// ── Sous-composants ───────────────────────────────────────────────────

function ChipSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </section>
  )
}

function CategoryChip({
  slug,
  selected,
  onToggle,
}: {
  slug: string
  selected: boolean
  onToggle: (slug: string) => void
}) {
  const config = getCategoryConfig(slug)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(slug)}
      className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition active:scale-[0.97]"
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`,
              borderColor: 'transparent',
              color: '#fff',
            }
          : {
              background: '#242424',
              borderColor: 'rgba(255,255,255,0.12)',
              color: '#e5e5e5',
            }
      }
    >
      <span aria-hidden>{config.emoji}</span>
      <span>{config.name}</span>
      {selected && <Check className="h-4 w-4" />}
    </button>
  )
}
