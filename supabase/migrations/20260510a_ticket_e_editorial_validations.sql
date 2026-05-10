-- Migration : Ticket E — Validations éditoriales (Qualiopi #21 + IA Act §50.4)
-- Date : 2026-05-10
-- Auteur : Claude Code (Lot 1 DB) + Dr Julie Fantin
--
-- Description :
--   Crée le système de signature des contenus pédagogiques (formations) et
--   éditoriaux (news_episodes) par le comité scientifique. Permet de produire
--   une preuve juridique exploitable :
--     - Qualiopi indicateur #21 (validation des contenus par un expert
--       métier indépendant du concepteur),
--     - IA Act Article 50 §4 (transparence sur les contenus générés ou
--       assistés par IA et validation humaine traçable).
--
-- Périmètre de cette migration (Lot 1 du Ticket E) :
--   1. Tables `cs_members` (membres du comité scientifique) et
--      `editorial_validations` (signatures avec hash de contenu).
--   2. RLS activée sur les deux tables avec policies super_admin (write)
--      et public (read restreint).
--   3. RPC `compute_content_hash`, `get_validation_status`, `validate_content`,
--      `revoke_validation`, `validate_content_bulk`.
--   4. Seed minimal : Dr Julie Fantin (lead) + Dr Laurent Elbeze (secondaire).
--
-- Cette migration est livrée en mode idempotent (CREATE IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION) car elle a déjà été appliquée en production
-- via le panneau Supabase ; ce fichier la reflète pour la traçabilité git.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extensions requises
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table cs_members
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cs_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     varchar NOT NULL,
  title            varchar,
  expertise_areas  text[] DEFAULT ARRAY[]::text[],
  photo_url        text,
  bio_short        text,
  is_lead          boolean NOT NULL DEFAULT FALSE,
  active           boolean NOT NULL DEFAULT TRUE,
  joined_at        date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cs_members IS
  'Membres du comité scientifique (Ticket E Qualiopi #21). is_lead=true pour le validateur principal obligatoire (Julie). Le user_id peut être NULL pour un membre CS sans compte app (cas validateurs externes futurs).';

COMMENT ON COLUMN public.cs_members.expertise_areas IS
  'Domaines d''expertise pour évolution future (matrice membre/thèmes). Exemples : esthetique, restauratrice, parodontie, endodontie.';

COMMENT ON COLUMN public.cs_members.is_lead IS
  'TRUE pour le membre principal qui doit signer toutes les validations (workflow décision 3A). Maximum 1 lead actif à la fois (contrainte applicative côté admin).';

CREATE INDEX IF NOT EXISTS cs_members_active_idx
  ON public.cs_members (active) WHERE (active = TRUE);

CREATE INDEX IF NOT EXISTS cs_members_user_id_idx
  ON public.cs_members (user_id) WHERE (user_id IS NOT NULL);

-- Trigger updated_at
DROP TRIGGER IF EXISTS cs_members_updated_at ON public.cs_members;
CREATE TRIGGER cs_members_updated_at
  BEFORE UPDATE ON public.cs_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Table editorial_validations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.editorial_validations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type             varchar NOT NULL,
  content_id               uuid NOT NULL,
  content_hash             text NOT NULL,
  validated_by_lead        uuid NOT NULL REFERENCES public.cs_members(id) ON DELETE RESTRICT,
  validated_by_secondary   uuid REFERENCES public.cs_members(id) ON DELETE SET NULL,
  validated_at             timestamptz NOT NULL DEFAULT now(),
  comments                 text,
  is_current               boolean NOT NULL DEFAULT TRUE,
  metadata                 jsonb DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editorial_validations_content_type_check
    CHECK (content_type IN ('formation','news_episode')),
  CONSTRAINT editorial_validations_distinct_validators
    CHECK (validated_by_secondary IS NULL OR validated_by_secondary <> validated_by_lead)
);

COMMENT ON TABLE public.editorial_validations IS
  'Traçabilité des validations éditoriales du comité scientifique sur les formations et episodes news. Preuve juridique IA Act Article 50 §4 + Qualiopi #21.';

COMMENT ON COLUMN public.editorial_validations.content_hash IS
  'SHA256 du contenu structurel au moment de la validation. Si le hash actuel diffère => is_current devient FALSE et la validation passe en stale (décision 4C).';

COMMENT ON COLUMN public.editorial_validations.validated_by_lead IS
  'Validateur principal (Julie), obligatoire (décision 3A).';

COMMENT ON COLUMN public.editorial_validations.validated_by_secondary IS
  'Validateur additionnel optionnel (membre CS expert thématique).';

COMMENT ON COLUMN public.editorial_validations.is_current IS
  'TRUE pour la validation active. Désactivée par RPC validate_content lors d''une nouvelle validation, ou marquée FALSE quand le content_hash change.';

CREATE INDEX IF NOT EXISTS editorial_validations_content_idx
  ON public.editorial_validations (content_type, content_id);

