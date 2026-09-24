-- Nom du fichier : 20260924a_news_synthesis_rejection.sql
-- Date de création : 2026-09-24
-- Ticket : news-validation-rejet-editorial
-- Description : Ajoute le rejet éditorial d'une synthèse : statut 'rejected',
--               motif contrôlé, et RPC de rejet / rétablissement (unitaire et
--               en lot).
-- Rollback : supabase/migrations/20260924a_news_synthesis_rejection_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Aujourd'hui une synthèse n'a que deux états visibles pour l'éditrice :
-- validée (is_editorially_validated = true) ou pas. « Pas validée » mélange
-- donc deux populations très différentes : « pas encore lue » et « lue et
-- refusée ». Aucune action « rejeter » n'existe nulle part :
--   - /admin/news/[id] n'offre que Régénérer et Éditer
--   - /api/admin/news/syntheses/[id] n'expose que GET et PATCH
--   - editorial_validations n'a pas de colonne décision : une ligne = un
--     accord, la table ne sait pas exprimer un refus
--   - « Révoquer » annule une validation et renvoie la synthèse dans la pile
--
-- Conséquence mesurée le 24/09/2026 : 143 synthèses en attente (61 en
-- septembre, 67 en août, 15 en juillet), dont une part que l'éditrice a déjà
-- écartée mentalement mais doit re-lire à chaque passage.
--
-- ============================================================================
-- Pourquoi passer par status plutôt que par un drapeau dédié
-- ============================================================================
-- status = 'active' est déjà le filtre commun de TOUTES les surfaces de
-- lecture : get_syntheses_for_validation(), /api/news/syntheses,
-- /api/news/by-theme, /api/daily-quiz, /api/quiz/by-theme,
-- lib/news/forYouNews et lib/news/episodeValidation.
--
-- Un statut 'rejected' fait donc disparaître la synthèse de la file de
-- validation, de la rubrique publique, du quiz du jour et des épisodes en une
-- seule écriture, sans modifier une seule de ces sept surfaces. Un drapeau
-- séparé aurait imposé de toutes les reprendre, avec un oubli probable.

-- ============================================================================
-- 1. Statut 'rejected'
-- ============================================================================
-- ⚠️ ALTER ... DROP CONSTRAINT — signalé en conversation avant écriture,
-- conformément à la convention du repo. Aucune donnée n'est touchée : la
-- contrainte est remplacée par la même, augmentée de 'rejected'. Les 5
-- valeurs existantes sont conservées à l'identique.

ALTER TABLE public.news_syntheses
  DROP CONSTRAINT news_syntheses_status_extended_check;

ALTER TABLE public.news_syntheses
  ADD CONSTRAINT news_syntheses_status_extended_check
  CHECK (status = ANY (ARRAY[
    'active'::text,
    'retracted'::text,
    'deleted'::text,
    'failed'::text,
    'failed_permanent'::text,
    'rejected'::text
  ]));

-- ============================================================================
-- 2. Traçabilité du rejet
-- ============================================================================
-- Colonnes nullables : une synthèse non rejetée les laisse à NULL, aucune
-- réécriture des 920 lignes existantes. rejected_by pointe sur profiles(id)
-- et non sur auth.users : c'est la cible utilisée par last_edited_by sur
-- cette même table, et celle que la purge RGPD (20260721j) sait traiter.

ALTER TABLE public.news_syntheses
  ADD COLUMN IF NOT EXISTS rejected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Liste fermée de motifs. Le but n'est pas la bureaucratie : ces motifs sont
-- le signal qui manque aujourd'hui pour savoir POURQUOI une part du flux ne
-- passe pas, et donc pour affiner le prompt de scoring plutôt que de subir le
-- tri à la main indéfiniment.
ALTER TABLE public.news_syntheses
  ADD CONSTRAINT news_syntheses_rejection_reason_check
  CHECK (rejection_reason IS NULL OR rejection_reason = ANY (ARRAY[
    'hors_sujet'::text,           -- hors champ dentaire
    'non_transposable'::text,     -- non transposable à l'exercice français
    'preuve_insuffisante'::text,  -- niveau de preuve trop faible
    'doublon'::text,              -- sujet déjà couvert par une autre synthèse
    'qualite_synthese'::text,     -- l'article est bon, la synthèse est mauvaise
    'deja_traite'::text,          -- déjà traité en formation ou en journal
    'autre'::text
  ]));

COMMENT ON COLUMN public.news_syntheses.rejection_reason IS
  'Motif de rejet éditorial (liste fermée). NULL si la synthèse n''est pas rejetée. Sert de signal d''amélioration du prompt de scoring : un motif dominant indique un critère à ajouter côté score_articles.';

CREATE INDEX IF NOT EXISTS idx_news_syntheses_rejected
  ON public.news_syntheses (rejected_at DESC)
  WHERE status = 'rejected';

-- ============================================================================
-- 3. RPC reject_news_syntheses(uuid[], text)
-- ============================================================================
-- Même patron que validate_content / revoke_validation : SECURITY DEFINER,
-- garde is_cs_member OR is_super_admin, appelée depuis le client par le
-- membre connecté. Traite 1 ou N identifiants — le rejet unitaire est un lot
-- d'un seul élément, pas une seconde fonction à maintenir.

