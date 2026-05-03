'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, Ban } from 'lucide-react'
import { INTRA_ROLE_LABELS } from '@/lib/auth/intra-role-matrix'
import type { IntraRole } from '@/lib/auth/rbac'

type MembershipStatus = 'active' | 'invited' | 'revoked'

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

export default function TenantMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRevoked, setShowRevoked] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tenant/members')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setMembers(json.members ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleRevoke = async (memberId: string) => {
    if (!confirm("Révoquer ce membre ? Il perdra l'accès à l'organisation.")) return
    try {
      const res = await fetch(`/api/tenant/members/${memberId}`, {
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

  const visibleMembers = members.filter((m) =>
    showRevoked ? true : m.status !== 'revoked'
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Membres</h1>
          <p className="text-gray-600 mt-1">
            Gestion des membres de votre organisation.
          </p>
        </div>
        <Link
          href="/tenant/admin/members/invite"
          className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--tenant-primary)' }}
        >
          <UserPlus className="w-5 h-5" />
          Inviter un membre
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={(e) => setShowRevoked(e.target.checked)}
          />
          Afficher les membres révoqués
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--tenant-primary)]" />
        </div>
      ) : visibleMembers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500">Aucun membre à afficher.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Prénom</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Nom</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Rôle</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date d'adhésion</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleMembers.map((m) => {
                const joined = m.joined_at ?? m.created_at
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{m.first_name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-900">{m.last_name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-700">{m.email ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {INTRA_ROLE_LABELS[m.intra_role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[m.status]}`}>
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(joined).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        {m.status !== 'revoked' && (
                          <button
                            onClick={() => handleRevoke(m.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Révoquer"
                          >
                            <Ban className="w-5 h-5" />
                          </button>
                        )}
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
