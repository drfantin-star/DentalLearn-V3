export type NotificationType =
  | 'leaderboard_result'
  | 'new_sequence'
  | 'new_formation'
  | 'daily_reminder';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: NotificationType;
  };
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
  created_at: string;
}