CREATE OR REPLACE FUNCTION public.reject_news_syntheses(
  p_ids    uuid[],
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT (public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden: cs_member or super_admin required';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Le motif est obligatoire ; la contrainte de colonne valide la valeur.
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Un motif de rejet est requis';
  END IF;

  -- Seules les synthèses actives sont rejetables : on ne rejette pas une
  -- synthèse déjà supprimée, rétractée ou en échec technique.
  UPDATE public.news_syntheses
     SET status           = 'rejected',
         rejected_at      = now(),
         rejected_by      = auth.uid(),
         rejection_reason = p_reason
   WHERE id = ANY(p_ids)
     AND status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.reject_news_syntheses(uuid[], text) IS
  'Rejet éditorial d''une ou plusieurs synthèses (status active → rejected, avec motif). Réservée aux membres du comité scientifique et aux super-admins. Renvoie le nombre de lignes effectivement rejetées.';

-- ============================================================================
-- 4. RPC restore_news_syntheses(uuid[]) — annulation d'un rejet
-- ============================================================================
-- Le rejet en lot rend une erreur de manipulation coûteuse : sans retour
-- arrière, un clic malheureux sur 50 lignes est irrécupérable côté UI.

CREATE OR REPLACE FUNCTION public.restore_news_syntheses(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT (public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden: cs_member or super_admin required';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.news_syntheses
     SET status           = 'active',
         rejected_at      = NULL,
         rejected_by      = NULL,
         rejection_reason = NULL
   WHERE id = ANY(p_ids)
     AND status = 'rejected';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.restore_news_syntheses(uuid[]) IS
  'Annule un rejet éditorial (status rejected → active, motif effacé). La synthèse repasse non validée dans la file de validation. Réservée au comité scientifique et aux super-admins.';

-- ============================================================================
-- 5. RPC get_rejected_syntheses() — la vue « Rejetées »
-- ============================================================================
-- get_syntheses_for_validation() filtre status='active' : les rejetées en
-- sortent automatiquement. Il faut donc une lecture dédiée pour pouvoir les
-- relire et les rétablir.

CREATE OR REPLACE FUNCTION public.get_rejected_syntheses()
RETURNS TABLE (
  id               uuid,
  display_title    text,
  specialite       text,
  published_at     date,
  created_at       timestamptz,
  rejected_at      timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF NOT (public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden: cs_member or super_admin required';
  END IF;

  RETURN QUERY
  SELECT ns.id,
         ns.display_title::text,
         ns.specialite::text,
         ns.published_at,
         ns.created_at,
         ns.rejected_at,
         ns.rejection_reason::text
    FROM public.news_syntheses ns
   WHERE ns.status = 'rejected'
   ORDER BY ns.rejected_at DESC NULLS LAST, ns.id;
END;
$$;

COMMENT ON FUNCTION public.get_rejected_syntheses() IS
  'Synthèses rejetées éditorialement, les plus récemment rejetées d''abord. Alimente l''onglet « Rejetées » de /admin/editorial-validations.';

-- ============================================================================
-- 6. Droits
-- ============================================================================
-- ⚠️ GOTCHA Supabase — ALTER DEFAULT PRIVILEGES (cf. CLAUDE.md, section
-- « Convention RPC : REVOKE explicite après tout CREATE FUNCTION »).
-- Le schéma public accorde automatiquement EXECUTE à anon et authenticated
-- sur toute fonction nouvellement créée, et REVOKE ... FROM PUBLIC ne les
-- retire pas. Le REVOKE doit nommer les rôles.
--
-- Cible : {postgres, authenticated, service_role}, à l'identique de
-- validate_content / revoke_validation / validate_content_bulk. Pas d'anon :
-- la garde interne renverrait de toute façon Forbidden, mais on ne s'appuie
-- pas sur une garde applicative pour tenir lieu de droit.

REVOKE EXECUTE ON FUNCTION public.reject_news_syntheses(uuid[], text)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_news_syntheses(uuid[], text)  FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reject_news_syntheses(uuid[], text)  TO postgres, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.restore_news_syntheses(uuid[])       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_news_syntheses(uuid[])       FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.restore_news_syntheses(uuid[])       TO postgres, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_rejected_syntheses()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_rejected_syntheses()             FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_rejected_syntheses()             TO postgres, authenticated, service_role;

-- ============================================================================
-- 7. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- -- 7.1 La contrainte accepte bien 'rejected' et rien de plus
-- SELECT pg_get_constraintdef(con.oid)
--   FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
--  WHERE c.relname = 'news_syntheses'
--    AND con.conname = 'news_syntheses_status_extended_check';
--
-- -- 7.2 Aucune synthèse n'a changé d'état
-- SELECT status, COUNT(*) FROM news_syntheses GROUP BY 1 ORDER BY 2 DESC;
-- Attendu au 24/09/2026 : active 883, deleted 37, failed_permanent 1,
-- rejected 0.
--
-- -- 7.3 Droits : ni anon, ni authenticated en direct sur le REVOKE, mais
-- --     authenticated re-granté explicitement (les 3 doivent être identiques
-- --     à validate_content)
-- SELECT p.oid::regprocedure, p.proacl
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('reject_news_syntheses','restore_news_syntheses',
--                      'get_rejected_syntheses','validate_content');
-- Attendu : {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
