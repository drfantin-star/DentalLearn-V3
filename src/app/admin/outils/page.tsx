'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Save,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

interface Tool {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string | null
  href: string | null
  status: 'active' | 'coming_soon'
  is_published: boolean
  desktop_only: boolean
  order_idx: number
  created_at: string
  updated_at: string
}

type ToolDraft = Omit<Tool, 'id' | 'created_at' | 'updated_at'>

const EMPTY_DRAFT: ToolDraft = {
  slug: '',
  title: '',
  description: '',
  icon: '',
  href: '',
  status: 'coming_soon',
  is_published: false,
  desktop_only: true,
  order_idx: 0,
}

export default function AdminOutilsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<ToolDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [publishConfirm, setPublishConfirm] = useState<Tool | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tools')
      .select('*')
      .order('order_idx', { ascending: true })
    setTools((data as Tool[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function startNew() {
    const maxIdx = tools.reduce((m, t) => Math.max(m, t.order_idx), 0)
    setDraft({ ...EMPTY_DRAFT, order_idx: maxIdx + 1 })
    setEditingId('new')
    setError(null)
  }

  function startEdit(tool: Tool) {
    setDraft({
      slug: tool.slug,
      title: tool.title,
      description: tool.description ?? '',
      icon: tool.icon ?? '',
      href: tool.href ?? '',
      status: tool.status,
      is_published: tool.is_published,
      desktop_only: tool.desktop_only,
      order_idx: tool.order_idx,
    })
    setEditingId(tool.id)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  async function saveDraft() {
    if (!draft.slug || !draft.title) {
      setError('Slug et titre obligatoires.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId === 'new') {
        const { error: err } = await supabase.from('tools').insert({
          slug: draft.slug,
          title: draft.title,
          description: draft.description || null,
          icon: draft.icon || null,
          href: draft.href || null,
          status: draft.status,
          is_published: draft.is_published,
          desktop_only: draft.desktop_only,
          order_idx: draft.order_idx,
        })
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('tools')
          .update({
            slug: draft.slug,
            title: draft.title,
            description: draft.description || null,
            icon: draft.icon || null,
            href: draft.href || null,
            status: draft.status,
            desktop_only: draft.desktop_only,
            order_idx: draft.order_idx,
          })
          .eq('id', editingId!)
        if (err) throw err
      }
      await load()
      cancelEdit()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish(tool: Tool) {
    if (!tool.is_published) {
      setPublishConfirm(tool)
    } else {
      await supabase.from('tools').update({ is_published: false }).eq('id', tool.id)
      await load()
    }
  }

  async function confirmPublish() {
    if (!publishConfirm) return
    setSaving(true)
    await supabase.from('tools').update({ is_published: true }).eq('id', publishConfirm.id)
    setPublishConfirm(null)
    setSaving(false)
    await load()
  }

  async function moveOrder(tool: Tool, direction: 'up' | 'down') {
    const sorted = [...tools].sort((a, b) => a.order_idx - b.order_idx)
    const idx = sorted.findIndex((t) => t.id === tool.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    await supabase.from('tools').update({ order_idx: other.order_idx }).eq('id', tool.id)
    await supabase.from('tools').update({ order_idx: tool.order_idx }).eq('id', other.id)
    await load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Boîte à outils</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérer les outils publiés dans l'application</p>
        </div>
        {editingId === null && (
          <button
            onClick={startNew}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-medium hover:bg-primary-hover transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvel outil
          </button>
        )}
      </div>

      {/* Formulaire création / édition */}
      {editingId !== null && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId === 'new' ? 'Nouvel outil' : "Modifier l'outil"}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slug *</label>
              <input
                type="text"
                value={draft.slug}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                placeholder="conformite"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Titre *</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Conformité cabinet"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
              <textarea
                value={draft.description ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Icône (lucide slug)</label>
              <input
                type="text"
                value={draft.icon ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                placeholder="shield-check"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lien (href)</label>
              <input
                type="text"
                value={draft.href ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, href: e.target.value }))}
                placeholder="/conformite"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Tool['status'] }))}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="active">Actif</option>
                <option value="coming_soon">Bientôt disponible</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ordre (order_idx)</label>
              <input
                type="number"
                value={draft.order_idx}
                onChange={(e) => setDraft((d) => ({ ...d, order_idx: parseInt(e.target.value) || 0 }))}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input
                id="desktop_only"
                type="checkbox"
                checked={draft.desktop_only}
                onChange={(e) => setDraft((d) => ({ ...d, desktop_only: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="desktop_only" className="text-sm text-gray-700">Desktop uniquement</label>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-2 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des outils */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Ordre</th>
                <th className="text-left px-5 py-3">Titre</th>
                <th className="text-left px-5 py-3">Slug</th>
                <th className="text-left px-5 py-3">Statut</th>
                <th className="text-left px-5 py-3">Publié</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool, i) => (
                <tr key={tool.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveOrder(tool, 'up')}
                        disabled={i === 0}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      >
                        <ArrowUp className="w-3 h-3 text-gray-500" />
                      </button>
                      <span className="w-6 text-center text-gray-500 font-mono text-xs">{tool.order_idx}</span>
                      <button
                        onClick={() => moveOrder(tool, 'down')}
                        disabled={i === tools.length - 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      >
                        <ArrowDown className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{tool.title}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{tool.slug}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tool.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tool.status === 'active' ? 'Actif' : 'Bientôt'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => togglePublish(tool)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        tool.is_published
                          ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {tool.is_published ? (
                        <><Eye className="w-3 h-3" />Publié</>
                      ) : (
                        <><EyeOff className="w-3 h-3" />Brouillon</>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => startEdit(tool)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de confirmation de publication */}
      {publishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Publier cet outil ?</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold">{publishConfirm.title}</span>
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Tous les praticiens recevront une notification.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={confirmPublish}
                disabled={saving}
                className="flex-1 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? 'Publication…' : 'Publier'}
              </button>
              <button
                onClick={() => setPublishConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
