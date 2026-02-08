// Web Push server-side implementation
import webpush from 'web-push';
import type { PushSubscription as WebPushSubscription } from 'web-push';
import type { PushNotificationPayload, PushSubscriptionRecord } from '@/types/push-notifications';

function initializeWebPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contact@dentalschool.fr';

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys are not configured.');
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function toWebPushSubscription(record: PushSubscriptionRecord): WebPushSubscription {
  return {
    endpoint: record.endpoint,
    keys: {
      p256dh: record.p256dh,
      auth: record.auth
    }
  };
}

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    initializeWebPush();
    const webPushSubscription = toWebPushSubscription(subscription);
    const payloadString = JSON.stringify(payload);

    await webpush.sendNotification(webPushSubscription, payloadString);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WebPush] Error:', errorMessage);

    if (error instanceof webpush.WebPushError) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        return { success: false, error: 'subscription_expired' };
      }
    }

    return { success: false, error: errorMessage };
  }
}

export async function sendPushNotificationToMany(
  subscriptions: PushSubscriptionRecord[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; expiredEndpoints: string[] }> {
  initializeWebPush();

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      const result = await sendPushNotification(subscription, payload);
      if (result.success) {
        sent++;
      } else {
        failed++;
        if (result.error === 'subscription_expired') {
          expiredEndpoints.push(subscription.endpoint);
        }
      }
    })
  );

  return { sent, failed, expiredEndpoints };
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}
