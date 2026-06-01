'use client'

import { Check } from 'lucide-react'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { UserInterests } from '@/lib/supabase/types'

// ── Définition des chips ──────────────────────────────────────────────
// Source UNIQUE du jeu de chips, partagée entre l'onboarding et la page
// Profil pour éviter toute divergence (le set de ~14 chips + son mapping
// doivent rester identiques). Cliniques & bonus → poussent leur slug dans
// categories[] (libellés/couleurs réutilisés via getCategoryConfig). Chips
// d'axe → poussent un entier dans axes[] (couleurs canoniques du design
// system : axe 3 #D97706, axe 4 #EC4899).

export const CLINICAL_SLUGS = [
  'esthetique',
  'restauratrice',
  'chirurgie',
  'implant',
  'prothese',
  'parodontologie',
  'endodontie',
  'radiologie',
  'numerique',
] as const

export const BONUS_SLUGS = ['management', 'organisation', 'soft-skills'] as const

export const AXE_CHIPS: { label: string; axe: number; color: string; emoji: string }[] = [
  { label: 'Relation patient', axe: 3, color: '#D97706', emoji: '🗣️' },
  { label: 'Santé du praticien', axe: 4, color: '#EC4899', emoji: '🪷' },
]

interface InterestChipsProps {
  value: UserInterests
  onChange: (value: UserInterests) => void
}

// Composant contrôlé (value/onChange) : ne tient AUCUN état interne. L'appelant
// possède la valeur (onboarding ou Profil), garantissant un comportement
// strictement identique des deux côtés.
export default function InterestChips({ value, onChange }: InterestChipsProps) {
  const toggleCategory = (slug: string) => {
    const has = value.categories.includes(slug)
    onChange({
      ...value,
      categories: has
        ? value.categories.filter((c) => c !== slug)
        : [...value.categories, slug],
    })
  }

  const toggleAxe = (axe: number) => {
    const has = value.axes.includes(axe)
    onChange({
      ...value,
      axes: has ? value.axes.filter((a) => a !== axe) : [...value.axes, axe],
    })
  }

  return (
    <>
      <ChipSection title="Cliniques">
        {CLINICAL_SLUGS.map((slug) => (
          <CategoryChip
            key={slug}
            slug={slug}
            selected={value.categories.includes(slug)}
            onToggle={toggleCategory}
          />
        ))}
      </ChipSection>

      <ChipSection title="Parcours CP">
        {AXE_CHIPS.map((chip) => (
          <AxeChip
            key={chip.axe}
            chip={chip}
            selected={value.axes.includes(chip.axe)}
            onToggle={toggleAxe}
          />
        ))}
      </ChipSection>

      <ChipSection title="Gestion de cabinet">
        {BONUS_SLUGS.map((slug) => (
          <CategoryChip
            key={slug}
            slug={slug}
            selected={value.categories.includes(slug)}
            onToggle={toggleCategory}
          />
        ))}
      </ChipSection>
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

function AxeChip({
  chip,
  selected,
  onToggle,
}: {
  chip: { label: string; axe: number; color: string; emoji: string }
  selected: boolean
  onToggle: (axe: number) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(chip.axe)}
      className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition active:scale-[0.97]"
      style={
        selected
          ? {
              background: chip.color,
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
      <span aria-hidden>{chip.emoji}</span>
      <span>{chip.label}</span>
      {selected && <Check className="h-4 w-4" />}
    </button>
  )
}
