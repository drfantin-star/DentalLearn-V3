'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Shield } from 'lucide-react'

type OrgType = 'cabinet' | 'hr_entity' | 'training_org'
type OrgPlan = 'standard' | 'premium'

export default function NewOrganizationPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<OrgType>('cabinet')
  const [plan, setPlan] = useState<OrgPlan>('standard')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, plan }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de création')
      router.push(`/admin/organizations/${json.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de création')
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

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux organisations
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Nouvelle organisation</h1>
      <p className="text-gray-600 mb-8">
        Le membre admin pourra être invité après la création.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
            placeholder="ex: Cabinet Dr. Dupont"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as OrgType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
          >
            <option value="cabinet">Cabinet</option>
            <option value="hr_entity">Entité RH</option>
            <option value="training_org">Organisme de formation</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Le type est immuable après création.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as OrgPlan)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]"
          >
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            href="/admin/organizations"
            className="px-6 py-3 rounded-xl text-gray-700 hover:bg-gray-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
