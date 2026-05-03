'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, AlertCircle, X } from 'lucide-react'
import { formatDate } from '@/lib/news-display'

// ---------- Types ----------

interface NewsEpisode {
  id: string
  type: string
  title: string | null
  script_md: string
  format: string
  narrator: string | null
  target_duration_min: number | null
  editorial_tone: string
  status: string
  audio_url: string | null
  duration_s: number | null
  published_at: string | null
  created_at: string
}

type ScriptFormat = 'dialogue' | 'monologue'
type ScriptNarrator = 'sophie' | 'martin'
type TargetDuration = 3 | 5 | 8 | 12
type EditorialTone =
  | 'standard'
  | 'flash_urgence'
  | 'pedagogique'
  | 'focus_specialite'

interface AudioPodcastBlockProps {
  synthesisId: string
}

// ---------- Constantes UI ----------

const TONE_LABELS: Record<EditorialTone, string> = {
  standard: 'Standard',
  flash_urgence: 'Flash urgence',
  pedagogique: 'Pédagogique',
  focus_specialite: 'Focus spécialité',
}

const FORMAT_LABELS: Record<string, string> = {
  dialogue: 'Dialogue Sophie & Martin',
  monologue: 'Monologue',
}

const NARRATOR_LABELS: Record<string, string> = {
  sophie: 'Dr Sophie',
  martin: 'Dr Martin',
}

// Classes Tailwind partagées (cohérentes avec page.tsx).
const CARD = 'bg-white rounded-2xl shadow-sm border border-gray-200 p-6'
const CARD_TITLE = 'text-lg font-semibold text-gray-900 mb-4'
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_LINK =
  'inline-flex items-center gap-1 text-sm text-[#2D1B96] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1'
const SELECT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1B96] disabled:opacity-50'

// ---------- Helpers ----------

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ---------- Composant principal ----------

