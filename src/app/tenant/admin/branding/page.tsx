'use client'

import { useEffect, useState } from 'react'
import { Palette, Save } from 'lucide-react'

interface BrandingData {
  id: string
  name: string
  type: 'cabinet' | 'hr_entity' | 'training_org'
  branding_logo_url: string | null
  branding_primary_color: string | null
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/
const DEFAULT_COLOR = '#2D1B96'

export default function TenantBrandingPage() {
  const [data, setData] = useState<BrandingData | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [colorInput, setColorInput] = useState(DEFAULT_COLOR)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tenant/branding')
        const json = await res.json()
        if (res.status === 403) {
          if (!cancelled) setNotAvailable(true)
          return
        }
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (cancelled) return
        const brand = json as BrandingData
        setData(brand)
        setLogoUrl(brand.branding_logo_url ?? '')
        const initial = brand.branding_primary_color ?? DEFAULT_COLOR
        setColor(initial)
        setColorInput(initial)
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

  const handleColorTextChange = (value: string) => {
    setColorInput(value)
    if (HEX_RE.test(value)) {
      setColor(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!HEX_RE.test(colorInput)) {
      setError('Couleur invalide (format attendu : #RRGGBB)')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/tenant/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branding_logo_url: logoUrl.trim() || null,
          branding_primary_color: colorInput,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de sauvegarde')
      setData(json)
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
          <h1 className="text-xl font-semibold mb-2">Personnalisation non disponible</h1>
          <p>
            La personnalisation visuelle n'est disponible que pour les entités RH et les
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
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
        <Palette className="w-8 h-8" style={{ color: 'var(--tenant-primary)' }} />
        Personnalisation
      </h1>
      <p className="text-gray-600 mb-8">
        Personnalisez le logo et la couleur primaire affichés à vos membres.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL du logo</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-gray-500 mt-1">
            URL publique vers votre logo (PNG ou SVG recommandé). Laissez vide pour utiliser
            le logo DentalLearn.
          </p>
          {logoUrl && (
            <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Aperçu :</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Aperçu du logo"
                className="h-12 w-auto max-w-[240px] object-contain"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Couleur primaire</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={HEX_RE.test(colorInput) ? colorInput : color}
              onChange={(e) => handleColorTextChange(e.target.value)}
              className="h-12 w-16 border border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={colorInput}
              onChange={(e) => handleColorTextChange(e.target.value)}
              maxLength={7}
              placeholder="#2D1B96"
              className="border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Format : #RRGGBB</p>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Aperçu d'un bouton :</p>
            <button
              type="button"
              className="text-white px-6 py-3 rounded-xl font-medium"
              style={{ backgroundColor: HEX_RE.test(colorInput) ? colorInput : color }}
            >
              Bouton d'exemple
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          {savedFlash && (
            <span className="text-sm text-green-600">
              Modifications sauvegardées — rechargez pour voir le nouveau thème.
            </span>
          )}
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
      </form>

      {data && (
        <p className="text-xs text-gray-500 mt-4">
          Organisation : <span className="font-medium">{data.name}</span>
        </p>
      )}
    </div>
  )
}
