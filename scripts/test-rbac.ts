/**
 * Sprint 2 — Tests unitaires des 3 helpers RBAC formateur ajoutés en T2 :
 *   - isFormateur(userId)
 *   - getFormateurFormations(userId)
 *   - isFormateurOf(userId, formationId)
 *
 * Pourquoi un script standalone plutôt qu'un test Jest : le repo n'a pas
 * de framework de test JS installé (cf. package.json — uniquement Playwright
 * pour les E2E Sprint 1). Ajouter Jest pour 3 helpers serait disproportionné.
 *
 * Pré-requis :
 *   - Variables d'env NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *     (depuis `.env.local`).
 *   - Exécution (Node 20+ supporte --env-file nativement) :
 *       npx tsx --env-file=.env.local scripts/test-rbac.ts
 *     ou en exportant manuellement les vars.
 *
 * Le script :
 *   1. Crée un user de test temporaire via Admin SDK (auth.users + user_profiles).
 *   2. Pour chaque helper, vérifie un cas PASSANT (rôle attribué / lien créé)
 *      et un cas ÉCHOUANT (rôle absent / pas de lien).
 *   3. Nettoie tout en fin de script (DELETE FROM user_roles, formation_instructors,
 *      user_profiles, puis suppression user auth).
 *
 * Le script ne mute pas les helpers eux-mêmes : il utilise le service_role
 * pour SET/UNSET les rows BDD autour des appels, puis appelle les helpers
 * via l'import direct du module rbac (qui crée son propre client SSR avec
 * les cookies… mais nous n'avons pas de cookies en CLI, donc on bypass
 * en testant DIRECTEMENT les RPC SQL sous-jacentes via service_role —
 * c'est ce que les helpers font in fine côté serveur).
 *
 * Limite assumée : on ne teste pas le cache mémoire (Maps locales) car
 * il n'a aucune valeur sémantique en mode batch one-shot.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌  Variables d\'env manquantes : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
  )
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_EMAIL = `t2-rbac-test-${Date.now()}@example.test`

let failures = 0

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✅  ${label}`)
  } else {
    console.error(`  ❌  ${label}`)
    failures++
  }
}

async function main() {
  console.log('\n🔍  Tests RBAC formateur (Sprint 2 T2)\n')

  // ─── Setup ────────────────────────────────────────────────────────────────
  console.log('Setup — création d\'un user de test temporaire...')

  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    email_confirm: true,
    user_metadata: { test_marker: 't2-rbac' },
  })

  if (createErr || !createdUser?.user) {
    console.error('Impossible de créer le user de test:', createErr)
    process.exit(1)
  }

  const userId = createdUser.user.id
  console.log(`  user_id de test : ${userId}\n`)

  // Récupère une formation existante pour les tests isFormateurOf / getFormateurFormations
  const { data: anyFormation } = await admin
    .from('formations')
    .select('id, title')
    .limit(1)
    .single()

  if (!anyFormation) {
    console.error('Aucune formation en BDD pour les tests. Abort.')
    await admin.auth.admin.deleteUser(userId)
    process.exit(1)
  }

  const formationId = anyFormation.id as string
  console.log(`  formation de test : ${anyFormation.title} (${formationId})\n`)

  try {
    // ─── Test 1 — isFormateur ──────────────────────────────────────────────
    console.log('Test 1 — isFormateur(userId)')

    // Cas échouant : pas de rôle → has_role doit retourner false.
    {
      const { data, error } = await admin.rpc('has_role', {
        p_user_id: userId,
        p_role: 'formateur',
      })
      assert(!error && data === false, 'sans rôle → has_role=false')
    }

    // Cas passant : INSERT user_roles(formateur) → has_role=true.
    await admin.from('user_roles').insert({ user_id: userId, role: 'formateur' })
    {
      const { data, error } = await admin.rpc('has_role', {
        p_user_id: userId,
        p_role: 'formateur',
      })
      assert(!error && data === true, 'avec rôle → has_role=true')
    }

    // ─── Test 2 — isFormateurOf ───────────────────────────────────────────
    console.log('\nTest 2 — isFormateurOf(userId, formationId)')

    // Cas échouant : aucun lien formation_instructors.
    {
      const { data, error } = await admin.rpc('is_formateur_of', {
        p_user_id: userId,
        p_formation_id: formationId,
      })
      assert(!error && data === false, 'sans rattachement → is_formateur_of=false')
    }

    // Cas passant : INSERT formation_instructors.
    await admin
      .from('formation_instructors')
      .insert({ formation_id: formationId, user_id: userId, is_primary: true })
    {
      const { data, error } = await admin.rpc('is_formateur_of', {
        p_user_id: userId,
        p_formation_id: formationId,
      })
      assert(!error && data === true, 'avec rattachement → is_formateur_of=true')
    }

    // ─── Test 3 — getFormateurFormations ──────────────────────────────────
    console.log('\nTest 3 — getFormateurFormations(userId)')

    // Cas passant : 1 row injecté, on doit la retrouver avec is_primary=true.
    {
      const { data: ids, error } = await admin.rpc('get_formateur_formations', {
        p_user_id: userId,
      })
      const idList: string[] = Array.isArray(ids)
        ? ids
            .map((r: unknown) =>
              typeof r === 'string'
                ? r
                : (r as { get_formateur_formations?: string })?.get_formateur_formations ?? null
            )
            .filter((v): v is string => typeof v === 'string')
        : []
      assert(
        !error && idList.includes(formationId),
        `avec 1 rattachement → SETOF uuid contient ${formationId.slice(0, 8)}…`
      )

      // Lecture is_primary depuis formation_instructors (helper TS réplique ça).
      const { data: link } = await admin
        .from('formation_instructors')
        .select('is_primary')
        .eq('user_id', userId)
        .eq('formation_id', formationId)
        .single()
      assert(link?.is_primary === true, 'is_primary lu correctement depuis formation_instructors')
    }

    // Cas échouant : on retire le lien, le helper doit renvoyer un set vide.
    await admin
      .from('formation_instructors')
      .delete()
      .eq('user_id', userId)
      .eq('formation_id', formationId)
    {
      const { data: ids, error } = await admin.rpc('get_formateur_formations', {
        p_user_id: userId,
      })
      const idList: string[] = Array.isArray(ids)
        ? ids
            .map((r: unknown) =>
              typeof r === 'string'
                ? r
                : (r as { get_formateur_formations?: string })?.get_formateur_formations ?? null
            )
            .filter((v): v is string => typeof v === 'string')
        : []
      assert(!error && idList.length === 0, 'sans rattachement → SETOF uuid vide')
    }
  } finally {
    // ─── Cleanup ────────────────────────────────────────────────────────────
    console.log('\nCleanup — suppression user de test...')
    await admin
      .from('formation_instructors')
      .delete()
      .eq('user_id', userId)
    await admin.from('user_roles').delete().eq('user_id', userId)
    await admin.from('user_profiles').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
    console.log('  done.\n')
  }

  if (failures > 0) {
    console.error(`❌  ${failures} test(s) échoué(s).`)
    process.exit(1)
  }
  console.log('✅  Tous les tests passés.')
}

main().catch((err) => {
  console.error('Erreur inattendue :', err)
  process.exit(1)
})
