'use client'

import { useEffect, useRef, useState } from 'react'

// ============================================================================
// <TaxonomyPicker> — POC-T12
//
// Composant custom (zéro dépendance npm) pour choisir un ou plusieurs slugs
// dans une taxonomy news (specialite / theme / niveau_preuve).
//
// - mode='single' → <select> natif HTML stylé Tailwind. Inclut une option
//   "— Aucun —" pour permettre null.
// - mode='multi'  → chips affichés + bouton "+ Ajouter ▾" qui ouvre une
//   liste filtrable. Sélection ajoute chip, croix sur chip pour retirer.
//   Zone chips min-height 40px. État vide = placeholder gris-400 sur fond
//   gris-50 (état VALIDE, jamais rouge/orange — cf. D-PF-2).
//
// Fetch options via /api/admin/news/taxonomy?type=... au mount + à chaque
// changement de type (rare).
// ============================================================================

export type TaxonomyType = 'specialite' | 'theme' | 'niveau_preuve'

interface TaxonomyItem {
  slug: string
  label: string
}

interface SingleProps {
  type: TaxonomyType
  mode: 'single'
  value: string | null
  onChange: (next: string | null) => void
  // Texte du placeholder "— Aucun —" personnalisable (optionnel).
  emptyLabel?: string
}

interface MultiProps {
  type: TaxonomyType
  mode: 'multi'
  value: string[]
  onChange: (next: string[]) => void
  // Texte du placeholder de zone chips vide (optionnel).
  emptyPlaceholder?: string
}

type Props = SingleProps | MultiProps

export function TaxonomyPicker(props: Props) {
  const [items, setItems] = useState<TaxonomyItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(null)

    fetch(`/api/admin/news/taxonomy?type=${encodeURIComponent(props.type)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((data: { items: TaxonomyItem[] }) => {
        if (!cancelled) setItems(data.items ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
        }
      })

    return () => {
      cancelled = true
    }
  }, [props.type])

  if (error) {
    return (
      <p className="text-red-600 text-sm">
        Erreur taxonomy {props.type} : {error}
      </p>
    )
  }
  if (items === null) {
    return <p className="text-gray-700 text-sm">Chargement…</p>
  }

  if (props.mode === 'single') {
    return <SinglePicker items={items} {...props} />
  }
  return <MultiPicker items={items} {...props} />
}

// ----------------------------------------------------------------------------
// Single — <select> natif
// ----------------------------------------------------------------------------

function SinglePicker({
  items,
  value,
  onChange,
  emptyLabel,
}: SingleProps & { items: TaxonomyItem[] }) {
  return (
    <select
      className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
    >
      <option value="">{emptyLabel ?? '— Aucun —'}</option>
      {items.map((it) => (
        <option key={it.slug} value={it.slug}>
          {it.label}
        </option>
      ))}
    </select>
  )
}

// ----------------------------------------------------------------------------
// Multi — chips + dropdown filtrable custom
// ----------------------------------------------------------------------------

function MultiPicker({
  items,
  value,
  onChange,
  emptyPlaceholder,
}: MultiProps & { items: TaxonomyItem[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Fermeture dropdown sur clic extérieur
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const valueSet = new Set(value)
  const filtered = items
    .filter((it) => !valueSet.has(it.slug))
    .filter((it) => {
      if (query === '') return true
      const q = query.toLowerCase()
      return (
        it.label.toLowerCase().startsWith(q) ||
        it.slug.toLowerCase().startsWith(q)
      )
    })

  const labelOf = (slug: string): string =>
    items.find((it) => it.slug === slug)?.label ?? slug

  const addSlug = (slug: string) => {
    if (valueSet.has(slug)) return
    onChange([...value, slug])
    setQuery('')
  }
  const removeSlug = (slug: string) => {
    onChange(value.filter((v) => v !== slug))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Zone chips (min-height 40px, état vide ≠ erreur — D-PF-2) */}
      <div className="min-h-[40px] flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-gray-50">
        {value.length === 0 ? (
          <span className="text-sm text-gray-400">
            {emptyPlaceholder ??
              'Aucun thème — Cliquer "+ Ajouter" pour en saisir'}
          </span>
        ) : (
          value.map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700"
            >
              {labelOf(slug)}
              <button
                type="button"
                onClick={() => removeSlug(slug)}
                aria-label={`Retirer ${labelOf(slug)}`}
                className="text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* Bouton + Ajouter ▾ */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 inline-flex items-center gap-1 text-sm text-gray-700 border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        + Ajouter <span className="text-xs">▾</span>
      </button>

      {/* Dropdown filtrable */}
      {open && (
        <div className="absolute z-10 mt-1 w-72 bg-white border border-gray-200 rounded shadow-lg">
          <input
            autoFocus
            type="text"
            placeholder="Filtrer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-b border-gray-200 px-2 py-1 text-sm text-gray-700 bg-white outline-none"
          />
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-1 text-xs text-gray-400">
                {items.length === value.length
                  ? 'Tous les slugs ont déjà été sélectionnés'
                  : 'Aucun résultat'}
              </li>
            ) : (
              filtered.map((it) => (
                <li key={it.slug}>
                  <button
                    type="button"
                    onClick={() => addSlug(it.slug)}
                    className="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    {it.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
