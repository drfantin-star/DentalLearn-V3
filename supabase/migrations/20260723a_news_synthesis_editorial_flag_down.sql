-- 20260723a_news_synthesis_editorial_flag_down.sql
-- Rollback symetrique de 20260723a_news_synthesis_editorial_flag.sql.
--
-- ATTENTION : la colonne is_editorially_validated est lue par les chemins
-- praticien (news feed, quiz par theme) et par get_daily_quiz (migration
-- 20260723b). Ne PAS jouer ce down sans avoir au prealable rollback le code
-- applicatif ET la migration 20260723b, sous peine d'erreur "column does not
-- exist" en production.

DROP TRIGGER IF EXISTS trg_sync_news_synthesis_validation_flag
  ON public.editorial_validations;
DROP FUNCTION IF EXISTS public.sync_news_synthesis_validation_flag();
DROP INDEX IF EXISTS public.idx_news_syntheses_status_validated;
ALTER TABLE public.news_syntheses
  DROP COLUMN IF EXISTS is_editorially_validated;
