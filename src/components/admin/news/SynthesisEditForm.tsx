'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, X } from 'lucide-react'
import { TaxonomyPicker } from './TaxonomyPicker'
import { KeyFiguresEditor } from './KeyFiguresEditor'
import { EpisodeRegenerationPanel } from './EpisodeRegenerationPanel'

// ============================================================================
// <SynthesisEditForm> — POC-T12-C
//
// Client Component. Page d'édition d'une synthèse news. Layout M1 finale :
//   - sidebar sticky droite 360px (viewport ≥ 1280px / xl:)
//   - drawer modal fallback (viewport < xl:) via bouton "↗ Détails source"
//   - sections principales : Taxonomie → Bloc texte → Footer info
//   - section Régénération audio + timeline : CACHÉE en T12-C (livrée T12-D)
//   - sticky footer [Annuler] / [Sauvegarder]
//
// Dirty check : comparaison strict champ par champ entre `initial` (snapshot)
// et `form` (état courant). PATCH n'envoie QUE les champs modifiés via diff().
// Compteur display_title coloré gris/ambre/vert/rouge selon longueur, rejet
// inline ≥71 (avant submit), parité validation T12-A serveur.
// ============================================================================

type CategoryEditorial = 'reglementaire' | 'scientifique' | 'pratique' | 'humour'

interface Synthesis {
  id: string
  display_title: string | null
  summary_fr: string | null
  method: string | null
  key_figures: string[] | null
  evidence_level: string | null
  clinical_impact: string | null
  caveats: string | null
  specialite: string | null
  themes: string[] | null
  niveau_preuve: string | null
  category_editorial: string | null
  formation_category_match: string | null
  last_edited_at: string | null
  last_edited_by: string | null
}

interface RawSource {
  title: string
  url: string | null
  doi: string | null
  journal: string | null
  published_at: string | null
  abstract: string | null
}

interface FormState {
  display_title: string
  summary_fr: string
  method: string
  key_figures: string[]
  evidence_level: string
  clinical_impact: string
  caveats: string
  specialite: string | null
  themes: string[]
  niveau_preuve: string | null
  category_editorial: CategoryEditorial | null
}

