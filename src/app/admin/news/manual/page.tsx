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
  Plus,
  Trash2,
  X as XIcon,
} from 'lucide-react'
import {
  NEWS_SPECIALITES,
  NEWS_NIVEAU_PREUVE,
  NEWS_CATEGORIES_EDITORIALES,
} from '@/lib/constants/news'

const TITLE_MIN = 5
const TITLE_MAX = 300
const DISPLAY_TITLE_MAX = 70
const SUMMARY_MIN = 100
const QUESTIONS_MIN = 3
const QUESTIONS_MAX = 4
const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/

type Mode = 'auto' | 'enriched'

export default function ManualIngestPage() {
  const [mode, setMode] = useState<Mode>('auto')

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
          Deux modes disponibles. <strong>Pipeline auto</strong> : on saisit les
          métadonnées, le scoring + la synthèse passent par le pipeline LLM.
          <strong> Enrichi manuel</strong> : on rédige soi-même la synthèse et
          les questions, l'article devient immédiatement disponible.
        </p>
      </header>

      {/* Toggle mode */}
      <div
        role="tablist"
        aria-label="Mode d'ingestion"
        className="inline-flex p-1 bg-gray-100 rounded-xl mb-6 gap-1"
      >
        <ModeTab
          active={mode === 'auto'}
          onClick={() => setMode('auto')}
          label="Mode pipeline auto"
        />
        <ModeTab
          active={mode === 'enriched'}
          onClick={() => setMode('enriched')}
          label="Mode enrichi manuel"
        />
      </div>

      {mode === 'auto' ? <AutoModeForm /> : <EnrichedStepper />}
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-white text-[#2D1B96] shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Mode auto — comportement T8-P1 inchangé.
// ---------------------------------------------------------------------------

interface AutoFormState {
  url: string
  doi: string
  title: string
  journal: string
  authors: string
  published_at: string
  abstract: string
  spe_tags: string[]
}

const AUTO_INITIAL: AutoFormState = {
  url: '',
  doi: '',
  title: '',
  journal: '',
  authors: '',
  published_at: '',
  abstract: '',
  spe_tags: [],
}

function AutoModeForm() {
  const router = useRouter()
  const [form, setForm] = useState<AutoFormState>(AUTO_INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<
    { existing_raw_id: string; existing_synthesis_id: string | null } | null
  >(null)
  const [doiPrefill, setDoiPrefill] = useState('')
  const [prefilling, setPrefilling] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)
  const [prefillToast, setPrefillToast] = useState<string | null>(null)

  useEffect(() => {
    if (!prefillToast) return
    const t = setTimeout(() => setPrefillToast(null), 2000)
    return () => clearTimeout(t)
  }, [prefillToast])

  const setField = <K extends keyof AutoFormState>(
    key: K,
    value: AutoFormState[K],
  ) => {
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
        `/api/admin/news/manual-ingest/preview-doi?doi=${encodeURIComponent(doi)}`,
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
      router.push(`/admin/news/manual/result/${json.raw_id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
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

        <SpeTagPicker
          selected={form.spe_tags}
          onToggle={toggleSpeTag}
          label="Spécialités suggérées (optionnel)"
          help="Optionnel — aide le scoring à mieux orienter la synthèse."
        />

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
                <span className="font-mono">
                  {duplicate.existing_raw_id.slice(0, 8)}…
                </span>
                )
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

        <p className="text-xs text-gray-500 italic flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Vérifiez les métadonnées avant validation. Une fois ingéré, l'article
          passera dans le pipeline de scoring automatique.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? 'Ingestion en cours…' : "Ingérer l'article"}
        </button>
      </form>
    </>
  )
}

// ---------------------------------------------------------------------------
// Mode enrichi — stepper 3 étapes.
// ---------------------------------------------------------------------------

interface MetaFields {
  title: string
  url: string
  doi: string
  journal: string
  abstract: string
  spe_tags: string[]
}

interface SynthesisFields {
  display_title: string
  summary_fr: string
  clinical_impact: string
  evidence_level: string
  key_figures: string[]
  caveats: string
  category_editorial: string
  formation_category_match: string
  specialite: string
}

type QuestionType = 'mcq' | 'true_false'

interface QuestionDraft {
  id: string
  question_type: QuestionType
  text: string
  options: Array<{ id: string; text: string; correct: boolean }>
  feedback: string
}

const META_INITIAL: MetaFields = {
  title: '',
  url: '',
  doi: '',
  journal: '',
  abstract: '',
  spe_tags: [],
}

const SYNTH_INITIAL: SynthesisFields = {
  display_title: '',
  summary_fr: '',
  clinical_impact: '',
  evidence_level: '',
  key_figures: [],
  caveats: '',
  category_editorial: '',
  formation_category_match: '',
  specialite: '',
}

const newQuestionDraft = (type: QuestionType): QuestionDraft => {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  if (type === 'true_false') {
    return {
      id,
      question_type: 'true_false',
      text: '',
      options: [
        { id: 'A', text: 'Vrai', correct: true },
        { id: 'B', text: 'Faux', correct: false },
      ],
      feedback: '',
    }
  }
  return {
    id,
    question_type: 'mcq',
    text: '',
    options: [
      { id: 'A', text: '', correct: true },
      { id: 'B', text: '', correct: false },
      { id: 'C', text: '', correct: false },
      { id: 'D', text: '', correct: false },
    ],
    feedback: '',
  }
}

function EnrichedStepper() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [meta, setMeta] = useState<MetaFields>(META_INITIAL)
  const [synthesis, setSynthesis] = useState<SynthesisFields>(SYNTH_INITIAL)
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setMetaField = <K extends keyof MetaFields>(
    key: K,
    value: MetaFields[K],
  ) => setMeta((prev) => ({ ...prev, [key]: value }))

  const setSynthField = <K extends keyof SynthesisFields>(
    key: K,
    value: SynthesisFields[K],
  ) => setSynthesis((prev) => ({ ...prev, [key]: value }))

  const toggleMetaSpeTag = (slug: string) => {
    setMeta((prev) => ({
      ...prev,
      spe_tags: prev.spe_tags.includes(slug)
        ? prev.spe_tags.filter((s) => s !== slug)
        : [...prev.spe_tags, slug],
    }))
  }

  const step1Valid = meta.title.trim().length > 0
  const step2Valid =
    synthesis.display_title.trim().length > 0 &&
    synthesis.display_title.length <= DISPLAY_TITLE_MAX &&
    synthesis.summary_fr.trim().length >= SUMMARY_MIN

  const handleSubmit = async () => {
    setSubmitError(null)

    if (questions.length < QUESTIONS_MIN) {
      setSubmitError(`Minimum ${QUESTIONS_MIN} questions requises`)
      return
    }
    if (questions.length > QUESTIONS_MAX) {
      setSubmitError(`Maximum ${QUESTIONS_MAX} questions autorisées`)
      return
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.text.trim()) {
        setSubmitError(`Question ${i + 1} : énoncé requis`)
        return
      }
      const correct = q.options.filter((o) => o.correct).length
      if (correct !== 1) {
        setSubmitError(
          `Question ${i + 1} : exactement une option doit être marquée correcte`,
        )
        return
      }
      if (q.options.some((o) => !o.text.trim())) {
        setSubmitError(`Question ${i + 1} : chaque option doit avoir un texte`)
        return
      }
      if (!q.feedback.trim()) {
        setSubmitError(`Question ${i + 1} : feedback requis`)
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        title: meta.title.trim(),
        url: meta.url.trim() || null,
        doi: meta.doi.trim() || null,
        journal: meta.journal.trim() || null,
        abstract: meta.abstract.trim() || null,
        spe_tags: meta.spe_tags,
        display_title: synthesis.display_title.trim(),
        summary_fr: synthesis.summary_fr.trim(),
        clinical_impact: synthesis.clinical_impact.trim() || null,
        evidence_level: synthesis.evidence_level || null,
        key_figures: synthesis.key_figures,
        caveats: synthesis.caveats.trim() || null,
        category_editorial: synthesis.category_editorial || null,
        formation_category_match:
          synthesis.formation_category_match.trim() || null,
        specialite: synthesis.specialite || null,
        questions: questions.map((q) => ({
          question_type: q.question_type,
          text: q.text.trim(),
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text.trim(),
            correct: o.correct,
          })),
          feedback: q.feedback.trim(),
        })),
      }

      const res = await fetch('/api/admin/news/manual-enriched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = Array.isArray(json.details)
          ? json.details.map((d: any) => `${d.field} : ${d.message}`).join(' • ')
          : ''
        throw new Error(detail || json.error || `Erreur ${res.status}`)
      }
      router.push(`/admin/news/${json.synthesis_id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <StepperHeader step={step} />

      {step === 1 && (
        <Step1Meta
          meta={meta}
          setField={setMetaField}
          toggleSpeTag={toggleMetaSpeTag}
        />
      )}
      {step === 2 && (
        <Step2Synthesis synthesis={synthesis} setField={setSynthField} />
      )}
      {step === 3 && (
        <Step3Questions questions={questions} setQuestions={setQuestions} />
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() =>
            setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))
          }
          disabled={step === 1 || submitting}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Précédent
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 1 && !step1Valid) return
              if (step === 2 && !step2Valid) return
              setStep((s) => ((s + 1) as 1 | 2 | 3))
            }}
            disabled={
              (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Suivant →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || questions.length < QUESTIONS_MIN}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
      </div>
    </div>
  )
}

function StepperHeader({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Métadonnées' },
    { n: 2, label: 'Synthèse' },
    { n: 3, label: 'Questions' },
  ]
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const active = step === s.n
        const done = step > s.n
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-semibold ${
                active
                  ? 'bg-[#2D1B96] text-white'
                  : done
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {done ? <CheckCircle className="w-4 h-4" /> : s.n}
            </span>
            <span
              className={`font-medium ${
                active ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="w-8 h-px bg-gray-200 mx-1" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ---------- Étape 1 : Métadonnées ----------

function Step1Meta({
  meta,
  setField,
  toggleSpeTag,
}: {
  meta: MetaFields
  setField: <K extends keyof MetaFields>(k: K, v: MetaFields[K]) => void
  toggleSpeTag: (slug: string) => void
}) {
  return (
    <section className="space-y-5">
      <FieldTextarea
        label="Titre"
        required
        rows={2}
        value={meta.title}
        onChange={(v) => setField('title', v)}
        placeholder="Titre original de l'article"
      />
      <FieldText
        label="URL de l'article (optionnel)"
        type="url"
        value={meta.url}
        onChange={(v) => setField('url', v)}
        placeholder="https://pubmed.ncbi.nlm.nih.gov/..."
      />
      <FieldText
        label="DOI (optionnel)"
        value={meta.doi}
        onChange={(v) => setField('doi', v)}
        placeholder="10.1234/abcd.5678"
      />
      <FieldText
        label="Journal (optionnel)"
        value={meta.journal}
        onChange={(v) => setField('journal', v)}
        placeholder="J Dent Res"
      />
      <FieldTextarea
        label="Abstract (optionnel)"
        rows={5}
        value={meta.abstract}
        onChange={(v) => setField('abstract', v)}
        placeholder="Résumé scientifique original…"
      />
      <SpeTagPicker
        selected={meta.spe_tags}
        onToggle={toggleSpeTag}
        label="Spécialités (optionnel)"
        help="Tags multi-valeurs sauvegardés sur news_scored.spe_tags."
      />
    </section>
  )
}

// ---------- Étape 2 : Synthèse ----------

function Step2Synthesis({
  synthesis,
  setField,
}: {
  synthesis: SynthesisFields
  setField: <K extends keyof SynthesisFields>(
    k: K,
    v: SynthesisFields[K],
  ) => void
}) {
  const titleLen = synthesis.display_title.length
  const titleOver = titleLen > DISPLAY_TITLE_MAX
  const summaryLen = synthesis.summary_fr.length
  const summaryShort = summaryLen > 0 && summaryLen < SUMMARY_MIN

  return (
    <section className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Titre éditorial<span className="text-red-600 ml-0.5">*</span>
        </label>
        <input
          type="text"
          value={synthesis.display_title}
          onChange={(e) => setField('display_title', e.target.value)}
          className={`w-full px-3 py-2 text-sm bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 ${
            titleOver
              ? 'border-red-400 focus:ring-red-200'
              : 'border-gray-200 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]'
          }`}
          placeholder="Titre court accrocheur (vu sur la liste News)"
        />
        <p
          className={`mt-1 text-xs ${titleOver ? 'text-red-600' : 'text-gray-500'}`}
        >
          {titleLen}/{DISPLAY_TITLE_MAX} caractères
          {titleOver && ' — limite dépassée'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Résumé FR<span className="text-red-600 ml-0.5">*</span>
        </label>
        <textarea
          rows={8}
          value={synthesis.summary_fr}
          onChange={(e) => setField('summary_fr', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96] resize-y"
          placeholder="Résumé synthétique en français (≥100 caractères)…"
        />
        <p
          className={`mt-1 text-xs ${summaryShort ? 'text-amber-700' : 'text-gray-500'}`}
        >
          {summaryLen} caractères{summaryShort && ` (min ${SUMMARY_MIN})`}
        </p>
      </div>

      <FieldTextarea
        label="Impact clinique (optionnel)"
        rows={3}
        value={synthesis.clinical_impact}
        onChange={(v) => setField('clinical_impact', v)}
        placeholder="Conséquences pratiques pour le praticien…"
      />

      <FieldTextarea
        label="Limites / mises en garde (optionnel)"
        rows={3}
        value={synthesis.caveats}
        onChange={(v) => setField('caveats', v)}
        placeholder="Biais, limites méthodologiques, prudence…"
      />

      <KeyFiguresEditor
        figures={synthesis.key_figures}
        onChange={(arr) => setField('key_figures', arr)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldSelect
          label="Niveau de preuve"
          value={synthesis.evidence_level}
          onChange={(v) => setField('evidence_level', v)}
          options={NEWS_NIVEAU_PREUVE.map((n) => ({
            value: n.value,
            label: n.label,
          }))}
          placeholder="— Choisir —"
        />
        <FieldSelect
          label="Catégorie éditoriale"
          value={synthesis.category_editorial}
          onChange={(v) => setField('category_editorial', v)}
          options={NEWS_CATEGORIES_EDITORIALES.map((c) => ({
            value: c.value,
            label: c.label,
          }))}
          placeholder="— Choisir —"
        />
        <FieldSelect
          label="Spécialité"
          value={synthesis.specialite}
          onChange={(v) => setField('specialite', v)}
          options={NEWS_SPECIALITES.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
          placeholder="— Choisir —"
        />
        <FieldText
          label="Catégorie formation (slug)"
          value={synthesis.formation_category_match}
          onChange={(v) => setField('formation_category_match', v)}
          placeholder="ex : restauratrice"
        />
      </div>
    </section>
  )
}

function KeyFiguresEditor({
  figures,
  onChange,
}: {
  figures: string[]
  onChange: (arr: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...figures, v])
    setDraft('')
  }
  const remove = (idx: number) => {
    onChange(figures.filter((_, i) => i !== idx))
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        Chiffres clés (optionnel)
      </label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="ex : 73 % de succès à 5 ans"
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-white text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>
      {figures.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {figures.map((f, i) => (
            <li
              key={`${i}-${f}`}
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-800"
            >
              <span>{f}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-gray-700"
                aria-label={`Retirer ${f}`}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Étape 3 : Questions ----------

function Step3Questions({
  questions,
  setQuestions,
}: {
  questions: QuestionDraft[]
  setQuestions: (qs: QuestionDraft[]) => void
}) {
  const addQuestion = (type: QuestionType) => {
    if (questions.length >= QUESTIONS_MAX) return
    setQuestions([...questions, newQuestionDraft(type)])
  }

  const updateQuestion = (id: string, patch: Partial<QuestionDraft>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    )
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id))
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-700">
          <span
            className={
              questions.length < QUESTIONS_MIN
                ? 'text-amber-700 font-medium'
                : 'text-emerald-700 font-medium'
            }
          >
            {questions.length} / {QUESTIONS_MIN} minimum
          </span>
          {' • '}
          maximum {QUESTIONS_MAX}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addQuestion('mcq')}
            disabled={questions.length >= QUESTIONS_MAX}
            className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            QCM
          </button>
          <button
            type="button"
            onClick={() => addQuestion('true_false')}
            disabled={questions.length >= QUESTIONS_MAX}
            className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Vrai/Faux
          </button>
        </div>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-xl p-4">
          Aucune question. Ajoutez au moins {QUESTIONS_MIN} questions pour
          activer l'enregistrement.
        </p>
      )}

      <ul className="space-y-4">
        {questions.map((q, idx) => (
          <li
            key={q.id}
            className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  Q{idx + 1}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  {q.question_type === 'mcq' ? 'QCM' : 'Vrai/Faux'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-gray-400 hover:text-red-600"
                aria-label="Supprimer la question"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Énoncé
              </label>
              <textarea
                rows={2}
                value={q.text}
                onChange={(e) =>
                  updateQuestion(q.id, { text: e.target.value })
                }
                placeholder="Énoncé de la question…"
                className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
              />
            </div>

            <QuestionOptionsEditor
              question={q}
              onChange={(options) => updateQuestion(q.id, { options })}
            />

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Feedback (affiché après réponse)
              </label>
              <textarea
                rows={2}
                value={q.feedback}
                onChange={(e) =>
                  updateQuestion(q.id, { feedback: e.target.value })
                }
                placeholder="Explication / référence pédagogique…"
                className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function QuestionOptionsEditor({
  question,
  onChange,
}: {
  question: QuestionDraft
  onChange: (options: QuestionDraft['options']) => void
}) {
  const setCorrect = (optionId: string) => {
    onChange(
      question.options.map((o) => ({ ...o, correct: o.id === optionId })),
    )
  }
  const setText = (optionId: string, text: string) => {
    onChange(
      question.options.map((o) => (o.id === optionId ? { ...o, text } : o)),
    )
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Options{' '}
        <span className="text-gray-400 font-normal">
          (cocher la bonne réponse)
        </span>
      </label>
      <ul className="space-y-2">
        {question.options.map((o) => {
          const readOnlyText = question.question_type === 'true_false'
          return (
            <li key={o.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={o.correct}
                onChange={() => setCorrect(o.id)}
                className="text-[#2D1B96] focus:ring-[#2D1B96]"
                aria-label={`Marquer ${o.id} comme correcte`}
              />
              <span className="text-xs font-mono text-gray-500 w-5">{o.id}</span>
              <input
                type="text"
                value={o.text}
                onChange={(e) => setText(o.id, e.target.value)}
                readOnly={readOnlyText}
                placeholder={
                  question.question_type === 'mcq'
                    ? 'Texte de l\'option'
                    : undefined
                }
                className={`flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96] ${
                  readOnlyText ? 'bg-gray-50 text-gray-700' : 'bg-white text-gray-900'
                }`}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Champs réutilisables
// ---------------------------------------------------------------------------

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

function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
      >
        <option value="">{placeholder ?? '— Choisir —'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SpeTagPicker({
  selected,
  onToggle,
  label,
  help,
}: {
  selected: string[]
  onToggle: (slug: string) => void
  label: string
  help: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      <p className="text-xs text-gray-500 mb-2">{help}</p>
      <div className="flex flex-wrap gap-2">
        {NEWS_SPECIALITES.map((s) => {
          const active = selected.includes(s.value)
          return (
            <button
              type="button"
              key={s.value}
              onClick={() => onToggle(s.value)}
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
  )
}
