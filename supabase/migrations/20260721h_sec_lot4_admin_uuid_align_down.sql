-- Nom du fichier : 20260721h_sec_lot4_admin_uuid_align_down.sql
-- Date de création : 2026-07-21
-- Rollback de : 20260721h_sec_lot4_admin_uuid_align.sql (LOT 4)
-- Restaure les 4 policies dans leur définition d'origine exacte
-- (UUID codé en dur, WITH CHECK vide, cmd et rôles identiques).

-- complaints — SELECT
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
CREATE POLICY "Admins can view all complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);

-- complaints — UPDATE
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);

-- epp_improvement_suggestions — ALL
DROP POLICY IF EXISTS "Admin can manage suggestions" ON public.epp_improvement_suggestions;
CREATE POLICY "Admin can manage suggestions" ON public.epp_improvement_suggestions
  FOR ALL TO authenticated
  USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);

-- user_attestations — SELECT
DROP POLICY IF EXISTS "Admins can view all attestations" ON public.user_attestations;
CREATE POLICY "Admins can view all attestations" ON public.user_attestations
  FOR SELECT TO authenticated
  USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);
