-- Nom du fichier : 20260511_sprint2_formateur_entities.sql
-- Date de création : 2026-05-11
-- Ticket : Sprint 2 / Ticket 1 — claude/dentallearn-development-u4ueJ
-- Description : Fondations BDD Espace Formateur V1 — 5 tables (formation_instructors,
--               formateur_profiles, live_events, live_sessions, live_registrations)
--               + 3 helpers SQL (is_formateur_of, get_formateur_formations,
--               formateur_aggregated_stats — stub en T1, body réécrit en T3)
--               + RLS activée + policies différenciées + triggers updated_at
--               (réutilise public.update_updated_at_column déjà en place)
-- Décisions produit :
--   - S2.1 masterclass live gratuite V1 → PAS de colonne price_cents
--   - S2.2 visio = lien Zoom manuel V1 → zoom_url + zoom_password
--   - Affichage inscrits (T5) = compteur + prénoms via SELECT scoped user_profiles
-- Rollback : supabase/migrations/20260511_sprint2_formateur_entities_down.sql

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- formation_instructors : liaison N:N formateurs ↔ formations
-- is_primary distingue le formateur principal pour la fiche formation publique.
CREATE TABLE formation_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE (formation_id, user_id)
);

CREATE INDEX formation_instructors_user_id_idx ON formation_instructors (user_id);

-- formateur_profiles : profil public formateur (1 ligne par user formateur)
CREATE TABLE formateur_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug varchar(80) NOT NULL UNIQUE,
  display_name varchar(120) NOT NULL,
  bio_short varchar(280),
  bio_long text,
  photo_pro_url text,
  linkedin_url text,
  website_url text,
  expertise_tags text[],
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX formateur_profiles_slug_idx ON formateur_profiles (slug);
CREATE INDEX formateur_profiles_published_idx
  ON formateur_profiles (is_published)
  WHERE is_published = true;

