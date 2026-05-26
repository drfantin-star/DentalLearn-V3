import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasRole, isSuperAdmin } from '@/lib/auth/rbac'

/**
 * Sprint 2 — Guard pour Server Components. À appeler en tête d'un layout
 * ou d'une page server-side : il `redirect()` vers `/login?next=…` si non
 * connecté, vers `/403` si le user n'est ni `formateur` ni `super_admin`.
 *
 * Pourquoi un fichier distinct de `src/middleware.ts` : les helpers du
 * middleware retournent un `NextResponse`, format inadapté aux Server
 * Components (qui attendent un `redirect()` de `next/navigation` qui
 * `throw`). Même pattern que `src/app/tenant/layout.tsx`.
 *
 * Retourne le `userId` autorisé si l'accès est OK (utile pour éviter un
 * second appel `auth.getUser()` dans le layout appelant).
 */
export async function requireFormateurOrRedirect(
  currentPath?: string
): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const target = currentPath
      ? `/login?next=${encodeURIComponent(currentPath)}`
      : '/login'
    redirect(target)
  }

  const [isFmt, isSA] = await Promise.all([
    hasRole(user.id, 'formateur'),
    isSuperAdmin(user.id),
  ])

  if (!isFmt && !isSA) {
    redirect('/403')
  }

  return user.id
}
