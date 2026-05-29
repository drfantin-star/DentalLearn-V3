-- Nom du fichier : 20260529b_attestations_action_f_type.sql
-- Date de création : 2026-05-29
-- Description : Étend la contrainte CHECK sur public.user_attestations.type pour
--               autoriser la valeur 'action_cnp_info_patient' (attestation
--               déclarative « Démarche d'information du patient », Certification
--               Périodique Axe 3 / Action F).
--               Avant : type ∈ ('formation_online', 'epp')
--               Après : type ∈ ('formation_online', 'epp', 'action_cnp_info_patient')
--
--               La RLS d'insertion (auth.uid() = user_id), le trigger
--               trg_create_verification (peuplement de user_attestation_verifications)
--               et le default auto-généré de verification_code couvrent déjà ce
--               nouveau type — aucune autre modification DB nécessaire.
--
-- ⚠️ Migration corrective : DROP de la contrainte existante puis ADD de la
--    nouvelle (opération destructive sur la contrainte, sans perte de données).
-- Rollback : supabase/migrations/20260529b_attestations_action_f_type_down.sql

ALTER TABLE public.user_attestations
  DROP CONSTRAINT IF EXISTS user_attestations_type_check;

ALTER TABLE public.user_attestations
  ADD CONSTRAINT user_attestations_type_check
  CHECK (
    (type)::text = ANY (
      (ARRAY[
        'formation_online'::character varying,
        'epp'::character varying,
        'action_cnp_info_patient'::character varying
      ])::text[]
    )
  );
