'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronRight, Building2, Shield } from 'lucide-react'

type OrgType = 'cabinet' | 'hr_entity' | 'training_org'
type OrgPlan = 'standard' | 'premium'

interface OrgRow {
  id: string
  name: string
  type: OrgType
  plan: OrgPlan
  active_members_count: number
  created_at: string
}

const TYPE_LABEL: Record<OrgType, string> = {
  cabinet: 'Cabinet',
  hr_entity: 'Entité RH',
  training_org: 'Organisme de formation',
}

const TYPE_BADGE: Record<OrgType, string> = {
  cabinet: 'bg-blue-100 text-blue-800',
  hr_entity: 'bg-purple-100 text-purple-800',
  training_org: 'bg-green-100 text-green-800',
}

const PLAN_LABEL: Record<OrgPlan, string> = {
  standard: 'Standard',
  premium: 'Premium',
}

const PLAN_BADGE: Record<OrgPlan, string> = {
  standard: 'bg-gray-100 text-gray-700',
  premium: 'bg-amber-100 text-amber-800',
}

export default function OrganizationsPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [organizations, setOrganizations] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'' | OrgType>('')
  const [planFilter, setPlanFilter] = useState<'' | OrgPlan>('')

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
    void loadOrganizations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, typeFilter, planFilter])

  const loadOrganizations = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (planFilter) params.set('plan', planFilter)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/admin/organizations${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setOrganizations(json.organizations ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const formattedDate = useMemo(
    () =>
      (iso: string) => new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
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
            <Building2 className="w-8 h-8 text-[#2D1B96]" />
            Organisations
          </h1>
          <p className="text-gray-600 mt-1">Cabinets, entités RH et organismes de formation</p>
        </div>
        <Link
          href="/admin/organizations/new"
          className="flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvelle organisation
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as '' | OrgType)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tous</option>
            <option value="cabinet">Cabinet</option>
            <option value="hr_entity">Entité RH</option>
            <option value="training_org">Organisme de formation</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as '' | OrgPlan)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tous</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]" />
        </div>
      ) : organizations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500 mb-4">Aucune organisation</p>
          <Link
            href="/admin/organizations/new"
            className="inline-flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl"
          >
            <Plus className="w-5 h-5" />
            Créer une première organisation
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Nom</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Plan</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Membres actifs</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Création</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{org.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_BADGE[org.type]}`}>
                      {TYPE_LABEL[org.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${PLAN_BADGE[org.plan]}`}>
                      {PLAN_LABEL[org.plan]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{org.active_members_count}</td>
                  <td className="px-6 py-4 text-gray-600">{formattedDate(org.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="p-2 text-[#2D1B96] hover:bg-[#2D1B96]/10 rounded-lg"
                        title="Voir détails"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
