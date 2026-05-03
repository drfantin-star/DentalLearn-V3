'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { NEWS_SPECIALITE_LABELS } from '@/lib/constants/news'

// Détail d'un journal hebdo (T11) :
//   - affiche les synthèses sélectionnées dans l'ordre
//   - Formulaire de génération aligné sur T7-bis (CaseAParametrage de
//     src/components/admin/news/AudioPodcastBlock.tsx) : format, narrator
//     (si monologue), target_duration_min (3/5/8/12), editorial_tone,
//     editorial_notes
//   - Bouton "Générer le script" → POST generate-script
//   - Textarea script éditable (modifs envoyées au prochain generate-audio
//     via UPDATE indirect — pour l'instant la régénération seule est exposée,
//     l'édition manuelle est réservée à un futur ticket)
//   - Bouton "Générer l'audio" → POST generate-audio (publie automatiquement)
//   - Bouton "Publier" / "Archiver" → PATCH status

type ScriptFormat = 'dialogue' | 'monologue'
type ScriptNarrator = 'sophie' | 'martin'
type TargetDuration = 3 | 5 | 8 | 12
type EditorialTone =
  | 'standard'
  | 'flash_urgence'
  | 'pedagogique'
  | 'focus_specialite'

const TONE_LABELS: Record<EditorialTone, string> = {
  standard: 'Standard',
  flash_urgence: 'Flash urgence',
  pedagogique: 'Pédagogique',
  focus_specialite: 'Focus spécialité',
}

interface JournalSynthesis {
  id: string
  position: number
  display_title: string | null
  specialite: string | null
  summary_fr: string | null
  clinical_impact: string | null
  key_figures: string[] | null
  evidence_level: string | null
  source_url: string | null
  journal_name: string | null
}

interface JournalEpisodeAdmin {
  id: string
  type: string
  title: string
  week_iso: string | null
  status: 'draft' | 'published' | 'archived' | string
  audio_url: string | null
  duration_s: number | null
  script_md: string | null
  target_duration_min: number | null
  editorial_tone: string | null
  created_at: string
  updated_at: string | null
  published_at: string | null
}

interface JournalDetailResponse {
  episode: JournalEpisodeAdmin
  syntheses: JournalSynthesis[]
}

function statusBadge(status: string) {
  switch (status) {
    case 'draft':
      return { label: 'Brouillon', className: 'bg-gray-200 text-gray-700' }
    case 'published':
      return { label: 'Publié', className: 'bg-green-100 text-green-700' }
    case 'archived':
      return { label: 'Archivé', className: 'bg-red-100 text-red-700' }
    default:
      return { label: status, className: 'bg-gray-200 text-gray-700' }
  }
}

function formatDuration(s: number | null): string {
  if (!s) return '—'
  const m = Math.round(s / 60)
  return `${m} min`
}

