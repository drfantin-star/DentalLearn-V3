'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Marqueur d'URL anti-boucle (PAS de localStorage/sessionStorage — règle projet).
const RECOVERED_PARAM = 'session_recovered'

/**
 * SessionRecoveryGuard — filet de récupération pour les testeurs déjà coincés
 * sur une session au format legacy incompatible (suite au bump
 * `@supabase/ssr`).
 *
 * Garde-fous (cf. plan) :
 *  - Déclencheur de purge UNIQUE = cookie de session **illisible**. La décision
 *    ne dépend d'AUCUN appel réseau : une session valide mais lente n'est
 *    JAMAIS déconnectée. Une session saine = no-op total.
 *  - Anti-boucle via marqueur d'URL `?session_recovered=1` : la récupération
 *    s'exécute au plus une fois.
 *
 * Le hang « lock » lui-même est traité en amont par le lock borné dans
 * `lib/supabase/client.ts` ; ce guard ne couvre que le cas du cookie corrompu.
 */
export default function SessionRecoveryGuard() {
  useEffect(() => {
    const url = new URL(window.location.href)

    // Récupération déjà tentée : on nettoie le param et on s'arrête (anti-boucle).
    if (url.searchParams.has(RECOVERED_PARAM)) {
      url.searchParams.delete(RECOVERED_PARAM)
      window.history.replaceState(null, '', url.toString())
      return
    }

    // Inspection synchrone : un cookie de session existe-t-il et est-il lisible ?
    const raw = readAuthCookie()
    if (raw === null) return // pas de session → rien à récupérer
    if (isReadableSession(raw)) return // session lisible → no-op (cas nominal)

    // Cookie présent mais illisible (format legacy / corrompu) → purge + reload.
    void recoverAndReload()
  }, [])

  return null
}

/**
 * Reconstitue la valeur du cookie d'auth Supabase à partir de `document.cookie`,
 * en recombinant les éventuels chunks `sb-<ref>-auth-token.0`, `.1`, …
 * Retourne `null` s'il n'existe aucun cookie de session.
 */
function readAuthCookie(): string | null {
  const cookies = document.cookie ? document.cookie.split('; ') : []
  const base = new Map<string, string>()

  for (const entry of cookies) {
    const eq = entry.indexOf('=')
    if (eq === -1) continue
    const name = entry.slice(0, eq)
    const value = entry.slice(eq + 1)
    // Clés Supabase : sb-<ref>-auth-token éventuellement suffixé .<index>.
    if (/^sb-.+-auth-token(\.\d+)?$/.test(name)) {
      base.set(name, value)
    }
  }

  if (base.size === 0) return null

  // Recombine les chunks dans l'ordre (.0, .1, …) ou prend la clé non-chunkée.
  const names = Array.from(base.keys()).sort((a, b) => {
    const ai = chunkIndex(a)
    const bi = chunkIndex(b)
    return ai - bi
  })

  return names.map((n) => base.get(n)!).join('')
}

function chunkIndex(name: string): number {
  const m = name.match(/\.(\d+)$/)
  return m ? Number(m[1]) : 0
}

/**
 * Tente de décoder la valeur du cookie en session JSON valide. Volontairement
 * **tolérant** : on ne considère « illisible » que si AUCUNE stratégie de décodage
 * n'aboutit à un objet de session plausible. Objectif : éviter à tout prix une
 * purge sur une session valide (faux positif).
 */
function isReadableSession(raw: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }

  // Format récent @supabase/ssr : préfixe `base64-` + payload base64(url).
  const candidates: string[] = []
  if (decoded.startsWith('base64-')) {
    const b64 = base64ToString(decoded.slice('base64-'.length))
    if (b64 !== null) candidates.push(b64)
  } else {
    candidates.push(decoded) // ancien format : JSON direct
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (looksLikeSession(parsed)) return true
    } catch {
      // stratégie suivante
    }
  }

  return false
}

/** Une session Supabase contient un access_token (objet) ou en position 0 (array). */
function looksLikeSession(value: unknown): boolean {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.access_token === 'string') return true
  }
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
    return true
  }
  return false
}

function base64ToString(b64url: string): string | null {
  try {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Purge locale de la session + reload unique (avec marqueur anti-boucle). */
async function recoverAndReload(): Promise<void> {
  try {
    const supabase = createClient()
    // signOut local : efface le storage géré par @supabase/ssr, sans appel réseau.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  } finally {
    // Suppression défensive de tout cookie sb-* restant.
    deleteSupabaseCookies()

    const url = new URL(window.location.href)
    url.searchParams.set(RECOVERED_PARAM, '1')
    window.location.replace(url.toString())
  }
}

function deleteSupabaseCookies(): void {
  const cookies = document.cookie ? document.cookie.split('; ') : []
  for (const entry of cookies) {
    const name = entry.split('=')[0]
    if (name.startsWith('sb-')) {
      document.cookie = `${name}=; Max-Age=0; path=/`
    }
  }
}
