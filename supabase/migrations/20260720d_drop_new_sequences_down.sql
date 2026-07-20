-- Rollback 20260720d — recrée new_sequences.
-- Les valeurs individuelles sont perdues (colonne orpheline) : DEFAULT true,
-- cohérent avec l'opt-in par défaut des autres préférences de contenu.

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS new_sequences boolean DEFAULT true;
