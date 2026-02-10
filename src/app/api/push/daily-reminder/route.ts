import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { sendPushNotificationToMany } from '@/lib/push';
import { createDailyReminderNotification } from '@/lib/push/notifications';
import type { PushSubscriptionRecord } from '@/types/push-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Vérifier le secret CRON pour la sécurité
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const today = new Date().toISOString().split('T')[0];

    console.log('[Daily Reminder] Envoi des rappels quotidiens...');

    // Récupérer les utilisateurs avec rappels activés
    const { data: users, error: usersError } = await supabase
      .from('user_notification_preferences')
      .select('user_id')
      .eq('daily_reminders', true);

    if (usersError) {
      console.error('[Daily Reminder] Erreur:', usersError);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'Aucun utilisateur avec rappels activés', notified: 0 });
    }

    let totalNotified = 0;
    let totalFailed = 0;
    let skipped = 0;

    for (const user of users) {
      // Vérifier si l'utilisateur a déjà fait une activité aujourd'hui
      const { data: todayActivity } = await supabase
        .from('daily_quiz_results')
        .select('id')
        .eq('user_id', user.user_id)
        .gte('completed_at', `${today}T00:00:00`)
        .lte('completed_at', `${today}T23:59:59`)
        .limit(1);

      if (todayActivity && todayActivity.length > 0) {
        skipped++;
        continue;
      }

      // Récupérer le streak de l'utilisateur
      const { data: streak } = await supabase
        .from('streaks')
        .select('current_streak')
        .eq('user_id', user.user_id)
        .single();

      // Récupérer les abonnements push
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.user_id);

      if (!subscriptions || subscriptions.length === 0) {
        continue;
      }

      // Créer et envoyer la notification
      const notification = createDailyReminderNotification(
        streak?.current_streak || 0
      );

      const result = await sendPushNotificationToMany(
        subscriptions as PushSubscriptionRecord[],
        notification
      );

      totalNotified += result.sent;
      totalFailed += result.failed;

      // Nettoyer les abonnements expirés
      if (result.expiredEndpoints.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', result.expiredEndpoints);
      }
    }

    console.log(`[Daily Reminder] Résultat: ${totalNotified} envoyés, ${totalFailed} échecs, ${skipped} ignorés`);

    return NextResponse.json({
      success: true,
      notified: totalNotified,
      failed: totalFailed,
      skipped
    });
  } catch (error) {
    console.error('Erreur API /push/daily-reminder:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
