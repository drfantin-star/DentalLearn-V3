'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  BulkValidationResult,
  CsMember,
  EditorialContentType,
  ValidationCandidate,
  ValidationStatus,
} from '@/types/editorialValidations'

// ─────────────────────────────────────────────────────────────────────────────
// 1. useValidationStatus
// ─────────────────────────────────────────────────────────────────────────────
interface UseValidationStatusResult {
  status: ValidationStatus | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useValidationStatus(
  contentType: EditorialContentType,
  contentId: string | null
): UseValidationStatusResult {
  const [status, setStatus] = useState<ValidationStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!contentId) {
      setStatus(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcErr } = await supabase.rpc('get_validation_status', {
        p_content_type: contentType,
        p_content_id: contentId,
      })
      if (rpcErr) throw rpcErr
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null
      setStatus(row as ValidationStatus | null)
    } catch (err: any) {
      console.error('useValidationStatus error:', err)
      setError(err.message || 'Erreur lors de la récupération du statut')
      // fail-open : composant continue à fonctionner
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [contentType, contentId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return { status, loading, error, refetch: fetchStatus }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. useCsMembers
// ─────────────────────────────────────────────────────────────────────────────
interface UseCsMembersOptions {
  activeOnly?: boolean
}

interface UseCsMembersResult {
  members: CsMember[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCsMembers(options?: UseCsMembersOptions): UseCsMembersResult {
  const activeOnly = options?.activeOnly ?? true
  const [members, setMembers] = useState<CsMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      let query = supabase
        .from('cs_members')
        .select('*')
        .order('is_lead', { ascending: false })
        .order('display_name', { ascending: true })

      if (activeOnly) {
        query = query.eq('active', true)
      }

      const { data, error: dbErr } = await query
      if (dbErr) throw dbErr
      setMembers((data || []) as CsMember[])
    } catch (err: any) {
      console.error('useCsMembers error:', err)
      setError(err.message || 'Erreur lors du chargement des membres')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  return { members, loading, error, refetch: fetchMembers }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. useValidateContent
// ─────────────────────────────────────────────────────────────────────────────
interface ValidateContentParams {
  contentType: EditorialContentType
  contentId: string
  validatedByLead: string
  validatedBySecondary?: string | null
  comments?: string | null
}

interface UseValidateContentResult {
  validate: (params: ValidateContentParams) => Promise<string>
  loading: boolean
  error: string | null
}

export function useValidateContent(): UseValidateContentResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(async (params: ValidateContentParams): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcErr } = await supabase.rpc('validate_content', {
        p_content_type: params.contentType,
        p_content_id: params.contentId,
        p_validated_by_lead: params.validatedByLead,
        p_validated_by_secondary: params.validatedBySecondary ?? null,
        p_comments: params.comments ?? null,
      })
      if (rpcErr) throw rpcErr
      return data as string
    } catch (err: any) {
      console.error('useValidateContent error:', err)
      setError(err.message || 'Erreur lors de la validation')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { validate, loading, error }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. useRevokeValidation
// ─────────────────────────────────────────────────────────────────────────────
interface UseRevokeValidationResult {
  revoke: (validationId: string, reason: string) => Promise<boolean>
  loading: boolean
  error: string | null
}

export function useRevokeValidation(): UseRevokeValidationResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const revoke = useCallback(async (validationId: string, reason: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcErr } = await supabase.rpc('revoke_validation', {
        p_validation_id: validationId,
        p_reason: reason,
      })
      if (rpcErr) throw rpcErr
      return Boolean(data)
    } catch (err: any) {
      console.error('useRevokeValidation error:', err)
      setError(err.message || 'Erreur lors de la révocation')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { revoke, loading, error }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. useValidateContentBulk
// ─────────────────────────────────────────────────────────────────────────────
interface UseValidateContentBulkResult {
  validateBulk: (
    leadId: string,
    contentType?: EditorialContentType
  ) => Promise<BulkValidationResult[]>
  loading: boolean
  error: string | null
}

export function useValidateContentBulk(): UseValidateContentBulkResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateBulk = useCallback(
    async (leadId: string, contentType?: EditorialContentType) => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data, error: rpcErr } = await supabase.rpc('validate_content_bulk', {
          p_validated_by_lead: leadId,
          p_content_type: contentType ?? null,
        })
        if (rpcErr) throw rpcErr
        return (data || []) as BulkValidationResult[]
      } catch (err: any) {
        console.error('useValidateContentBulk error:', err)
        setError(err.message || 'Erreur lors de la validation en bloc')
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { validateBulk, loading, error }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. useValidationCandidates
// ─────────────────────────────────────────────────────────────────────────────
interface UseValidationCandidatesResult {
  candidates: ValidationCandidate[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface FormationRow {
  id: string
  title: string
  axe_cp: number | null
}

interface NewsEpisodeRow {
  id: string
  title: string
  type: string
  status: string
}

function statusOrderKey(c: ValidationCandidate): number {
  // 0 : non validé · 1 : stale · 2 : validé à jour
  if (!c.current_validation_id) return 0
  if (c.is_stale) return 1
  return 2
}

export function useValidationCandidates(
  contentType?: EditorialContentType
): UseValidationCandidatesResult {
  const [candidates, setCandidates] = useState<ValidationCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      // 1. Récupère les contenus bruts en parallèle
      const wantFormations = !contentType || contentType === 'formation'
      const wantEpisodes = !contentType || contentType === 'news_episode'

      const formationsPromise: Promise<{ data: FormationRow[]; error: any }> =
        wantFormations
          ? (async () => {
              const res = await supabase
                .from('formations')
                .select('id, title, axe_cp')
                .order('title', { ascending: true })
              return {
                data: (res.data || []) as FormationRow[],
                error: res.error,
              }
            })()
          : Promise.resolve({ data: [] as FormationRow[], error: null })

      const episodesPromise: Promise<{ data: NewsEpisodeRow[]; error: any }> =
        wantEpisodes
          ? (async () => {
              const res = await supabase
                .from('news_episodes')
                .select('id, title, type, status')
                .in('status', ['draft', 'published', 'archived'])
                .order('title', { ascending: true })
              return {
                data: (res.data || []) as NewsEpisodeRow[],
                error: res.error,
              }
            })()
          : Promise.resolve({ data: [] as NewsEpisodeRow[], error: null })

      const [formationsRes, episodesRes] = await Promise.all([
        formationsPromise,
        episodesPromise,
      ])
      if (formationsRes.error) throw formationsRes.error
      if (episodesRes.error) throw episodesRes.error

      const formationRows = formationsRes.data
      const episodeRows = episodesRes.data

      // 2. Pour chaque ligne, appel get_validation_status en parallèle
      type StatusEntry = {
        type: EditorialContentType
        id: string
        title: string
        axe_cp?: number | null
        episode_type?: string | null
        episode_status?: string | null
        status: ValidationStatus | null
      }

      const statusPromises: Promise<StatusEntry>[] = []

      for (const f of formationRows) {
        statusPromises.push(
          (async (): Promise<StatusEntry> => {
            const res = await supabase.rpc('get_validation_status', {
              p_content_type: 'formation',
              p_content_id: f.id,
            })
            return {
              type: 'formation',
              id: f.id,
              title: f.title,
              axe_cp: f.axe_cp,
              status:
                Array.isArray(res.data) && res.data.length > 0
                  ? (res.data[0] as ValidationStatus)
                  : null,
            }
          })()
        )
      }

      for (const e of episodeRows) {
        statusPromises.push(
          (async (): Promise<StatusEntry> => {
            const res = await supabase.rpc('get_validation_status', {
              p_content_type: 'news_episode',
              p_content_id: e.id,
            })
            return {
              type: 'news_episode',
              id: e.id,
              title: e.title,
              episode_type: e.type,
              episode_status: e.status,
              status:
                Array.isArray(res.data) && res.data.length > 0
                  ? (res.data[0] as ValidationStatus)
                  : null,
            }
          })()
        )
      }

      const statuses = await Promise.all(statusPromises)

      // 3. Construit la liste finale de candidats
      const result: ValidationCandidate[] = statuses.map((s) => {
        const validated = s.status?.validated ?? false
        return {
          content_type: s.type,
          content_id: s.id,
          content_title: s.title,
          axe_cp: s.axe_cp ?? null,
          episode_type: s.episode_type ?? null,
          episode_status: s.episode_status ?? null,
          is_stale: validated ? Boolean(s.status?.is_stale) : false,
          current_validation_id: validated ? s.status?.validation_id ?? null : null,
          current_validated_at: validated ? s.status?.validated_at ?? null : null,
          current_lead_name: validated ? s.status?.lead_name ?? null : null,
          current_secondary_name: validated ? s.status?.secondary_name ?? null : null,
        }
      })

      // 4. Tri : non-validés > stale > validés (validated_at DESC)
      result.sort((a, b) => {
        const ka = statusOrderKey(a)
        const kb = statusOrderKey(b)
        if (ka !== kb) return ka - kb
        // même catégorie : trie par date desc, sinon titre
        const ta = a.current_validated_at ? Date.parse(a.current_validated_at) : 0
        const tb = b.current_validated_at ? Date.parse(b.current_validated_at) : 0
        if (tb !== ta) return tb - ta
        return a.content_title.localeCompare(b.content_title)
      })

      setCandidates(result)
    } catch (err: any) {
      console.error('useValidationCandidates error:', err)
      setError(err.message || 'Erreur lors du chargement des candidats')
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }, [contentType])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  return { candidates, loading, error, refetch: fetchCandidates }
}
