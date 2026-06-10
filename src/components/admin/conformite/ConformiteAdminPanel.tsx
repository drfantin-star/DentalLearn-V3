'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  Radio,
  Thermometer,
  Shield,
  Lock,
  Accessibility,
  Activity,
  MonitorSmartphone,
  Receipt,
  Users,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ComplianceItemFormModal from './ComplianceItemFormModal'
import ComplianceCategoryFormModal from './ComplianceCategoryFormModal'
import { APPLIES_WHEN_LABELS, FREQUENCY_LABELS, FICHE_BUCKET } from './constants'
import type {
  CabinetComplianceCategory,
  CabinetComplianceItem,
} from '@/lib/supabase/types'

type NotifKind = 'success' | 'error'

interface ConformiteAdminPanelProps {
  onNotify: (n: { kind: NotifKind; message: string }) => void
}

// Mêmes noms d'icônes lucide qu'en base (cf. conformite/page.tsx).
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  radio: Radio,
  thermometer: Thermometer,
  'trash-2': Trash2,
  shield: Shield,
  lock: Lock,
  accessibility: Accessibility,
  activity: Activity,
  'monitor-smartphone': MonitorSmartphone,
  'file-text': FileText,
  receipt: Receipt,
  users: Users,
  briefcase: Briefcase,
}

function categoryIcon(name: string | null): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || ShieldCheck
}

