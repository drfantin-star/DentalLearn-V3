import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isSuperAdmin,
  hasRole,
  getUserIntraRole,
  type AppRole,
  type IntraRole,
} from '@/lib/auth/rbac'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Rafraîchir la session si nécessaire
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

/**
 * Redirige vers /login si non authentifié, vers /403 si non super_admin.
 * À utiliser dans les route handlers admin : `await requireSuperAdmin(request)`.
 * Retourne `null` si l'accès est autorisé.
 */
export async function requireSuperAdmin(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!(await isSuperAdmin(user.id))) {
    return NextResponse.redirect(new URL('/403', request.url))
  }

  return null
}

/**
 * Redirige vers /login ou /403 si le user n'a pas le rôle global requis.
 */
export async function requireRole(request: NextRequest, role: AppRole) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!(await hasRole(user.id, role))) {
    return NextResponse.redirect(new URL('/403', request.url))
  }

  return null
}

/**
 * Redirige vers /login ou /403 si l'intra_role du user n'est pas dans la liste.
 * Pour les pages espace tenant admin.
 */
export async function requireIntraRole(
  request: NextRequest,
  allowedRoles: IntraRole[]
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const intraRole = await getUserIntraRole(user.id)

  if (!intraRole || !allowedRoles.includes(intraRole)) {
    return NextResponse.redirect(new URL('/403', request.url))
  }

  return null
}
