-- 20260723a_news_synthesis_editorial_flag.sql
-- Chantier verrou de validation editoriale news (suite audit 23/07/2026).
--
-- Objectif : exposer aux chemins de lecture praticien (client admin, colonnes
-- sures, pas de RLS sur news_syntheses) un booleen denormalise indiquant si
-- une synthese possede une validation editoriale COURANTE dans
-- editorial_validations. Un EXISTS sur editorial_validations n'est pas
-- exploitable cote PostgREST -> on materialise le flag sur news_syntheses et
-- on le maintient par trigger.
--
-- Non destructif : ajout de colonne + fonction + trigger + index. Aucune
-- donnee supprimee. Idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP ...
-- IF EXISTS) : rejouable sans effet de bord si le runner de migrations le
-- ré-applique au merge de la PR.

-- 1) Colonne denormalisee.
ALTER TABLE public.news_syntheses
  ADD COLUMN IF NOT EXISTS is_editorially_validated boolean NOT NULL DEFAULT false;

-- 2) Backfill : true pour toute synthese ayant une validation COURANTE.
UPDATE public.news_syntheses ns
SET is_editorially_validated = true
WHERE EXISTS (
  SELECT 1 FROM public.editorial_validations ev
  WHERE ev.content_type = 'news_synthesis'
    AND ev.content_id = ns.id
    AND ev.is_current = true
)
AND ns.is_editorially_validated IS DISTINCT FROM true;

-- 3) Fonction trigger : recalcule le flag pour la (les) synthese(s) touchee(s)
--    par tout changement sur editorial_validations. Maintient les DEUX sens :
--      - validation posee (is_current=true)              -> flag true
--      - is_current passe a false / ligne supprimee et
--        plus aucune validation courante                 -> flag false
--    Le recalcul est un EXISTS complet (pas un delta), donc robuste quel que
--    soit l'ordre des operations d'un flip de is_current (UPDATE old->false +
--    INSERT new->true).
CREATE OR REPLACE FUNCTION public.sync_news_synthesis_validation_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id  uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.content_type = 'news_synthesis' THEN
    v_ids := array_append(v_ids, NEW.content_id);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.content_type = 'news_synthesis' THEN
    v_ids := array_append(v_ids, OLD.content_id);
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE public.news_syntheses ns
    SET is_editorially_validated = EXISTS (
      SELECT 1 FROM public.editorial_validations ev
      WHERE ev.content_type = 'news_synthesis'
        AND ev.content_id = v_id
        AND ev.is_current = true
    )
    WHERE ns.id = v_id;
  END LOOP;

  RETURN NULL;
END;
$function$;

-- 4) Trigger AFTER sur editorial_validations.
DROP TRIGGER IF EXISTS trg_sync_news_synthesis_validation_flag
  ON public.editorial_validations;
CREATE TRIGGER trg_sync_news_synthesis_validation_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.editorial_validations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_news_synthesis_validation_flag();

-- 5) Index de lecture feed (status, is_editorially_validated).
CREATE INDEX IF NOT EXISTS idx_news_syntheses_status_validated
  ON public.news_syntheses (status, is_editorially_validated);
