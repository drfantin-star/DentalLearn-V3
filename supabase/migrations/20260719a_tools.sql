-- Migration : 20260719a_tools
-- Table publique des outils de la boîte à outils + RLS + seed initial
-- Rollback : supabase/migrations/20260719a_tools_down.sql
--
-- NOTE : le seed est inséré ICI, avant la migration 20260719b qui crée le
-- trigger de notification. Aucune notification ne part au déploiement.

CREATE TABLE public.tools (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        UNIQUE NOT NULL,
  title        text        NOT NULL,
  description  text,
  icon         text,
  href         text,
  status       text        NOT NULL CHECK (status IN ('active', 'coming_soon')),
  is_published boolean     NOT NULL DEFAULT false,
  desktop_only boolean     NOT NULL DEFAULT true,
  order_idx    integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- Lecture : utilisateurs authentifiés, outils publiés uniquement
CREATE POLICY "tools_select_published"
  ON public.tools FOR SELECT TO authenticated
  USING (is_published = true);

-- Toutes opérations : super admin uniquement (pattern is_super_admin existant)
CREATE POLICY "tools_all_super_admin"
  ON public.tools FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tools_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tools_updated_at
  BEFORE UPDATE ON public.tools
  FOR EACH ROW EXECUTE FUNCTION public.tools_set_updated_at();

-- Seed initial (is_published = true pour tous, trigger de notif pas encore créé)
INSERT INTO public.tools
  (slug, title, status, href, order_idx, is_published, desktop_only)
VALUES
  ('conformite',              'Conformité cabinet',      'active',      '/conformite', 1, true, true),
  ('duerp',                   'DUERP',                   'coming_soon', NULL,          2, true, true),
  ('entretien-professionnel', 'Entretien professionnel', 'coming_soon', NULL,          3, true, true),
  ('bilan-parodontal',        'Bilan parodontal',        'coming_soon', NULL,          4, true, true),
  ('bilan-erosions',          'Bilan érosions',          'coming_soon', NULL,          5, true, true);
