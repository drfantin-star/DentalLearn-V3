'use client';

import { useState } from 'react';
import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function PushNotificationToggle({ className, showLabel = true }: PushNotificationToggleProps) {
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotifications();
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const handleTestNotification = async () => {
    setTestStatus('loading');
    setTestMessage(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
        setTestMessage('Notification envoyée !');
      } else {
        setTestStatus('error');
        setTestMessage(data.message || 'Erreur');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Erreur réseau');
    }
    setTimeout(() => {
      setTestStatus('idle');
      setTestMessage(null);
    }, 3000);
  };

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const isDisabled = isLoading || permission === 'denied';

  return (
    <div className={`flex flex-col gap-3 ${className || ''}`}>
      <button
        onClick={handleToggle}
        disabled={isDisabled}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-medium ${
          isSubscribed
            ? 'bg-[#00D1C1]/10 text-[#00D1C1] border border-[#00D1C1]/20'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="w-5 h-5" />
        ) : (
          <BellOff className="w-5 h-5" />
        )}
        {showLabel && (
          <span>
            {isLoading ? 'Chargement...' : isSubscribed ? 'Notifications activées' : 'Activer les notifications'}
          </span>
        )}
      </button>

      {permission === 'denied' && (
        <p className="text-sm text-red-600">
          Notifications bloquées. Activez-les dans les paramètres du navigateur.
        </p>
      )}

      {error && permission !== 'denied' && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {isSubscribed && (
        <button
          onClick={handleTestNotification}
          disabled={testStatus === 'loading'}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
            testStatus === 'success'
              ? 'bg-green-100 text-green-700'
              : testStatus === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {testStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {testMessage || 'Envoyer une notification test'}
        </button>
      )}
    </div>
  );
}