-- live_events : formations présentielles animées par un formateur
-- formation_id facultatif (un event peut être indépendant d'une formation Dentalschool)
CREATE TABLE live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id uuid REFERENCES formations(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  description text,
  location_city varchar(120) NOT NULL,
  location_venue varchar(200),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  external_registration_url text,
  capacity int,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_events_dates_coherent CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX live_events_formateur_idx ON live_events (formateur_user_id);
CREATE INDEX live_events_starts_at_idx ON live_events (starts_at);
-- Index partiel "upcoming published" : prédicat now() interdit par Postgres
-- (fonction STABLE non autorisée dans WHERE d'index partiel). On garde
-- WHERE is_published = true et on laisse le runtime filtrer starts_at > now()
-- via index range scan sur la clé (starts_at).
CREATE INDEX live_events_published_upcoming_idx
  ON live_events (starts_at)
  WHERE is_published = true;

-- live_sessions : masterclass live en visio (Zoom manuel V1, gratuit pour abonnés)
CREATE TABLE live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id uuid REFERENCES formations(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  zoom_url text,
  zoom_password varchar(100),
  capacity int,
  status varchar(20) NOT NULL DEFAULT 'scheduled',
  recording_url text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_sessions_status_check
    CHECK (status IN ('draft','scheduled','live','completed','cancelled'))
);

CREATE INDEX live_sessions_formateur_idx ON live_sessions (formateur_user_id);
CREATE INDEX live_sessions_starts_at_idx ON live_sessions (starts_at);
CREATE INDEX live_sessions_status_idx ON live_sessions (status);

-- live_registrations : inscriptions des users aux live_sessions
-- attended NULL avant la session, set par formateur (ou cron) après.
CREATE TABLE live_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  attended boolean,
  attended_duration_sec int,
  cancelled_at timestamptz,
  UNIQUE (session_id, user_id)
);

CREATE INDEX live_registrations_user_idx ON live_registrations (user_id);
CREATE INDEX live_registrations_session_idx ON live_registrations (session_id);

-- =============================================================================
-- 2. HELPERS SQL
-- =============================================================================

-- is_formateur_of : vrai si le user est instructor de la formation
-- OU s'il est super_admin (cohérent avec pattern Sprint 1).
CREATE OR REPLACE FUNCTION is_formateur_of(p_user_id uuid, p_formation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1 FROM formation_instructors
      WHERE user_id = p_user_id
        AND formation_id = p_formation_id
    );
$$;

-- get_formateur_formations : liste les formation_id assignées au user.
CREATE OR REPLACE FUNCTION get_formateur_formations(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT formation_id FROM formation_instructors
  WHERE user_id = p_user_id;
$$;

-- formateur_aggregated_stats : KPIs agrégés (RGPD modèle A — pas de données nominatives)
-- T1 : stub à signature gelée pour ne pas casser de migration future.
-- T3 : body réécrit avec agrégations réelles sur user_formations / user_sequences / user_points
-- scopées sur get_formateur_formations(p_user_id) entre p_date_from et p_date_to.
CREATE OR REPLACE FUNCTION formateur_aggregated_stats(
  p_user_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT '{}'::jsonb;
$$;

-- Hardening : pattern identique à 20260502_sprint1_rbac_multitenant.sql
-- (REVOKE FROM PUBLIC + anon, puis GRANT EXECUTE TO authenticated + service_role).
-- NB : les default privileges Supabase du schema public grantent désormais anon
-- automatiquement sur les nouvelles fonctions — `REVOKE FROM PUBLIC` ne suffit pas
-- à couvrir anon. On REVOKE explicitement anon pour aligner sur l'état observé
-- en prod des helpers Sprint 1 (has_role, is_super_admin, etc.).
REVOKE EXECUTE ON FUNCTION is_formateur_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_formateur_formations(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION formateur_aggregated_stats(uuid, date, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION is_formateur_of(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_formateur_formations(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION formateur_aggregated_stats(uuid, date, date)
  TO authenticated, service_role;

-- =============================================================================
-- 3. TRIGGERS updated_at
-- =============================================================================
-- Réutilise public.update_updated_at_column() déjà en place (créée hors Sprint 1,
-- pattern utilisé par news_journal et editorial_validations).

CREATE TRIGGER set_updated_at_formateur_profiles
  BEFORE UPDATE ON formateur_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_live_events
  BEFORE UPDATE ON live_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_live_sessions
  BEFORE UPDATE ON live_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. RLS — activation + policies
-- =============================================================================

ALTER TABLE formation_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE formateur_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_registrations    ENABLE ROW LEVEL SECURITY;

-- ---- formation_instructors --------------------------------------------------
-- SELECT public : exposé sur la fiche formation publique (anon + authenticated).
-- INSERT/UPDATE/DELETE : Dr Fantin uniquement (assigne les formateurs).

CREATE POLICY "formation_instructors_select_public" ON formation_instructors
  FOR SELECT USING (true);

CREATE POLICY "formation_instructors_insert_super_admin" ON formation_instructors
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "formation_instructors_update_super_admin" ON formation_instructors
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "formation_instructors_delete_super_admin" ON formation_instructors
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ---- formateur_profiles -----------------------------------------------------
-- SELECT public si is_published = true, OU le user sur sa propre ligne, OU super_admin.
-- UPDATE par le formateur lui-même OU super_admin.
-- INSERT/DELETE : super_admin uniquement (le profil est créé en T2 par admin).

CREATE POLICY "formateur_profiles_select" ON formateur_profiles
  FOR SELECT USING (
    is_published = true
    OR auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "formateur_profiles_insert_super_admin" ON formateur_profiles
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "formateur_profiles_update" ON formateur_profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "formateur_profiles_delete_super_admin" ON formateur_profiles
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ---- live_events ------------------------------------------------------------
-- SELECT public si is_published = true, sinon owner ou super_admin.
-- INSERT : ownership stricte (formateur_user_id = auth.uid() + rôle formateur) OU super_admin.
-- UPDATE/DELETE : owner OU super_admin.

CREATE POLICY "live_events_select" ON live_events
  FOR SELECT USING (
    is_published = true
    OR formateur_user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "live_events_insert" ON live_events
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      formateur_user_id = auth.uid()
      AND has_role(auth.uid(), 'formateur')
    )
  );

CREATE POLICY "live_events_update" ON live_events
  FOR UPDATE USING (
    formateur_user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "live_events_delete" ON live_events
  FOR DELETE USING (
    formateur_user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

-- ---- live_sessions ----------------------------------------------------------
-- Mêmes policies que live_events.

CREATE POLICY "live_sessions_select" ON live_sessions
  FOR SELECT USING (
    is_published = true
    OR formateur_user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "live_sessions_insert" ON live_sessions
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      formateur_user_id = auth.uid()
      AND has_role(auth.uid(), 'formateur')
    )
  );

CREATE POLICY "live_sessions_update" ON live_sessions
  FOR UPDATE USING (
    formateur_user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "live_sessions_delete" ON live_sessions
  FOR DELETE USING (
    formateur_user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

-- ---- live_registrations -----------------------------------------------------
-- SELECT : le user concerné, le formateur owner strict de la session, ou super_admin.
--          Pas d'élargissement aux co-formateurs via formation_instructors
--          (décision Dr Fantin 2026-05-11 : ownership unique sur live_session).
-- INSERT : le user lui-même.
-- UPDATE : user (cancellation) OU owner session (attended/duration) OU super_admin.
-- DELETE : super_admin uniquement (cancel = UPDATE cancelled_at, pas DELETE).

CREATE POLICY "live_registrations_select" ON live_registrations
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_registrations.session_id
        AND ls.formateur_user_id = auth.uid()
    )
  );

CREATE POLICY "live_registrations_insert_self" ON live_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "live_registrations_update" ON live_registrations
  FOR UPDATE USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_registrations.session_id
        AND ls.formateur_user_id = auth.uid()
    )
  );

CREATE POLICY "live_registrations_delete_super_admin" ON live_registrations
  FOR DELETE USING (is_super_admin(auth.uid()));
