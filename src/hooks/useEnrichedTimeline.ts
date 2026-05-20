'use client'

import { useEffect, useState } from 'react'

import { TimelineSchema, type Timeline } from '@/lib/timeline/schema'

/**
 * Hook qui fetch + parse Zod un `*.timeline.json` depuis une URL.
 *
 * - Cache mémoire module-level : évite de re-fetcher la même URL si le
 *   composant remount (ex : navigation Next puis retour). Pas de persistance
 *   entre rechargements de page (volontaire — pas de localStorage).
 * - En cas d'erreur fetch ou parse Zod, `error` est setté et `timeline` reste
 *   null.
 * - Annulation : si l'URL change pendant un fetch en cours, le résultat de
 *   l'ancienne requête est ignoré via un flag `isStale` capturé par closure.
 */

export type UseEnrichedTimelineResult = {
  timeline: Timeline | null
  isLoading: boolean
  error: Error | null
}

const memoryCache = new Map<string, Timeline>()

export function useEnrichedTimeline(
  timelineUrl: string | null | undefined
): UseEnrichedTimelineResult {
  const [timeline, setTimeline] = useState<Timeline | null>(() =>
    timelineUrl ? memoryCache.get(timelineUrl) ?? null : null
  )
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!timelineUrl) {
      setTimeline(null)
      setIsLoading(false)
      setError(null)
      return
    }

    const cached = memoryCache.get(timelineUrl)
    if (cached) {
      setTimeline(cached)
      setIsLoading(false)
      setError(null)
      return
    }

    let isStale = false
    setIsLoading(true)
    setError(null)
    setTimeline(null)

    fetch(timelineUrl, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          console.error('[EnrichedTimeline] fetch HTTP error', {
            url: timelineUrl,
            status: res.status,
            statusText: res.statusText,
          })
          throw new Error(
            `Timeline fetch failed: HTTP ${res.status} ${res.statusText}`
          )
        }
        const json = (await res.json()) as unknown
        const parsed = TimelineSchema.safeParse(json)
        if (!parsed.success) {
          console.error('[EnrichedTimeline] Zod parse failed', {
            url: timelineUrl,
            issues: parsed.error.flatten(),
          })
          throw new Error(
            `Timeline Zod validation failed: ${parsed.error.message}`
          )
        }
        return parsed.data
      })
      .then((parsed) => {
        if (isStale) return
        memoryCache.set(timelineUrl, parsed)
        setTimeline(parsed)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (isStale) return
        const wrapped =
          err instanceof Error
            ? err
            : new Error('Timeline load failed (unknown error)')
        console.error('[EnrichedTimeline] load failed', {
          url: timelineUrl,
          message: wrapped.message,
        })
        setError(wrapped)
        setTimeline(null)
        setIsLoading(false)
      })

    return () => {
      isStale = true
    }
  }, [timelineUrl])

  return { timeline, isLoading, error }
}
