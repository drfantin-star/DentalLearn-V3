// Push notification helpers and message templates
import type { PushNotificationPayload, NotificationType } from '@/types/push-notifications';

const DEFAULT_ICON = '/images/iconeDL.png';
const DEFAULT_BADGE = '/images/iconeDL.png';

export function createLeaderboardResultNotification(
  rank: number,
  points: number
): PushNotificationPayload {
  const rankText = rank === 1 ? '1er' : `${rank}ème`;
  const emoji = rank <= 3 ? '🏆' : '📊';

  return {
    title: `${emoji} Résultat du classement`,
    body: `Vous avez terminé ${rankText} cette semaine avec ${points} points !`,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'leaderboard-result',
    data: {
      url: '/classement',
      type: 'leaderboard_result' as NotificationType
    }
  };
}

export function createNewSequenceNotification(
  formationTitle: string,
  sequenceNumber: number,
  sequenceTitle: string,
  formationId: string
): PushNotificationPayload {
  return {
    title: '🎯 Nouvelle séquence disponible !',
    body: `${formationTitle} - Séquence ${sequenceNumber}: ${sequenceTitle}`,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: `new-sequence-${formationId}-${sequenceNumber}`,
    data: {
      url: `/formation/${formationId}`,
      type: 'new_sequence' as NotificationType
    }
  };
}

export function createDailyReminderNotification(
  streakCount: number,
  sequencesToComplete?: number
): PushNotificationPayload {
  let body: string;
  let emoji: string;

  if (streakCount > 0) {
    emoji = '🔥';
    body = `Vous avez une série de ${streakCount} jours ! Ne la perdez pas, faites votre séquence du jour.`;
  } else {
    emoji = '📚';
    body = sequencesToComplete
      ? `Vous avez ${sequencesToComplete} séquence${sequencesToComplete > 1 ? 's' : ''} disponible${sequencesToComplete > 1 ? 's' : ''}. Prenez 3 minutes pour progresser !`
      : 'Prenez 3 minutes pour faire votre séquence du jour !';
  }

  return {
    title: `${emoji} Rappel DentalLearn`,
    body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'daily-reminder',
    data: {
      url: '/',
      type: 'daily_reminder' as NotificationType
    }
  };
}

export function createNotification(
  title: string,
  body: string,
  options?: {
    url?: string;
    tag?: string;
    type?: NotificationType;
  }
): PushNotificationPayload {
  return {
    title,
    body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: options?.tag || 'default',
    data: {
      url: options?.url || '/',
      type: options?.type
    }
  };
}

/**
 * Crée la notification push de relance à froid (J+90).
 * Type 'first' = 1ère notif, 'reminder' = 2ème notif (J+97).
 */
export function createColdSurveyNotification(
  formationTitle: string,
  formationId: string,
  type: 'first' | 'reminder'
): PushNotificationPayload {
  const title =
    type === 'first'
      ? '💬 Votre avis 3 mois après ?'
      : '🔔 Petit rappel : votre avis nous intéresse';

  const body = `Comment avez-vous appliqué ${formationTitle} dans votre pratique ?`;

  return {
    title,
    body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: `cold-survey-${formationId}`,
    data: {
      url: `/satisfaction-froid/${formationId}`,
      type: 'cold_survey' as NotificationType
    }
  };
}
