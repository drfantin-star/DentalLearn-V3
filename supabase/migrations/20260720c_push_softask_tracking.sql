-- Lot 4B — Suivi du soft-ask push + snapshot des sous-préférences.
-- Ajoute sur user_notification_preferences les colonnes nécessaires à
-- l'orchestration multi-appareils (localStorage interdit côté client, la
-- persistance passe donc obligatoirement par la base) :
--   - softask_shown_at        : date du premier soft-ask affiché (one-shot).
--   - softask_dismissed_count : nombre de « Plus tard » (0 → 1 → 2 = stop auto).
--   - prefs_snapshot          : sauvegarde des 9 sous-préférences quand le
--                               toggle maître est coupé, restaurée au rallumage.

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS softask_shown_at        timestamptz,
  ADD COLUMN IF NOT EXISTS softask_dismissed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prefs_snapshot          jsonb;
