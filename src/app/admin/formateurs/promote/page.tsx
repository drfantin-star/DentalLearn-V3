'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, UserPlus, UserX, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Candidate {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  is_formateur: boolean
  formations_count: number
}

const MIN_CHARS = 2
const DEBOUNCE_MS = 300

function displayName(u: Candidate): string {
  const full = [u.first_name, u.last_name]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
  if (full) return full
  // Fallback préfixe email (cohérent avec la règle display_name).
  const email = (u.email ?? '').trim()
  if (email) return email.split('@')[0]
  return '—'
}

function initialsOf(u: Candidate): string {
  const f = (u.first_name ?? '').trim()
  const l = (u.last_name ?? '').trim()
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
  return (u.email ?? '?').charAt(0).toUpperCase()
}

export default function PromoteFormateurPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const term = query.trim()

    if (term.length < MIN_CHARS) {
      abortRef.current?.abort()
      setResults([])
      setSearched(false)
      setSearching(false)
      setError(null)
      return
    }

    setSearching(true)
    const handle = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `/api/admin/formateurs/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de recherche')
        setResults((json.users ?? []) as Candidate[])
        setError(null)
        setSearched(true)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Erreur de recherche')
        setResults([])
        setSearched(true)
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [query])

  const showFlash = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 3000)
  }

  const handlePromote = async (u: Candidate) => {
    if (!confirm(`Promouvoir ${displayName(u)} au rôle formateur ?`)) return
    setPending(u.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/formateurs/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de promotion')
      setResults((prev) =>
        prev.map((r) => (r.id === u.id ? { ...r, is_formateur: true } : r))
      )
      showFlash(`${displayName(u)} est désormais formateur.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de promotion')
    } finally {
      setPending(null)
    }
  }

  const handleDemote = async (u: Candidate) => {
    if (
      !confirm(
        `Retirer le rôle formateur à ${displayName(u)} ? Il perdra l'accès ` +
          `à l'espace formateur et ses rattachements aux formations seront retirés.`
      )
    )
      return
    setPending(u.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/formateurs/${u.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de rétrogradation')
      setResults((prev) =>
        prev.map((r) =>
          r.id === u.id ? { ...r, is_formateur: false, formations_count: 0 } : r
        )
      )
      showFlash(`${displayName(u)} n'est plus formateur.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de rétrogradation')
    } finally {
      setPending(null)
    }
  }

  const tooShort = query.trim().length > 0 && query.trim().length < MIN_CHARS

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        backHref="/admin/formateurs"
        backLabel="Retour aux formateurs"
        title="Rechercher un utilisateur"
        className="mb-2"
      />
      <p className="text-gray-600 mb-8">
        Recherchez un utilisateur par email, prénom ou nom, puis attribuez-lui
        (ou retirez-lui) le rôle <strong>formateur</strong>.
      </p>

      <Card className="p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email, prénom ou nom
        </label>
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex : Dupont, marie, exemple@dentalschool.fr"
            autoFocus
            className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {tooShort && (
          <p className="text-xs text-gray-500 mt-2">
            Saisissez au moins {MIN_CHARS} caractères.
          </p>
        )}
      </Card>

      {flash && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{flash}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {searching && (
        <div className="flex items-center gap-3 text-gray-500 py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          <span>Recherche…</span>
        </div>
      )}

      {!searching && searched && results.length === 0 && !error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Aucun résultat</p>
              <p className="text-sm">
                Aucun utilisateur ne correspond à «&nbsp;{query.trim()}&nbsp;».
                S'il n'a pas encore de compte, demandez-lui de s'inscrire sur{' '}
                <a
                  href="https://app.dentalschool.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  app.dentalschool.fr
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-3">
          {results.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-semibold flex-shrink-0">
                  {initialsOf(u)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">
                      {displayName(u)}
                    </span>
                    {u.is_formateur ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Formateur
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Utilisateur
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{u.email ?? '—'}</p>
                </div>
                <div className="flex-shrink-0">
                  {u.is_formateur ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDemote(u)}
                      loading={pending === u.id}
                    >
                      <UserX className="w-4 h-4" />
                      Retirer le rôle
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePromote(u)}
                      loading={pending === u.id}
                    >
                      <UserPlus className="w-4 h-4" />
                      Promouvoir formateur
                    </Button>
                  )}
                </div>
              </div>
              {u.is_formateur && (
                <Link
                  href={`/admin/formateurs/${u.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary mt-3 ml-[3.75rem] hover:underline"
                >
                  <Info className="w-3.5 h-3.5" />
                  Voir son profil formateur ({u.formations_count} formation
                  {u.formations_count > 1 ? 's' : ''})
                </Link>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
