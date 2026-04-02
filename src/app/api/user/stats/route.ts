import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Points totaux
    const { data: pointsData } = await supabase
      .from('daily_quiz_results')
      .select('total_points')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null);

    const total_points = pointsData
      ? pointsData.reduce((sum, r) => sum + (r.total_points || 0), 0)
      : 0;

    // Streak
    const { data: streak } = await supabase
      .from('streaks')
      .select('current_streak, longest_streak')
      .eq('user_id', user.id)
      .single();

    // Séquences complétées
    const { count: completed_sequences } = await supabase
      .from('user_sequences')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('completed_at', 'is', null);

    // Formations complétées
    const { count: completed_formations } = await supabase
      .from('user_formations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('completed_at', 'is', null);

    return NextResponse.json({
      total_points,
      current_streak: streak?.current_streak || 0,
      longest_streak: streak?.longest_streak || 0,
      completed_sequences: completed_sequences || 0,
      completed_formations: completed_formations || 0
    });
  } catch (error) {
    console.error('Erreur API /user/stats:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
