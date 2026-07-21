-- 20260721a_cs_news_episodes_access.sql
-- Migration 1 (chantier CS) — accès des membres du Comité Scientifique aux
-- épisodes news + garde-fou is_lead sur la validation principale.
--
-- Contexte : l'espace /cs est bloqué côté news pour un cs_member non
-- super_admin. `news_episodes` n'est lisible que par `is_super_admin` et
-- `service_role` : la file d'attente ressort vide côté news et l'aperçu
-- (`getContentPreview`) tombe sur notFound(). Cette migration débloque la
-- lecture des épisodes pour les membres CS actifs.
--
-- Deux arbitrages actés par Dr Julie Fantin :
--   2A  — policy SELECT `is_cs_member(auth.uid())` sur `news_episodes`,
--         portée large (brouillons inclus : le CS valide avant publication).
--   11A — la policy d'INSERT `editorial_validations_cs_insert` doit exiger
--         `is_lead = true` sur le membre courant : seul le validateur
--         principal (unique is_lead) peut créer une validation principale.
--         La co-signature (`add_secondary_validation`) reste ouverte aux
--         autres membres et n'est pas touchée.
--
-- Le chantier synthèses (`news_synthesis`) fait l'objet d'une migration 2
-- séparée : rien n'est anticipé ici.
--
-- NB : aucune ligne existante de `editorial_validations` n'est modifiée. Un
-- WITH CHECK ne s'applique qu'aux écritures futures ; le pré-contrôle a
-- confirmé 0 validation courante avec un lead is_lead=false.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2A) Lecture des épisodes news par un membre CS actif.
--     Les policies existantes (`news_episodes_admin_read_all`,
--     `Service role full access`) restent inchangées. Les policies RLS se
--     cumulent en OR : rien ne se perd.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS news_episodes_cs_read ON public.news_episodes;
CREATE POLICY news_episodes_cs_read
  ON public.news_episodes
  FOR SELECT
  TO authenticated
  USING (public.is_cs_member(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 11A) Garde-fou is_lead sur la validation principale.
--      Remplace `editorial_validations_cs_insert` (une policy ne s'altère pas
--      en place) en ajoutant `AND m.is_lead = true` à la sous-requête. Le
--      reste de la logique est conservé strictement à l'identique :
--        - lecteur autorisé : cs_member OU super_admin ;
--        - validated_by_lead DOIT être le cs_members.id du membre courant
--          (anti-usurpation + cohérence FK).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS editorial_validations_cs_insert ON public.editorial_validations;
CREATE POLICY editorial_validations_cs_insert
  ON public.editorial_validations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid()))
    AND validated_by_lead IN (
      SELECT m.id
      FROM public.cs_members m
      WHERE m.user_id = auth.uid()
        AND m.active = true
        AND m.is_lead = true
    )
  );
