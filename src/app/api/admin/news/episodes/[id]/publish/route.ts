import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST — publie un épisode en statut 'ready'.
// Précondition : status === 'ready' → 409 sinon.
// Écrit published_at + validated_by (réservés à cette route uniquement).
//
// Décision (chantier fusion validation/publication, news_episode
// uniquement) : publier UN épisode EST l'acte de validation éditoriale.
// Avant de faire passer l'épisode en published, on pose une validation
// courante dans editorial_validations via la RPC validate_content — la
// même RPC que la validation manuelle sur /admin/editorial-validations,
// avec le même garde-fou is_lead. Si la validation échoue (pas de
// cs_member is_lead pour l'appelant), on NE publie PAS.
//
// Ordre volontairement non-atomique (pas de migration nominative pour une
// fonction SQL unique) : on valide D'ABORD, on ne publie qu'ENSUITE. Le
// seul mode de défaillance possible est donc « validé mais pas encore
// publié » (récupérable, sans risque), jamais l'inverse.
//
// validate_content vérifie en interne is_super_admin(auth.uid()) : elle
// DOIT être appelée via le client `supabase` lié à la session (auth.uid()
// résout), jamais via `adminSupabase` (service-role, auth.uid() = NULL).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: episodeId } = await params

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data: episode, error: fetchErr } = await adminSupabase
      .from('news_episodes')
      .select('id, status')
      .eq('id', episodeId)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Épisode introuvable' }, { status: 404 })
    }
    if (episode.status !== 'ready') {
      return NextResponse.json(
        { error: 'Episode doit être en statut ready pour être publié' },
        { status: 409 },
      )
    }

    // ----- Résolution de l'appelant vers son cs_members.id (doit être lead) -----
    const { data: csMember, error: csErr } = await adminSupabase
      .from('cs_members')
      .select('id, is_lead, active')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (csErr) {
      return NextResponse.json({ error: csErr.message }, { status: 500 })
    }
    if (!csMember || !csMember.is_lead || !csMember.active) {
      return NextResponse.json(
        {
          error:
            'Publication réservée au validateur principal du comité scientifique',
        },
        { status: 403 },
      )
    }

    // ----- Validation éditoriale (avant publication) -----
    const { error: validateErr } = await supabase.rpc('validate_content', {
      p_content_type: 'news_episode',
      p_content_id: episodeId,
      p_validated_by_lead: csMember.id,
      p_validated_by_secondary: null,
      p_comments: "Validation via publication de l'épisode",
    })

    if (validateErr) {
      console.error('Erreur validate_content (publish):', validateErr)
      return NextResponse.json(
        { error: validateErr.message || 'Erreur lors de la validation éditoriale' },
        { status: 500 },
      )
    }

    // ----- Publication (uniquement si la validation a réussi) -----
    const { data: updated, error: updErr } = await adminSupabase
      .from('news_episodes')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        validated_by: session.user.id,
      })
      .eq('id', episodeId)
      .select('id, status, published_at')
      .single()

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, episode: updated })
  } catch (err) {
    console.error('POST /api/admin/news/episodes/[id]/publish error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
