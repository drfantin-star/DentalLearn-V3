-- Nom du fichier : 20260721g_sec_lot3_admin_policies_align.sql
-- Date de création : 2026-07-21
-- Ticket : Durcissement sécurité BRIEF 2 — LOT 3 (alignement système d'admin)
-- Description : Recrée 3 policies « manage » sur le mécanisme d'admin canonique
--               du projet, is_super_admin(auth.uid()) (table user_roles), en
--               remplaçant deux mécanismes divergents :
--                 - profiles.role = 'admin'   (news_articles, content_library)
--                 - UUID codé en dur          (epp_criteria)
--               Les nouvelles policies renseignent USING **et** WITH CHECK
--               (les anciennes avaient un WITH CHECK vide → faiblesse corrigée).
--
--   Décisions Julie respectées :
--     - table profiles + colonne role CONSERVÉES (aucun DROP).
--     - policies de lecture publique NON touchées :
--         news_articles."Anyone can view published news"
--         content_library."Anyone can view published content"
--         epp_criteria."Critères visibles si audit publié"
--
--   Innocuité vérifiée en base : is_super_admin('af506ec2-…') = true et ce
--   compte est super_admin dans user_roles → aucun accès perdu.
--
-- Rollback : supabase/migrations/20260721g_sec_lot3_admin_policies_align_down.sql

-- news_articles ---------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage news" ON public.news_articles;
CREATE POLICY "Admins can manage news" ON public.news_articles
  FOR ALL TO public
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- content_library -------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage content" ON public.content_library;
CREATE POLICY "Admins can manage content" ON public.content_library
  FOR ALL TO public
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- epp_criteria ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admin peut tout faire" ON public.epp_criteria;
CREATE POLICY "Admin peut tout faire" ON public.epp_criteria
  FOR ALL TO public
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
