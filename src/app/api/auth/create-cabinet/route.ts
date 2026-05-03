// Crée une organisation type='cabinet' + un membership intra_role='titulaire'
// pour un user. Service_role obligatoire (l'user n'est pas forcément
// authentifié quand cette route est appelée juste après signUp() — son email
// n'est pas encore vérifié).
//
// Deux cas d'usage :
//   1. Post-signup immédiat depuis /register : pas de session, on lit user_id
//      dans le body.
//   2. Upgrade solo → cabinet depuis /profil : session présente, on prend
//      auth.uid() côté serveur (le body est ignoré pour user_id).
//
// Idempotence : si une org existe déjà pour ce owner_user_id OU si un
// membership existe déjà pour ce user_id, on retourne l'org existante au
// lieu de dupliquer (cas retry réseau).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface CreateCabinetBody {
  user_id?: string
  name?: string
  siret?: string | null
  forme_juridique?: string | null
  adresse?: string | null
}

const NAME_MAX = 200
const FORME_MAX = 50
const SIRET_RE = /^\d{14}$/

function trimOrNull(v: unknown, max?: number): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  if (max && trimmed.length > max) return trimmed.slice(0, max)
  return trimmed
}

export async function POST(request: Request) {
  let body: CreateCabinetBody
  try {
    body = (await request.json()) as CreateCabinetBody
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  // ─── Résolution de l'user_id ────────────────────────────────────────────
  // Priorité à la session si elle existe (cas upgrade /profil).
  // Sinon fallback sur user_id du body (cas post-signup pré-vérification email).
  const sessionSupabase = createClient()
  const {
    data: { user: sessionUser },
  } = await sessionSupabase.auth.getUser()

  let userId: string | null = sessionUser?.id ?? null

  if (!userId) {
    const bodyUserId = trimOrNull(body.user_id)
    if (!bodyUserId) {
      return NextResponse.json(
        { error: 'user_id requis (aucune session active)' },
        { status: 401 }
      )
    }
    userId = bodyUserId
  }

  // ─── Validation des champs cabinet ──────────────────────────────────────
  const name = trimOrNull(body.name, NAME_MAX)
  if (!name) {
    return NextResponse.json(
      { error: 'Nom du cabinet requis' },
      { status: 400 }
    )
  }

  const siret = trimOrNull(body.siret, 14)
  if (siret && !SIRET_RE.test(siret)) {
    return NextResponse.json(
      { error: 'SIRET invalide (14 chiffres attendus)' },
      { status: 400 }
    )
  }
  const formeJuridique = trimOrNull(body.forme_juridique, FORME_MAX)
  const adresse = trimOrNull(body.adresse)

  // ─── Vérif user existe en auth.users ────────────────────────────────────
  const adminSupabase = createAdminClient()

  // Si on est en post-signup (pas de session), on confirme que l'user_id
  // correspond bien à un user récemment créé. Bloque les tentatives d'usurpation
  // par appel direct à la route avec un user_id arbitraire d'un autre user.
  if (!sessionUser) {
    const { data: targetUser, error: getUserError } =
      await adminSupabase.auth.admin.getUserById(userId)
    if (getUserError || !targetUser?.user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }
    // Sécurité : refuser si user déjà confirmé (= déjà passé par /verify-email).
    // Dans ce cas il devrait passer par le flow /profil avec session.
    if (targetUser.user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Utilisateur déjà confirmé : utilisez le flow connecté' },
        { status: 403 }
      )
    }
  }

  // ─── Idempotence : org déjà créée pour ce user ? ────────────────────────
  // 1. Cherche un membership existant (1 user = 1 org max V1).
  const { data: existingMembership } = await adminSupabase
    .from('organization_members')
    .select('org_id, intra_role, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingMembership?.org_id) {
    return NextResponse.json(
      {
        org_id: existingMembership.org_id,
        already_member: true,
        intra_role: existingMembership.intra_role,
      },
      { status: 200 }
    )
  }

  // 2. Sécurité : cherche aussi une org owned par ce user mais sans
  //    membership (cas retry à mi-chemin entre les deux INSERT).
  const { data: existingOrg } = await adminSupabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('type', 'cabinet')
    .limit(1)
    .maybeSingle()

  let orgId: string | null = existingOrg?.id ?? null

  // ─── INSERT organization (si pas déjà créée) ────────────────────────────
  if (!orgId) {
    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .insert({
        name,
        type: 'cabinet',
        plan: 'standard',
        owner_user_id: userId,
        siret,
        forme_juridique: formeJuridique,
        adresse,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('create-cabinet: INSERT organization', orgError)
      return NextResponse.json(
        { error: orgError?.message ?? 'Erreur création organisation' },
        { status: 500 }
      )
    }
    orgId = org.id
  }

  // ─── INSERT membership titulaire actif ──────────────────────────────────
  const { error: memberError } = await adminSupabase
    .from('organization_members')
    .insert({
      user_id: userId,
      org_id: orgId,
      intra_role: 'titulaire',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

  if (memberError) {
    // 23505 = race condition sur l'UNIQUE (user_id) : un autre call est passé
    // entre temps. On retourne l'org_id (idempotent côté caller).
    if (memberError.code === '23505') {
      return NextResponse.json(
        { org_id: orgId, already_member: true },
        { status: 200 }
      )
    }
    console.error('create-cabinet: INSERT membership', memberError)
    return NextResponse.json(
      { error: memberError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ org_id: orgId, created: true }, { status: 201 })
}
