'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  FileText,
  Loader2,
  Library,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import RessourceFormModal from '@/components/admin/bibliotheque/RessourceFormModal'
import ConformiteAdminPanel from '@/components/admin/conformite/ConformiteAdminPanel'
import {
  AXE_LABELS,
  type AxeId,
  type BibliothequeRessourceRow,
} from '@/lib/bibliotheque/types'

const BUCKET = 'bibliotheque-publique'
const AXES: AxeId[] = [1, 3, 4]

type Notification = { kind: 'success' | 'error'; message: string }

// Ligne légère de la section « Questionnaire » (édition via écran dédié).
type QuestionnaireRow = {
  id: string
  slug: string
  titre: string
  actif: boolean
  time_estimate_min: number | null
}

export default function AdminBibliothequePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AxeId | 'conformite'>(3)
  const isConformite = activeTab === 'conformite'
  const [ressources, setRessources] = useState<BibliothequeRessourceRow[]>([])
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notif, setNotif] = useState<Notification | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BibliothequeRessourceRow | null>(null)

  const [toDelete, setToDelete] = useState<BibliothequeRessourceRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showNotif = useCallback((n: Notification) => {
    setNotif(n)
    window.setTimeout(() => setNotif(null), 4000)
  }, [])

  const loadRessources = useCallback(async (axe: AxeId) => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bibliotheque_ressources')
      .select('*')
      .eq('axe', axe)
      .order('categorie', { ascending: true })
      .order('ordre', { ascending: true })
    if (error) {
      showNotif({ kind: 'error', message: `Chargement échoué : ${error.message}` })
      setRessources([])
    } else {
      setRessources((data ?? []) as BibliothequeRessourceRow[])
    }
    setLoading(false)
  }, [showNotif])

  const loadQuestionnaires = useCallback(async (axe: AxeId) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('questionnaires')
      .select('id, slug, titre, actif, time_estimate_min')
      .eq('axe_cp', axe)
      .order('titre', { ascending: true })
    if (error) {
      // Section secondaire : on n'interrompt pas l'affichage des ressources.
      console.error('Chargement questionnaires échoué:', error.message)
      setQuestionnaires([])
    } else {
      setQuestionnaires((data ?? []) as QuestionnaireRow[])
    }
  }, [])

  useEffect(() => {
    if (typeof activeTab !== 'number') return
    loadRessources(activeTab)
    loadQuestionnaires(activeTab)
  }, [activeTab, loadRessources, loadQuestionnaires])

  // Regroupement par catégorie en préservant l'ordre (déjà trié par la requête).
  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, BibliothequeRessourceRow[]>()
    for (const r of ressources) {
      const cat = r.categorie ?? 'Sans catégorie'
      if (!map.has(cat)) {
        map.set(cat, [])
        order.push(cat)
      }
      map.get(cat)!.push(r)
    }
    return order.map((categorie) => ({ categorie, items: map.get(categorie)! }))
  }, [ressources])

  const existingCategories = useMemo(
    () =>
      Array.from(
        new Set(ressources.map((r) => r.categorie).filter((c): c is string => !!c)),
      ),
    [ressources],
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (r: BibliothequeRessourceRow) => {
    setEditing(r)
    setFormOpen(true)
  }

  const handleSaved = (message: string) => {
    showNotif({ kind: 'success', message })
    if (typeof activeTab === 'number') loadRessources(activeTab)
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    const supabase = createClient()

    // 1. Supprimer le fichier Storage (best-effort) si interne.
    if (toDelete.type === 'internal' && toDelete.storage_path) {
      const { error: rmErr } = await supabase.storage
        .from(BUCKET)
        .remove([toDelete.storage_path])
      if (rmErr) {
        // Fichier orphelin < UI désynchro : on logge et on continue.
        console.error('Suppression fichier Storage échouée:', rmErr.message)
      }
    }

    // 2. Supprimer la ligne.
    const { error: delErr } = await supabase
      .from('bibliotheque_ressources')
      .delete()
      .eq('id', toDelete.id)

    setDeleting(false)
    if (delErr) {
      showNotif({ kind: 'error', message: `Suppression échouée : ${delErr.message}` })
      return
    }
    showNotif({ kind: 'success', message: 'Ressource supprimée.' })
    setToDelete(null)
    if (typeof activeTab === 'number') loadRessources(activeTab)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Library className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bibliothèque</h1>
        </div>
        {!isConformite && (
          <Button variant="primary" onClick={openCreate}>
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Ajouter une ressource
            </span>
          </Button>
        )}
      </div>

      {/* Notification */}
      {notif && (
        <div
          role="status"
          className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            notif.kind === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {notif.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{notif.message}</span>
        </div>
      )}

      {/* Sélecteur d'axe */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
        {AXES.map((axe) => (
          <button
            key={axe}
            onClick={() => setActiveTab(axe)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === axe
                ? 'bg-primary text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {AXE_LABELS[axe]}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('conformite')}
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
            isConformite
              ? 'bg-primary text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Conformité
        </button>
      </div>

      {/* Conformité : panneau dédié (CRUD catégories + items) */}
      {isConformite ? (
        <ConformiteAdminPanel onNotify={showNotif} />
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-500">
            Aucune ressource pour {AXE_LABELS[activeTab as AxeId]}.
          </p>
          <button
            onClick={openCreate}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            + Ajouter la première ressource
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.categorie}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                {group.categorie}
              </h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                {/* En-têtes (desktop) */}
                <div className="hidden md:grid grid-cols-[1fr_140px_110px_70px_90px] gap-3 px-4 py-2 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <span>Titre</span>
                  <span>Source</span>
                  <span>Type</span>
                  <span>Ordre</span>
                  <span className="text-right">Actions</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {group.items.map((r) => (
                    <li
                      key={r.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_140px_110px_70px_90px] gap-2 md:gap-3 px-4 py-3 md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.titre}</p>
                        {r.description && (
                          <p className="text-xs text-gray-500 truncate md:hidden">
                            {r.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 truncate">{r.source}</span>
                      <span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.type === 'internal'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {r.type === 'internal' ? (
                            <FileText className="w-3 h-3" />
                          ) : (
                            <ExternalLink className="w-3 h-3" />
                          )}
                          {r.type === 'internal' ? 'Interne' : 'Externe'}
                        </span>
                      </span>
                      <span className="text-sm text-gray-600">{r.ordre}</span>
                      <div className="flex items-center gap-1 md:justify-end">
                        <button
                          onClick={() => openEdit(r)}
                          aria-label={`Éditer ${r.titre}`}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(r)}
                          aria-label={`Supprimer ${r.titre}`}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Section Questionnaire — masquée si aucun questionnaire pour l'axe actif */}
      {!isConformite && !loading && questionnaires.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
            Questionnaire
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {/* En-têtes (desktop) */}
            <div className="hidden md:grid grid-cols-[1fr_140px_90px_90px_90px] gap-3 px-4 py-2 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <span>Titre</span>
              <span>Type</span>
              <span>Actif</span>
              <span>Durée</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {questionnaires.map((q) => (
                <li
                  key={q.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_140px_90px_90px_90px] gap-2 md:gap-3 px-4 py-3 md:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{q.titre}</p>
                  </div>
                  <span className="text-sm text-gray-600">Auto-évaluation</span>
                  <span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        q.actif ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {q.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    {q.time_estimate_min != null ? `${q.time_estimate_min} min` : '—'}
                  </span>
                  <div className="flex items-center gap-1 md:justify-end">
                    <button
                      onClick={() =>
                        router.push(`/admin/bibliotheque/questionnaire/${q.slug}`)
                      }
                      aria-label={`Éditer ${q.titre}`}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Modal formulaire */}
      <RessourceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        axe={(typeof activeTab === 'number' ? activeTab : 3) as AxeId}
        existing={editing}
        existingCategories={existingCategories}
        onSaved={handleSaved}
      />

      {/* Modal de confirmation suppression */}
      <Modal
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        variant="light"
        size="sm"
        ariaLabel="Confirmer la suppression"
      >
        <Modal.Header title="Supprimer la ressource" onClose={() => !deleting && setToDelete(null)} />
        <Modal.Body>
          <p className="text-sm text-gray-700">
            Supprimer définitivement «&nbsp;
            <span className="font-semibold">{toDelete?.titre}</span>&nbsp;» ? Cette action est
            irréversible.
            {toDelete?.type === 'internal' && (
              <span className="mt-2 block text-xs text-gray-500">
                Le fichier PDF associé sera également supprimé du stockage.
              </span>
            )}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting}>
            Supprimer
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