const CATEGORIES: CategoryEditorial[] = ['reglementaire', 'scientifique', 'pratique', 'humour']
const CATEGORY_LABELS: Record<CategoryEditorial, string> = {
  reglementaire: 'Réglementaire',
  scientifique: 'Scientifique',
  pratique: 'Pratique',
  humour: 'Humour',
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function toForm(s: Synthesis): FormState {
  return {
    display_title: s.display_title ?? '',
    summary_fr: s.summary_fr ?? '',
    method: s.method ?? '',
    key_figures: s.key_figures ?? [],
    evidence_level: s.evidence_level ?? '',
    clinical_impact: s.clinical_impact ?? '',
    caveats: s.caveats ?? '',
    specialite: s.specialite,
    themes: s.themes ?? [],
    niveau_preuve: s.niveau_preuve,
    category_editorial: (s.category_editorial as CategoryEditorial | null) ?? null,
  }
}

function arrEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function isEqual(a: FormState, b: FormState): boolean {
  return (
    a.display_title === b.display_title &&
    a.summary_fr === b.summary_fr &&
    a.method === b.method &&
    a.evidence_level === b.evidence_level &&
    a.clinical_impact === b.clinical_impact &&
    a.caveats === b.caveats &&
    a.specialite === b.specialite &&
    a.niveau_preuve === b.niveau_preuve &&
    a.category_editorial === b.category_editorial &&
    arrEqual(a.key_figures, b.key_figures) &&
    arrEqual(a.themes, b.themes)
  )
}

// Construit le payload PATCH avec seulement les champs modifiés. Les champs
// texte vidés (string '') sont envoyés en null pour les colonnes nullable.
function diffPayload(initial: FormState, current: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (current.display_title !== initial.display_title) {
    out.display_title = current.display_title
  }
  if (current.summary_fr !== initial.summary_fr) {
    out.summary_fr = current.summary_fr
  }
  if (current.method !== initial.method) {
    out.method = current.method || null
  }
  if (current.evidence_level !== initial.evidence_level) {
    out.evidence_level = current.evidence_level || null
  }
  if (current.clinical_impact !== initial.clinical_impact) {
    out.clinical_impact = current.clinical_impact || null
  }
  if (current.caveats !== initial.caveats) {
    out.caveats = current.caveats || null
  }
  if (current.specialite !== initial.specialite) {
    out.specialite = current.specialite
  }
  if (current.niveau_preuve !== initial.niveau_preuve) {
    out.niveau_preuve = current.niveau_preuve
  }
  if (current.category_editorial !== initial.category_editorial) {
    out.category_editorial = current.category_editorial
  }
  if (!arrEqual(current.key_figures, initial.key_figures)) {
    out.key_figures = current.key_figures
  }
  if (!arrEqual(current.themes, initial.themes)) {
    out.themes = current.themes
  }
  return out
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function titleColorClass(len: number): string {
  if (len > 70) return 'text-red-600'
  if (len === 70) return 'text-green-600'
  if (len >= 60) return 'text-amber-600'
  return 'text-gray-400'
}

// ----------------------------------------------------------------------------
// Composant principal
// ----------------------------------------------------------------------------

export function SynthesisEditForm({
  synthesis,
  raw,
  lastEditedByName,
}: {
  synthesis: Synthesis
  raw: RawSource | null
  lastEditedByName: string | null
}) {
  const router = useRouter()

  const [initial, setInitial] = useState<FormState>(() => toForm(synthesis))
  const [form, setForm] = useState<FormState>(() => toForm(synthesis))
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Affichage "Dernière modif" : maintenu en local pour refléter la sauvegarde
  // en cours sans re-fetch serveur.
  const [lastEdited, setLastEdited] = useState<{ at: string | null; by: string | null }>({
    at: synthesis.last_edited_at,
    by: lastEditedByName,
  })

  const dirty = !isEqual(initial, form)

  const titleLen = form.display_title.length
  const titleColor = titleColorClass(titleLen)
  const titleInvalid = titleLen > 70

  // Avertissement client summary_fr < 50 : uniquement si le champ a été modifié
  // (évite de bloquer le save sur une synthèse Sonnet historique dont le
  // summary_fr non-touché ferait <50 — cas théorique mais défensif).
  const summaryChanged = form.summary_fr !== initial.summary_fr
  const summaryInvalid = summaryChanged && form.summary_fr.length < 50

  const canSave = dirty && !saving && !titleInvalid && !summaryInvalid

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSave = async () => {
    setSaving(true)
    setErrorMsg(null)
    try {
      const body = diffPayload(initial, form)
      if (Object.keys(body).length === 0) {
        setErrorMsg('Aucun champ modifié')
        return
      }

      const res = await fetch(`/api/admin/news/syntheses/${synthesis.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`)
      }

      // Reset dirty : nouveau snapshot = form courant. Mise à jour audit
      // footer avec la valeur retournée par le serveur.
      const updated = data.synthesis as Synthesis | undefined
      if (updated) {
        const newForm = toForm(updated)
        setForm(newForm)
        setInitial(newForm)
        setLastEdited({
          at: updated.last_edited_at,
          // by reste inchangé (c'est l'utilisateur courant qui vient de sauvegarder)
          by: lastEdited.by,
        })
      } else {
        setInitial(form)
      }

      setToastMsg('Modifications enregistrées')
      setTimeout(() => setToastMsg(null), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const onCancel = () => {
    if (dirty) {
      const confirmed = window.confirm(
        'Modifications non sauvegardées. Quitter quand même ?',
      )
      if (!confirmed) return
    }
    router.push(`/admin/news/${synthesis.id}`)
  }

  // --------------------------------------------------------------------------
  // Rendu
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* En-tête : breadcrumb + bouton drawer (mobile) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/admin/news/${synthesis.id}`}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au détail
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="xl:hidden inline-flex items-center gap-1 text-sm border border-gray-300 rounded px-3 py-1.5 bg-white hover:bg-gray-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Détails source
          </button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">
          Édition — {synthesis.display_title || 'Sans titre'}
        </h1>
      </div>

      {/* Grid principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* Colonne principale */}
          <main className="space-y-6 min-w-0">
            <Section title="Taxonomie">
              <FieldRow label="Spécialité">
                <TaxonomyPicker
                  type="specialite"
                  mode="single"
                  value={form.specialite}
                  onChange={(v) => updateField('specialite', v)}
                />
              </FieldRow>
              <FieldRow label="Niveau de preuve">
                <TaxonomyPicker
                  type="niveau_preuve"
                  mode="single"
                  value={form.niveau_preuve}
                  onChange={(v) => updateField('niveau_preuve', v)}
                />
              </FieldRow>
              <FieldRow label="Thèmes">
                <TaxonomyPicker
                  type="theme"
                  mode="multi"
                  value={form.themes}
                  onChange={(v) => updateField('themes', v)}
                />
              </FieldRow>
              <FieldRow label="Catégorie éditoriale">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="category_editorial"
                        value={cat}
                        checked={form.category_editorial === cat}
                        onChange={() => updateField('category_editorial', cat)}
                      />
                      {CATEGORY_LABELS[cat]}
                    </label>
                  ))}
                  {form.category_editorial !== null && (
                    <button
                      type="button"
                      onClick={() => updateField('category_editorial', null)}
                      className="text-xs text-gray-500 underline hover:text-gray-700"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </FieldRow>
            </Section>

            <Section title="Bloc texte">
              <FieldRow
                label={
                  <span>
                    Titre court{' '}
                    <span className={`text-xs font-normal ${titleColor}`}>
                      [{titleLen}/70]
                    </span>
                  </span>
                }
              >
                <input
                  type="text"
                  value={form.display_title}
                  onChange={(e) => updateField('display_title', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Ex. Greffes vs tunnel : verdict 2026"
                />
                {titleInvalid && (
                  <p className="mt-1 text-xs text-red-600">
                    70 caractères max — le titre dépasse de {titleLen - 70}.
                  </p>
                )}
              </FieldRow>

              <FieldRow
                label={
                  <span>
                    Résumé FR{' '}
                    <span className="text-xs font-normal text-gray-400">
                      (≥ 50 caractères)
                    </span>
                  </span>
                }
              >
                <textarea
                  value={form.summary_fr}
                  onChange={(e) => updateField('summary_fr', e.target.value)}
                  rows={6}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
                {summaryInvalid && (
                  <p className="mt-1 text-xs text-red-600">
                    summary_fr doit contenir au moins 50 caractères
                    (actuellement {form.summary_fr.length}).
                  </p>
                )}
              </FieldRow>

              <FieldRow label="Méthode">
                <textarea
                  value={form.method}
                  onChange={(e) => updateField('method', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </FieldRow>

              <FieldRow label="Chiffres clés">
                <KeyFiguresEditor
                  value={form.key_figures}
                  onChange={(v) => updateField('key_figures', v)}
                />
              </FieldRow>

              <FieldRow label="Niveau de preuve (résumé éditorial)">
                <input
                  type="text"
                  value={form.evidence_level}
                  onChange={(e) => updateField('evidence_level', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Ex. Méta-analyse Cochrane, niveau 1a"
                />
              </FieldRow>

              <FieldRow label="Impact clinique">
                <textarea
                  value={form.clinical_impact}
                  onChange={(e) => updateField('clinical_impact', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </FieldRow>

              <FieldRow label="Limites / précautions">
                <textarea
                  value={form.caveats}
                  onChange={(e) => updateField('caveats', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </FieldRow>
            </Section>

            {/* Régénération audio + timeline (T12-D-3 — section entièrement
                cachée si 0 episode lié, géré côté composant) */}
            <EpisodeRegenerationPanel synthesisId={synthesis.id} />

            {/* Footer info dernière modif (visible uniquement si non-null) */}
            {lastEdited.at && (
              <p className="text-sm text-gray-500">
                Dernière modification : {formatTimestamp(lastEdited.at)}
                {lastEdited.by ? ` — ${lastEdited.by}` : ''}
              </p>
            )}
          </main>

          {/* Sidebar sticky (xl+ uniquement) */}
          <aside className="hidden xl:block">
            <div className="sticky top-6">
              <MetadataPanel raw={raw} />
            </div>
          </aside>
        </div>
      </div>

      {/* Drawer mobile (< xl) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute right-0 top-0 h-full w-[360px] max-w-[90vw] bg-white border-l border-gray-200 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Métadonnées (read-only)
                </h3>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Fermer"
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <MetadataPanel raw={raw} embedded />
            </div>
          </aside>
        </div>
      )}

      {/* Sticky footer save */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            {errorMsg && <span className="text-red-600">{errorMsg}</span>}
            {toastMsg && !errorMsg && (
              <span className="text-green-600">{toastMsg}</span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="text-sm font-medium rounded px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Sous-composants
// ----------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200 rounded p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

function MetadataPanel({
  raw,
  embedded = false,
}: {
  raw: RawSource | null
  embedded?: boolean
}) {
  const container = embedded
    ? 'space-y-3 text-sm'
    : 'bg-white border border-gray-200 rounded p-4 space-y-3 text-sm'

  if (!raw) {
    return (
      <div className={container}>
        {!embedded && (
          <h3 className="text-sm font-semibold text-gray-700">
            Métadonnées (read-only)
          </h3>
        )}
        <p className="text-gray-400">Aucune source brute liée.</p>
      </div>
    )
  }

  return (
    <div className={container}>
      {!embedded && (
        <h3 className="text-sm font-semibold text-gray-700">
          Métadonnées (read-only)
        </h3>
      )}
      <Field label="DOI" value={raw.doi} />
      <Field label="Journal" value={raw.journal} />
      <Field
        label="Publication"
        value={raw.published_at ? formatDateShort(raw.published_at) : null}
      />
      <Field label="Titre original" value={raw.title} />
      {raw.abstract && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Abstract source</p>
          <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50 text-xs whitespace-pre-wrap">
            {raw.abstract}
          </div>
        </div>
      )}
      {raw.url && (
        <a
          href={raw.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Lien article source
        </a>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
