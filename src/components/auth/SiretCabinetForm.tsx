'use client'

// Sous-formulaire de création de cabinet.
// Champ de recherche unique (nom OU SIRET) avec auto-complétion via
// /api/auth/sirene-search (proxy gouv.fr).
//
// Réutilisé par :
//   - /register (signup titulaire_cabinet)
//   - /profil (modal upgrade solo→cabinet)
//
// Émet onChange({ name, siret, forme_juridique, adresse, valid }) à chaque
// modification — le parent gère la soumission et le wiring à
// /api/auth/create-cabinet.

import { useEffect, useRef, useState } from 'react'
import { Building2, Search, AlertTriangle, Loader2, Check } from 'lucide-react'

export interface CabinetData {
  name: string
  siret: string | null
  forme_juridique: string | null
  adresse: string | null
}

interface SireneResult {
  siret: string
  nom: string
  forme_juridique: string | null
  adresse: string | null
  actif: boolean
}

interface SiretCabinetFormProps {
  value: CabinetData
  onChange: (next: CabinetData) => void
  disabled?: boolean
}

const DEBOUNCE_MS = 300
const MIN_QUERY = 3

export default function SiretCabinetForm({
  value,
  onChange,
  disabled,
}: SiretCabinetFormProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SireneResult[]>([])
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [hasSelected, setHasSelected] = useState(!!value.siret)

  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY) {
      setResults([])
      setApiError(null)
      setLoading(false)
      return
    }

    debounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setApiError(null)
      try {
        const res = await fetch(
          `/api/auth/sirene-search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        if (!res.ok) {
          setApiError(json.error ?? 'API indisponible')
          setResults([])
        } else {
          setResults((json.results as SireneResult[]) ?? [])
          setShowDropdown(true)
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setApiError('Erreur réseau (saisie manuelle possible)')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelect = (r: SireneResult) => {
    onChange({
      name: r.nom,
      siret: r.siret,
      forme_juridique: r.forme_juridique,
      adresse: r.adresse,
    })
    setHasSelected(true)
    setShowDropdown(false)
    setQuery('')
    setResults([])
  }

  const handleManualName = (newName: string) => {
    onChange({ ...value, name: newName })
  }

  const handleReset = () => {
    onChange({ name: '', siret: null, forme_juridique: null, adresse: null })
    setHasSelected(false)
    setQuery('')
    setResults([])
  }

  return (
    <div className="space-y-3">
      {/* Recherche auto-complétion */}
      {!hasSelected && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rechercher votre cabinet
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowDropdown(true)}
              disabled={disabled}
              autoComplete="off"
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent disabled:opacity-60"
              placeholder="Nom du cabinet ou SIRET (14 chiffres)"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>

          {showDropdown && results.length > 0 && (
            <ul className="mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
              {results.map((r) => (
                <li key={r.siret}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    disabled={!r.actif}
                    className="w-full text-left p-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 mt-1 text-[#2D1B96] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {r.nom || '(nom non renseigné)'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {r.forme_juridique
                            ? `${r.forme_juridique} · `
                            : ''}
                          SIRET {r.siret}
                          {!r.actif && ' · ⚠️ Inactif'}
                        </p>
                        {r.adresse && (
                          <p className="text-xs text-gray-500 truncate">
                            {r.adresse}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showDropdown &&
            !loading &&
            query.trim().length >= MIN_QUERY &&
            results.length === 0 &&
            !apiError && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                Aucun résultat. Vous pouvez saisir le nom de votre cabinet
                manuellement ci-dessous.
              </div>
            )}

          {apiError && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                {apiError} Vous pouvez saisir le nom de votre cabinet
                manuellement ci-dessous.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Résultat sélectionné OU saisie manuelle */}
      {hasSelected && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-900">{value.name}</p>
                {value.forme_juridique && (
                  <p className="text-emerald-800">{value.forme_juridique}</p>
                )}
                {value.siret && (
                  <p className="text-emerald-700 text-xs">
                    SIRET {value.siret}
                  </p>
                )}
                {value.adresse && (
                  <p className="text-emerald-700 text-xs">{value.adresse}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={disabled}
              className="text-xs text-emerald-700 underline hover:text-emerald-900"
            >
              Modifier
            </button>
          </div>
        </div>
      )}

      {/* Champ nom — toujours éditable, pré-rempli si sélection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nom du cabinet
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={value.name}
            onChange={(e) => handleManualName(e.target.value)}
            disabled={disabled}
            required
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent disabled:opacity-60"
            placeholder="Ex : Cabinet Dupont"
          />
        </div>
      </div>
    </div>
  )
}
