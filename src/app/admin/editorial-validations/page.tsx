'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  History,
  Trash2,
  Filter,
  ListChecks,
  Newspaper,
  BookOpen,
  FlaskConical,
  Ban,
  RotateCcw,
  Square,
  CheckSquare,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  useCsMembers,
  useRejectSyntheses,
  useRejectedSyntheses,
  useRestoreSyntheses,
  useRevokeValidation,
  useValidateContent,
  useValidateContentBulk,
  useValidationCandidates,
} from '@/lib/hooks/useEditorialValidations'
import type {
  EditorialContentType,
  EditorialValidation,
  RejectedSynthesis,
  RejectionReason,
  ValidationCandidate,
} from '@/types/editorialValidations'
import { REJECTION_REASONS, rejectionReasonLabel } from '@/types/editorialValidations'

// 'rejected' n'est pas un état de validation mais un état de la synthèse
// elle-même (news_syntheses.status). Il vit dans le même sélecteur parce que,
// du point de vue éditorial, c'est la troisième issue possible d'une relecture :
// je valide, je laisse en attente, je refuse.
type StatusFilter = 'all' | 'unvalidated' | 'stale' | 'valid' | 'rejected'
type TabFilter = 'all' | EditorialContentType
type PublishStatusFilter = 'all' | 'draft' | 'published'

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTimeFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function candidateStatusKey(c: ValidationCandidate): StatusFilter {
  if (!c.current_validation_id) return 'unvalidated'
  if (c.is_stale) return 'stale'
  return 'valid'
}

function StatusBadge({ candidate }: { candidate: ValidationCandidate }) {
  const status = candidateStatusKey(candidate)
  if (status === 'unvalidated') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
        Non validé
      </span>
    )
  }
  if (status === 'stale') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
        <AlertTriangle size={11} />
        Stale
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 size={11} />
      Validée
    </span>
  )
}

function TypeBadge({ type }: { type: EditorialContentType }) {
  if (type === 'formation') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
        <BookOpen size={11} />
        Formation
      </span>
    )
  }
  if (type === 'news_synthesis') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-100 text-sky-700">
        <FlaskConical size={11} />
        Synthèse
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
      <Newspaper size={11} />
      News
    </span>
  )
}

// Pour content_type='news_episode' : la validation se pose desormais via la
// publication de l'episode (fusion validation/publication, route
// episodes/[id]/publish). Le bouton "Valider"/"Re-valider" manuel est donc
// retire pour ces lignes -- mention discrete, pas de bouton actif. Le
// comportement ne change pas pour 'formation' et 'news_synthesis'.
function isEpisodeAutoValidated(candidate: ValidationCandidate): boolean {
  return candidate.content_type === 'news_episode'
}

function DraftBadge({ candidate }: { candidate: ValidationCandidate }) {
  if (candidate.content_type !== 'news_episode' || candidate.episode_status !== 'draft') {
    return null
  }
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
      Brouillon
    </span>
  )
}

