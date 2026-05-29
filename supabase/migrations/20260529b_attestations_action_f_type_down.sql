-- Nom du fichier : 20260529b_attestations_action_f_type_down.sql
-- Date de création : 2026-05-29
-- Description : Rollback de 20260529b_attestations_action_f_type.sql.
--               Restaure la contrainte CHECK d'origine sur
--               public.user_attestations.type, n'autorisant que
--               ('formation_online', 'epp').
--
-- ⚠️ Pré-requis : aucune ligne ne doit porter type='action_cnp_info_patient'
--    sinon le ADD CONSTRAINT échouera. Les supprimer avant rollback le cas échéant.

ALTER TABLE public.user_attestations
  DROP CONSTRAINT IF EXISTS user_attestations_type_check;

ALTER TABLE public.user_attestations
  ADD CONSTRAINT user_attestations_type_check
  CHECK (
    (type)::text = ANY (
      (ARRAY[
        'formation_online'::character varying,
        'epp'::character varying
      ])::text[]
    )
  );
