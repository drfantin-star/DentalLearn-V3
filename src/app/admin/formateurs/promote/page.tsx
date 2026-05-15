'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface LookupUser {
  id: string
  email: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  is_formateur: boolean
  formations_count: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function initialsOf(u: LookupUser): string {
  const f = (u.first_name ?? '').trim()
  const l = (u.last_name ?? '').trim()
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
  return (u.email ?? '?').charAt(0).toUpperCase()
}

export default function PromoteFormateurPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [user, setUser] = useState<LookupUser | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promoting, setPromoting] = useState(false)

  const emailLooksValid = EMAIL_RE.test(email.trim())

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailLooksValid) return

    setSearching(true)
    setSearched(false)
    setUser(null)
    setNotFound(false)
    setError(null)

    try {
      const res = await fetch(
        `/api/admin/users/lookup?email=${encodeURIComponent(email.trim())}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de recherche')
      if (json.found) {
        setUser(json.user as LookupUser)
      } else {
        setNotFound(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de recherche')
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  const handlePromote = async () => {
    if (!user) return
    setPromoting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/formateurs/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de promotion')
      router.push('/admin/formateurs')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de promotion')
    } finally {
      setPromoting(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        backHref="/admin/formateurs"
        backLabel="Retour aux formateurs"
        title="Promouvoir un utilisateur"
        className="mb-2"
      />
      <p className="text-gray-600 mb-8">
        Recherchez un utilisateur existant par email puis attribuez-lui le rôle{' '}
        <strong>formateur</strong> pour qu'il puisse animer des masterclass et des formations
        présentielles.
      </p>

      <form onSubmit={handleSearch}>
      <Card className="p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email de l'utilisateur
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemple@dentallearn.fr"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
          />
        </div>
        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={!emailLooksValid || searching}
        >
          <Search className="w-4 h-4" />
          {searching ? 'Recherche…' : 'Rechercher'}
        </Button>
      </Card>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {searched && notFound && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Aucun compte trouvé</p>
              <p className="text-sm">
                Cet utilisateur n'a pas de compte DentalLearn. Demandez-lui de
                s'inscrire sur{' '}
                <a
                  href="https://dental-learn-v3.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  dental-learn-v3.vercel.app
                </a>{' '}
                puis revenez ici pour le promouvoir.
              </p>
            </div>
          </div>
        </div>
      )}

      {searched && user && user.is_formateur && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#2D1B96] text-white flex items-center justify-center font-semibold">
              {initialsOf(user)}
            </div>
            <div className="flex-1">
              <p className="font-semibold mb-1">
                {user.full_name ?? user.email} est déjà formateur
              </p>
              <p className="text-sm mb-3">
                Il a actuellement {user.formations_count} formation
                {user.formations_count > 1 ? 's' : ''} rattachée
                {user.formations_count > 1 ? 's' : ''}.
              </p>
              <Link
                href={`/admin/formateurs/${user.id}`}
                className="inline-flex items-center gap-2 text-sm font-medium underline hover:no-underline"
              >
                Voir son profil formateur
              </Link>
            </div>
          </div>
        </div>
      )}

      {searched && user && !user.is_formateur && (
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-[#2D1B96] text-white flex items-center justify-center font-semibold">
              {initialsOf(user)}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.full_name ?? '—'}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 mb-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-600">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p>
              Promouvoir cet utilisateur ne crée que son rôle global. Son profil
              public formateur sera créé lors de sa première visite de{' '}
              <code className="bg-white px-1 py-0.5 rounded text-xs">/formateur/profil</code>.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={handlePromote}
            loading={promoting}
          >
            <UserPlus className="w-4 h-4" />
            Promouvoir au rôle formateur
          </Button>
        </Card>
      )}
    </div>
  )
}
