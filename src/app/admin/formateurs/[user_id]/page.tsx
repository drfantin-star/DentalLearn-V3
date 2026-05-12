'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Shield, UserX, Star, ExternalLink, MapPin } from 'lucide-react'

interface FormationLink {
  formation_id: string
  title: string
  slug: string
  cover_image_url: string | null
  is_primary: boolean
  assigned_at: string
}

interface FormateurDetail {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  profile_photo_url: string | null
  city: string | null
  promoted_at: string
  formations: FormationLink[]
}

function initialsOf(d: FormateurDetail): string {
  const f = (d.first_name ?? '').trim()
  const l = (d.last_name ?? '').trim()
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
  return (d.email ?? '?').charAt(0).toUpperCase()
}

export default function FormateurDetailPage() {
  const params = useParams()
  const userId = params.user_id as string
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [formateur, setFormateur] = useState<FormateurDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [demoting, setDemoting] = useState(false)

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
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, userId])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/formateurs/${userId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setFormateur(json.formateur as FormateurDetail)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleDemote = async () => {
    if (!formateur) return
    const fullName = [formateur.first_name, formateur.last_name].filter(Boolean).join(' ') || formateur.email || 'ce formateur'
    if (!confirm(
      `Rétrograder ${fullName} ? Le user perdra l'accès à l'espace formateur. ` +
      `Les rattachements aux formations et l'historique masterclass restent en place.`
    )) return

    setDemoting(true)
    try {
      const res = await fetch(`/api/admin/formateurs/${userId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de rétrogradation')
      router.push('/admin/formateurs')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur de rétrogradation')
      setDemoting(false)
    }
  }

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
        </div>
      </div>
    )
  }

  if (loading || !formateur) {
    return (
      <div className="p-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        ) : (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]" />
          </div>
        )}
      </div>
    )
  }

  const fullName = [formateur.first_name, formateur.last_name].filter(Boolean).join(' ') || '—'

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/admin/formateurs"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux formateurs
      </Link>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-start gap-6">
          {formateur.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={formateur.profile_photo_url}
              alt={fullName}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#2D1B96] text-white flex items-center justify-center font-bold text-2xl flex-shrink-0">
              {initialsOf(formateur)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            <p className="text-gray-600">{formateur.email ?? '—'}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {formateur.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {formateur.city}
                </span>
              )}
              <span>
                Formateur depuis le{' '}
                {new Date(formateur.promoted_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDemote}
            disabled={demoting}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 hover:bg-red-50 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {demoting ? (
              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UserX className="w-4 h-4" />
            )}
            Rétrograder
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Formations rattachées ({formateur.formations.length})
          </h2>
          <p className="text-sm text-gray-500">
            Pour ajouter/retirer un rattachement, ouvrez la page intervenants de la formation
            concernée.
          </p>
        </div>

        {formateur.formations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="mb-3">Aucune formation rattachée à ce formateur.</p>
            <p className="text-sm">
              Il peut néanmoins créer des masterclass autonomes via{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">/formateur/sessions</code>.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Formation
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Rôle</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Rattaché le
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Gérer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {formateur.formations.map((f) => (
                <tr key={f.formation_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {f.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.cover_image_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{f.title}</div>
                        <div className="text-xs text-gray-500">{f.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {f.is_primary ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <Star className="w-3 h-3" />
                        Intervenant principal
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Intervenant</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(f.assigned_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <Link
                        href={`/admin/formations/${f.formation_id}/instructors`}
                        className="inline-flex items-center gap-1 text-sm text-[#2D1B96] hover:underline"
                      >
                        Intervenants
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
