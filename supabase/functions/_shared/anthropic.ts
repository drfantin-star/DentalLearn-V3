// Anthropic Messages API client pour Edge Functions Deno.
//
// Contraintes (handoff §4 + spec v1.3 §6.3) :
//   - Clé API en variable d'environnement (ANTHROPIC_API_KEY), jamais en dur.
//   - Backoff exponentiel sur 429/5xx, max 3 retries (configurable).
//   - Respect du header Retry-After si présent.
//   - Aucune PII dans les logs (handoff §4.9) — c'est l'appelant qui choisit
//     de logger, ce module n'émet pas de logs.
//
// Ce module expose :
//   - AnthropicClient.messages(req)  — appel POST /v1/messages avec retry.
//   - extractTextContent(response)   — concatène les blocs `text` retournés.
//   - parseJsonFromText(text)        — parsing tolérant (bloc ```json``` ou JSON direct).
//
// Pas de SDK : fetch direct vers https://api.anthropic.com/v1/messages.
// Le SDK officiel `@anthropic-ai/sdk` tire des dépendances Node-only (form-data,
// node:stream) qui cassent le bundler Edge Functions Supabase. fetch suffit.
//
// Réutilisable Tickets 5 (synthèse Sonnet) et 7 (script Sonnet).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicRequest {
  model: string;
  /** System prompt (optionnel mais recommandé). */
  system?: string;
  messages: AnthropicMessage[];
  /** Limite tokens output (obligatoire côté Anthropic API). */
  max_tokens: number;
  /** 0..1, défaut 0 pour scoring déterministe. */
  temperature?: number;
}

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicTextBlock[];
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicClientOptions {
  /** ANTHROPIC_API_KEY (obligatoire). */
  apiKey: string;
  /** Version de l'API Anthropic, défaut "2023-06-01". */
  version?: string;
  /** Max retries sur 429/5xx (défaut 3). */
  maxRetries?: number;
  /** Timeout par requête en ms (défaut 60_000). */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

export class AnthropicClient {
  private readonly apiKey: string;
  private readonly version: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(opts: AnthropicClientOptions) {
    if (!opts.apiKey) throw new Error("AnthropicClient: apiKey required");
    this.apiKey = opts.apiKey;
    this.version = opts.version ?? "2023-06-01";
    this.maxRetries = opts.maxRetries ?? 3;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  /**
   * Appel POST /v1/messages avec retry exponentiel sur 429/5xx.
   * Backoff : 1s → 2s → 4s. Respecte le header Retry-After si présent et
   * supérieur au backoff calculé.
   *
   * Lève une Error détaillée si toutes les tentatives échouent (status non
   * retryable, payload error.message Anthropic, ou erreur réseau).
   */
  async messages(req: AnthropicRequest): Promise<AnthropicResponse> {
    const url = `${ANTHROPIC_BASE}/messages`;
    const body = JSON.stringify(req);
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= this.maxRetries) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": this.version,
            "content-type": "application/json",
          },
          body,
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          return await res.json() as AnthropicResponse;
        }

        // Tentative d'extraction du message d'erreur Anthropic structuré.
        const errPayload = await safeJsonError(res);

        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(
            `Anthropic ${res.status} ${res.statusText}: ${errPayload}`,
          );
          // Respect Retry-After si fourni en secondes.
          const ra = res.headers.get("retry-after");
          const raMs = ra ? parseRetryAfter(ra) : null;
          const backoff = 1000 * Math.pow(2, attempt);
          await sleep(raMs && raMs > backoff ? raMs : backoff);
        } else {
          throw new Error(
            `Anthropic ${res.status} ${res.statusText}: ${errPayload} (non-retryable)`,
          );
        }
      } catch (e) {
        clearTimeout(timer);
        const isAbort = e instanceof DOMException && e.name === "AbortError";
        if (isAbort) {
          lastErr = new Error(`Anthropic request timeout after ${this.timeoutMs}ms`);
          await sleep(1000 * Math.pow(2, attempt));
        } else if (attempt < this.maxRetries) {
          // Erreur réseau probable — retry.
          lastErr = e;
          await sleep(1000 * Math.pow(2, attempt));
        } else {
          throw e;
        }
      }
      attempt++;
    }
    throw lastErr ?? new Error("Anthropic: exhausted retries");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Concatène tous les blocs `text` d'une réponse Anthropic en une seule string.
 * Les autres types de blocs (tool_use, etc.) sont ignorés.
 */
export function extractTextContent(res: AnthropicResponse): string {
  return res.content
    .filter((b): b is AnthropicTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Parse JSON depuis un texte LLM, tolérant aux variantes courantes :
 *   - JSON brut.
 *   - Bloc Markdown ```json ... ``` (avec ou sans le mot json).
 *   - Texte parasite avant/après le JSON (extraction par accolades équilibrées).
 *
 * Retourne null si aucun JSON parsable n'est trouvé. L'appelant décide si
 * c'est une erreur retryable ou non.
 */
export function parseJsonFromText<T = unknown>(text: string): T | null {
  if (!text) return null;
  const trimmed = text.trim();

  // Cas 1 — JSON direct.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      // tombe en cas 3 (extraction par accolades).
    }
  }

  // Cas 2 — bloc Markdown ```json ... ``` ou ``` ... ```.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      // tombe en cas 3.
    }
  }

  // Cas 3 — extraction par accolades équilibrées (1er { jusqu'au } qui ferme).
  const start = trimmed.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(start, i + 1)) as T;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeJsonError(res: Response): Promise<string> {
  try {
    const body = await res.json() as {
      error?: { type?: string; message?: string };
    };
    if (body?.error?.message) {
      return `[${body.error.type ?? "error"}] ${body.error.message}`;
    }
    return JSON.stringify(body).slice(0, 500);
  } catch {
    try {
      const text = await res.text();
      return text.slice(0, 500);
    } catch {
      return "(no body)";
    }
  }
}

function parseRetryAfter(value: string): number | null {
  // Anthropic envoie Retry-After en secondes (entier).
  const n = parseFloat(value);
  if (Number.isFinite(n) && n >= 0) return Math.round(n * 1000);
  // Forme HTTP-date possible mais non observée — best effort.
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
}
