// Parsing JSON tolérant pour les réponses LLM Sonnet côté Node.js.
//
// Transposition du helper `parseJsonFromText` de
// supabase/functions/_shared/anthropic.ts (Deno) — même logique deux passes :
//   1. JSON.parse direct (cas nominal — Sonnet respecte la consigne "pas de
//      wrap markdown, pas de préambule, sortie 100 % JSON").
//   2. Recovery sur :
//      - bloc Markdown ``` ```json ... ``` ``` (avec ou sans le mot json)
//      - extraction par accolades équilibrées (1er { jusqu'au } qui ferme,
//        en respectant les strings et les caractères échappés).
//
// Le caller (extractScenesFromScript) loggue un warning
// "json_recovered_from_wrap" si le recovery est actif — c'est un signal de
// drift Sonnet à surveiller même si la sortie est utilisable.

export interface JsonRecoveryAttempt {
  ok: boolean
  parsed?: unknown
  reason?: string
  /** true si JSON.parse direct a échoué mais l'extraction wrap/accolades a réussi. */
  recovered_from_wrap: boolean
}

export function parseStrictWithRecovery(text: string): JsonRecoveryAttempt {
  const trimmed = (text ?? '').trim()
  if (!trimmed) {
    return { ok: false, reason: 'empty response', recovered_from_wrap: false }
  }

  // 1ère passe : JSON.parse direct.
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return { ok: true, parsed, recovered_from_wrap: false }
  } catch {
    // Tomber sur la 2e passe.
  }

  // 2e passe — bloc Markdown ```json ... ``` puis extraction par accolades.
  const recovered = parseJsonFromText(trimmed)
  if (recovered !== null && recovered !== undefined) {
    return { ok: true, parsed: recovered, recovered_from_wrap: true }
  }

  return {
    ok: false,
    reason: 'JSON parse failed (direct + recovery)',
    recovered_from_wrap: false,
  }
}

/**
 * Variante exportée du helper Deno pour usage direct ailleurs si besoin.
 * Comportement strictement aligné sur _shared/anthropic.ts.
 */
export function parseJsonFromText<T = unknown>(text: string): T | null {
  if (!text) return null
  const trimmed = text.trim()

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as T
    } catch {
      // tombe en cas 3.
    }
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as T
    } catch {
      // tombe en cas 3.
    }
  }

  const start = trimmed.indexOf('{')
  if (start >= 0) {
    let depth = 0
    let inString = false
    let escape = false
    for (let i = start; i < trimmed.length; i++) {
      const c = trimmed[i]
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(start, i + 1)) as T
          } catch {
            return null
          }
        }
      }
    }
  }
  return null
}
