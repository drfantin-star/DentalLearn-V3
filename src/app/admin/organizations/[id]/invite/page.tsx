'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Shield, UserPlus } from 'lucide-react'
import {
  INTRA_ROLES_BY_ORG_TYPE,
  INTRA_ROLE_LABELS,
} from '@/lib/auth/intra-role-matrix'
import type { IntraRole, OrgType } from '@/lib/auth/rbac'

export default function InviteMemberPage() {
  const params = useParams()
  const orgId = params.id as string
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [orgType, setOrgType] = useState<OrgType | null>(null)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [intraRole, setIntraRole] = useState<IntraRole | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        setOrgType(json.organization.type as OrgType)
        setOrgName(json.organization.name as string)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    })()
  }, [authorized, orgId])

  const allowedRoles: readonly IntraRole[] = orgType
    ? INTRA_ROLES_BY_ORG_TYPE[orgType]
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Email requis')
      return
    }
    if (!intraRole) {
      setError('Rôle requis')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), intra_role: intraRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur d\'invitation')
      router.push(`/admin/organizations/${orgId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur d\'invitation')
      setSubmitting(false)
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href={`/admin/organizations/${orgId}`}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l'organisation
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
        <UserPlus className="w-8 h-8 text-[#2D1B96]" />
        Inviter un membre
      </h1>
      <p className="text-gray-600 mb-8">
        Organisation : <span className="font-medium">{orgName}</span>
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
            placeholder="ex: dr.martin@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            Si l'utilisateur n'a pas de compte, une invitation sera envoyée par email.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
          <select
            value={intraRole}
            onChange={(e) => setIntraRole(e.target.value as IntraRole | '')}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
          >
            <option value="">— Sélectionner —</option>
            {allowedRoles.map((role) => (
              <option key={role} value={role}>
                {INTRA_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            href={`/admin/organizations/${orgId}`}
            className="px-6 py-3 rounded-xl text-gray-700 hover:bg-gray-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Envoi…' : 'Inviter'}
          </button>
        </div>
      </form>
    </div>
  )
}