export default function ConformiteAdminPanel({ onNotify }: ConformiteAdminPanelProps) {
  const [categories, setCategories] = useState<CabinetComplianceCategory[]>([])
  const [items, setItems] = useState<CabinetComplianceItem[]>([])
  const [loading, setLoading] = useState(true)

  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CabinetComplianceItem | null>(null)
  const [itemDefaultCategory, setItemDefaultCategory] = useState<string | undefined>()

  const [catFormOpen, setCatFormOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<CabinetComplianceCategory | null>(null)

  const [itemToDelete, setItemToDelete] = useState<CabinetComplianceItem | null>(null)
  const [catToDelete, setCatToDelete] = useState<CabinetComplianceCategory | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [catRes, itemRes] = await Promise.all([
      supabase
        .from('cabinet_compliance_categories')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase
        .from('cabinet_compliance_items')
        .select('*')
        .order('display_order', { ascending: true }),
    ])
    if (catRes.error || itemRes.error) {
      onNotify({
        kind: 'error',
        message: `Chargement échoué : ${catRes.error?.message ?? itemRes.error?.message}`,
      })
      setCategories([])
      setItems([])
    } else {
      setCategories((catRes.data ?? []) as CabinetComplianceCategory[])
      setItems((itemRes.data ?? []) as CabinetComplianceItem[])
    }
    setLoading(false)
  }, [onNotify])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, CabinetComplianceItem[]>()
    for (const it of items) {
      if (!map.has(it.category_id)) map.set(it.category_id, [])
      map.get(it.category_id)!.push(it)
    }
    return map
  }, [items])

  const itemCodes = useMemo(() => items.map((i) => i.code), [items])
  const categoryCodes = useMemo(() => categories.map((c) => c.code), [categories])

  // Handlers ouverture formulaires.
  const openCreateItem = (categoryId?: string) => {
    setEditingItem(null)
    setItemDefaultCategory(categoryId)
    setItemFormOpen(true)
  }
  const openEditItem = (it: CabinetComplianceItem) => {
    setEditingItem(it)
    setItemDefaultCategory(undefined)
    setItemFormOpen(true)
  }
  const openCreateCat = () => {
    setEditingCat(null)
    setCatFormOpen(true)
  }
  const openEditCat = (c: CabinetComplianceCategory) => {
    setEditingCat(c)
    setCatFormOpen(true)
  }

  const handleSaved = (message: string) => {
    onNotify({ kind: 'success', message })
    loadAll()
  }

  // Suppression item (best-effort sur la fiche storage).
  const confirmDeleteItem = async () => {
    if (!itemToDelete) return
    setDeleting(true)
    const supabase = createClient()

    if (itemToDelete.fiche_storage_path) {
      const { error: rmErr } = await supabase.storage
        .from(FICHE_BUCKET)
        .remove([itemToDelete.fiche_storage_path])
      if (rmErr) console.error('Suppression fiche Storage échouée:', rmErr.message)
    }

    const { error: delErr } = await supabase
      .from('cabinet_compliance_items')
      .delete()
      .eq('id', itemToDelete.id)

    setDeleting(false)
    if (delErr) {
      onNotify({ kind: 'error', message: `Suppression échouée : ${delErr.message}` })
      return
    }
    onNotify({ kind: 'success', message: 'Item supprimé.' })
    setItemToDelete(null)
    loadAll()
  }

  // Suppression catégorie (bloquée si non vide : FK NO ACTION).
  const catItemCount = catToDelete ? (itemsByCategory.get(catToDelete.id)?.length ?? 0) : 0

  const confirmDeleteCat = async () => {
    if (!catToDelete || catItemCount > 0) return
    setDeleting(true)
    const supabase = createClient()
    const { error: delErr } = await supabase
      .from('cabinet_compliance_categories')
      .delete()
      .eq('id', catToDelete.id)

    setDeleting(false)
    if (delErr) {
      onNotify({ kind: 'error', message: `Suppression échouée : ${delErr.message}` })
      return
    }
    onNotify({ kind: 'success', message: 'Catégorie supprimée.' })
    setCatToDelete(null)
    loadAll()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="secondary" onClick={openCreateCat}>
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Ajouter une catégorie
          </span>
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-500">Aucune catégorie de conformité.</p>
          <button
            onClick={openCreateCat}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            + Ajouter la première catégorie
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const Icon = categoryIcon(cat.icon)
            const catItems = itemsByCategory.get(cat.id) ?? []
            return (
              <section key={cat.id}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: cat.color ? `${cat.color}1A` : '#f3f4f6',
                        color: cat.color ?? '#374151',
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    {cat.name}
                    <span className="text-[10px] font-medium normal-case text-gray-400">
                      {cat.code}
                    </span>
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openCreateItem(cat.id)}
                      aria-label={`Ajouter un item à ${cat.name}`}
                      className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditCat(cat)}
                      aria-label={`Éditer ${cat.name}`}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCatToDelete(cat)}
                      aria-label={`Supprimer ${cat.name}`}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="hidden md:grid grid-cols-[1fr_130px_120px_90px_90px] gap-3 px-4 py-2 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <span>Titre</span>
                    <span>Fréquence</span>
                    <span>Liens</span>
                    <span>Ordre</span>
                    <span className="text-right">Actions</span>
                  </div>
                  {catItems.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-gray-400">
                      Aucun item.{' '}
                      <button
                        onClick={() => openCreateItem(cat.id)}
                        className="font-semibold text-primary hover:underline"
                      >
                        Ajouter
                      </button>
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {catItems.map((it) => (
                        <li
                          key={it.id}
                          className="grid grid-cols-1 md:grid-cols-[1fr_130px_120px_90px_90px] gap-2 md:gap-3 px-4 py-3 md:items-center"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{it.title}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {it.code}
                              {!it.is_mandatory && ' · Recommandé'}
                              {it.applies_when !== 'always' &&
                                ` · ${APPLIES_WHEN_LABELS[it.applies_when]}`}
                            </p>
                          </div>
                          <span className="text-sm text-gray-600">
                            {it.frequency ? FREQUENCY_LABELS[it.frequency] ?? it.frequency : '—'}
                          </span>
                          <span className="flex items-center gap-2">
                            {it.official_url && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600"
                                title="URL officielle"
                              >
                                <ExternalLink className="w-3 h-3" /> URL
                              </span>
                            )}
                            {it.fiche_url && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"
                                title="Fiche PDF"
                              >
                                <FileText className="w-3 h-3" /> Fiche
                              </span>
                            )}
                            {!it.official_url && !it.fiche_url && (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </span>
                          <span className="text-sm text-gray-600">{it.display_order}</span>
                          <div className="flex items-center gap-1 md:justify-end">
                            <button
                              onClick={() => openEditItem(it)}
                              aria-label={`Éditer ${it.title}`}
                              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setItemToDelete(it)}
                              aria-label={`Supprimer ${it.title}`}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Modales formulaires */}
      <ComplianceItemFormModal
        open={itemFormOpen}
        onClose={() => setItemFormOpen(false)}
        categories={categories}
        existing={editingItem}
        defaultCategoryId={itemDefaultCategory}
        existingCodes={itemCodes}
        onSaved={handleSaved}
      />
      <ComplianceCategoryFormModal
        open={catFormOpen}
        onClose={() => setCatFormOpen(false)}
        existing={editingCat}
        existingCodes={categoryCodes}
        onSaved={handleSaved}
      />

      {/* Confirmation suppression item */}
      <Modal
        open={itemToDelete !== null}
        onClose={() => !deleting && setItemToDelete(null)}
        variant="light"
        size="sm"
        ariaLabel="Confirmer la suppression"
      >
        <Modal.Header title="Supprimer l'item" onClose={() => !deleting && setItemToDelete(null)} />
        <Modal.Body>
          <p className="text-sm text-gray-700">
            Supprimer définitivement «&nbsp;
            <span className="font-semibold">{itemToDelete?.title}</span>&nbsp;» ? Cette action est
            irréversible.
            {itemToDelete?.fiche_url && (
              <span className="mt-2 block text-xs text-gray-500">
                La fiche PDF associée sera également supprimée du stockage.
              </span>
            )}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setItemToDelete(null)} disabled={deleting}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirmDeleteItem} loading={deleting}>
            Supprimer
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Confirmation suppression catégorie */}
      <Modal
        open={catToDelete !== null}
        onClose={() => !deleting && setCatToDelete(null)}
        variant="light"
        size="sm"
        ariaLabel="Confirmer la suppression"
      >
        <Modal.Header
          title="Supprimer la catégorie"
          onClose={() => !deleting && setCatToDelete(null)}
        />
        <Modal.Body>
          {catItemCount > 0 ? (
            <p className="text-sm text-gray-700">
              «&nbsp;<span className="font-semibold">{catToDelete?.name}</span>&nbsp;» contient{' '}
              <span className="font-semibold">{catItemCount}</span> item(s). Supprimez ou
              réassignez-les d&apos;abord.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              Supprimer définitivement «&nbsp;
              <span className="font-semibold">{catToDelete?.name}</span>&nbsp;» ? Cette action est
              irréversible.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setCatToDelete(null)} disabled={deleting}>
            {catItemCount > 0 ? 'Fermer' : 'Annuler'}
          </Button>
          {catItemCount === 0 && (
            <Button variant="danger" onClick={confirmDeleteCat} loading={deleting}>
              Supprimer
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  )
}
