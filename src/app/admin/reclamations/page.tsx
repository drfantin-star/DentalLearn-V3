'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquareWarning,
  Loader2,
  Mail,
  Calendar,
  ChevronRight,
  Filter,
} from 'lucide-react'

type ComplaintStatus = 'nouvelle' | 'en_cours' | 'resolue' | 'close'
type CategorieValue =
  | 'contenu_pedagogique'
  | 'facturation'
  | 'technique'
  | 'accessibilite'
  | 'autre'

interface Complaint {
  id: string
  user_id: string | null
  email_contact: string
  nom_contact: string | null
  sujet: string
  categorie: CategorieValue
  message: string
  status: ComplaintStatus
  admin_response: string | null
  admin_note: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  nouvelle: 'Nouvelle',
  en_cours: 'En cours',
  resolue: 'Résolue',
  close: 'Close',
}

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  nouvelle: 'bg-red-100 text-red-700 border-red-200',
  en_cours: 'bg-amber-100 text-amber-700 border-amber-200',
  resolue: 'bg-green-100 text-green-700 border-green-200',
  close: 'bg-gray-100 text-gray-600 border-gray-200',
}

const CATEGORIE_LABELS: Record<CategorieValue, string> = {
  contenu_pedagogique: 'Contenu pédagogique',
  facturation: 'Facturation',
  technique: 'Technique',
  accessibilite: 'Accessibilité',
  autre: 'Autre',
}

export default function AdminReclamationsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all')

  useEffect(() => {
    loadComplaints()
  }, [])

  const loadComplaints = async () => {
    try {
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      setComplaints((data || []) as Complaint[])
    } catch (err: any) {
      console.error('Erreur load complaints:', err)
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const filtered = statusFilter === 'all'
    ? complaints
    : complaints.filter(c => c.status === statusFilter)

  const counts = {
    all: complaints.length,
    nouvelle: complaints.filter(c => c.status === 'nouvelle').length,
    en_cours: complaints.filter(c => c.status === 'en_cours').length,
    resolue: complaints.filter(c => c.status === 'resolue').length,
    close: complaints.filter(c => c.status === 'close').length,
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#2D1B96]/10 flex items-center justify-center">
            <MessageSquareWarning className="w-5 h-5 text-[#2D1B96]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Réclamations</h1>
            <p className="text-sm text-gray-500">
              Indicateur Qualiopi #31 — Suivi du traitement des réclamations
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filtres status */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <FilterChip
          label="Toutes"
          count={counts.all}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <FilterChip
          label="Nouvelles"
          count={counts.nouvelle}
          active={statusFilter === 'nouvelle'}
          onClick={() => setStatusFilter('nouvelle')}
          highlight
        />
        <FilterChip
          label="En cours"
          count={counts.en_cours}
          active={statusFilter === 'en_cours'}
          onClick={() => setStatusFilter('en_cours')}
        />
        <FilterChip
          label="Résolues"
          count={counts.resolue}
          active={statusFilter === 'resolue'}
          onClick={() => setStatusFilter('resolue')}
        />
        <FilterChip
          label="Closes"
          count={counts.close}
          active={statusFilter === 'close'}
          onClick={() => setStatusFilter('close')}
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <MessageSquareWarning className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune réclamation dans cette catégorie</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {filtered.map((c, idx) => (
            <Link
              key={c.id}
              href={`/admin/reclamations/${c.id}`}
              className={`block px-5 py-4 hover:bg-gray-50 transition-colors ${
                idx > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status */}
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${STATUS_COLORS[c.status]}`}
                >
                  {STATUS_LABELS[c.status]}
                </span>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {c.sujet}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {CATEGORIE_LABELS[c.categorie]} ·{' '}
                    {c.nom_contact || c.email_contact}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {c.email_contact}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  highlight,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-[#2D1B96] text-white border-[#2D1B96]'
          : highlight && count > 0
            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label} <span className="ml-1 opacity-70">({count})</span>
    </button>
  )
}
