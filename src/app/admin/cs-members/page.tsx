'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Plus,
  Loader2,
  X,
  Pencil,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCsMembers } from '@/lib/hooks/useEditorialValidations'
import type { CsMember } from '@/types/editorialValidations'
import { Button } from '@/components/ui/Button'

interface MemberFormState {
  display_name: string
  title: string
  bio_short: string
  photo_url: string
  expertise_areas_text: string
  is_lead: boolean
  active: boolean
  user_id: string
}

const EMPTY_FORM: MemberFormState = {
  display_name: '',
  title: '',
  bio_short: '',
  photo_url: '',
  expertise_areas_text: '',
  is_lead: false,
  active: true,
  user_id: '',
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  // joined_at is YYYY-MM-DD
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())
}

function MemberAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="w-10 h-10 rounded-full object-cover bg-gray-200"
        onError={(e) => ((e.currentTarget.style.display = 'none'))}
      />
    )
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return (
    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
      {initials || '?'}
    </div>
  )
}

export default function AdminCsMembersPage() {
  const { members, loading, error, refetch } = useCsMembers({ activeOnly: false })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CsMember | null>(null)
  const [form, setForm] = useState<MemberFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const activeLead = useMemo(
    () => members.find((m) => m.is_lead && m.active),
    [members]
  )

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSubmitError(null)
    setModalOpen(true)
  }

  const openEdit = (m: CsMember) => {
    setEditing(m)
    setForm({
      display_name: m.display_name,
      title: m.title || '',
      bio_short: m.bio_short || '',
      photo_url: m.photo_url || '',
      expertise_areas_text: (m.expertise_areas || []).join(', '),
      is_lead: m.is_lead,
      active: m.active,
      user_id: m.user_id || '',
    })
    setSubmitError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (submitting) return
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setSubmitError(null)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleToggleActive = async (m: CsMember) => {
    try {
      const supabase = createClient()
      const { error: updErr } = await supabase
        .from('cs_members')
        .update({ active: !m.active })
        .eq('id', m.id)
      if (updErr) throw updErr
      showToast(m.active ? 'Membre désactivé' : 'Membre réactivé')
      await refetch()
    } catch (err: any) {
      console.error('toggle active error:', err)
      showToast(err.message || 'Erreur lors du toggle actif')
    }
  }

  const handleSubmit = async () => {
    setSubmitError(null)

    // Validation client basique
    const display_name = form.display_name.trim()
    if (!display_name) {
      setSubmitError('Le nom affiché est requis.')
      return
    }
    if (form.user_id.trim() && !isUuid(form.user_id.trim())) {
      setSubmitError("user_id doit être un UUID valide ou laissé vide.")
      return
    }

    const expertise_areas = form.expertise_areas_text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const payload = {
      display_name,
      title: form.title.trim() || null,
      bio_short: form.bio_short.trim() || null,
      photo_url: form.photo_url.trim() || null,
      expertise_areas,
      is_lead: form.is_lead,
      active: form.active,
      user_id: form.user_id.trim() || null,
    }

    setSubmitting(true)
    try {
      const supabase = createClient()

      // Garde-fou is_lead : si on coche is_lead alors qu'un autre lead actif existe
      // (et que ce n'est pas celui qu'on édite), on retire le flag de l'ancien lead.
      if (
        payload.is_lead &&
        payload.active &&
        activeLead &&
        activeLead.id !== editing?.id
      ) {
        const { error: demoteErr } = await supabase
          .from('cs_members')
          .update({ is_lead: false })
          .eq('id', activeLead.id)
        if (demoteErr) throw demoteErr
      }

      if (editing) {
        const { error: updErr } = await supabase
          .from('cs_members')
          .update(payload)
          .eq('id', editing.id)
        if (updErr) throw updErr
        showToast('Membre mis à jour')
      } else {
        const { error: insErr } = await supabase
          .from('cs_members')
          .insert(payload)
        if (insErr) throw insErr
        showToast('Membre ajouté')
      }

      await refetch()
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    } catch (err: any) {
      console.error('cs_members submit error:', err)
      setSubmitError(err.message || "Erreur lors de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  const conflictWithExistingLead =
    form.is_lead &&
    form.active &&
    activeLead &&
    activeLead.id !== editing?.id

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comité scientifique</h1>
            <p className="text-sm text-gray-500">
              Membres validateurs éditoriaux (Ticket E Qualiopi #21 + article 50 §4 du règlement européen sur l'IA)
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={openCreate}
        >
          <Plus size={16} />
          Ajouter un membre
        </Button>
      </header>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
          Aucun membre du comité scientifique. Cliquez sur « Ajouter un membre ».
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Membre</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Domaines d'expertise</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Rejoint le</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((m) => (
                    <tr key={m.id} className={m.active ? 'text-gray-800' : 'text-gray-400'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <MemberAvatar url={m.photo_url} name={m.display_name} />
                          <div>
                            <div className="font-semibold">{m.display_name}</div>
                            {m.title && <div className="text-xs text-gray-500">{m.title}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {m.is_lead && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary text-white">
                              <ShieldCheck size={11} />
                              Lead
                            </span>
                          )}
                          {!m.active && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-200 text-gray-600">
                              Inactif
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {m.expertise_areas && m.expertise_areas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {m.expertise_areas.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {formatDateFr(m.joined_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label={`Modifier ${m.display_name}`}
                          >
                            <Pencil size={13} />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(m)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              m.active
                                ? 'text-orange-700 hover:bg-orange-50'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {m.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            {m.active ? 'Désactiver' : 'Réactiver'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {members.map((m) => (
              <div
                key={m.id}
                className={`bg-white rounded-2xl shadow p-4 ${m.active ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <MemberAvatar url={m.photo_url} name={m.display_name} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{m.display_name}</div>
                    {m.title && (
                      <div className="text-xs text-gray-500 mt-0.5">{m.title}</div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.is_lead && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary text-white">
                          <ShieldCheck size={11} />
                          Lead
                        </span>
                      )}
                      {!m.active && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-200 text-gray-600">
                          Inactif
                        </span>
                      )}
                    </div>
                    {m.expertise_areas && m.expertise_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.expertise_areas.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      Rejoint le {formatDateFr(m.joined_at)}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                      >
                        <Pencil size={13} />
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(m)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                          m.active
                            ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {m.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {m.active ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal create/edit */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cs-member-modal-title"
        >
          <div
            className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
              style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
            >
              <h2
                id="cs-member-modal-title"
                className="text-lg font-bold leading-snug"
                style={{ color: '#e5e5e5' }}
              >
                {editing ? 'Modifier un membre' : 'Ajouter un membre'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer"
                className="p-2 rounded-full flex-shrink-0 transition-colors"
                style={{ color: '#a3a3a3' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#242424')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
                  Nom affiché *
                </label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Dr Jean Dupont"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
                  Titre / fonction
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Chirurgien-dentiste, MCU-PH…"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
                  Bio courte
                </label>
                <textarea
                  rows={3}
                  value={form.bio_short}
                  onChange={(e) => setForm((f) => ({ ...f, bio_short: e.target.value }))}
                  placeholder="Présentation succincte affichée publiquement…"
                  className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-primary"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
                  URL de la photo
                </label>
                <input
                  type="url"
                  value={form.photo_url}
                  onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
                />
                <p className="text-[11px] mt-1" style={{ color: '#737373' }}>
                  Upload Storage non branché pour le MVP — saisir une URL publique.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
                  Domaines d'expertise (séparés par virgule)
                </label>
                <input
                  type="text"
                  value={form.expertise_areas_text}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expertise_areas_text: e.target.value }))
                  }
                  placeholder="esthetique, restauratrice, parodontie"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#e5e5e5' }}>
                  user_id (optionnel — UUID Supabase Auth)
                </label>
                <input
                  type="text"
                  value={form.user_id}
                  onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
                />
                <p className="text-[11px] mt-1" style={{ color: '#737373' }}>
                  Laisser vide pour un membre externe (sans compte app).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label
                  className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer select-none"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
                >
                  <input
                    type="checkbox"
                    checked={form.is_lead}
                    onChange={(e) => setForm((f) => ({ ...f, is_lead: e.target.checked }))}
                    className="accent-primary"
                  />
                  <span className="text-sm" style={{ color: '#e5e5e5' }}>
                    Lead (validateur principal)
                  </span>
                </label>
                <label
                  className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer select-none"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
                >
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="accent-primary"
                  />
                  <span className="text-sm" style={{ color: '#e5e5e5' }}>
                    Actif
                  </span>
                </label>
              </div>

              {conflictWithExistingLead && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl text-xs"
                  style={{ background: 'rgba(180,83,9,0.18)', border: '1px solid #b45309', color: '#fbbf24' }}
                >
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    Un autre membre est déjà lead ({activeLead?.display_name}). Cocher
                    déclenchera automatiquement le retrait du flag is_lead de ce membre.
                  </div>
                </div>
              )}

              {submitError && <p className="text-red-400 text-sm">{submitError}</p>}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 flex-shrink-0 flex items-center gap-3"
              style={{ background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}
            >
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: '#242424', color: '#e5e5e5' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#e5e5e5] px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  <span>{editing ? 'Mettre à jour' : 'Ajouter'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
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
