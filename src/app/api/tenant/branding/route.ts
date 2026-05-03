import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantAdmin } from '@/lib/auth/tenant-guard'

export const dynamic = 'force-dynamic'

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/
const QUALIOPI_RE = /^[A-Za-z0-9-]{1,20}$/
const ODPC_RE = /^[A-Za-z0-9]{1,10}$/

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('organizations')
      .select('id, name, type, branding_logo_url, branding_primary_color, qualiopi_number, odpc_number')
      .eq('id', guard.ctx.org.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur API tenant/branding GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const orgType = guard.ctx.org.type
    if (orgType !== 'hr_entity' && orgType !== 'training_org') {
      return NextResponse.json(
        { error: 'Personnalisation non disponible pour ce type d\'organisation' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (body.branding_logo_url !== undefined) {
      if (body.branding_logo_url === null || body.branding_logo_url === '') {
        updates.branding_logo_url = null
      } else if (typeof body.branding_logo_url === 'string') {
        const url = body.branding_logo_url.trim()
        if (!isValidHttpUrl(url)) {
          return NextResponse.json(
            { error: 'URL du logo invalide (http(s) attendu)' },
            { status: 400 }
          )
        }
        updates.branding_logo_url = url
      } else {
        return NextResponse.json({ error: 'branding_logo_url invalide' }, { status: 400 })
      }
    }

    if (body.branding_primary_color !== undefined) {
      if (body.branding_primary_color === null || body.branding_primary_color === '') {
        updates.branding_primary_color = null
      } else if (
        typeof body.branding_primary_color === 'string' &&
        HEX_COLOR_RE.test(body.branding_primary_color)
      ) {
        updates.branding_primary_color = body.branding_primary_color
      } else {
        return NextResponse.json(
          { error: 'Couleur invalide (format attendu : #RRGGBB)' },
          { status: 400 }
        )
      }
    }

    // T7 — Qualiopi / ODPC, réservés aux training_org (visibles sur attestations OF tiers)
    if (body.qualiopi_number !== undefined) {
      if (orgType !== 'training_org') {
        return NextResponse.json(
          { error: 'qualiopi_number n\'est éditable que pour les organismes de formation' },
          { status: 403 }
        )
      }
      if (body.qualiopi_number === null || body.qualiopi_number === '') {
        updates.qualiopi_number = null
      } else if (
        typeof body.qualiopi_number === 'string' &&
        QUALIOPI_RE.test(body.qualiopi_number.trim())
      ) {
        updates.qualiopi_number = body.qualiopi_number.trim()
      } else {
        return NextResponse.json(
          { error: 'qualiopi_number invalide (1-20 caractères alphanumériques ou tiret)' },
          { status: 400 }
        )
      }
    }

    if (body.odpc_number !== undefined) {
      if (orgType !== 'training_org') {
        return NextResponse.json(
          { error: 'odpc_number n\'est éditable que pour les organismes de formation' },
          { status: 403 }
        )
      }
      if (body.odpc_number === null || body.odpc_number === '') {
        updates.odpc_number = null
      } else if (
        typeof body.odpc_number === 'string' &&
        ODPC_RE.test(body.odpc_number.trim())
      ) {
        updates.odpc_number = body.odpc_number.trim()
      } else {
        return NextResponse.json(
          { error: 'odpc_number invalide (1-10 caractères alphanumériques)' },
          { status: 400 }
        )
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('organizations')
      .update(updates)
      .eq('id', guard.ctx.org.id)
      .select('id, name, type, branding_logo_url, branding_primary_color, qualiopi_number, odpc_number, updated_at')
      .single()

    if (error) {
      console.error('tenant/branding PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur API tenant/branding PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