export default function AdminEditorialValidationsPage() {
  const [tab, setTab] = useState<TabFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [publishStatusFilter, setPublishStatusFilter] = useState<PublishStatusFilter>('all')

  // Le filtre Publication ne s'applique qu'aux news : on le reset si on passe
  // sur l'onglet Formations.
  // Le filtre Publication ne concerne que les épisodes news (draft/publié).
  // On le reset sur les onglets Formations et Synthèses (vocabulaire distinct).
  useEffect(() => {
    if (
      (tab === 'formation' || tab === 'news_synthesis') &&
      publishStatusFilter !== 'all'
    ) {
      setPublishStatusFilter('all')
    }
  }, [tab, publishStatusFilter])

  const candidatesType = tab === 'all' ? undefined : tab
  const { candidates, loading, error, refetch } = useValidationCandidates(candidatesType)
  const { members: leads } = useCsMembers({ activeOnly: true })

  const { validate, loading: validating } = useValidateContent()
  const { revoke, loading: revoking } = useRevokeValidation()
  const { validateBulk, loading: bulking } = useValidateContentBulk()
  const { reject, loading: rejecting } = useRejectSyntheses()
  const { restore, loading: restoring } = useRestoreSyntheses()
  const {
    rejected,
    loading: rejectedLoading,
    refetch: refetchRejected,
  } = useRejectedSyntheses(statusFilter === 'rejected')

  const [validationModal, setValidationModal] = useState<ValidationCandidate | null>(null)
  const [revocationModal, setRevocationModal] = useState<ValidationCandidate | null>(null)
  const [historyModal, setHistoryModal] = useState<ValidationCandidate | null>(null)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  // Rejet : une seule modale sert l'unitaire et le lot — un rejet unitaire est
  // un lot d'un seul élément, côté UI comme côté RPC.
  const [rejectTargets, setRejectTargets] = useState<ValidationCandidate[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Toute bascule de filtre ou d'onglet vide la sélection : garder des cases
  // cochées sur des lignes devenues invisibles est le meilleur moyen de
  // rejeter en masse autre chose que ce qu'on croit voir.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [tab, statusFilter, publishStatusFilter])

  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const filteredCandidates = useMemo(() => {
    // La vue « Rejetées » ne lit pas les candidats : get_syntheses_for_validation()
    // filtre status='active', donc une synthèse rejetée en est absente par
    // construction. Elle a sa propre source (useRejectedSyntheses).
    if (statusFilter === 'rejected') return []
    return candidates.filter((c) => {
      if (statusFilter !== 'all' && candidateStatusKey(c) !== statusFilter) {
        return false
      }
      if (publishStatusFilter !== 'all' && c.content_type === 'news_episode') {
        if (publishStatusFilter === 'draft' && c.episode_status !== 'draft') return false
        if (
          publishStatusFilter === 'published' &&
          c.episode_status !== 'published' &&
          c.episode_status !== 'archived'
        )
          return false
      }
      return true
    })
  }, [candidates, statusFilter, publishStatusFilter])

  // ── Rejet éditorial ────────────────────────────────────────────────────────
  // Réservé aux synthèses : une formation ou un épisode ne se « rejette » pas,
  // il se dépublie ailleurs. Le bouton n'apparaît donc que sur news_synthesis,
  // et jamais sur un contenu déjà validé (là, c'est « Révoquer » qu'il faut).
  const isRejectable = (c: ValidationCandidate) =>
    c.content_type === 'news_synthesis' && candidateStatusKey(c) !== 'valid'

  const selectableCandidates = useMemo(
    () => filteredCandidates.filter(isRejectable),
    [filteredCandidates]
  )

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelectableSelected =
    selectableCandidates.length > 0 &&
    selectableCandidates.every((c) => selectedIds.has(c.content_id))

  const toggleSelectAll = () => {
    setSelectedIds(
      allSelectableSelected
        ? new Set()
        : new Set(selectableCandidates.map((c) => c.content_id))
    )
  }

  const confirmReject = async (reason: RejectionReason) => {
    if (!rejectTargets || rejectTargets.length === 0) return
    const ids = rejectTargets.map((c) => c.content_id)
    const n = await reject(ids, reason)
    setRejectTargets(null)
    setSelectedIds(new Set())
    await refetch()
    showToast(
      n === 0
        ? 'Aucune synthèse rejetée (déjà traitée ailleurs ?)'
        : `${n} synthèse${n > 1 ? 's' : ''} rejetée${n > 1 ? 's' : ''} — motif : ${rejectionReasonLabel(reason)}`
    )
  }

  const handleRestore = async (id: string, title: string | null) => {
    const n = await restore([id])
    await refetchRejected()
    showToast(
      n > 0
        ? `« ${title ?? 'Synthèse'} » rétablie — elle repasse en attente de validation`
        : 'Rien à rétablir'
    )
  }

  // Compteurs Publication : dépendent de Type (déjà appliqué via candidates) et
  // du filtre Statut validation, mais pas du filtre Publication lui-même.
  const publishCounts = useMemo(() => {
    let all = 0
    let draft = 0
    let published = 0
    for (const c of candidates) {
      if (c.content_type !== 'news_episode') continue
      if (statusFilter !== 'all' && candidateStatusKey(c) !== statusFilter) continue
      all++
      if (c.episode_status === 'draft') draft++
      else if (c.episode_status === 'published' || c.episode_status === 'archived') {
        published++
      }
    }
    return { all, draft, published }
  }, [candidates, statusFilter])

  const counts = useMemo(() => {
    let unvalidated = 0
    let stale = 0
    let valid = 0
    let formations = 0
    let episodes = 0
    let syntheses = 0
    for (const c of candidates) {
      const k = candidateStatusKey(c)
      if (k === 'unvalidated') unvalidated++
      else if (k === 'stale') stale++
      else valid++
      if (c.content_type === 'formation') formations++
      else if (c.content_type === 'news_synthesis') syntheses++
      else episodes++
    }
    return {
      unvalidated,
      stale,
      valid,
      formations,
      episodes,
      syntheses,
      total: candidates.length,
    }
  }, [candidates])

  const activeLead = useMemo(() => leads.find((m) => m.is_lead), [leads])
  const secondaryOptions = useMemo(() => leads.filter((m) => !m.is_lead), [leads])

  const handleBulkValidate = async () => {
    if (!activeLead) {
      showToast("Aucun lead actif disponible pour la validation en bloc.")
      return
    }
    try {
      const res = await validateBulk(activeLead.id)
      showToast(`${res.length} contenu(s) validé(s) en bloc.`)
      setBulkConfirmOpen(false)
      await refetch()
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la validation en bloc')
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Validations éditoriales</h1>
            <p className="text-sm text-gray-500 max-w-2xl">
              Signature des contenus pédagogiques et éditoriaux par le comité scientifique.
              Preuve juridique IA Act §50.4 (transparence des contenus assistés par IA) +
              indicateur Qualiopi #21 (validation expert indépendant).
            </p>
          </div>
        </div>
        {counts.unvalidated + counts.stale > 0 && (
          <button
            type="button"
            onClick={() => setBulkConfirmOpen(true)}
            className="inline-flex items-center gap-2 border-2 border-primary text-primary hover:bg-primary/5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <ListChecks size={16} />
            Tout valider en bloc
          </button>
        )}
      </header>

      {/* Filters */}
      <section className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 font-semibold">
          <Filter className="w-3.5 h-3.5" />
          Filtres
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 mr-1">Type :</span>
          {[
            { key: 'all' as const, label: `Tous (${counts.total})` },
            { key: 'formation' as const, label: `Formations (${counts.formations})` },
            { key: 'news_episode' as const, label: `News (${counts.episodes})` },
            { key: 'news_synthesis' as const, label: `Synthèses (${counts.syntheses})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 mr-1">Statut :</span>
          {[
            { key: 'all' as const, label: 'Tous' },
            { key: 'unvalidated' as const, label: `Non validés (${counts.unvalidated})` },
            { key: 'stale' as const, label: `Stale (${counts.stale})` },
            { key: 'valid' as const, label: `À jour (${counts.valid})` },
            { key: 'rejected' as const, label: 'Rejetées' },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === s.key
                  ? s.key === 'rejected'
                    ? 'bg-gray-800 text-white'
                    : 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Barre d'action du rejet en lot — n'apparaît que si quelque chose est
            sélectionné, pour qu'un rejet massif soit toujours un geste
            délibéré et jamais un bouton qu'on frôle. */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-white">
            <span className="text-sm font-semibold">
              {selectedIds.size} synthèse{selectedIds.size > 1 ? 's' : ''} sélectionnée
              {selectedIds.size > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() =>
                setRejectTargets(
                  selectableCandidates.filter((c) => selectedIds.has(c.content_id))
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              <Ban size={13} />
              Rejeter la sélection
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              Tout désélectionner
            </button>
          </div>
        )}

        {(tab === 'all' || tab === 'news_episode') && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 mr-1">Publication :</span>
            {[
              { key: 'all' as const, label: `Tous (${publishCounts.all})` },
              { key: 'draft' as const, label: `Brouillon (${publishCounts.draft})` },
              { key: 'published' as const, label: `Publié·archivé (${publishCounts.published})` },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPublishStatusFilter(p.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  publishStatusFilter === p.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Candidates list */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold">
            Tous les contenus sont validés et à jour ✓
          </p>
          <Link
            href="/admin"
            className="inline-block mt-4 text-sm text-primary hover:underline"
          >
            Retour au dashboard admin
          </Link>
        </div>
      ) : statusFilter === 'rejected' ? (
        <RejectedList
          rows={rejected}
          loading={rejectedLoading}
          restoring={restoring}
          onRestore={handleRestore}
        />
      ) : filteredCandidates.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
          Aucun contenu ne correspond aux filtres sélectionnés.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      {selectableCandidates.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          title={
                            allSelectableSelected
                              ? 'Tout désélectionner'
                              : `Sélectionner les ${selectableCandidates.length} synthèses affichées`
                          }
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          {allSelectableSelected ? (
                            <CheckSquare size={15} />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>
                      )}
                    </th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 font-semibold">Contenu</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Validateurs</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCandidates.map((c) => {
                    const status = candidateStatusKey(c)
                    const rejectable = isRejectable(c)
                    const checked = selectedIds.has(c.content_id)
                    return (
                      <tr
                        key={`${c.content_type}:${c.content_id}`}
                        className={`text-gray-800 ${checked ? 'bg-red-50/60' : ''}`}
                      >
                        <td className="px-3 py-3">
                          {rejectable && (
                            <button
                              type="button"
                              onClick={() => toggleSelected(c.content_id)}
                              aria-label={
                                checked ? 'Désélectionner' : 'Sélectionner pour rejet'
                              }
                              className={
                                checked
                                  ? 'text-red-600'
                                  : 'text-gray-300 hover:text-gray-600 transition-colors'
                              }
                            >
                              {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TypeBadge type={c.content_type} />
                          <DraftBadge candidate={c} />
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          <div className="font-medium truncate" title={c.content_title}>
                            {c.content_title}
                          </div>
                          {c.episode_type && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              type : {c.episode_type}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <StatusBadge candidate={c} />
                            {c.current_validated_at && (
                              <span className="text-[11px] text-gray-500">
                                {formatDateFr(c.current_validated_at)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {c.current_lead_name ? (
                            <span>
                              {c.current_lead_name}
                              {c.current_secondary_name
                                ? ` + ${c.current_secondary_name}`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                            {status !== 'valid' ? (
                              isEpisodeAutoValidated(c) ? (
                                <span className="text-xs text-gray-500 italic px-1">
                                  Se valide via la publication de l&apos;épisode
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setValidationModal(c)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                >
                                  {status === 'stale' ? 'Re-valider' : 'Valider'}
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRevocationModal(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={12} />
                                Révoquer
                              </button>
                            )}
                            {rejectable && (
                              <button
                                type="button"
                                onClick={() => setRejectTargets([c])}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
                              >
                                <Ban size={12} />
                                Rejeter
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setHistoryModal(c)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <History size={12} />
                              Historique
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredCandidates.map((c) => {
              const status = candidateStatusKey(c)
              return (
                <div
                  key={`${c.content_type}:${c.content_id}`}
                  className="bg-white rounded-2xl shadow p-4"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center">
                      <TypeBadge type={c.content_type} />
                      <DraftBadge candidate={c} />
                    </div>
                    <StatusBadge candidate={c} />
                  </div>
                  <div className="font-semibold text-gray-900 mt-2">{c.content_title}</div>
                  {c.current_lead_name && (
                    <div className="text-xs text-gray-500 mt-1">
                      {c.current_lead_name}
                      {c.current_secondary_name ? ` + ${c.current_secondary_name}` : ''}
                      {c.current_validated_at &&
                        ` • ${formatDateFr(c.current_validated_at)}`}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {status !== 'valid' ? (
                      isEpisodeAutoValidated(c) ? (
                        <span className="flex-1 text-xs text-gray-500 italic px-1 py-2">
                          Se valide via la publication de l&apos;épisode
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setValidationModal(c)}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white"
                        >
                          {status === 'stale' ? 'Re-valider' : 'Valider'}
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevocationModal(c)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50"
                      >
                        <Trash2 size={12} />
                        Révoquer
                      </button>
                    )}
                    {isRejectable(c) && (
                      <button
                        type="button"
                        onClick={() => setRejectTargets([c])}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50"
                      >
                        <Ban size={12} />
                        Rejeter
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setHistoryModal(c)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 bg-gray-100"
                    >
                      <History size={12} />
                      Historique
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Reject modal — unitaire ou lot, même écran */}
      {rejectTargets && rejectTargets.length > 0 && (
        <RejectModal
          targets={rejectTargets}
          submitting={rejecting}
          onClose={() => setRejectTargets(null)}
          onConfirm={confirmReject}
        />
      )}

      {/* Validation modal */}
      {validationModal && (
        <ValidateModal
          candidate={validationModal}
          leads={leads.filter((m) => m.is_lead)}
          secondaries={secondaryOptions}
          submitting={validating}
          onClose={() => setValidationModal(null)}
          onSubmit={async ({ leadId, secondaryId, comments }) => {
            try {
              await validate({
                contentType: validationModal.content_type,
                contentId: validationModal.content_id,
                validatedByLead: leadId,
                validatedBySecondary: secondaryId,
                comments,
              })
              showToast('Validation enregistrée.')
              setValidationModal(null)
              await refetch()
            } catch (err: any) {
              showToast(err.message || 'Erreur de validation')
            }
          }}
        />
      )}

      {/* Revocation modal */}
      {revocationModal && (
        <RevokeModal
          candidate={revocationModal}
          submitting={revoking}
          onClose={() => setRevocationModal(null)}
          onSubmit={async (reason) => {
            if (!revocationModal.current_validation_id) {
              showToast('Validation introuvable.')
              return
            }
            try {
              const ok = await revoke(revocationModal.current_validation_id, reason)
              if (ok) {
                showToast('Validation révoquée.')
              } else {
                showToast('Aucune validation courante à révoquer.')
              }
              setRevocationModal(null)
              await refetch()
            } catch (err: any) {
              showToast(err.message || 'Erreur de révocation')
            }
          }}
        />
      )}

      {/* History modal */}
      {historyModal && (
        <HistoryModal
          candidate={historyModal}
          onClose={() => setHistoryModal(null)}
        />
      )}

      {/* Bulk confirmation */}
      {bulkConfirmOpen && (
        <ConfirmBulkModal
          counts={counts}
          leadName={activeLead?.display_name || '—'}
          submitting={bulking}
          onClose={() => setBulkConfirmOpen(false)}
          onConfirm={handleBulkValidate}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium"
          style={{ background: '#0a0a0a', color: '#e5e5e5', border: '1px solid #2a2a2a' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal : valider / re-valider
// ─────────────────────────────────────────────────────────────────────────────
function ValidateModal({
  candidate,
  leads,
  secondaries,
  submitting,
  onClose,
  onSubmit,
}: {
  candidate: ValidationCandidate
  leads: { id: string; display_name: string; title: string | null }[]
  secondaries: { id: string; display_name: string; title: string | null }[]
  submitting: boolean
  onClose: () => void
  onSubmit: (params: {
    leadId: string
    secondaryId: string | null
    comments: string | null
  }) => Promise<void>
}) {
  const [leadId, setLeadId] = useState(leads[0]?.id || '')
  const [secondaryId, setSecondaryId] = useState<string>('')
  const [comments, setComments] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const isStale = candidate.is_stale && candidate.current_validation_id

  const handleSubmit = async () => {
    setLocalError(null)
    if (!leadId) {
      setLocalError('Aucun lead disponible. Crée un membre lead actif dans /admin/cs-members.')
      return
    }
    if (comments.length > 2000) {
      setLocalError('Le commentaire ne peut pas dépasser 2000 caractères.')
      return
    }
    await onSubmit({
      leadId,
      secondaryId: secondaryId || null,
      comments: comments.trim() || null,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
        >
          <div>
            <h2 className="text-lg font-bold leading-snug" style={{ color: '#e5e5e5' }}>
              {isStale ? 'Re-valider le contenu' : 'Valider le contenu'}
            </h2>
            <p className="text-xs mt-1 truncate" style={{ color: '#a3a3a3' }}>
              <TypeBadge type={candidate.content_type} />
              <DraftBadge candidate={candidate} />
              <span className="ml-2">{candidate.content_title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="p-2 rounded-full"
            style={{ color: '#a3a3a3' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {isStale && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{
                background: 'rgba(180,83,9,0.18)',
                border: '1px solid #b45309',
                color: '#fbbf24',
              }}
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                Le contenu a été modifié depuis la dernière validation. Une re-validation
                va remplacer la précédente (l'ancienne sera conservée dans l'historique).
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
              Lead validateur *
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
            >
              {leads.length === 0 && <option value="">— aucun lead actif —</option>}
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.display_name}
                  {l.title ? ` (${l.title})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
              Validateur secondaire (optionnel)
            </label>
            <select
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
            >
              <option value="">Aucun</option>
              {secondaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                  {s.title ? ` (${s.title})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
              Commentaires (optionnel, max 2000)
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Notes éditoriales ou justification scientifique…"
              className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-primary"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
            />
            <p className="text-[11px] mt-1 text-right" style={{ color: '#737373' }}>
              {comments.length}/2000
            </p>
          </div>

          {localError && <p className="text-red-400 text-sm">{localError}</p>}
        </div>

        <div
          className="px-5 py-4 flex-shrink-0 flex items-center gap-3"
          style={{ background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#242424', color: '#e5e5e5' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !leadId}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Validation…
              </>
            ) : (
              'Valider'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal : révoquer
// ─────────────────────────────────────────────────────────────────────────────
function RevokeModal({
  candidate,
  submitting,
  onClose,
  onSubmit,
}: {
  candidate: ValidationCandidate
  submitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLocalError(null)
    if (reason.trim().length < 5) {
      setLocalError('Une raison d\'au moins 5 caractères est requise.')
      return
    }
    await onSubmit(reason.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#e5e5e5' }}>
              Révoquer la validation
            </h2>
            <p className="text-xs mt-1 truncate" style={{ color: '#a3a3a3' }}>
              {candidate.content_title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="p-2 rounded-full"
            style={{ color: '#a3a3a3' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div
            className="p-3 rounded-xl text-xs"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#a3a3a3' }}
          >
            Validation courante :{' '}
            <span style={{ color: '#e5e5e5' }}>
              {candidate.current_lead_name || '—'}
              {candidate.current_secondary_name ? ` + ${candidate.current_secondary_name}` : ''}
            </span>
            <br />
            Date :{' '}
            <span style={{ color: '#e5e5e5' }}>
              {formatDateTimeFr(candidate.current_validated_at)}
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
              Raison de la révocation * (min 5 caractères)
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquer pourquoi cette validation est annulée…"
              className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-red-500"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
            />
          </div>

          {localError && <p className="text-red-400 text-sm">{localError}</p>}
        </div>

        <div
          className="px-5 py-4 flex-shrink-0 flex items-center gap-3"
          style={{ background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#242424', color: '#e5e5e5' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Révocation…
              </>
            ) : (
              'Révoquer'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal : historique
// ─────────────────────────────────────────────────────────────────────────────
interface HistoryRow extends EditorialValidation {
  lead?: { display_name: string; title: string | null } | null
  secondary?: { display_name: string; title: string | null } | null
}

function HistoryModal({
  candidate,
  onClose,
}: {
  candidate: ValidationCandidate
  onClose: () => void
}) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data, error: dbErr } = await supabase
          .from('editorial_validations')
          .select(
            `*,
             lead:cs_members!editorial_validations_validated_by_lead_fkey(display_name,title),
             secondary:cs_members!editorial_validations_validated_by_secondary_fkey(display_name,title)`
          )
          .eq('content_type', candidate.content_type)
          .eq('content_id', candidate.content_id)
          .order('validated_at', { ascending: false })
        if (dbErr) throw dbErr
        if (!cancelled) setRows((data || []) as HistoryRow[])
      } catch (err: any) {
        console.error('history load error:', err)
        if (!cancelled) setError(err.message || 'Erreur lors du chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [candidate.content_type, candidate.content_id])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#e5e5e5' }}>
              Historique des validations
            </h2>
            <p className="text-xs mt-1 truncate" style={{ color: '#a3a3a3' }}>
              {candidate.content_title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 rounded-full"
            style={{ color: '#a3a3a3' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a3a3a3' }} />
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm" style={{ color: '#a3a3a3' }}>
              Aucune validation historique trouvée pour ce contenu.
            </p>
          ) : (
            rows.map((r) => {
              const meta = (r.metadata || {}) as Record<string, unknown>
              const revokedAt = meta.revoked_at ? String(meta.revoked_at) : null
              const revokedReason = meta.revocation_reason
                ? String(meta.revocation_reason)
                : null
              return (
                <div
                  key={r.id}
                  className="p-4 rounded-xl"
                  style={{
                    background: r.is_current ? 'rgba(16,185,129,0.08)' : '#1a1a1a',
                    border: r.is_current ? '1px solid #059669' : '1px solid #2a2a2a',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#e5e5e5' }}>
                        {r.lead?.display_name || '—'}
                        {r.secondary && (
                          <span style={{ color: '#a3a3a3' }}>
                            {' + '}
                            {r.secondary.display_name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#a3a3a3' }}>
                        {formatDateTimeFr(r.validated_at)}
                      </div>
                    </div>
                    <div>
                      {r.is_current ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-600 text-white">
                          <CheckCircle2 size={11} />
                          Courante
                        </span>
                      ) : revokedAt ? (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-red-700 text-white">
                          Révoquée
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-gray-600 text-white">
                          Remplacée
                        </span>
                      )}
                    </div>
                  </div>
                  {r.comments && (
                    <p
                      className="text-xs mt-2 italic"
                      style={{ color: '#d4d4d4' }}
                    >
                      « {r.comments} »
                    </p>
                  )}
                  {revokedAt && (
                    <p className="text-[11px] mt-2" style={{ color: '#fb923c' }}>
                      Révoquée le {formatDateTimeFr(revokedAt)}
                      {revokedReason && ` — raison : ${revokedReason}`}
                    </p>
                  )}
                  <p className="text-[10px] font-mono mt-2" style={{ color: '#525252' }}>
                    hash : {r.content_hash.slice(0, 16)}…
                  </p>
                </div>
              )
            })
          )}
        </div>

        <div
          className="px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#242424', color: '#e5e5e5' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal : confirmation bulk
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmBulkModal({
  counts,
  leadName,
  submitting,
  onClose,
  onConfirm,
}: {
  counts: { unvalidated: number; stale: number; formations: number; episodes: number }
  leadName: string
  submitting: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
        >
          <h2 className="text-lg font-bold" style={{ color: '#e5e5e5' }}>
            Validation en bloc
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="p-2 rounded-full"
            style={{ color: '#a3a3a3' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          <p className="text-sm" style={{ color: '#e5e5e5' }}>
            Tu vas valider en bloc{' '}
            <strong>{counts.formations} formation(s)</strong> et{' '}
            <strong>{counts.episodes} episode(s) news</strong> au nom de{' '}
            <strong>{leadName}</strong>.
          </p>
          <p className="text-xs" style={{ color: '#a3a3a3' }}>
            La RPC ne traite que les contenus sans validation courante ou dont le hash
            a changé. Chaque validation rétroactive sera enregistrée avec le commentaire
            « Validation rétroactive (backfill) ». Continuer ?
          </p>
        </div>

        <div
          className="px-5 py-4 flex-shrink-0 flex items-center gap-3"
          style={{ background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#242424', color: '#e5e5e5' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Validation…
              </>
            ) : (
              'Valider en bloc'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RejectModal — choix du motif, unitaire ou en lot
// ─────────────────────────────────────────────────────────────────────────────
// Le motif est obligatoire (la RPC le refuse vide) : c'est lui qui transforme
// le tri éditorial en signal exploitable. Un motif qui domine indique un
// critère à ajouter au prompt de score_articles, plutôt que de continuer à
// trier à la main indéfiniment.
function RejectModal({
  targets,
  submitting,
  onClose,
  onConfirm,
}: {
  targets: ValidationCandidate[]
  submitting: boolean
  onClose: () => void
  onConfirm: (reason: RejectionReason) => Promise<void>
}) {
  const [reason, setReason] = useState<RejectionReason | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const isBulk = targets.length > 1

  const submit = async () => {
    if (!reason) {
      setLocalError('Choisis un motif avant de rejeter.')
      return
    }
    setLocalError(null)
    try {
      await onConfirm(reason)
    } catch (err: any) {
      setLocalError(err?.message || 'Erreur lors du rejet')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
        >
          <h2
            className="text-lg font-bold inline-flex items-center gap-2"
            style={{ color: '#e5e5e5' }}
          >
            <Ban size={18} className="text-red-500" />
            {isBulk ? `Rejeter ${targets.length} synthèses` : 'Rejeter la synthèse'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="p-2 rounded-full"
            style={{ color: '#a3a3a3' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {isBulk ? (
            <div
              className="rounded-xl px-4 py-3 max-h-40 overflow-y-auto"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <ul className="space-y-1">
                {targets.map((t) => (
                  <li key={t.content_id} className="text-xs" style={{ color: '#d4d4d4' }}>
                    • {t.content_title}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm font-medium" style={{ color: '#e5e5e5' }}>
              {targets[0].content_title}
            </p>
          )}

          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#a3a3a3' }}>
              MOTIF DU REJET
            </p>
            <div className="space-y-1.5">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setReason(r.value)
                    setLocalError(null)
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: reason === r.value ? 'rgba(220,38,38,0.12)' : '#1a1a1a',
                    border:
                      reason === r.value ? '1px solid #dc2626' : '1px solid #2a2a2a',
                  }}
                >
                  <span className="text-sm font-semibold" style={{ color: '#e5e5e5' }}>
                    {r.label}
                  </span>
                  {r.hint && (
                    <span className="block text-xs mt-0.5" style={{ color: '#a3a3a3' }}>
                      {r.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs" style={{ color: '#a3a3a3' }}>
            La synthèse disparaît de la file de validation, de la rubrique News et du
            quiz du jour. Rien n&apos;est supprimé : tu peux la rétablir depuis le filtre
            « Rejetées ».
          </p>

          {localError && <p className="text-sm text-red-400">{localError}</p>}
        </div>

        <div
          className="px-5 py-4 flex-shrink-0 flex items-center gap-3"
          style={{ background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#242424', color: '#e5e5e5' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !reason}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Rejet…
              </>
            ) : (
              <>
                <Ban size={16} />
                {isBulk ? `Rejeter les ${targets.length}` : 'Rejeter'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RejectedList — la vue « Rejetées », avec rétablissement
// ─────────────────────────────────────────────────────────────────────────────
function RejectedList({
  rows,
  loading,
  restoring,
  onRestore,
}: {
  rows: RejectedSynthesis[]
  loading: boolean
  restoring: boolean
  onRestore: (id: string, title: string | null) => Promise<void>
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
        Aucune synthèse rejetée.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-600">
        {rows.length} synthèse{rows.length > 1 ? 's' : ''} rejetée
        {rows.length > 1 ? 's' : ''}. Elles ne sont visibles ni dans la rubrique News,
        ni dans le quiz du jour. Rétablir une synthèse la renvoie en attente de
        validation.
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div
            key={r.id}
            className="px-5 py-3 flex items-start justify-between gap-4 flex-wrap"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">
                {r.display_title ?? '(sans titre)'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold">
                  {rejectionReasonLabel(r.rejection_reason)}
                </span>
                {r.specialite && <span>{r.specialite}</span>}
                <span>rejetée le {formatDateFr(r.rejected_at)}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={restoring}
              onClick={() => onRestore(r.id, r.display_title)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60"
            >
              <RotateCcw size={12} />
              Rétablir
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
