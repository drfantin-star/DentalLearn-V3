'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, AlertCircle, X, Copy, Check } from 'lucide-react'
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

interface RejectedStats {
  replies: number
  words: number
  estimatedDurationSec: number
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
  'inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_LINK =
  'inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline'
const LABEL = 'block text-sm font-medium text-gray-700 mb-1'
const SELECT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50'

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
  const [isBackingToDraft, setIsBackingToDraft] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeletingDraft, setIsDeletingDraft] = useState(false)
  const [scriptDraft, setScriptDraft] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  // Script rejeté à la validation de format (200 { ok:false }) : conservé en
  // state React (jamais localStorage/sessionStorage) pour relecture seule et
  // régénération assistée. Effacé à la prochaine génération réussie.
  const [rejectedScript, setRejectedScript] = useState<string | null>(null)
  const [rejectedStats, setRejectedStats] = useState<RejectedStats | null>(null)
  const [rejectedReason, setRejectedReason] = useState<string | null>(null)
  const [reuseRejected, setReuseRejected] = useState(true)

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
      // Régénération assistée : si un script précédent a été rejeté et que la
      // case "Repartir du script précédent" est cochée, on le renvoie au
      // serveur pour repartir de cette base.
      const reusePrevious = rejectedScript != null && reuseRejected
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
            ...(reusePrevious
              ? {
                  previousScript: rejectedScript,
                  previousReason: rejectedReason ?? undefined,
                }
              : {}),
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) {
        // Échec technique (502) ou autre erreur HTTP.
        const msg = json.error || `Erreur ${res.status}`
        const validation = Array.isArray(json.validation_errors)
          ? json.validation_errors
          : []
        setErrors([msg, ...validation])
        return
      }
      if (json && json.ok === false && json.validation) {
        // Échec de VALIDATION de format : le script a bien été produit mais
        // n'est pas conforme. On l'affiche en lecture seule (bandeau rouge +
        // panneau repliable) sans rien persister.
        const reason =
          typeof json.validation.reason === 'string' &&
          json.validation.reason.length > 0
            ? json.validation.reason
            : 'Script généré non conforme au format attendu.'
        setErrors([reason])
        setRejectedScript(
          typeof json.rawScript === 'string' ? json.rawScript : '',
        )
        setRejectedStats(
          json.stats && typeof json.stats === 'object'
            ? (json.stats as RejectedStats)
            : null,
        )
        setRejectedReason(reason)
        setReuseRejected(true)
        return
      }
      // Succès : nouvel épisode draft créé. On efface l'état de rejet
      // (les notes éditoriales ne sont jamais effacées automatiquement).
      setRejectedScript(null)
      setRejectedStats(null)
      setRejectedReason(null)
      // L'endpoint renvoie episode_id + script_md mais pas l'objet complet.
      // On re-fetch pour avoir l'épisode au format BDD complet.
      await refreshEpisode()
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

  const handleBackToDraft = async () => {
    if (!episode) return
    setIsBackingToDraft(true)
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
      setIsBackingToDraft(false)
    }
  }

  const handlePublish = async () => {
    if (!episode) return
    if (!window.confirm('Publier cet épisode ? Il deviendra visible côté praticiens.')) return
    setIsPublishing(true)
    setErrors([])
    try {
      const res = await fetch(
        `/api/admin/news/episodes/${episode.id}/publish`,
        { method: 'POST' },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrors([json.error || `Erreur ${res.status}`])
        return
      }
      await refreshEpisode()
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : 'Erreur de publication',
      ])
    } finally {
      setIsPublishing(false)
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

  const handleDeleteDraft = async () => {
    if (!episode) return
    if (!window.confirm('Supprimer définitivement ce brouillon ?')) return
    setIsDeletingDraft(true)
    setErrors([])
    try {
      const res = await fetch(`/api/admin/news/episodes/${episode.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrors([json.error || `Erreur ${res.status}`])
        return
      }
      setEpisode(null)
      setScriptDraft('')
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : 'Erreur de suppression',
      ])
    } finally {
      setIsDeletingDraft(false)
    }
  }

  // Workflow T13 : la génération se lance depuis le statut draft (la route
  // generate-audio exige status='draft' et sort en 'ready'). Le mode
  // `regenerate` (statuts ready/published) passe `?regenerate=true` — la
  // route skippe alors la précondition et préserve status/published_at.
  const handleGenerateAudio = async (regenerate = false) => {
    if (!episode) return
    if (
      !window.confirm(
        regenerate
          ? 'Régénérer l\'audio via ElevenLabs (payant) ? Le statut de l\'épisode sera préservé.'
          : 'Générer l\'audio via ElevenLabs (payant) ? L\'opération peut prendre 30-60 s.',
      )
    ) {
      return
    }
    setIsGeneratingAudio(true)
    setErrors([])
    try {
      // En mode normal (draft), persister d'abord les éditions du textarea :
      // la route génère depuis le script_md stocké en BDD, pas depuis l'état
      // local. La validation de format (422) tourne ainsi AVANT l'appel
      // ElevenLabs payant.
      if (!regenerate && scriptDraft.trim().length > 0 && scriptDraft !== episode.script_md) {
        const saveRes = await fetch(`/api/admin/news/episodes/${episode.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script_md: scriptDraft }),
        })
        const saveJson = await saveRes.json()
        if (!saveRes.ok) {
          const validation = Array.isArray(saveJson.validation_errors)
            ? saveJson.validation_errors
            : []
          setErrors([saveJson.error || `Erreur ${saveRes.status}`, ...validation])
          return
        }
        setEpisode((prev) =>
          prev ? { ...prev, script_md: scriptDraft } : prev,
        )
      }

      const res = await fetch(
        `/api/admin/news/episodes/${episode.id}/generate-audio${regenerate ? '?regenerate=true' : ''}`,
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
        showReuseOption={rejectedScript != null}
        reuseRejected={reuseRejected}
        setReuseRejected={setReuseRejected}
      />
    )
  } else if (status === 'draft') {
    body = (
      <CaseBReview
        episode={episode}
        scriptDraft={scriptDraft}
        setScriptDraft={setScriptDraft}
        onSave={handleSaveScript}
        onGenerateAudio={() => handleGenerateAudio(false)}
        onRegenerate={handleRegenerateScript}
        onCancel={handleCancelReview}
        onDeleteDraft={handleDeleteDraft}
        saving={isSavingScript}
        generatingAudio={isGeneratingAudio}
        deleting={isDeletingDraft}
      />
    )
  } else if (status === 'ready') {
    body = (
      <CaseCReady
        episode={episode}
        onPublish={handlePublish}
        onRegenerateAudio={() => handleGenerateAudio(true)}
        onBackToDraft={handleBackToDraft}
        publishing={isPublishing}
        regenerating={isGeneratingAudio}
        backLoading={isBackingToDraft}
      />
    )
  } else if (status === 'published') {
    body = (
      <CaseDPublished
        episode={episode}
        onRegenerateAudio={() => handleGenerateAudio(true)}
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
      {rejectedScript != null && (
        <RejectedScriptPanel
          script={rejectedScript}
          stats={rejectedStats}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panneau repliable — script généré non conforme (lecture seule)
// ---------------------------------------------------------------------------

function RejectedScriptPanel({
  script,
  stats,
}: {
  script: string
  stats: RejectedStats | null
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard indisponible (contexte non sécurisé) — silencieux.
    }
  }

  const estimatedMin =
    stats != null ? Math.round(stats.estimatedDurationSec / 60) : null

  return (
    <details className="mt-4 border border-gray-200 rounded-lg bg-gray-50">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-800">
        Voir le script généré (non conforme)
      </summary>
      <div className="px-4 pb-4 space-y-3">
        {stats != null && (
          <p className="text-xs text-gray-600">
            {stats.replies} répliques &middot; {stats.words} mots &middot; durée
            estimée ~{estimatedMin} min
          </p>
        )}
        <pre className="w-full max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-sm border border-gray-200 rounded-lg p-3 bg-white text-gray-800">
          {script}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className={BTN_SECONDARY}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copié
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copier le script
            </>
          )}
        </button>
      </div>
    </details>
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
  showReuseOption,
  reuseRejected,
  setReuseRejected,
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
  showReuseOption: boolean
  reuseRejected: boolean
  setReuseRejected: (v: boolean) => void
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
              className="text-primary focus:ring-primary"
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
              className="text-primary focus:ring-primary"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 placeholder:text-gray-400"
        />
      </div>

      {showReuseOption && (
        <label className="flex items-center gap-2 mb-3 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={reuseRejected}
            onChange={(e) => setReuseRejected(e.target.checked)}
            disabled={loading}
            className="text-primary focus:ring-primary rounded"
          />
          Repartir du script précédent
        </label>
      )}

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
// Cas B — Review script (draft) : édition + lancement direct de la
// génération audio (workflow T13 : draft → generate-audio → ready).
// ---------------------------------------------------------------------------

function CaseBReview({
  episode,
  scriptDraft,
  setScriptDraft,
  onSave,
  onGenerateAudio,
  onRegenerate,
  onCancel,
  onDeleteDraft,
  saving,
  generatingAudio,
  deleting,
}: {
  episode: NewsEpisode
  scriptDraft: string
  setScriptDraft: (s: string) => void
  onSave: () => void
  onGenerateAudio: () => void
  onRegenerate: () => void
  onCancel: () => void
  onDeleteDraft: () => void
  saving: boolean
  generatingAudio: boolean
  deleting: boolean
}) {
  const wordCount = countWords(scriptDraft)
  const estimatedMin = Math.round(wordCount / 150)
  const formatLabel = FORMAT_LABELS[episode.format] ?? episode.format
  const targetMin = episode.target_duration_min ?? null
  const busy = saving || generatingAudio || deleting

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
        className="w-full font-mono text-sm border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
      />
      <p className="text-xs text-gray-500 mt-1.5">
        {wordCount} mots • ~{estimatedMin} min estimées
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
        <p className="text-sm text-amber-900">
          ⚠️ La génération audio est payante (ElevenLabs Creator plan).
          Assurez-vous que le script est définitif avant de lancer.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={onGenerateAudio}
          disabled={busy || scriptDraft.trim().length === 0}
          className={BTN_PRIMARY}
        >
          {generatingAudio ? (
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
        <button
          type="button"
          onClick={onDeleteDraft}
          disabled={busy}
          className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
        >
          {deleting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Suppression…
            </>
          ) : (
            <>🗑️ Supprimer le brouillon</>
          )}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Cas C — Audio prêt (status='ready') : preview + publication.
// Workflow T13 : generate-audio sort en 'ready' ; published_at + validated_by
// sont posés par POST /publish uniquement.
// Garde-fou : un épisode 'ready' sans audio_url (état hérité de l'ancien
// workflow « Valider → ready ») ne doit PAS être publiable — la route
// /publish ne contrôle que le statut, pas la présence de l'audio.
// ---------------------------------------------------------------------------

function CaseCReady({
  episode,
  onPublish,
  onRegenerateAudio,
  onBackToDraft,
  publishing,
  regenerating,
  backLoading,
}: {
  episode: NewsEpisode
  onPublish: () => void
  onRegenerateAudio: () => void
  onBackToDraft: () => void
  publishing: boolean
  regenerating: boolean
  backLoading: boolean
}) {
  const formatLabel = FORMAT_LABELS[episode.format] ?? episode.format
  const targetMin = episode.target_duration_min
  const toneLabel =
    TONE_LABELS[episode.editorial_tone as EditorialTone] ??
    episode.editorial_tone
  const hasAudio = Boolean(episode.audio_url)
  const busy = publishing || regenerating || backLoading

  return (
    <>
      <h2 className={CARD_TITLE}>
        {hasAudio
          ? '✓ Audio prêt — en attente de publication'
          : '🎙️ Épisode en attente d\'audio'}
      </h2>

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

      {hasAudio ? (
        <div className="mb-4">
          <audio
            controls
            src={episode.audio_url ?? undefined}
            className="w-full"
            preload="metadata"
          />
          <p className="text-xs text-gray-500 mt-1">
            Durée estimée : {formatDuration(episode.duration_s)}
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-900">
            ⚠️ Audio manquant — repasser en draft pour générer.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPublish}
          disabled={busy || !hasAudio}
          className={BTN_PRIMARY}
        >
          {publishing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publication…
            </>
          ) : (
            <>✅ Publier</>
          )}
        </button>
        {hasAudio && (
          <button
            type="button"
            onClick={onRegenerateAudio}
            disabled={busy}
            className={BTN_SECONDARY}
          >
            {regenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Régénération en cours (~30-60s)…
              </>
            ) : (
              <>🔄 Régénérer l&apos;audio</>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onBackToDraft}
          disabled={busy}
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
