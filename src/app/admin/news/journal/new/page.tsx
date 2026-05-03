'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  JOURNAL_MAX_SYNTHESES,
  JOURNAL_MIN_SYNTHESES,
  NEWS_SPECIALITE_LABELS,
} from '@/lib/constants/news'

// Création d'un journal hebdo (T11) — stepper 1 page :
//   1. Sélectionner 3 à 6 synthèses dans la liste des synthèses actives
//   2. Réordonner via boutons ↑/↓ (dette D-T11-01 : pas de drag-and-drop
//      car aucune lib installée et contrainte "pas de nouvelle dépendance")
//   3. Soumettre → POST /api/admin/news/journal puis redirect vers la
//      page de détail pour générer script + audio

interface SynthesisRow {
  id: string
  display_title: string | null
  specialite: string | null
  created_at: string
  published_at: string | null
}

function getCurrentIsoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export default function AdminJournalNewPage() {
  const router = useRouter()
  const currentWeek = useMemo(() => getCurrentIsoWeek(), [])

  const [syntheses, setSyntheses] = useState<SynthesisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Liste ordonnée des synthesis_id sélectionnés (l'ordre = position 1..N).
  const [selected, setSelected] = useState<string[]>([])

  // Détecte si un journal non-archivé existe déjà pour la semaine courante.
  const [existingForWeek, setExistingForWeek] = useState<{ id: string } | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ----- Chargement initial -----
  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/api/admin/news/syntheses?limit=50&status=active'),
      fetch('/api/admin/news/journal'),
    ])
      .then(async ([sRes, jRes]) => {
        if (!sRes.ok) {
          const body = await sRes.json().catch(() => ({}))
          throw new Error(body?.error ?? `HTTP ${sRes.status} (synthèses)`)
        }
        const sJson = await sRes.json()
        const jJson = jRes.ok ? await jRes.json() : { data: [] }

        if (cancelled) return

        // L'endpoint /api/admin/news/syntheses retourne { syntheses, total,
        // page, limit, total_pages } — voir src/app/api/admin/news/syntheses/route.ts.
        // (Confusion possible avec /api/admin/news/journal qui lui retourne
        // { data: journals } — clés différentes.)
        const rows = Array.isArray(sJson?.syntheses) ? (sJson.syntheses as SynthesisRow[]) : []
        setSyntheses(rows)

        const journals: Array<{ id: string; week_iso: string | null; status: string }> =
          Array.isArray(jJson?.data) ? jJson.data : []
        const conflict = journals.find(
          (j) => j.week_iso === currentWeek && j.status !== 'archived',
        )
        setExistingForWeek(conflict ? { id: conflict.id } : null)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Erreur de chargement')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentWeek])

  // ----- Helpers sélection -----
  const isSelected = (id: string) => selected.includes(id)

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= JOURNAL_MAX_SYNTHESES) return prev
      return [...prev, id]
    })
  }

  const moveUp = (idx: number) => {
    if (idx <= 0) return
    setSelected((prev) => {
      const next = prev.slice()
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx: number) => {
    setSelected((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = prev.slice()
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const remove = (id: string) => {
    setSelected((prev) => prev.filter((x) => x !== id))
  }

  // ----- Soumission -----
  const canSubmit =
    selected.length >= JOURNAL_MIN_SYNTHESES &&
    selected.length <= JOURNAL_MAX_SYNTHESES &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/admin/news/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ synthesis_ids: selected, week_iso: currentWeek }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      router.push(`/admin/news/journal/${body.episode_id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur création')
      setSubmitting(false)
    }
  }

  // ----- Lookup synthèses sélectionnées -----
  const synthesisById = useMemo(() => {
    const map = new Map<string, SynthesisRow>()
    for (const s of syntheses) map.set(s.id, s)
    return map
  }, [syntheses])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Nouveau journal — {currentWeek}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Sélectionnez {JOURNAL_MIN_SYNTHESES} à {JOURNAL_MAX_SYNTHESES} synthèses,
            puis ordonnez-les avec les boutons ↑/↓.
          </p>
        </div>
        <Link
          href="/admin/news/journal"
          className="text-sm text-gray-600 hover:underline"
        >
          ← Retour à la liste
        </Link>
      </div>

      {existingForWeek && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-amber-800 text-sm">
          ⚠️ Un journal non-archivé existe déjà pour la semaine {currentWeek}.
          La création échouera tant qu'il n'est pas archivé —{' '}
          <Link
            href={`/admin/news/journal/${existingForWeek.id}`}
            className="underline font-medium"
          >
            ouvrir le journal existant
          </Link>
          .
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-red-700 text-sm">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---------- Catalogue des synthèses ---------- */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Synthèses actives</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              50 plus récentes — cliquez pour ajouter au journal.
            </p>
          </div>
          {loading ? (
            <div className="p-6 flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#2D1B96]" />
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {syntheses.length === 0 && (
                <p className="p-6 text-sm text-gray-500">
                  Aucune synthèse active disponible.
                </p>
              )}
              {syntheses.map((s) => {
                const checked = isSelected(s.id)
                const disabled =
                  !checked && selected.length >= JOURNAL_MAX_SYNTHESES
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    disabled={disabled}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-3 ${
                      checked ? 'bg-violet-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      className="mt-1 accent-[#2D1B96]"
                    />
                    <div className="flex-1 min-w-0">
                      {s.specialite && (
                        <span className="inline-block text-[10px] font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5 mr-2">
                          {NEWS_SPECIALITE_LABELS[s.specialite] ?? s.specialite}
                        </span>
                      )}
                      <p className="text-sm text-gray-800 mt-1 leading-snug">
                        {s.display_title ?? '(sans titre)'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ---------- Liste sélection ordonnée ---------- */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Au sommaire — {selected.length} / {JOURNAL_MAX_SYNTHESES}
            </h2>
            <span className="text-xs text-gray-500">
              {selected.length < JOURNAL_MIN_SYNTHESES
                ? `${JOURNAL_MIN_SYNTHESES - selected.length} de plus minimum`
                : 'OK'}
            </span>
          </div>
          <div className="p-4 space-y-2 min-h-[200px]">
            {selected.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                Cliquez sur une synthèse à gauche pour l'ajouter ici.
              </p>
            )}
            {selected.map((id, idx) => {
              const s = synthesisById.get(id)
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
                >
                  <span className="text-violet-700 font-bold text-sm w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    {s?.specialite && (
                      <span className="inline-block text-[9px] font-bold text-violet-700 bg-violet-100 rounded-full px-1.5 py-0.5 mr-1">
                        {NEWS_SPECIALITE_LABELS[s.specialite] ?? s.specialite}
                      </span>
                    )}
                    <span className="text-xs text-gray-800">
                      {s?.display_title ?? id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    aria-label="Monter"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === selected.length - 1}
                    className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="p-1 text-red-500 hover:text-red-700"
                    aria-label="Retirer"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-4 text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-[#2D1B96] hover:bg-[#231575] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          {submitting ? 'Création…' : 'Créer le journal (draft)'}
        </button>
      </div>
    </div>
  )
}
