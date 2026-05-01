'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { NEWS_SPECIALITES } from '@/lib/constants/news'

const TITLE_MIN = 5
const TITLE_MAX = 300
const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/

interface FormState {
  url: string
  doi: string
  title: string
  journal: string
  authors: string
  published_at: string
  abstract: string
  spe_tags: string[]
}

const INITIAL_STATE: FormState = {
  url: '',
  doi: '',
  title: '',
  journal: '',
  authors: '',
  published_at: '',
  abstract: '',
  spe_tags: [],
}

export default function ManualIngestPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<
    { existing_raw_id: string; existing_synthesis_id: string | null } | null
  >(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Pré-remplissage Crossref
  const [doiPrefill, setDoiPrefill] = useState('')
  const [prefilling, setPrefilling] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)
  const [prefillToast, setPrefillToast] = useState<string | null>(null)

  // Auto-clear des toasts après 2s
  useEffect(() => {
    if (!prefillToast) return
    const t = setTimeout(() => setPrefillToast(null), 2000)
    return () => clearTimeout(t)
  }, [prefillToast])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleSpeTag = (slug: string) => {
    setForm((prev) => ({
      ...prev,
      spe_tags: prev.spe_tags.includes(slug)
        ? prev.spe_tags.filter((s) => s !== slug)
        : [...prev.spe_tags, slug],
    }))
  }

  const handlePrefill = async () => {
    const doi = doiPrefill.trim()
    if (!doi) {
      setPrefillError('Saisir un DOI')
      return
    }
    if (!DOI_REGEX.test(doi)) {
      setPrefillError('Format DOI invalide (ex : 10.1038/s41368-024-00328-6)')
      return
    }
    setPrefilling(true)
    setPrefillError(null)
    try {
      const res = await fetch(
        `/api/admin/news/manual-ingest/preview-doi?doi=${encodeURIComponent(doi)}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
      const m = json.metadata
      setForm((prev) => ({
        ...prev,
        url: m?.url ?? prev.url,
        doi: m?.doi ?? prev.doi,
        title: m?.title ?? prev.title,
        journal: m?.journal ?? prev.journal,
        authors: m?.authors ?? prev.authors,
        published_at: m?.published_at ?? prev.published_at,
        abstract: m?.abstract ?? prev.abstract,
      }))
      setPrefillToast('Pré-rempli depuis Crossref')
    } catch (err) {
      setPrefillError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPrefilling(false)
    }
  }

  const validateClient = (): string | null => {
    if (!form.url.trim()) return 'URL requise'
    try {
      const parsed = new URL(form.url.trim())
      if (!/^https?:$/.test(parsed.protocol)) return 'URL doit être http(s)'
    } catch {
      return 'URL invalide'
    }
    if (form.doi.trim() && !DOI_REGEX.test(form.doi.trim())) {
      return 'Format DOI invalide'
    }
    const title = form.title.trim()
    if (!title) return 'Titre requis'
    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      return `Titre doit contenir entre ${TITLE_MIN} et ${TITLE_MAX} caractères`
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setDuplicate(null)
    const clientErr = validateClient()
    if (clientErr) {
      setSubmitError(clientErr)
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        url: form.url.trim(),
        doi: form.doi.trim() || null,
        title: form.title.trim(),
        journal: form.journal.trim() || null,
        authors: form.authors.trim() || null,
        published_at: form.published_at.trim() || null,
        abstract: form.abstract.trim() || null,
        spe_tags: form.spe_tags,
      }
      const res = await fetch('/api/admin/news/manual-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (res.status === 409) {
        setDuplicate({
          existing_raw_id: json.existing_raw_id,
          existing_synthesis_id: json.existing_synthesis_id ?? null,
        })
        return
      }
      if (!res.ok) {
        const detail = Array.isArray(json.details)
          ? json.details.map((d: any) => `${d.field} : ${d.message}`).join(' • ')
          : ''
        throw new Error(detail || json.error || `Erreur ${res.status}`)
      }
      const shortId = String(json.raw_id || '').slice(0, 8)
      setSuccessToast(`Article ingéré (ID : ${shortId}…)`)
      setTimeout(() => router.push('/admin/news'), 2000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/admin/news"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          Ingérer un article manuellement
        </h1>
        <p className="text-sm text-gray-500">
          Ajout ad hoc d'un article scientifique. Renseignez les métadonnées
          disponibles puis lancez le pipeline. L'article sera ensuite scoré et
          synthétisé comme les articles automatiques.
        </p>
      </header>

      {/* Bloc Crossref */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-700" />
          <h2 className="text-sm font-semibold text-blue-900">
            Pré-remplissage rapide
          </h2>
        </div>
        <p className="text-xs text-blue-800 mb-3">
          Vous avez un DOI ? Pré-remplissez le formulaire automatiquement.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={doiPrefill}
            onChange={(e) => setDoiPrefill(e.target.value)}
            placeholder="10.1234/abcd.5678"
            disabled={prefilling}
            className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white text-gray-900 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
          />
          <button
            onClick={handlePrefill}
            disabled={prefilling || !doiPrefill.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {prefilling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {prefilling ? 'Récupération…' : 'Pré-remplir depuis Crossref'}
          </button>
        </div>
        {prefillError && (
          <div className="mt-2 inline-flex items-start gap-1.5 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{prefillError}</span>
          </div>
        )}
        {prefillToast && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            {prefillToast}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <FieldText
          label="URL de l'article"
          required
          type="url"
          value={form.url}
          onChange={(v) => setField('url', v)}
          placeholder="https://pubmed.ncbi.nlm.nih.gov/..."
        />
        <FieldText
          label="DOI (optionnel)"
          value={form.doi}
          onChange={(v) => setField('doi', v)}
          placeholder="10.1234/abcd.5678"
        />
        <FieldTextarea
          label="Titre"
          required
          rows={2}
          value={form.title}
          onChange={(v) => setField('title', v)}
          placeholder="Titre de l'article"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldText
            label="Journal"
            value={form.journal}
            onChange={(v) => setField('journal', v)}
            placeholder="J Dent Res"
          />
          <FieldText
            label="Date de publication"
            type="date"
            value={form.published_at}
            onChange={(v) => setField('published_at', v)}
          />
        </div>
        <FieldText
          label="Auteurs"
          value={form.authors}
          onChange={(v) => setField('authors', v)}
          placeholder="Dupont J, Martin P, ..."
        />
        <FieldTextarea
          label="Abstract"
          rows={6}
          value={form.abstract}
          onChange={(v) => setField('abstract', v)}
          placeholder="Résumé scientifique de l'article…"
        />

        {/* Spécialités suggérées */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Spécialités suggérées (optionnel)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Optionnel — aide le scoring à mieux orienter la synthèse.
          </p>
          <div className="flex flex-wrap gap-2">
            {NEWS_SPECIALITES.map((s) => {
              const active = form.spe_tags.includes(s.value)
              return (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => toggleSpeTag(s.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-[#2D1B96] text-white border-[#2D1B96]'
                      : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {duplicate && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-800">
                Cet article est déjà dans votre veille
              </p>
            </div>
            <p className="text-xs text-red-700 mb-3">
              Ingestion bloquée pour éviter les doublons. Vous pouvez consulter
              la version existante ci-dessous.
            </p>
            {duplicate.existing_synthesis_id ? (
              <Link
                href={`/admin/news/${duplicate.existing_synthesis_id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-red-800 hover:underline"
              >
                Voir la synthèse →
              </Link>
            ) : (
              <p className="text-xs text-red-700 italic">
                Article ingéré mais pas encore synthétisé (raw_id :{' '}
                <span className="font-mono">{duplicate.existing_raw_id.slice(0, 8)}…</span>)
              </p>
            )}
          </div>
        )}

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {successToast && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-700">
              {successToast} — redirection en cours…
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 italic flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Vérifiez les métadonnées avant validation. Une fois ingéré, l'article
          passera dans le pipeline de scoring automatique. Vous pourrez toujours
          le supprimer ou le modifier depuis la page détail après synthèse.
        </p>

        <button
          type="submit"
          disabled={submitting || !!successToast}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : null}
          {submitting ? 'Ingestion en cours…' : 'Ingérer l\'article'}
        </button>
      </form>
    </div>
  )
}

// ---------- Champs réutilisables ----------

function FieldText({
  label,
  required,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string
  required?: boolean
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
      />
    </div>
  )
}

function FieldTextarea({
  label,
  required,
  rows,
  value,
  onChange,
  placeholder,
}: {
  label: string
  required?: boolean
  rows: number
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <textarea
        required={required}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96] resize-y"
      />
    </div>
  )
}
