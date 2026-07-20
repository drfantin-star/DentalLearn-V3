-- Lot 4B (correctif) — Suppression de prefs_snapshot : mécanique morte.
-- Le comportement « retrouver sa config après coupure du maître » est déjà
-- gratuit car les colonnes individuelles ne sont jamais modifiées à la coupure
-- (seul notifications_enabled bascule). Le snapshot recopiait des données
-- intactes → inutile.
--
-- DESTRUCTIVE (DROP COLUMN). Sûr en application immédiate : colonne créée le
-- jour même (20260720c), vide, référencée uniquement par cette branche (code
-- retiré avant le DROP). softask_shown_at et softask_dismissed_count sont
-- conservées.

ALTER TABLE public.user_notification_preferences
  DROP COLUMN IF EXISTS prefs_snapshot;
