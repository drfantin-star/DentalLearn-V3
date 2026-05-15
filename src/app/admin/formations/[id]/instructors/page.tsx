'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Shield,
  UserPlus,
  Trash2,
  Star,
  Users as UsersIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface FormationHeader {
  id: string
  title: string
  slug: string
  owner_org_id: string | null
}

interface InstructorRow {
  id: string
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  is_primary: boolean
  assigned_at: string
}

interface AvailableFormateur {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

function nameOf(p: { first_name: string | null; last_name: string | null; email: string | null }) {
  const f = [p.first_name, p.last_name].filter(Boolean).join(' ')
  return f || p.email || '—'
}

function initialsOf(p: { first_name: string | null; last_name: string | null; email: string | null }) {
  const f = (p.first_name ?? '').trim()
  const l = (p.last_name ?? '').trim()
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
  return (p.email ?? '?').charAt(0).toUpperCase()
}

export default function FormationInstructorsPage() {
  const params = useParams()
  const formationId = params.id as string
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  const [formation, setFormation] = useState<FormationHeader | null>(null)
  const [instructors, setInstructors] = useState<InstructorRow[]>([])
  const [available, setAvailable] = useState<AvailableFormateur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [selectedUserId, setSelectedUserId] = useState('')
  const [newIsPrimary, setNewIsPrimary] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busyRow, setBusyRow] = useState<string | null>(null)

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
  }, [authorized, formationId])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [instructorsRes, availableRes] = await Promise.all([
        fetch(`/api/admin/formations/${formationId}/instructors`),
        fetch(`/api/admin/formateurs?available_for=${formationId}`),
      ])
      const instructorsJson = await instructorsRes.json()
      const availableJson = await availableRes.json()
      if (!instructorsRes.ok) throw new Error(instructorsJson.error || 'Erreur de chargement')
      if (!availableRes.ok) throw new Error(availableJson.error || 'Erreur de chargement')
      setFormation(instructorsJson.formation as FormationHeader)
      setInstructors(instructorsJson.instructors ?? [])
      setAvailable(availableJson.formateurs ?? [])
      setSelectedUserId('')
      setNewIsPrimary(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const currentPrimary = useMemo(
    () => instructors.find((i) => i.is_primary) ?? null,
    [instructors]
  )

  const showFlash = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 3000)
  }

  const handleAdd = async () => {
    if (!selectedUserId) return

    if (newIsPrimary && currentPrimary) {
      const ok = confirm(
        `${nameOf(currentPrimary)} est actuellement intervenant principal. ` +
        `Confirmer le transfert du statut principal au nouvel intervenant ?`
      )
      if (!ok) return
    }

    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/formations/${formationId}/instructors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId, is_primary: newIsPrimary }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur lors du rattachement')
      showFlash('Intervenant rattaché.')
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du rattachement')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (row: InstructorRow) => {
    if (!confirm(
      `Retirer ${nameOf(row)} de cette formation ? Le rôle global formateur est conservé.`
    )) return
    setBusyRow(row.user_id)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/formations/${formationId}/instructors/${row.user_id}`,
        { method: 'DELETE' }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erreur lors du retrait')
      showFlash('Intervenant retiré.')
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du retrait')
    } finally {
      setBusyRow(null)
    }
  }

  const handleTogglePrimary = async (row: InstructorRow) => {
    const targetValue = !row.is_primary
    if (targetValue && currentPrimary && currentPrimary.user_id !== row.user_id) {
      const ok = confirm(
        `${nameOf(currentPrimary)} est actuellement intervenant principal. ` +
        `Transférer ce statut à ${nameOf(row)} ?`
      )
      if (!ok) return
    }
    setBusyRow(row.user_id)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/formations/${formationId}/instructors/${row.user_id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_primary: targetValue }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erreur lors de la mise à jour')
      showFlash(targetValue ? 'Intervenant principal défini.' : 'Statut principal retiré.')
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour')
    } finally {
      setBusyRow(null)
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

  if (loading || !formation) {
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

  return (
    <div className="p-8 max-w-5xl">
      <nav className="text-sm text-gray-500 mb-4 flex items-center gap-2 flex-wrap">
        <Link href="/admin/formations" className="hover:text-gray-700">
          Formations
        </Link>
        <span>/</span>
        <Link href={`/admin/formations/${formation.id}`} className="hover:text-gray-700">
          {formation.title}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Intervenants</span>
      </nav>

      <Link
        href={`/admin/formations/${formation.id}`}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la formation
      </Link>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <UsersIcon className="w-7 h-7 text-[#2D1B96]" />
          Intervenants
        </h1>
        <p className="text-gray-600 mt-2">
          <span className="font-medium text-gray-800">{formation.title}</span>{' '}
          · <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{formation.slug}</code>
          {formation.owner_org_id && (
            <span className="text-xs text-gray-500 ml-2">org : {formation.owner_org_id}</span>
          )}
        </p>
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

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Intervenants actuels ({instructors.length})
          </h2>
        </div>
        {instructors.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Aucun intervenant rattaché pour le moment. Ajoutez-en un ci-dessous.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Formateur
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Principal
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {instructors.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2D1B96] text-white flex items-center justify-center font-semibold text-sm">
                        {initialsOf(row)}
                      </div>
                      <Link
                        href={`/admin/formateurs/${row.user_id}`}
                        className="font-medium text-gray-900 hover:text-[#2D1B96]"
                      >
                        {nameOf(row)}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 text-sm">{row.email ?? '—'}</td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleTogglePrimary(row)}
                      disabled={busyRow === row.user_id}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                        row.is_primary
                          ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-800'
                      }`}
                      title={row.is_primary ? 'Retirer le statut principal' : 'Marquer comme principal'}
                    >
                      <Star className={`w-3 h-3 ${row.is_primary ? 'fill-current' : ''}`} />
                      {row.is_primary ? 'Principal' : 'Marquer principal'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemove(row)}
                        disabled={busyRow === row.user_id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Retirer de la formation"
                      >
                        {busyRow === row.user_id ? (
                          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#2D1B96]" />
          Ajouter un intervenant
        </h2>

        {available.length === 0 ? (
          <div className="text-sm text-gray-600">
            Aucun formateur disponible n'est non rattaché à cette formation. Pour ajouter un
            nouveau formateur,{' '}
            <Link href="/admin/formateurs/promote" className="text-[#2D1B96] underline">
              promouvez d'abord un utilisateur
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Formateur à rattacher
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
              >
                <option value="">— Choisir un formateur —</option>
                {available.map((f) => (
                  <option key={f.user_id} value={f.user_id}>
                    {nameOf(f)} ({f.email ?? 'sans email'})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newIsPrimary}
                onChange={(e) => setNewIsPrimary(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#2D1B96] focus:ring-[#2D1B96]"
              />
              Marquer comme intervenant principal
              {currentPrimary && newIsPrimary && (
                <span className="text-xs text-amber-700">
                  (remplace {nameOf(currentPrimary)})
                </span>
              )}
            </label>
            <Button
              variant="primary"
              size="lg"
              onClick={handleAdd}
              disabled={!selectedUserId || adding}
            >
              <UserPlus className="w-4 h-4" />
              {adding ? 'Rattachement…' : 'Rattacher'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
