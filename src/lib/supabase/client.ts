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

// Timeout générique appliqué à TOUTE opération d'auth publique (getUser /
// getSession). Le lock borné ci-dessus garantit que l'ACQUISITION du lock ne
// bloque pas ; mais une fois le lock obtenu, si l'opération réseau interne
// d'auth-js se coince (refresh token désynchronisé, onglet Android Chrome PWA
// throttlé en arrière-plan après le prompt de notif), la promesse partagée
// in-flight d'auth-js n'est plus bornée. On borne donc ici l'OPÉRATION
// elle-même.
const AUTH_OP_TIMEOUT_MS = 10000

let client: ReturnType<typeof createBrowserClient> | null = null

/**
 * Borne une opération d'auth par un timeout : si elle ne résout pas sous
 * `AUTH_OP_TIMEOUT_MS`, on renvoie `fallback` (traité comme « non authentifié »)
 * plutôt que de laisser la promesse pendre indéfiniment → jamais de spinner
 * infini, quel que soit l'état interne d'auth-js. Préserve la forme de retour
 * native (`{ data, error }`) pour rester transparent aux appelants.
 */
function withAuthTimeout<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  const fromOp: Promise<T> = (async () => {
    try {
      return await op()
    } catch {
      return fallback
    }
  })()

  const fromTimeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), AUTH_OP_TIMEOUT_MS)
  )

  return Promise.race([fromOp, fromTimeout])
}

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

  // Enveloppe GLOBALE (une seule fois, le client est un singleton) : chaque
  // appel à `getUser`/`getSession` venant de l'app est borné par un timeout.
  // Couvre tous les consommateurs bruts (Formations, Profil, Conformité, …),
  // pas seulement ceux passant par `getUserWithTimeout`. Les appels INTERNES
  // d'auth-js (refresh automatique, onAuthStateChange) ne sont pas affectés :
  // on ne wrappe que les méthodes publiques appelées par le code applicatif.
  const auth = client.auth
  const rawGetUser = auth.getUser.bind(auth)
  const rawGetSession = auth.getSession.bind(auth)

  type GetUserResult = Awaited<ReturnType<typeof rawGetUser>>
  type GetSessionResult = Awaited<ReturnType<typeof rawGetSession>>

  const timeoutError = (op: string) =>
    Object.assign(new Error(`auth.${op}() timed out`), { name: 'AuthRetryableFetchError' })

  auth.getUser = ((...args: Parameters<typeof rawGetUser>) =>
    withAuthTimeout<GetUserResult>(
      () => rawGetUser(...args),
      { data: { user: null }, error: timeoutError('getUser') } as GetUserResult
    )) as typeof auth.getUser

  auth.getSession = (() =>
    withAuthTimeout<GetSessionResult>(
      () => rawGetSession(),
      { data: { session: null }, error: timeoutError('getSession') } as GetSessionResult
    )) as typeof auth.getSession

  return client
}

/**
 * `getUser()` borné par un timeout généreux. Conservé pour compatibilité des
 * appelants existants (`useUser`). Désormais redondant avec l'enveloppe globale
 * de `createClient()`, mais on garde l'API : il renvoie directement
 * `{ user }`. En cas de timeout/erreur, `user: null` (« non authentifié »).
 */
export async function getUserWithTimeout(
  _timeoutMs = AUTH_OP_TIMEOUT_MS
): Promise<{ user: User | null }> {
  const supabase = createClient()
  // `supabase.auth.getUser` est déjà borné globalement et ne rejette jamais
  // (fallback `user: null`), donc pas de race supplémentaire nécessaire ici.
  const res = await supabase.auth.getUser()
  return { user: (res?.data?.user ?? null) as User | null }
}

export default createClient
