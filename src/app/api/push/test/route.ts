import { createClient } from '@/lib/supabase/server';
import { sendPushNotificationToMany } from '@/lib/push';
import { NextResponse } from 'next/server';
import type { PushSubscriptionRecord } from '@/types/push-notifications';

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucun abonnement trouvé'
      }, { status: 404 });
    }

    const testNotification = {
      title: '🦷 Test DentalLearn',
      body: 'Les notifications fonctionnent correctement !',
      icon: '/images/iconeDL.png',
      badge: '/images/iconeDL.png',
      tag: 'test',
      data: { url: '/' }
    };

    const result = await sendPushNotificationToMany(
      subscriptions as PushSubscriptionRecord[],
      testNotification
    );

    if (result.expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions')
        .delete()
        .in('endpoint', result.expiredEndpoints);
    }

    return NextResponse.json({
      success: result.sent > 0,
      sent: result.sent,
      message: result.sent > 0 ? 'Notification envoyée !' : 'Échec de l\'envoi'
    });
  } catch (error) {
    console.error('Erreur API /push/test:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
