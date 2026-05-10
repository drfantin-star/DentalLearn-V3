import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { sendPushNotificationToMany } from '@/lib/push';
import { createColdSurveyNotification } from '@/lib/push/notifications';
import type { PushSubscriptionRecord } from '@/types/push-notifications';

export const dynamic = 'force-dynamic';

interface ColdSurveyRecipient {
  satisfaction_id: string;
  user_id: string;
  formation_id: string;
  formation_title: string;
  formation_slug: string;
  notification_type: 'first' | 'reminder';
  cold_survey_due_at: string;
  cold_survey_sent_at: string | null;
}

export async function GET(request: Request) {
  try {
    // 1. Auth CRON_SECRET (même mécanique que daily-reminder)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 2. Garde lundi (Vercel Hobby ne supporte pas cron hebdo).
    // Évalué en Europe/Paris pour cohérence avec le reste de l'app.
    const parisDate = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })
    );
    const dayOfWeek = parisDate.getDay();
    if (dayOfWeek !== 1) {
      return NextResponse.json({
        skipped: true,
        reason: 'Cold survey reminder runs only on Mondays',
        day_of_week: dayOfWeek,
      });
    }

    const supabase = createAdminClient();
    console.log('[Cold Survey Reminder] Scan des destinataires...');

    const { data: recipientsRaw, error: recipientsError } = await supabase.rpc(
      'get_cold_survey_recipients'
    );

    if (recipientsError) {
      console.error('[Cold Survey Reminder] Erreur RPC:', recipientsError);
      return NextResponse.json({ error: 'Erreur RPC' }, { status: 500 });
    }

    const recipients = (recipientsRaw || []) as ColdSurveyRecipient[];

    if (recipients.length === 0) {
      console.log('[Cold Survey Reminder] Aucun destinataire éligible');
      return NextResponse.json({
        success: true,
        notified: 0,
        failed: 0,
        recipients: 0,
      });
    }

    console.log(
      `[Cold Survey Reminder] ${recipients.length} destinataire(s) éligible(s)`
    );

    let totalNotified = 0;
    let totalFailed = 0;

    for (const recipient of recipients) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', recipient.user_id);

      if (!subscriptions || subscriptions.length === 0) {
        continue;
      }

      const notification = createColdSurveyNotification(
        recipient.formation_title,
        recipient.formation_id,
        recipient.notification_type
      );

      const result = await sendPushNotificationToMany(
        subscriptions as PushSubscriptionRecord[],
        notification
      );

      if (result.sent > 0) {
        const { error: markErr } = await supabase.rpc('mark_cold_survey_notified', {
          p_satisfaction_id: recipient.satisfaction_id,
          p_notification_type: recipient.notification_type,
        });
        if (markErr) {
          console.error(
            `[Cold Survey Reminder] mark_cold_survey_notified failed for ${recipient.satisfaction_id}:`,
            markErr
          );
        }
        totalNotified += result.sent;
      }

      totalFailed += result.failed;

      if (result.expiredEndpoints.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', result.expiredEndpoints);
      }
    }

    console.log(
      `[Cold Survey Reminder] Résultat: ${totalNotified} envoyés, ${totalFailed} échecs sur ${recipients.length} destinataires`
    );

    return NextResponse.json({
      success: true,
      notified: totalNotified,
      failed: totalFailed,
      recipients: recipients.length,
    });
  } catch (error) {
    console.error('Erreur API /push/cold-survey-reminder:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
