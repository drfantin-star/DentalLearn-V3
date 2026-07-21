-- Nom du fichier : 20260721g_sec_lot3_admin_policies_align_down.sql
-- Date de création : 2026-07-21
-- Rollback de : 20260721g_sec_lot3_admin_policies_align.sql (BRIEF 2 — LOT 3)
-- Restaure les 3 policies « manage » dans leur définition d'origine exacte
-- (mécanismes profiles.role='admin' et UUID codé en dur ; WITH CHECK vide).

-- news_articles ---------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage news" ON public.news_articles;
CREATE POLICY "Admins can manage news" ON public.news_articles
  FOR ALL TO public
  USING (EXISTS ( SELECT 1 FROM profiles
                  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text));

-- content_library -------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage content" ON public.content_library;
CREATE POLICY "Admins can manage content" ON public.content_library
  FOR ALL TO public
  USING (EXISTS ( SELECT 1 FROM profiles
                  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::text));

-- epp_criteria ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admin peut tout faire" ON public.epp_criteria;
CREATE POLICY "Admin peut tout faire" ON public.epp_criteria
  FOR ALL TO public
  USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);
