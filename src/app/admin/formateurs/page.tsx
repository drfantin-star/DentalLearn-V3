'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserCheck, UserPlus, Shield, ChevronRight, UserX, Eye } from 'lucide-react'

interface FormateurRow {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  promoted_at: string | null
  formations_count: number
}

function initialsOf(first: string | null, last: string | null, email: string | null) {
  const f = (first ?? '').trim()
  const l = (last ?? '').trim()
  if (f || l) {
    return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
  }
  return (email ?? '?').charAt(0).toUpperCase()
}

export default function AdminFormateursPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [formateurs, setFormateurs] = useState<FormateurRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [demoting, setDemoting] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      const { data: isSA } = await supabase.rpc('is_super_admin', {
        p_user_id: session.user.id,
      })
      if (cancelled) return
      setAuthorized(!!isSA)
      setAuthChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    if (!authorized) return
    void loadFormateurs()
  }, [authorized])

  const loadFormateurs = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/formateurs')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setFormateurs(json.formateurs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleDemote = async (userId: string, fullName: string) => {
    if (!confirm(
      `Rétrograder ${fullName} ? Le user perdra l'accès à l'espace formateur. ` +
      `Les rattachements aux formations restent en place (vous pouvez les retirer ` +
      `manuellement via la page intervenants de chaque formation).`
    )) return

    setDemoting(userId)
    try {
      const res = await fetch(`/api/admin/formateurs/${userId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de rétrogradation')
      setFlash(`${fullName} a été rétrogradé.`)
      setTimeout(() => setFlash(null), 3000)
      void loadFormateurs()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur de rétrogradation')
    } finally {
      setDemoting(null)
    }
  }

  const formattedDate = useMemo(
    () => (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '—',
    []
  )

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2D1B96]" />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600">Cette page est réservée aux super-admins.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-[#2D1B96]" />
            Formateurs
          </h1>
          <p className="text-gray-600 mt-1">
            Animateurs masterclass live et formations présentielles
          </p>
        </div>
        <Link
          href="/admin/formateurs/promote"
          className="flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Promouvoir un utilisateur
        </Link>
      </div>

      {flash && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-4">
          {flash}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]" />
        </div>
      ) : formateurs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Aucun formateur pour le moment.</p>
          <Link
            href="/admin/formateurs/promote"
            className="inline-flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl"
          >
            <UserPlus className="w-5 h-5" />
            Promouvoir le premier formateur
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Formateur</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Promotion</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Formations rattachées</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {formateurs.map((f) => {
                const fullName = [f.first_name, f.last_name].filter(Boolean).join(' ') || '—'
                const initials = initialsOf(f.first_name, f.last_name, f.email)
                return (
                  <tr key={f.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/formateurs/${f.user_id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-[#2D1B96] text-white flex items-center justify-center font-semibold text-sm">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-[#2D1B96]">
                            {fullName}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{f.email ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{formattedDate(f.promoted_at)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {f.formations_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled
                          className="p-2 text-gray-300 rounded-lg cursor-not-allowed"
                          title="Profil public formateur — disponible en T6"
                          aria-label="Voir profil public (bientôt disponible)"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <Link
                          href={`/admin/formateurs/${f.user_id}`}
                          className="p-2 text-[#2D1B96] hover:bg-[#2D1B96]/10 rounded-lg"
                          title="Voir détails"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDemote(f.user_id, fullName)}
                          disabled={demoting === f.user_id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          title="Rétrograder"
                          aria-label={`Rétrograder ${fullName}`}
                        >
                          {demoting === f.user_id ? (
                            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <UserX className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
