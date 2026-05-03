'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Shield, UserPlus, Save, Ban } from 'lucide-react'
import { INTRA_ROLE_LABELS } from '@/lib/auth/intra-role-matrix'
import type { IntraRole } from '@/lib/auth/rbac'

type OrgType = 'cabinet' | 'hr_entity' | 'training_org'
type OrgPlan = 'standard' | 'premium'
type MembershipStatus = 'active' | 'invited' | 'revoked'
type Tab = 'info' | 'members' | 'content'

interface Organization {
  id: string
  name: string
  type: OrgType
  plan: OrgPlan
  owner_user_id: string
  created_at: string
  updated_at: string
}

interface Member {
  id: string
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  intra_role: IntraRole
  status: MembershipStatus
  joined_at: string | null
  revoked_at: string | null
  created_at: string
}

const TYPE_LABEL: Record<OrgType, string> = {
  cabinet: 'Cabinet',
  hr_entity: 'Entité RH',
  training_org: 'Organisme de formation',
}

const STATUS_BADGE: Record<MembershipStatus, string> = {
  active: 'bg-green-100 text-green-800',
  invited: 'bg-yellow-100 text-yellow-800',
  revoked: 'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<MembershipStatus, string> = {
  active: 'Actif',
  invited: 'Invité',
  revoked: 'Révoqué',
}

export default function OrganizationDetailPage() {
  const params = useParams()
  const orgId = params.id as string
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState<Tab>('info')

  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editPlan, setEditPlan] = useState<OrgPlan>('standard')
  const [savingInfo, setSavingInfo] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

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
  }, [authorized, orgId])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setOrg(json.organization)
      setMembers(json.members ?? [])
      setEditName(json.organization.name)
      setEditPlan(json.organization.plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return
    setSavingInfo(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), plan: editPlan }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de sauvegarde')
      setOrg({ ...org, name: json.name, plan: json.plan, updated_at: json.updated_at })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde')
    } finally {
      setSavingInfo(false)
    }
  }

  const handleRevoke = async (memberId: string) => {
    if (!confirm('Révoquer ce membre ? Il perdra l\'accès à l\'organisation.')) return
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked' }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Erreur lors de la révocation')
        return
      }
      void load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la révocation')
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

  if (loading || !org) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]" />
        </div>
      </div>
    )
  }

  const activeMembers = members.filter((m) => m.status !== 'revoked')

  return (
    <div className="p-8">
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux organisations
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{org.name}</h1>
        <p className="text-gray-600 mt-1">{TYPE_LABEL[org.type]} · Plan {org.plan}</p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-2">
          {[
            { id: 'info' as const, label: 'Informations' },
            { id: 'members' as const, label: `Membres (${activeMembers.length})` },
            { id: 'content' as const, label: 'Contenu' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#2D1B96] text-[#2D1B96]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      {tab === 'info' && (
        <form onSubmit={handleSaveInfo} className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              maxLength={200}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <input
              type="text"
              value={TYPE_LABEL[org.type]}
              disabled
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Le type est immuable.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={editPlan}
              onChange={(e) => setEditPlan(e.target.value as OrgPlan)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
            >
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            {savedFlash && (
              <span className="text-sm text-green-600">Modifications sauvegardées</span>
            )}
            <button
              type="submit"
              disabled={savingInfo}
              className="flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingInfo ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      )}

      {tab === 'members' && (
        <div>
          <div className="flex justify-end mb-4">
            <Link
              href={`/admin/organizations/${orgId}/invite`}
              className="flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Inviter un membre
            </Link>
          </div>
          {activeMembers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <p className="text-gray-500">Aucun membre actif pour cette organisation.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Nom</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Rôle</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Ajouté le</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeMembers.map((m) => {
                    const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ') || '—'
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{fullName}</td>
                        <td className="px-6 py-4 text-gray-700">{m.email ?? '—'}</td>
                        <td className="px-6 py-4 text-gray-700">{INTRA_ROLE_LABELS[m.intra_role]}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[m.status]}`}>
                            {STATUS_LABEL[m.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(m.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => handleRevoke(m.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Révoquer"
                            >
                              <Ban className="w-5 h-5" />
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
      )}

      {tab === 'content' && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500">Disponible en V2</p>
        </div>
      )}
    </div>
  )
}
