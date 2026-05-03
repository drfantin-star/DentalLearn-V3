import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantAdmin } from '@/lib/auth/tenant-guard'

export const dynamic = 'force-dynamic'

// Renvoie EXCLUSIVEMENT des agrégats — aucun user_id, email, prénom/nom dans
// la réponse. Garantie RGPD du modèle A : la hiérarchie ne voit jamais
// d'identifiants nominatifs sur cette route.
export async function GET() {
  try {
    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const orgId = guard.ctx.org.id
    const adminSupabase = createAdminClient()

    // 1. Membres actifs
    const { count: activeMembersCount, error: membersErr } = await adminSupabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active')

    if (membersErr) {
      console.error('analytics: count members', membersErr)
      return NextResponse.json({ error: membersErr.message }, { status: 500 })
    }

    // 2. Récupère la liste des user_id actifs pour scope analytics
    const { data: memberRows, error: memberRowsErr } = await adminSupabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('status', 'active')

    if (memberRowsErr) {
      console.error('analytics: list member ids', memberRowsErr)
      return NextResponse.json({ error: memberRowsErr.message }, { status: 500 })
    }

    const userIds = (memberRows ?? []).map((r) => r.user_id)

    let avgCompletion = 0
    let totalAudioSessions = 0
    let totalPoints = 0

    if (userIds.length > 0) {
      // 3. Taux de complétion moyen — % de user_formations avec completed_at
      const { data: ufRows, error: ufErr } = await adminSupabase
        .from('user_formations')
        .select('completed_at')
        .in('user_id', userIds)

      if (ufErr) {
        console.error('analytics: user_formations', ufErr)
        return NextResponse.json({ error: ufErr.message }, { status: 500 })
      }
      const total = ufRows?.length ?? 0
      if (total > 0) {
        const completed = (ufRows ?? []).filter((r) => r.completed_at !== null).length
        avgCompletion = Math.round((completed / total) * 100)
      }

      // 4. Sessions audio totales — COUNT course_watch_logs
      const { count: audioCount, error: audioErr } = await adminSupabase
        .from('course_watch_logs')
        .select('id', { count: 'exact', head: true })
        .in('user_id', userIds)

      if (audioErr) {
        console.error('analytics: course_watch_logs', audioErr)
        return NextResponse.json({ error: audioErr.message }, { status: 500 })
      }
      totalAudioSessions = audioCount ?? 0

      // 5. Points distribués — SUM user_points.points_earned
      const { data: pointRows, error: pointsErr } = await adminSupabase
        .from('user_points')
        .select('points_earned')
        .in('user_id', userIds)

      if (pointsErr) {
        console.error('analytics: user_points', pointsErr)
        return NextResponse.json({ error: pointsErr.message }, { status: 500 })
      }
      totalPoints = (pointRows ?? []).reduce((acc, r) => acc + (r.points_earned ?? 0), 0)
    }

    return NextResponse.json({
      active_members: activeMembersCount ?? 0,
      avg_completion_percent: avgCompletion,
      total_audio_sessions: totalAudioSessions,
      total_points: totalPoints,
    })
  } catch (error) {
    console.error('Erreur API tenant/analytics GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
