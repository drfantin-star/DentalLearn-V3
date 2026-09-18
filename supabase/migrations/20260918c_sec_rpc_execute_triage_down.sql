-- Nom du fichier : 20260918c_sec_rpc_execute_triage_down.sql
-- Date de création : 2026-09-18
-- Rollback de : 20260918c_sec_rpc_execute_triage.sql (Lot 2 — triage EXECUTE)
-- Description : Restaure à l'identique l'ACL EXECUTE relevée le 18/09/2026
--               avant application, fonction par fonction.
--
-- ATTENTION — la restauration n'est PAS uniforme. L'état d'origine différait
-- selon les fonctions (relevé via aclexplode sur pg_proc.proacl) :
--
--   Groupe A — grant PUBLIC seul, aucun grant nommé anon/authenticated :
--     audio_jobs_cost_summary, purge_old_notifications,
--     send_autoeval_reminders, send_autopilot_reminders
--     → on ne restaure QUE le grant PUBLIC.
--
--   Groupe B — grants nommés anon + authenticated, PAS de grant PUBLIC :
--     count_unscored_articles
--     → on ne restaure QUE les grants nommés.
--
--   Groupe C — grant PUBLIC ET grants nommés anon + authenticated :
--     regenerate_synthesis_from_fulltext, is_sequence_completed,
--     get_user_completed_sequences, is_cs_member
--     → on restaure les deux.
--
-- Les grants à postgres et service_role posés par la migration up existaient
-- déjà avant elle : rien à retirer ici. Idem pour le grant nommé
-- authenticated sur is_cs_member, jamais retiré.

-- ============================================================================
-- Groupe A — restaure le seul grant PUBLIC
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.audio_jobs_cost_summary()      TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_notifications()      TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_autoeval_reminders(text)  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_autopilot_reminders(text) TO PUBLIC;

-- ============================================================================
-- Groupe B — restaure les seuls grants nommés
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.count_unscored_articles() TO anon, authenticated;

-- ============================================================================
-- Groupe C — restaure grant PUBLIC + grants nommés
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.regenerate_synthesis_from_fulltext(
  uuid, text, text, text, text, text, jsonb, vector, text, text[],
  text, text, text, text[], text[], text, text, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_synthesis_from_fulltext(
  uuid, text, text, text, text, text, jsonb, vector, text, text[],
  text, text, text, text[], text[], text, text, uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_sequence_completed(uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_sequence_completed(uuid, uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_completed_sequences(uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_completed_sequences(uuid, uuid) TO anon, authenticated;

-- is_cs_member : seuls PUBLIC et anon avaient été retirés
GRANT EXECUTE ON FUNCTION public.is_cs_member(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cs_member(uuid) TO anon;