CREATE INDEX IF NOT EXISTS editorial_validations_lead_idx
  ON public.editorial_validations (validated_by_lead);

CREATE INDEX IF NOT EXISTS editorial_validations_validated_at_idx
  ON public.editorial_validations (validated_at DESC);

-- Une seule validation courante par contenu
CREATE UNIQUE INDEX IF NOT EXISTS editorial_validations_current_uniq
  ON public.editorial_validations (content_type, content_id)
  WHERE (is_current = TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cs_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_validations ENABLE ROW LEVEL SECURITY;

-- cs_members : super_admin full, public lit les membres actifs (affichage user)
DROP POLICY IF EXISTS cs_members_admin_read_all ON public.cs_members;
CREATE POLICY cs_members_admin_read_all ON public.cs_members
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS cs_members_admin_insert ON public.cs_members;
CREATE POLICY cs_members_admin_insert ON public.cs_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS cs_members_admin_update ON public.cs_members;
CREATE POLICY cs_members_admin_update ON public.cs_members
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS cs_members_admin_delete ON public.cs_members;
CREATE POLICY cs_members_admin_delete ON public.cs_members
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS cs_members_public_read_active ON public.cs_members;
CREATE POLICY cs_members_public_read_active ON public.cs_members
  FOR SELECT TO anon, authenticated
  USING (active = TRUE);

-- editorial_validations : écriture exclusive via RPC (SECURITY DEFINER)
DROP POLICY IF EXISTS editorial_validations_admin_read_all ON public.editorial_validations;
CREATE POLICY editorial_validations_admin_read_all ON public.editorial_validations
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS editorial_validations_public_read_current ON public.editorial_validations;
CREATE POLICY editorial_validations_public_read_current ON public.editorial_validations
  FOR SELECT TO anon, authenticated
  USING (is_current = TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC compute_content_hash
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_content_hash(
  p_content_type varchar,
  p_content_id   uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_payload TEXT;
  v_extra   TEXT;
BEGIN
  IF p_content_type = 'formation' THEN
    SELECT
      COALESCE(f.title, '') || '|' ||
      COALESCE(f.axe_cp::text, '') || '|' ||
      COALESCE(
        (SELECT string_agg(s.title, '||' ORDER BY s.id)
         FROM public.sequences s
         WHERE s.formation_id = f.id),
        ''
      )
    INTO v_payload
    FROM public.formations f
    WHERE f.id = p_content_id;

  ELSIF p_content_type = 'news_episode' THEN
    SELECT
      COALESCE(e.title, '') || '|' ||
      COALESCE(e.type, '') || '|' ||
      COALESCE(e.week_iso, '') || '|' ||
      COALESCE(e.script_md, '')
    INTO v_payload
    FROM public.news_episodes e
    WHERE e.id = p_content_id;

    SELECT COALESCE(string_agg(synthesis_id::text, '||' ORDER BY order_idx), '')
    INTO v_extra
    FROM public.news_episode_items
    WHERE episode_id = p_content_id;

    v_payload := v_payload || '|' || COALESCE(v_extra, '');

  ELSE
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;

  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'Content not found: % %', p_content_type, p_content_id;
  END IF;

  RETURN encode(digest(v_payload, 'sha256'), 'hex');
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC get_validation_status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_validation_status(
  p_content_type varchar,
  p_content_id   uuid
)
RETURNS TABLE (
  validated         boolean,
  is_stale          boolean,
  validation_id     uuid,
  validated_at      timestamptz,
  lead_name         varchar,
  lead_title        varchar,
  secondary_name    varchar,
  secondary_title   varchar,
  comments          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_current_hash TEXT;
BEGIN
  BEGIN
    v_current_hash := public.compute_content_hash(p_content_type, p_content_id);
  EXCEPTION WHEN OTHERS THEN
    v_current_hash := NULL;
  END;

  RETURN QUERY
  SELECT
    TRUE AS validated,
    (ev.content_hash <> v_current_hash) AS is_stale,
    ev.id AS validation_id,
    ev.validated_at,
    lead_m.display_name AS lead_name,
    lead_m.title AS lead_title,
    sec_m.display_name AS secondary_name,
    sec_m.title AS secondary_title,
    ev.comments
  FROM public.editorial_validations ev
  JOIN public.cs_members lead_m ON lead_m.id = ev.validated_by_lead
  LEFT JOIN public.cs_members sec_m ON sec_m.id = ev.validated_by_secondary
  WHERE ev.content_type = p_content_type
    AND ev.content_id = p_content_id
    AND ev.is_current = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::TIMESTAMPTZ,
                        NULL::VARCHAR, NULL::VARCHAR,
                        NULL::VARCHAR, NULL::VARCHAR, NULL::TEXT;
  END IF;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC validate_content
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_content(
  p_content_type           varchar,
  p_content_id             uuid,
  p_validated_by_lead      uuid,
  p_validated_by_secondary uuid DEFAULT NULL,
  p_comments               text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_validation_id UUID;
  v_hash          TEXT;
  v_is_lead       BOOLEAN;
  v_is_active     BOOLEAN;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super admin required';
  END IF;

  SELECT is_lead, active INTO v_is_lead, v_is_active
  FROM public.cs_members
  WHERE id = p_validated_by_lead;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cs_member lead not found: %', p_validated_by_lead;
  END IF;
  IF NOT v_is_lead THEN
    RAISE EXCEPTION 'cs_member % is not flagged as is_lead', p_validated_by_lead;
  END IF;
  IF NOT v_is_active THEN
    RAISE EXCEPTION 'cs_member lead % is inactive', p_validated_by_lead;
  END IF;

  IF p_validated_by_secondary IS NOT NULL THEN
    IF p_validated_by_secondary = p_validated_by_lead THEN
      RAISE EXCEPTION 'Secondary validator must differ from lead';
    END IF;
    PERFORM 1 FROM public.cs_members
      WHERE id = p_validated_by_secondary AND active = TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cs_member secondary not found or inactive: %',
        p_validated_by_secondary;
    END IF;
  END IF;

  v_hash := public.compute_content_hash(p_content_type, p_content_id);

  UPDATE public.editorial_validations
     SET is_current = FALSE
   WHERE content_type = p_content_type
     AND content_id = p_content_id
     AND is_current = TRUE;

  INSERT INTO public.editorial_validations (
    content_type, content_id, content_hash,
    validated_by_lead, validated_by_secondary,
    comments, is_current
  )
  VALUES (
    p_content_type, p_content_id, v_hash,
    p_validated_by_lead, p_validated_by_secondary,
    p_comments, TRUE
  )
  RETURNING id INTO v_validation_id;

  RETURN v_validation_id;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPC revoke_validation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_validation(
  p_validation_id uuid,
  p_reason        text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super admin required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A revocation reason of at least 5 characters is required';
  END IF;

  UPDATE public.editorial_validations
     SET is_current = FALSE,
         metadata = COALESCE(metadata, '{}'::jsonb) ||
                    jsonb_build_object(
                      'revoked_at', NOW(),
                      'revoked_by', auth.uid(),
                      'revocation_reason', p_reason
                    )
   WHERE id = p_validation_id
     AND is_current = TRUE;

  RETURN FOUND;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RPC validate_content_bulk
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_content_bulk(
  p_validated_by_lead uuid,
  p_content_type      varchar DEFAULT NULL
)
RETURNS TABLE (
  content_type   varchar,
  content_id     uuid,
  validation_id  uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  r    RECORD;
  v_id UUID;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super admin required';
  END IF;

  IF p_content_type IS NULL OR p_content_type = 'formation' THEN
    FOR r IN
      SELECT f.id
      FROM public.formations f
      WHERE NOT EXISTS (
        SELECT 1 FROM public.editorial_validations ev
        WHERE ev.content_type = 'formation'
          AND ev.content_id = f.id
          AND ev.is_current = TRUE
          AND ev.content_hash = public.compute_content_hash('formation', f.id)
      )
    LOOP
      v_id := public.validate_content('formation', r.id, p_validated_by_lead, NULL,
              'Validation rétroactive (backfill)');
      content_type := 'formation';
      content_id := r.id;
      validation_id := v_id;
      RETURN NEXT;
    END LOOP;
  END IF;

  IF p_content_type IS NULL OR p_content_type = 'news_episode' THEN
    FOR r IN
      SELECT e.id
      FROM public.news_episodes e
      WHERE e.status IN ('published', 'archived')
        AND NOT EXISTS (
          SELECT 1 FROM public.editorial_validations ev
          WHERE ev.content_type = 'news_episode'
            AND ev.content_id = e.id
            AND ev.is_current = TRUE
            AND ev.content_hash = public.compute_content_hash('news_episode', e.id)
        )
    LOOP
      v_id := public.validate_content('news_episode', r.id, p_validated_by_lead, NULL,
              'Validation rétroactive (backfill)');
      content_type := 'news_episode';
      content_id := r.id;
      validation_id := v_id;
      RETURN NEXT;
    END LOOP;
  END IF;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Seed minimal (idempotent via ON CONFLICT)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.cs_members (id, user_id, display_name, title, is_lead, active)
VALUES
  ('233e1b78-a446-4f62-b51c-c8624294e5e9'::uuid,
   'af506ec2-a281-4485-a504-b0633c8d2362'::uuid,
   'Dr Julie Fantin',
   'Chirurgien-dentiste, fondatrice DentalLearn',
   TRUE, TRUE),
  ('8995c60b-b08f-4d31-8323-ccc8965e4fa2'::uuid,
   NULL,
   'Dr Laurent Elbeze',
   'Chirurgien-dentiste',
   FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;
