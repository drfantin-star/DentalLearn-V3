import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint requis' }, { status: 400 });
    }

    await supabase.from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id);

    const { data: remaining } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (!remaining || remaining.length === 0) {
      await supabase.from('user_notification_preferences')
        .update({ push_enabled: false })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur API /push/unsubscribe:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
