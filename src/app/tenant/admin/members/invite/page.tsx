'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus } from 'lucide-react'
import {
  INTRA_ROLES_BY_ORG_TYPE,
  INTRA_ROLE_LABELS,
} from '@/lib/auth/intra-role-matrix'
import type { IntraRole, OrgType } from '@/lib/auth/rbac'

interface MembersResponse {
  org: { id: string; name: string; type: OrgType; plan: string }
}

export default function TenantInviteMemberPage() {
  const router = useRouter()
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
      try {
        const res = await fetch('/api/tenant/members')
        const json = (await res.json()) as MembersResponse
        if (!res.ok) throw new Error((json as unknown as { error?: string }).error || 'Erreur de chargement')
        if (cancelled) return
        setOrgType(json.org.type)
        setOrgName(json.org.name)
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

  const allowedRoles: readonly IntraRole[] = orgType ? INTRA_ROLES_BY_ORG_TYPE[orgType] : []

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
      const res = await fetch('/api/tenant/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), intra_role: intraRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erreur d'invitation")
      router.push('/tenant/admin/members')
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'invitation")
      setSubmitting(false)
    }
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
    <div className="p-8 max-w-2xl">
      <Link
        href="/tenant/admin/members"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux membres
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
        <UserPlus className="w-8 h-8" style={{ color: 'var(--tenant-primary)' }} />
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            placeholder="ex: dr.martin@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            Si l'utilisateur n'a pas de compte, une invitation lui sera envoyée par email.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
          <select
            value={intraRole}
            onChange={(e) => setIntraRole(e.target.value as IntraRole | '')}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
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
            href="/tenant/admin/members"
            className="px-6 py-3 rounded-xl text-gray-700 hover:bg-gray-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="text-white px-6 py-3 rounded-xl font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--tenant-primary)' }}
          >
            {submitting ? 'Envoi…' : 'Inviter'}
          </button>
        </div>
      </form>
    </div>
  )
}