export function AudioPodcastBlock({ synthesisId }: AudioPodcastBlockProps) {
  const [episode, setEpisode] = useState<NewsEpisode | null>(null)
  const [episodeLoading, setEpisodeLoading] = useState(true)
  const [scriptParams, setScriptParams] = useState<{
    format: ScriptFormat
    narrator: ScriptNarrator | null
    target_duration_min: TargetDuration
    editorial_tone: EditorialTone
  }>({
    format: 'dialogue',
    narrator: null,
    target_duration_min: 5,
    editorial_tone: 'standard',
  })
  const [editorialNotes, setEditorialNotes] = useState('')
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isSavingScript, setIsSavingScript] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [scriptDraft, setScriptDraft] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  // Fetch initial de l'épisode lié.
  useEffect(() => {
    if (!synthesisId) return
    let cancelled = false

    const loadEpisode = async () => {
      setEpisodeLoading(true)
      try {
        const res = await fetch(
          `/api/admin/news/syntheses/${synthesisId}/episode`,
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
        if (cancelled) return
        const ep = (json.episode as NewsEpisode | null) ?? null
        setEpisode(ep)
        if (ep && (ep.status === 'draft' || ep.status === 'ready')) {
          setScriptDraft(ep.script_md)
        }
      } catch (e) {
        if (!cancelled) {
          setErrors([e instanceof Error ? e.message : 'Erreur de chargement'])
        }
      } finally {
        if (!cancelled) setEpisodeLoading(false)
      }
    }

    loadEpisode()

    return () => {
      cancelled = true
    }
  }, [synthesisId])

  // ---------- Loading state ----------
  if (episodeLoading) {
    return (
      <div className={CARD}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-4/5" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  // ---------- Helpers d'actions ----------

  const refreshEpisode = async (): Promise<NewsEpisode | null> => {
    const res = await fetch(
      `/api/admin/news/syntheses/${synthesisId}/episode`,
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
    const ep = (json.episode as NewsEpisode | null) ?? null
    setEpisode(ep)
    if (ep && (ep.status === 'draft' || ep.status === 'ready')) {
      setScriptDraft(ep.script_md)
    }
    return ep
  }

  const handleGenerateScript = async () => {
    if (
      scriptParams.format === 'monologue' &&
      scriptParams.narrator == null
    ) {
      setErrors(['Sélectionne un narrateur pour le format monologue.'])
      return
    }
    setIsGeneratingScript(true)
    setErrors([])
    try {
      const res = await fetch(
        `/api/admin/news/syntheses/${synthesisId}/generate-script`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: scriptParams.format,
            narrator:
              scriptParams.format === 'monologue'
                ? scriptParams.narrator
                : undefined,
            target_duration_min: scriptParams.target_duration_min,
            editorial_tone: scriptParams.editorial_tone,
            editorial_notes: editorialNotes,
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) {
        const msg = json.error || `Erreur ${res.status}`
        const validation = Array.isArray(json.validation_errors)
          ? json.validation_errors
          : []
        setErrors([msg, ...validation])
        return
      }
      // L'endpoint renvoie episode_id + script_md mais pas l'objet complet.
      // On re-fetch pour avoir l'épisode au format BDD complet.
      await refreshEpisode()
      setEditorialNotes('')
    } catch (e) {
      setErrors([
        e instanceof Error
          ? e.message
          : 'Erreur lors de la génération du script',
      ])
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleSaveScript = async () => {
    if (!episode) return
    setIsSavingScript(true)
    setErrors([])
    try {
      const res = await fetch(`/api/admin/news/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_md: scriptDraft }),
      })
      const json = await res.json()
      if (!res.ok) {
        const validation = Array.isArray(json.validation_errors)
          ? json.validation_errors
          : []
        setErrors([json.error || `Erreur ${res.status}`, ...validation])
        return
      }
      setEpisode((prev) =>
        prev ? { ...prev, script_md: scriptDraft } : prev,
      )
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : 'Erreur de sauvegarde',
      ])
    } finally {
      setIsSavingScript(false)
    }
  }

  const handleValidateScript = async () => {
    if (!episode) return
    setIsValidating(true)
    setErrors([])
    try {
      const res = await fetch(`/api/admin/news/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_md: scriptDraft,
          status: 'ready',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const validation = Array.isArray(json.validation_errors)
          ? json.validation_errors
          : []
        setErrors([json.error || `Erreur ${res.status}`, ...validation])
        return
      }
      setEpisode((prev) =>
        prev
          ? { ...prev, script_md: scriptDraft, status: 'ready' }
          : prev,
      )
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : 'Erreur de validation',
      ])
    } finally {
      setIsValidating(false)
    }
  }

  const handleBackToDraft = async () => {
    if (!episode) return
    setIsValidating(true)
    setErrors([])
    try {
      const res = await fetch(`/api/admin/news/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrors([json.error || `Erreur ${res.status}`])
        return
      }
      setEpisode((prev) => (prev ? { ...prev, status: 'draft' } : prev))
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : 'Erreur de transition',
      ])
    } finally {
      setIsValidating(false)
    }
  }

  const handleRegenerateScript = () => {
    // Repasse en Cas A. L'archivage effectif aura lieu côté
    // /generate-script lors de la prochaine génération (l'endpoint
    // archive systématiquement les épisodes liés à la synthèse avant
    // d'INSERTer le nouveau).
    setEpisode(null)
    setScriptDraft('')
    setErrors([])
  }

  const handleCancelReview = () => {
    // Annule la relecture : retour Cas A sans aucun appel API.
    // L'épisode draft reste en BDD ; il sera archivé à la prochaine
    // génération via l'endpoint /generate-script (archivage idempotent).
    setEpisode(null)
    setScriptDraft('')
    setErrors([])
  }

  const handleGenerateAudio = async () => {
    if (!episode) return
    setIsGeneratingAudio(true)
    setErrors([])
    try {
      const res = await fetch(
        `/api/admin/news/episodes/${episode.id}/generate-audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      )
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 503) {
          setErrors([
            'Clé API ElevenLabs manquante — à configurer dans Vercel env vars (ELEVENLABS_API_KEY).',
          ])
        } else {
          setErrors([json.error || `Erreur ${res.status}`])
        }
        return
      }
      // L'endpoint retourne audio_url, duration_s, status. Pour avoir
      // published_at + le reste à jour, on re-fetch.
      await refreshEpisode()
    } catch (e) {
      setErrors([
        e instanceof Error
          ? e.message
          : 'Erreur lors de la génération audio',
      ])
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const clearErrors = () => setErrors([])

  // ---------- Rendu par cas ----------

  const status = episode?.status ?? null

  let body: ReactNode = null

  if (!episode || status === 'archived') {
    // Cas A — Paramétrage
    body = (
      <CaseAParametrage
        params={scriptParams}
        setParams={setScriptParams}
        editorialNotes={editorialNotes}
        setEditorialNotes={setEditorialNotes}
        onGenerate={handleGenerateScript}
        loading={isGeneratingScript}
      />
    )
  } else if (status === 'draft') {
    body = (
      <CaseBReview
        episode={episode}
        scriptDraft={scriptDraft}
        setScriptDraft={setScriptDraft}
        onSave={handleSaveScript}
        onValidate={handleValidateScript}
        onRegenerate={handleRegenerateScript}
        onCancel={handleCancelReview}
        saving={isSavingScript}
        validating={isValidating}
      />
    )
  } else if (status === 'ready') {
    body = (
      <CaseCReady
        episode={episode}
        onGenerateAudio={handleGenerateAudio}
        onBackToDraft={handleBackToDraft}
        loading={isGeneratingAudio}
        backLoading={isValidating}
      />
    )
  } else if (status === 'published') {
    body = (
      <CaseDPublished
        episode={episode}
        onRegenerateAudio={handleGenerateAudio}
        loading={isGeneratingAudio}
      />
    )
  } else {
    // Statut inconnu — fallback informatif.
    body = (
      <p className="text-sm text-gray-600">
        Statut épisode inconnu : <code className="font-mono">{status}</code>
      </p>
    )
  }

  return (
    <div className={CARD}>
      {body}
      {errors.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-700">
                {e}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={clearErrors}
            className="text-red-500 hover:text-red-700 flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cas A — Paramétrage
// ---------------------------------------------------------------------------

function CaseAParametrage({
  params,
  setParams,
  editorialNotes,
  setEditorialNotes,
  onGenerate,
  loading,
}: {
  params: {
    format: ScriptFormat
    narrator: ScriptNarrator | null
    target_duration_min: TargetDuration
    editorial_tone: EditorialTone
  }
  setParams: (
    p: {
      format: ScriptFormat
      narrator: ScriptNarrator | null
      target_duration_min: TargetDuration
      editorial_tone: EditorialTone
    },
  ) => void
  editorialNotes: string
  setEditorialNotes: (notes: string) => void
  onGenerate: () => void
  loading: boolean
}) {
  const disabled =
    loading || (params.format === 'monologue' && params.narrator == null)

  return (
    <>
      <h2 className={CARD_TITLE}>🎙️ Générer un podcast</h2>

      {/* Format */}
      <fieldset className="mb-4">
        <legend className={LABEL}>Format</legend>
        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name="audio-format"
              value="dialogue"
              checked={params.format === 'dialogue'}
              onChange={() =>
                setParams({ ...params, format: 'dialogue', narrator: null })
              }
              disabled={loading}
              className="text-[#2D1B96] focus:ring-[#2D1B96]"
            />
            Dialogue Sophie &amp; Martin
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name="audio-format"
              value="monologue"
              checked={params.format === 'monologue'}
              onChange={() =>
                setParams({ ...params, format: 'monologue' })
              }
              disabled={loading}
              className="text-[#2D1B96] focus:ring-[#2D1B96]"
            />
            Monologue
          </label>
        </div>
      </fieldset>

      {/* Narrateur (conditionnel) */}
      {params.format === 'monologue' && (
        <div className="mb-4">
          <label className={LABEL} htmlFor="audio-narrator">
            Narrateur
          </label>
          <select
            id="audio-narrator"
            value={params.narrator ?? ''}
            onChange={(e) =>
              setParams({
                ...params,
                narrator: (e.target.value || null) as ScriptNarrator | null,
              })
            }
            disabled={loading}
            className={SELECT}
          >
            <option value="">— Choisir —</option>
            <option value="sophie">Dr Sophie</option>
            <option value="martin">Dr Martin</option>
          </select>
        </div>
      )}

      {/* Durée */}
      <div className="mb-4">
        <label className={LABEL} htmlFor="audio-duration">
          Durée cible
        </label>
        <select
          id="audio-duration"
          value={params.target_duration_min}
          onChange={(e) =>
            setParams({
              ...params,
              target_duration_min: Number(e.target.value) as TargetDuration,
            })
          }
          disabled={loading}
          className={SELECT}
        >
          <option value={3}>3 min</option>
          <option value={5}>5 min</option>
          <option value={8}>8 min</option>
          <option value={12}>12 min</option>
        </select>
      </div>

      {/* Ton éditorial */}
      <div className="mb-5">
        <label className={LABEL} htmlFor="audio-tone">
          Ton éditorial
        </label>
        <select
          id="audio-tone"
          value={params.editorial_tone}
          onChange={(e) =>
            setParams({
              ...params,
              editorial_tone: e.target.value as EditorialTone,
            })
          }
          disabled={loading}
          className={SELECT}
        >
          {(Object.keys(TONE_LABELS) as EditorialTone[]).map((tone) => (
            <option key={tone} value={tone}>
              {TONE_LABELS[tone]}
            </option>
          ))}
        </select>
      </div>

      {/* Notes éditorial (optionnel) */}
      <div className="mb-5">
        <label className={LABEL} htmlFor="audio-editorial-notes">
          Notes éditorial
        </label>
        <p className="text-xs text-gray-500 mb-1.5">
          Facultatif — points à développer, angle éditorial spécifique,
          données à mettre en avant
        </p>
        <textarea
          id="audio-editorial-notes"
          value={editorialNotes}
          onChange={(e) => setEditorialNotes(e.target.value)}
          disabled={loading}
          rows={4}
          placeholder="Points à développer, angle éditorial, données à mettre en avant…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1B96] disabled:opacity-50 placeholder:text-gray-400"
        />
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        className={BTN_PRIMARY}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération du script (~20s)…
          </>
        ) : (
          <>Générer le script</>
        )}
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Cas B — Review script
// ---------------------------------------------------------------------------

function CaseBReview({
  episode,
  scriptDraft,
  setScriptDraft,
  onSave,
  onValidate,
  onRegenerate,
  onCancel,
  saving,
  validating,
}: {
  episode: NewsEpisode
  scriptDraft: string
  setScriptDraft: (s: string) => void
  onSave: () => void
  onValidate: () => void
  onRegenerate: () => void
  onCancel: () => void
  saving: boolean
  validating: boolean
}) {
  const wordCount = countWords(scriptDraft)
  const estimatedMin = Math.round(wordCount / 150)
  const formatLabel = FORMAT_LABELS[episode.format] ?? episode.format
  const targetMin = episode.target_duration_min ?? null
  const busy = saving || validating

  return (
    <>
      <h2 className={CARD_TITLE}>✏️ Script généré — relecture</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
          {formatLabel}
          {episode.format === 'monologue' && episode.narrator
            ? ` — ${NARRATOR_LABELS[episode.narrator] ?? episode.narrator}`
            : ''}
        </span>
        {targetMin != null && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-50 text-purple-700">
            Cible : {targetMin} min
          </span>
        )}
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
          {TONE_LABELS[episode.editorial_tone as EditorialTone] ??
            episode.editorial_tone}
        </span>
      </div>

      <textarea
        value={scriptDraft}
        onChange={(e) => setScriptDraft(e.target.value)}
        disabled={busy}
        rows={20}
        className="w-full font-mono text-sm border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[#2D1B96] focus:outline-none disabled:opacity-50"
      />
      <p className="text-xs text-gray-500 mt-1.5">
        {wordCount} mots • ~{estimatedMin} min estimées
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={onValidate}
          disabled={busy || scriptDraft.trim().length === 0}
          className={BTN_PRIMARY}
        >
          {validating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Validation…
            </>
          ) : (
            <>✅ Valider → Prêt pour audio</>
          )}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy || scriptDraft.trim().length === 0}
          className={BTN_SECONDARY}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sauvegarde…
            </>
          ) : (
            <>Sauvegarder</>
          )}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className={BTN_LINK}
        >
          🔄 Régénérer le script
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={BTN_LINK}
        >
          Annuler
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Cas C — Prêt pour audio
// ---------------------------------------------------------------------------

function CaseCReady({
  episode,
  onGenerateAudio,
  onBackToDraft,
  loading,
  backLoading,
}: {
  episode: NewsEpisode
  onGenerateAudio: () => void
  onBackToDraft: () => void
  loading: boolean
  backLoading: boolean
}) {
  const formatLabel = FORMAT_LABELS[episode.format] ?? episode.format
  const targetMin = episode.target_duration_min
  const toneLabel =
    TONE_LABELS[episode.editorial_tone as EditorialTone] ??
    episode.editorial_tone

  return (
    <>
      <h2 className={CARD_TITLE}>🎙️ Prêt pour la génération audio</h2>

      <dl className="text-sm text-gray-700 space-y-1 mb-4">
        <div className="flex gap-2">
          <dt className="font-medium text-gray-500 min-w-[100px]">Format :</dt>
          <dd>
            {formatLabel}
            {episode.format === 'monologue' && episode.narrator
              ? ` — ${NARRATOR_LABELS[episode.narrator] ?? episode.narrator}`
              : ''}
          </dd>
        </div>
        {targetMin != null && (
          <div className="flex gap-2">
            <dt className="font-medium text-gray-500 min-w-[100px]">
              Durée cible :
            </dt>
            <dd>{targetMin} min</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="font-medium text-gray-500 min-w-[100px]">Ton :</dt>
          <dd>{toneLabel}</dd>
        </div>
      </dl>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-amber-900">
          ⚠️ La génération audio est payante (ElevenLabs Creator plan).
          Assurez-vous que le script est définitif avant de lancer.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerateAudio}
          disabled={loading || backLoading}
          className={BTN_PRIMARY}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Génération ElevenLabs en cours (~30-60s)…
            </>
          ) : (
            <>🎙️ Générer l&apos;audio</>
          )}
        </button>
        <button
          type="button"
          onClick={onBackToDraft}
          disabled={loading || backLoading}
          className={BTN_LINK}
        >
          {backLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Retour au draft…
            </>
          ) : (
            <>← Modifier le script</>
          )}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Cas D — Audio publié
// ---------------------------------------------------------------------------

function CaseDPublished({
  episode,
  onRegenerateAudio,
  loading,
}: {
  episode: NewsEpisode
  onRegenerateAudio: () => void
  loading: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className={CARD_TITLE + ' mb-0'}>✅ Podcast publié</h2>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
          Publié
        </span>
      </div>

      <dl className="text-sm text-gray-700 space-y-1 mb-3">
        {episode.published_at && (
          <div className="flex gap-2">
            <dt className="font-medium text-gray-500 min-w-[100px]">
              Publié le :
            </dt>
            <dd>{formatDate(episode.published_at)}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="font-medium text-gray-500 min-w-[100px]">Durée :</dt>
          <dd>{formatDuration(episode.duration_s)}</dd>
        </div>
      </dl>

      {episode.audio_url ? (
        <audio
          controls
          src={episode.audio_url}
          className="w-full mt-3"
          preload="metadata"
        />
      ) : (
        <p className="text-sm text-gray-500 italic">
          URL audio manquante — régénération nécessaire.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={onRegenerateAudio}
          disabled={loading}
          className={BTN_SECONDARY}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Régénération en cours (~30-60s)…
            </>
          ) : (
            <>🔄 Régénérer l&apos;audio</>
          )}
        </button>
      </div>
    </>
  )
}
