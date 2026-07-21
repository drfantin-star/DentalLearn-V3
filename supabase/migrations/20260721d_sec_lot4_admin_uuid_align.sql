-- Nom du fichier : 20260721d_sec_lot4_admin_uuid_align.sql
-- Date de création : 2026-07-21
-- Ticket : Durcissement sécurité — LOT 4 (suite BRIEF 2 / LOT 3)
-- Description : Recrée les 4 dernières policies admin qui codaient en dur l'UUID
--               'af506ec2-a281-4485-a504-b0633c8d2362' sur le mécanisme canonique
--               is_super_admin(auth.uid()) (table user_roles). Après ce lot,
--               plus AUCUNE policy du schéma public ne code d'UUID en dur.
--
--   Règle WITH CHECK (non mécanique) :
--     - SELECT → WITH CHECK inexistant pour ce type → USING seul.
--     - UPDATE / ALL → USING **et** WITH CHECK (faiblesse WITH CHECK vide
--       corrigée, comme au LOT 3).
--   cmd et rôles ({authenticated}) conservés à l'identique.
--
--   Innocuité vérifiée en base : is_super_admin('af506ec2-…') = true → le seul
--   compte concerné reste admin, personne ne perd d'accès.
--
--   NON touché (policies utilisateur coexistantes) :
--     - complaints."Anyone can submit complaint" (INSERT anon+auth — dépôt
--       Qualiopi SANS compte : chemin préservé, non impacté par ce lot)
--     - complaints."Users can view own complaints"
--     - user_attestations."Users can view/insert/delete own attestations"
--     - epp_improvement_suggestions."Users can read suggestions"
--
-- Rollback : supabase/migrations/20260721d_sec_lot4_admin_uuid_align_down.sql

-- complaints — SELECT ---------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
CREATE POLICY "Admins can view all complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- complaints — UPDATE ---------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- epp_improvement_suggestions — ALL -------------------------------------------
DROP POLICY IF EXISTS "Admin can manage suggestions" ON public.epp_improvement_suggestions;
CREATE POLICY "Admin can manage suggestions" ON public.epp_improvement_suggestions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- user_attestations — SELECT --------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all attestations" ON public.user_attestations;
CREATE POLICY "Admins can view all attestations" ON public.user_attestations
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
