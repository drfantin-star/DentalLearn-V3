// OpenAI Embeddings API client pour Edge Functions Deno.
//
// Contraintes (handoff §4.5 + addendum v1.3 §2 + arbitrage Phase 1) :
//   - Clé API en variable d'environnement (OPENAI_API_KEY), jamais en dur.
//   - Backoff exponentiel sur 429/5xx, max 3 retries (configurable).
//   - Respect du header Retry-After si présent.
//   - Aucune PII dans les logs (handoff §4.9) — c'est l'appelant qui choisit
//     de logger, ce module n'émet pas de logs.
//   - Modèle figé : text-embedding-3-small, 1536 dimensions, ~0,02 $/1M tokens.
//   - Vector retourné asserté à exactement 1536 floats (échec immédiat sinon).
//
// Pas de SDK : fetch direct vers https://api.openai.com/v1/embeddings.
// Le SDK officiel `openai` tire des dépendances Node-only qui cassent le
// bundler Edge Functions Supabase. fetch suffit.
//
// Calque sur _shared/anthropic.ts (Ticket 4) : même structure, mêmes
// patterns retry/timeout/Retry-After.
//
// Réutilisable Tickets 5 (synthèse + KB) et au-delà si on ré-emploie les
// embeddings (recherche sémantique admin Ticket 8).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddingRequest {
  /** Texte à embedder. Max ~8191 tokens côté API. */
  input: string;
  /** Modèle figé en pratique, mais paramétrable pour tests. */
  model?: string;
  /**
   * Optionnel : tronquer/projeter à N dimensions côté serveur OpenAI.
   * On ne s'en sert pas (on garde les 1536 natives), mais c'est exposé
   * pour souplesse future.
   */
  dimensions?: number;
}

export interface EmbeddingResponseItem {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface EmbeddingResponse {
  object: "list";
  data: EmbeddingResponseItem[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIClientOptions {
  /** OPENAI_API_KEY (obligatoire). */
  apiKey: string;
  /** Max retries sur 429/5xx (défaut 3). */
  maxRetries?: number;
  /** Timeout par requête en ms (défaut 30_000 — embeddings sont rapides). */
  timeoutMs?: number;
  /** Modèle par défaut, défaut "text-embedding-3-small". */
  defaultModel?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENAI_BASE = "https://api.openai.com/v1";
export const EMBEDDING_MODEL_DEFAULT = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class OpenAIClient {
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly defaultModel: string;

  constructor(opts: OpenAIClientOptions) {
    if (!opts.apiKey) throw new Error("OpenAIClient: apiKey required");
    this.apiKey = opts.apiKey;
    this.maxRetries = opts.maxRetries ?? 3;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.defaultModel = opts.defaultModel ?? EMBEDDING_MODEL_DEFAULT;
  }

  /**
   * Appel POST /v1/embeddings avec retry exponentiel sur 429/5xx.
   * Backoff : 1s → 2s → 4s. Respecte le header Retry-After si présent et
   * supérieur au backoff calculé.
   *
   * Lève une Error détaillée si toutes les tentatives échouent (status non
   * retryable, payload error.message OpenAI, ou erreur réseau).
   */
  async embeddings(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    const url = `${OPENAI_BASE}/embeddings`;
    const body = JSON.stringify({
      input: req.input,
      model: req.model ?? this.defaultModel,
      // dimensions n'est inclus que s'il est explicitement demandé (sinon
      // on utilise les 1536 natives du modèle, ce que l'on veut).
      ...(req.dimensions ? { dimensions: req.dimensions } : {}),
    });
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= this.maxRetries) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "authorization": `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          },
          body,
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          return await res.json() as EmbeddingResponse;
        }

        const errPayload = await safeJsonError(res);

        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(
            `OpenAI ${res.status} ${res.statusText}: ${errPayload}`,
          );
          const ra = res.headers.get("retry-after");
          const raMs = ra ? parseRetryAfter(ra) : null;
          const backoff = 1000 * Math.pow(2, attempt);
          await sleep(raMs && raMs > backoff ? raMs : backoff);
        } else {
          // 4xx non retryable (401 clé invalide, 400 input vide, etc.)
          throw new Error(
            `OpenAI ${res.status} ${res.statusText}: ${errPayload} (non-retryable)`,
          );
        }
      } catch (e) {
        clearTimeout(timer);
        const isAbort = e instanceof DOMException && e.name === "AbortError";
        if (isAbort) {
          lastErr = new Error(`OpenAI request timeout after ${this.timeoutMs}ms`);
          await sleep(1000 * Math.pow(2, attempt));
        } else if (attempt < this.maxRetries) {
          lastErr = e;
          await sleep(1000 * Math.pow(2, attempt));
        } else {
          throw e;
        }
      }
      attempt++;
    }
    throw lastErr ?? new Error("OpenAI: exhausted retries");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Génère un embedding pour un texte unique.
 *
 * Garanties :
 *   - Lève une Error si `text` est vide ou ne contient que des espaces
 *     (l'API OpenAI rejetterait avec 400, autant échouer plus haut).
 *   - Lève une Error si la réponse ne contient pas exactement 1 entrée
 *     (cas `data.length !== 1` ou `data[0].embedding` manquant).
 *   - Lève une Error si le vector retourné n'a pas exactement
 *     EMBEDDING_DIMENSIONS (1536) floats — protège contre une dérive
 *     silencieuse de modèle qui casserait le storage `vector(1536)`.
 *
 * Retourne le tableau de floats prêt à insérer dans une colonne
 * `vector(1536)` Postgres (le client supabase-js sérialise correctement
 * un `number[]` vers le format pgvector).
 */
export async function embedText(
  client: OpenAIClient,
  text: string,
): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("embedText: input text is empty after trim");
  }

  const res = await client.embeddings({ input: trimmed });
  if (!res.data || res.data.length !== 1) {
    throw new Error(
      `embedText: expected 1 embedding in response, got ${res.data?.length ?? 0}`,
    );
  }
  const vec = res.data[0].embedding;
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `embedText: expected vector length ${EMBEDDING_DIMENSIONS}, got ${vec?.length ?? 0}`,
    );
  }
  // Les modèles OpenAI peuvent émettre des -0 ou NaN très rarement sur des
  // entrées dégénérées. On valide finement pour ne pas insérer des NaN dans
  // pgvector (qui les rejetterait à l'INSERT, mais autant fail plus tôt avec
  // un message clair).
  for (let i = 0; i < vec.length; i++) {
    if (!Number.isFinite(vec[i])) {
      throw new Error(`embedText: non-finite value at index ${i} (value=${vec[i]})`);
    }
  }
  return vec;
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
      error?: { type?: string; code?: string; message?: string };
    };
    if (body?.error?.message) {
      return `[${body.error.type ?? body.error.code ?? "error"}] ${body.error.message}`;
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
  // OpenAI envoie Retry-After en secondes (float possible).
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
