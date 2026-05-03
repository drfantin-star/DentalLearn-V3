import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantAdmin } from '@/lib/auth/tenant-guard'

export const dynamic = 'force-dynamic'

const MAX_CURATED = 10
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ensureBrandedOrg(orgType: string): NextResponse | null {
  if (orgType !== 'hr_entity' && orgType !== 'training_org') {
    return NextResponse.json(
      { error: 'Curation non disponible pour ce type d\'organisation' },
      { status: 403 }
    )
  }
  return null
}

export async function GET() {
  try {
    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const block = ensureBrandedOrg(guard.ctx.org.type)
    if (block) return block

    const orgId = guard.ctx.org.id
    const adminSupabase = createAdminClient()

    // Liste épinglée par l'org (jointure pour récupérer titre et cover).
    const { data: pinned, error: pinnedErr } = await adminSupabase
      .from('org_curated_formations')
      .select('id, formation_id, display_order, formations(id, title, slug, cover_image_url, instructor_name, is_published)')
      .eq('org_id', orgId)
      .order('display_order', { ascending: true })

    if (pinnedErr) {
      console.error('tenant/curation GET pinned:', pinnedErr)
      return NextResponse.json({ error: pinnedErr.message }, { status: 500 })
    }

    // Catalogue Dentalschool publié (owner_org_id IS NULL AND is_published = true).
    const { data: catalog, error: catalogErr } = await adminSupabase
      .from('formations')
      .select('id, title, slug, cover_image_url, instructor_name')
      .is('owner_org_id', null)
      .eq('is_published', true)
      .order('title', { ascending: true })

    if (catalogErr) {
      console.error('tenant/curation GET catalog:', catalogErr)
      return NextResponse.json({ error: catalogErr.message }, { status: 500 })
    }

    return NextResponse.json({
      pinned: pinned ?? [],
      catalog: catalog ?? [],
      max: MAX_CURATED,
    })
  } catch (error) {
    console.error('Erreur API tenant/curation GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const block = ensureBrandedOrg(guard.ctx.org.type)
    if (block) return block

    const orgId = guard.ctx.org.id

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || !Array.isArray(body.formation_ids)) {
      return NextResponse.json(
        { error: 'Corps de requête invalide (formation_ids attendu)' },
        { status: 400 }
      )
    }

    const rawIds: unknown[] = body.formation_ids
    const ids: string[] = []
    for (const raw of rawIds) {
      if (typeof raw !== 'string' || !UUID_RE.test(raw)) {
        return NextResponse.json({ error: 'formation_id invalide' }, { status: 400 })
      }
      if (!ids.includes(raw)) ids.push(raw)
    }

    if (ids.length > MAX_CURATED) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CURATED} formations épinglées` },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    // Vérifie que toutes les formations sont du catalogue Dentalschool publié.
    if (ids.length > 0) {
      const { data: validRows, error: validErr } = await adminSupabase
        .from('formations')
        .select('id')
        .in('id', ids)
        .is('owner_org_id', null)
        .eq('is_published', true)

      if (validErr) {
        console.error('tenant/curation POST validate:', validErr)
        return NextResponse.json({ error: validErr.message }, { status: 500 })
      }
      if ((validRows?.length ?? 0) !== ids.length) {
        return NextResponse.json(
          { error: 'Une ou plusieurs formations ne sont pas dans le catalogue Dentalschool publié' },
          { status: 400 }
        )
      }
    }

    // Remplacement complet : DELETE puis INSERT batch.
    const { error: deleteErr } = await adminSupabase
      .from('org_curated_formations')
      .delete()
      .eq('org_id', orgId)

    if (deleteErr) {
      console.error('tenant/curation POST delete:', deleteErr)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    if (ids.length > 0) {
      const rows = ids.map((formation_id, idx) => ({
        org_id: orgId,
        formation_id,
        display_order: idx,
      }))
      const { error: insertErr } = await adminSupabase
        .from('org_curated_formations')
        .insert(rows)

      if (insertErr) {
        console.error('tenant/curation POST insert:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ count: ids.length })
  } catch (error) {
    console.error('Erreur API tenant/curation POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
