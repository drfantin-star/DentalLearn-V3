import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

// Délai max d'acquisition du lock d'auth avant exécution sans exclusivité.
const LOCK_ACQUIRE_TIMEOUT_MS = 5000

/**
 * Lock d'auth borné.
 *
 * Le lock par défaut de `@supabase/auth-js` s'appuie sur `navigator.locks`.
 * Sur Android Chrome en mode standalone/PWA, un lock détenu par une autre
 * fenêtre/contexte (ou par un refresh coincé sur une session au format legacy)
 * peut n'être JAMAIS relâché : `getUser()` attend alors indéfiniment et les
 * pages qui en dépendent (Formations, Conformité, clic catégorie) chargent à
 * l'infini.
 *
 * Ici on borne l'acquisition : si le lock n'est pas obtenu sous
 * `LOCK_ACQUIRE_TIMEOUT_MS`, on exécute quand même l'opération sans exclusivité
 * plutôt que de bloquer l'UI. La promesse de `getUser()` finit donc toujours
 * par se résoudre. La sérialisation reste assurée dans le cas nominal.
 */
async function boundedNavigatorLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  // Pas de Web Locks (SSR, navigateurs anciens) : exécution directe.
  if (
    typeof navigator === 'undefined' ||
    !navigator.locks ||
    typeof navigator.locks.request !== 'function'
  ) {
    return fn()
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOCK_ACQUIRE_TIMEOUT_MS)

  try {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', signal: controller.signal },
      async () => fn()
    )
  } catch (err) {
    // AbortError = lock non obtenu à temps (probablement détenu par un contexte
    // bloqué). On exécute sans le lock plutôt que de bloquer indéfiniment.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return fn()
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: boundedNavigatorLock,
      },
    }
  )

  return client
}

/**
 * `getUser()` borné par un timeout généreux. Filet defense-in-depth pour les
 * chemins critiques au boot : garantit que la promesse résout même si l'auth se
 * coince, pour ne jamais laisser un écran en chargement infini. En cas de
 * timeout, on retourne `user: null` (l'UI traite comme « non authentifié »
 * plutôt que de tourner dans le vide).
 */
export async function getUserWithTimeout(
  timeoutMs = 10000
): Promise<{ user: User | null }> {
  const supabase = createClient()

  const fromAuth: Promise<{ user: User | null }> = (async () => {
    try {
      const res = await supabase.auth.getUser()
      return { user: (res?.data?.user ?? null) as User | null }
    } catch {
      return { user: null }
    }
  })()

  const fromTimeout = new Promise<{ user: null }>((resolve) =>
    setTimeout(() => resolve({ user: null }), timeoutMs)
  )

  return Promise.race([fromAuth, fromTimeout])
}

export default createClient
