-- Lot 4B — Suppression définitive de la colonne orpheline new_sequences.
-- DESTRUCTIVE (DROP COLUMN). Décision Julie (20/07/2026) : la préférence
-- « new_sequences » n'est plus exposée nulle part.
--
-- Pré-requis (fait avant application) : plus aucune référence code
--   - src/          → 0 (l'unique usage, api/push/subscribe/route.ts, retiré)
--   - supabase/functions/ → 0
--   - fonctions plpgsql public/extensions → 0 (audit MCP 20/07/2026)
-- Ordre impératif : retrait des références + build validé AVANT ce DROP.

ALTER TABLE public.user_notification_preferences
  DROP COLUMN IF EXISTS new_sequences;
