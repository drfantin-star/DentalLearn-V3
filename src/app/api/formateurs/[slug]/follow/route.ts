import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: { slug: string } }

async function resolveFormateurUserId(
  supabase: ReturnType<typeof createClient>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('formateur_profiles')
    .select('user_id')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  return data?.user_id ?? null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formateurUserId = await resolveFormateurUserId(supabase, params.slug)
  if (!formateurUserId) return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })

  const [followRow, countRow] = await Promise.all([
    supabase
      .from('formateur_followers')
      .select('id')
      .eq('user_id', user.id)
      .eq('formateur_user_id', formateurUserId)
      .maybeSingle(),
    supabase
      .from('formateur_followers')
      .select('id', { count: 'exact', head: true })
      .eq('formateur_user_id', formateurUserId),
  ])

  return NextResponse.json({
    following: !!followRow.data,
    followers_count: countRow.count ?? 0,
  })
}

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formateurUserId = await resolveFormateurUserId(supabase, params.slug)
  if (!formateurUserId) return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })

  // Ownership check : on ne peut pas se suivre soi-même
  if (user.id === formateurUserId) {
    return NextResponse.json({ error: 'Impossible de se suivre soi-même' }, { status: 400 })
  }

  const { error } = await supabase
    .from('formateur_followers')
    .insert({ user_id: user.id, formateur_user_id: formateurUserId })

  // ON CONFLICT DO NOTHING equivalent : ignorer l'erreur unique violation
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ following: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formateurUserId = await resolveFormateurUserId(supabase, params.slug)
  if (!formateurUserId) return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })

  // Ownership check explicite côté serveur
  const { error } = await supabase
    .from('formateur_followers')
    .delete()
    .eq('user_id', user.id)
    .eq('formateur_user_id', formateurUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ following: false })
}
