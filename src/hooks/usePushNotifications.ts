'use client';

import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: PermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

function checkSupport(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      setError(null);

      if (!checkSupport()) {
        setIsSupported(false);
        setPermission('unsupported');
        setIsLoading(false);
        return;
      }

      setIsSupported(true);
      setPermission(Notification.permission as PermissionState);

      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);
        const subscription = await reg.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('[Push] Init error:', err);
        setError('Erreur lors de l\'initialisation');
      }

      setIsLoading(false);
    }

    init();
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !registration) {
      setError('Notifications non supportées');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as PermissionState);

      if (permissionResult !== 'granted') {
        setError('Permission refusée');
        setIsLoading(false);
        return false;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError('Configuration manquante');
        setIsLoading(false);
        return false;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON())
      });

      if (!response.ok) throw new Error('Erreur serveur');

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      setError('Erreur lors de l\'activation');
      setIsLoading(false);
      return false;
    }
  }, [isSupported, registration]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;

    setIsLoading(true);
    setError(null);

    try {
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      setError('Erreur lors de la désactivation');
      setIsLoading(false);
      return false;
    }
  }, [registration]);

  return { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe };
}
