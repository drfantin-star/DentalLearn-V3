'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookMarked, Save } from 'lucide-react'

interface CatalogFormation {
  id: string
  title: string
  slug: string
  cover_image_url: string | null
  instructor_name: string
}

interface PinnedRow {
  id: string
  formation_id: string
  display_order: number
  formations: CatalogFormation | null
}

interface CurationResponse {
  pinned: PinnedRow[]
  catalog: CatalogFormation[]
  max: number
}

export default function TenantCurationPage() {
  const [catalog, setCatalog] = useState<CatalogFormation[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [max, setMax] = useState(10)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tenant/curation')
        const json = await res.json()
        if (res.status === 403) {
          if (!cancelled) setNotAvailable(true)
          return
        }
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (cancelled) return
        const data = json as CurationResponse
        setCatalog(data.catalog)
        setMax(data.max)
        // L'ordre actuel = display_order ; on conserve l'ordre des épinglées.
        setSelected(
          [...data.pinned]
            .sort((a, b) => a.display_order - b.display_order)
            .map((p) => p.formation_id)
        )
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (formationId: string) => {
    setError(null)
    if (selectedSet.has(formationId)) {
      setSelected((prev) => prev.filter((id) => id !== formationId))
    } else {
      if (selected.length >= max) {
        setError(`Maximum ${max} formations épinglées.`)
        return
      }
      setSelected((prev) => [...prev, formationId])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/tenant/curation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formation_ids: selected }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de sauvegarde')
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (notAvailable) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl p-6 max-w-2xl">
          <h1 className="text-xl font-semibold mb-2">Catalogue non disponible</h1>
          <p>
            La curation du catalogue n'est disponible que pour les entités RH et les
            organismes de formation.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--tenant-primary)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
        <BookMarked className="w-8 h-8" style={{ color: 'var(--tenant-primary)' }} />
        Catalogue
      </h1>
      <p className="text-gray-600 mb-6">
        Épinglez jusqu'à {max} formations Dentalschool dans le catalogue présenté à vos
        membres. L'ordre d'affichage suit l'ordre de sélection.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          {catalog.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Aucune formation Dentalschool publiée pour le moment.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {catalog.map((f) => {
                const isSelected = selectedSet.has(f.id)
                const order = isSelected ? selected.indexOf(f.id) + 1 : null
                return (
                  <li key={f.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(f.id)}
                      className="w-5 h-5"
                    />
                    {f.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.cover_image_url}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{f.title}</p>
                      <p className="text-sm text-gray-500 truncate">{f.instructor_name}</p>
                    </div>
                    {order !== null && (
                      <span
                        className="text-white text-xs font-bold px-3 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--tenant-primary)' }}
                      >
                        #{order}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selected.length} / {max} épinglée{selected.length > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            {savedFlash && <span className="text-sm text-green-600">Modifications sauvegardées</span>}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--tenant-primary)' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