export default function AdminJournalDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [data, setData] = useState<JournalDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Notes éditoriales (non persistées en BDD).
  const [editorialNotes, setEditorialNotes] = useState('')

  // Paramètres de génération T7-bis (alignés sur AudioPodcastBlock).
  // Default : dialogue Sophie/Martin, 12 min, ton standard — cohérent avec
  // l'INSERT du draft côté /api/admin/news/journal POST.
  const [scriptParams, setScriptParams] = useState<{
    format: ScriptFormat
    narrator: ScriptNarrator | null
    target_duration_min: TargetDuration
    editorial_tone: EditorialTone
  }>({
    format: 'dialogue',
    narrator: null,
    target_duration_min: 12,
    editorial_tone: 'standard',
  })

  // Script affiché — initialisé depuis episode.script_md, éditable visuel seulement.
  const [scriptDraft, setScriptDraft] = useState('')

  const [busy, setBusy] = useState<null | 'script' | 'audio' | 'publish' | 'archive'>(null)
  const [opError, setOpError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/admin/news/journal/${id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as JournalDetailResponse
      setData(json)
      setScriptDraft(json.episode.script_md ?? '')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (!id) return null

  const handleGenerateScript = async () => {
    if (!data) return
    if (
      scriptParams.format === 'monologue' &&
      scriptParams.narrator == null
    ) {
      setOpError('Sélectionne un narrateur pour le format monologue.')
      return
    }
    if (!confirm('Générer le script via Claude Sonnet ? L\'opération peut prendre 30-60 s.')) return
    setBusy('script')
    setOpError(null)
    try {
      const res = await fetch(`/api/admin/news/journal/${id}/generate-script`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          format: scriptParams.format,
          narrator:
            scriptParams.format === 'monologue' ? scriptParams.narrator : null,
          target_duration_min: scriptParams.target_duration_min,
          editorial_tone: scriptParams.editorial_tone,
          editorial_notes: editorialNotes,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      setScriptDraft(body.script_md ?? '')
      await reload()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Erreur génération script')
    } finally {
      setBusy(null)
    }
  }

  const handleGenerateAudio = async () => {
    if (!data) return
    if (!confirm('Générer le MP3 via ElevenLabs et publier le journal ? L\'opération peut prendre plusieurs minutes.')) return
    setBusy('audio')
    setOpError(null)
    try {
      const res = await fetch(`/api/admin/news/journal/${id}/generate-audio`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      await reload()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Erreur génération audio')
    } finally {
      setBusy(null)
    }
  }

  const handlePublish = async () => {
    if (!data) return
    if (!confirm(`Publier le journal ${data.episode.week_iso} ?`)) return
    setBusy('publish')
    setOpError(null)
    try {
      const res = await fetch(`/api/admin/news/journal/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      await reload()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Erreur publication')
    } finally {
      setBusy(null)
    }
  }

  const handleArchive = async () => {
    if (!data) return
    if (!confirm('Archiver ce journal ? Cette action est irréversible.')) return
    setBusy('archive')
    setOpError(null)
    try {
      const res = await fetch(`/api/admin/news/journal/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      await reload()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Erreur archivage')
    } finally {
      setBusy(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D1B96]" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          {loadError}
        </div>
        <Link href="/admin/news/journal" className="mt-4 inline-block text-sm text-gray-600 hover:underline">
          ← Retour à la liste
        </Link>
      </div>
    )
  }

  if (!data) return null

  const { episode, syntheses } = data
  const badge = statusBadge(episode.status)
  const isDraft = episode.status === 'draft'
  const isPublished = episode.status === 'published'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/news/journal" className="text-sm text-gray-600 hover:underline">
            ← Retour à la liste
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{episode.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
            <span className="text-xs text-gray-500">
              {syntheses.length} articles · {formatDuration(episode.duration_s)}
            </span>
          </div>
        </div>
      </div>

      {opError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          {opError}
        </div>
      )}

      {/* Synthèses sélectionnées */}
      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Au sommaire</h2>
        <ol className="space-y-2">
          {syntheses.map((s) => (
            <li key={s.id} className="flex items-start gap-3">
              <span className="text-violet-700 font-bold text-sm w-5 shrink-0">{s.position}.</span>
              <div className="flex-1 min-w-0">
                {s.specialite && (
                  <span className="inline-block text-[10px] font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5 mr-2">
                    {NEWS_SPECIALITE_LABELS[s.specialite] ?? s.specialite}
                  </span>
                )}
                <span className="text-sm text-gray-800">{s.display_title ?? '(sans titre)'}</span>
                {s.journal_name && (
                  <span className="text-xs text-gray-500 ml-2">— {s.journal_name}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Génération du script — formulaire aligné sur T7-bis (CaseAParametrage
          de src/components/admin/news/AudioPodcastBlock.tsx). JSX dupliqué ici
          en additif pour ne pas toucher le composant T7-bis stable. */}
      {isDraft && (
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">🎙️ Générer un podcast</h2>

          {/* Format */}
          <fieldset className="mb-4">
            <legend className="block text-sm font-medium text-gray-700 mb-1">Format</legend>
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="audio-format"
                  value="dialogue"
                  checked={scriptParams.format === 'dialogue'}
                  onChange={() =>
                    setScriptParams({ ...scriptParams, format: 'dialogue', narrator: null })
                  }
                  disabled={busy !== null}
                  className="text-[#2D1B96] focus:ring-[#2D1B96]"
                />
                Dialogue Sophie &amp; Martin
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="audio-format"
                  value="monologue"
                  checked={scriptParams.format === 'monologue'}
                  onChange={() =>
                    setScriptParams({ ...scriptParams, format: 'monologue' })
                  }
                  disabled={busy !== null}
                  className="text-[#2D1B96] focus:ring-[#2D1B96]"
                />
                Monologue
              </label>
            </div>
          </fieldset>

          {/* Narrateur (conditionnel monologue) */}
          {scriptParams.format === 'monologue' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="audio-narrator">
                Narrateur
              </label>
              <select
                id="audio-narrator"
                value={scriptParams.narrator ?? ''}
                onChange={(e) =>
                  setScriptParams({
                    ...scriptParams,
                    narrator: (e.target.value || null) as ScriptNarrator | null,
                  })
                }
                disabled={busy !== null}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1B96] disabled:opacity-50"
              >
                <option value="">— Choisir —</option>
                <option value="sophie">Dr Sophie</option>
                <option value="martin">Dr Martin</option>
              </select>
            </div>
          )}

          {/* Durée */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="audio-duration">
              Durée cible
            </label>
            <select
              id="audio-duration"
              value={scriptParams.target_duration_min}
              onChange={(e) =>
                setScriptParams({
                  ...scriptParams,
                  target_duration_min: Number(e.target.value) as TargetDuration,
                })
              }
              disabled={busy !== null}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1B96] disabled:opacity-50"
            >
              <option value={3}>3 min</option>
              <option value={5}>5 min</option>
              <option value={8}>8 min</option>
              <option value={12}>12 min</option>
            </select>
          </div>

          {/* Ton éditorial */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="audio-tone">
              Ton éditorial
            </label>
            <select
              id="audio-tone"
              value={scriptParams.editorial_tone}
              onChange={(e) =>
                setScriptParams({
                  ...scriptParams,
                  editorial_tone: e.target.value as EditorialTone,
                })
              }
              disabled={busy !== null}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1B96] disabled:opacity-50"
            >
              {(Object.keys(TONE_LABELS) as EditorialTone[]).map((tone) => (
                <option key={tone} value={tone}>
                  {TONE_LABELS[tone]}
                </option>
              ))}
            </select>
          </div>

          {/* Notes éditorial (optionnel, non persistées en BDD) */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editorial_notes">
              Notes éditorial
            </label>
            <p className="text-xs text-gray-500 mb-1.5">
              Facultatif — points à développer, angle éditorial spécifique,
              données à mettre en avant
            </p>
            <textarea
              id="editorial_notes"
              value={editorialNotes}
              onChange={(e) => setEditorialNotes(e.target.value)}
              disabled={busy !== null}
              rows={4}
              placeholder="Points à développer, angle éditorial, données à mettre en avant…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1B96] disabled:opacity-50 placeholder:text-gray-400"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateScript}
            disabled={
              busy !== null ||
              (scriptParams.format === 'monologue' && scriptParams.narrator == null)
            }
            className="bg-[#2D1B96] hover:bg-[#231575] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {busy === 'script'
              ? 'Génération en cours…'
              : episode.script_md && episode.script_md.trim().length > 0
                ? 'Régénérer le script'
                : 'Générer le script'}
          </button>
        </section>
      )}

      {/* Script + génération audio */}
      {(scriptDraft.trim().length > 0 || isPublished) && (
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            {isPublished ? 'Script du journal publié' : '2. Script généré'}
          </h2>
          <textarea
            value={scriptDraft}
            onChange={(e) => setScriptDraft(e.target.value)}
            readOnly={!isDraft}
            rows={14}
            className="w-full font-mono text-xs rounded-xl border border-gray-300 p-3 bg-gray-50"
          />
          {isDraft && (
            <p className="mt-2 text-xs text-gray-500">
              Édition locale uniquement — les modifications ne sont pas persistées
              (utiliser « Régénérer le script » pour relancer Claude).
            </p>
          )}
          {isDraft && (
            <button
              type="button"
              onClick={handleGenerateAudio}
              disabled={busy !== null || scriptDraft.trim().length === 0}
              className="mt-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {busy === 'audio'
                ? 'Génération MP3 + publication…'
                : 'Générer l\'audio (publie le journal)'}
            </button>
          )}
        </section>
      )}

      {/* Player audio (toujours visible quand audio_url existe) */}
      {episode.audio_url && (
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Aperçu audio</h2>
          <audio
            controls
            src={episode.audio_url}
            className="w-full"
            style={{ height: '40px' }}
          />
          <p className="mt-2 text-xs text-gray-500">
            Durée estimée : {formatDuration(episode.duration_s)} — pas de contrôle
            de vitesse (contrainte produit).
          </p>
        </section>
      )}

      {/* Actions de cycle de vie */}
      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Statut</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {isPublished && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={busy !== null}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {busy === 'archive' ? 'Archivage…' : 'Archiver'}
            </button>
          )}
          {isDraft && episode.audio_url && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={busy !== null}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {busy === 'publish' ? 'Publication…' : 'Publier sans regénérer'}
            </button>
          )}
          {isDraft && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={busy !== null}
              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {busy === 'archive' ? 'Archivage…' : 'Archiver le brouillon'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
