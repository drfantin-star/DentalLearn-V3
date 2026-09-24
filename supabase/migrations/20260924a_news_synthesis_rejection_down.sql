-- Nom du fichier : 20260924a_news_synthesis_rejection_down.sql
-- Date de création : 2026-09-24
-- Ticket : news-validation-rejet-editorial
-- Description : Rollback — retire le rejet éditorial (RPC, colonnes, statut).
-- Rollback : n/a (ce fichier EST le rollback de
--            20260924a_news_synthesis_rejection.sql)

-- ============================================================================
-- ⚠️ ROLLBACK DESTRUCTIF DE DONNÉES
-- ============================================================================
-- Contrairement à l'aller, ce retour PERD de l'information :
--   - toute synthèse en status='rejected' est remise en 'active', donc
--     réapparaît dans la file de validation et redevient publiable ;
--   - les motifs de rejet, dates et auteurs sont supprimés avec les colonnes.
--
-- Avant d'exécuter ce fichier, mesurer ce qui sera perdu :
--   SELECT COUNT(*) FILTER (WHERE status = 'rejected') AS a_reactiver,
--          COUNT(*) FILTER (WHERE rejection_reason IS NOT NULL) AS motifs_perdus
--     FROM public.news_syntheses;
--
-- Si le nombre est significatif, exporter d'abord :
--   SELECT id, display_title, rejected_at, rejection_reason
--     FROM public.news_syntheses WHERE status = 'rejected';

BEGIN;

-- 1. Remettre les rejetées en 'active' AVANT de restaurer la contrainte,
--    sinon l'ancienne contrainte (qui ignore 'rejected') échouerait.
UPDATE public.news_syntheses
   SET status = 'active'
 WHERE status = 'rejected';

-- 2. RPC
DROP FUNCTION IF EXISTS public.get_rejected_syntheses();
DROP FUNCTION IF EXISTS public.restore_news_syntheses(uuid[]);
DROP FUNCTION IF EXISTS public.reject_news_syntheses(uuid[], text);

-- 3. Index et colonnes de traçabilité
DROP INDEX IF EXISTS public.idx_news_syntheses_rejected;

ALTER TABLE public.news_syntheses
  DROP CONSTRAINT IF EXISTS news_syntheses_rejection_reason_check;

ALTER TABLE public.news_syntheses
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS rejected_by,
  DROP COLUMN IF EXISTS rejected_at;

-- 4. Contrainte de statut d'origine (5 valeurs, sans 'rejected')
ALTER TABLE public.news_syntheses
  DROP CONSTRAINT news_syntheses_status_extended_check;

ALTER TABLE public.news_syntheses
  ADD CONSTRAINT news_syntheses_status_extended_check
  CHECK (status = ANY (ARRAY[
    'active'::text,
    'retracted'::text,
    'deleted'::text,
    'failed'::text,
    'failed_permanent'::text
  ]));

COMMIT;

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT pg_get_constraintdef(con.oid)
--   FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
--  WHERE c.relname = 'news_syntheses'
--    AND con.conname = 'news_syntheses_status_extended_check';
-- Attendu : 5 valeurs, pas de 'rejected'.
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'news_syntheses' AND column_name LIKE 'reject%';
-- Attendu : aucune ligne.
