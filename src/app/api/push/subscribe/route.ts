import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') || null;

    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent
      }, { onConflict: 'endpoint' });

    if (upsertError) {
      console.error('[Push Subscribe] Error:', upsertError);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    // Créer ou mettre à jour les préférences
    const { data: existingPrefs } = await supabase
      .from('user_notification_preferences')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (!existingPrefs) {
      await supabase.from('user_notification_preferences').insert({
        user_id: user.id,
        push_enabled: true,
        leaderboard_results: true,
        new_sequences: true,
        daily_reminders: true
      });
    } else {
      await supabase.from('user_notification_preferences')
        .update({ push_enabled: true })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur API /push/subscribe:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
