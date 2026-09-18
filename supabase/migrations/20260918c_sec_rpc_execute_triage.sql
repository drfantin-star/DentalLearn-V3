-- Nom du fichier : 20260918c_sec_rpc_execute_triage.sql
-- Date de création : 2026-09-18
-- Ticket : Triage des droits EXECUTE sur les RPC — Lot 2
-- Description : Ferme l'accès anon (et authenticated quand il n'est pas requis)
--               sur 9 fonctions SECURITY DEFINER dont l'appelant réel est
--               pg_cron, une route service_role, une Edge Function, ou plus
--               aucun appelant côté front. Triage complet des 35 fonctions
--               exposées : cf. RAPPORT_SEC_RPC_EXECUTE_TRIAGE_18SEP2026.md
--               (20 restent ouvertes, 6 restées incertaines ne sont PAS touchées).
-- Rollback : supabase/migrations/20260918c_sec_rpc_execute_triage_down.sql
--
-- Aucun DROP, aucune modification de signature ou de corps : cette migration
-- ne touche que des privilèges. Rejouable à volonté (REVOKE/GRANT idempotents).
--
-- ============================================================================
-- POURQUOI DEUX REVOKE PAR FONCTION
-- ============================================================================
-- L'audit ACL du 18/09 (aclexplode sur pg_proc.proacl) montre que les
-- fonctions ouvertes à anon le sont par DEUX chemins différents, et qu'il faut
-- couper les deux :
--
--   a) grant NOMMÉ à anon / authenticated (droits par défaut Supabase,
--      pg_default_acl). C'est le cas documenté dans CLAUDE.md :
--      « REVOKE ... FROM PUBLIC » ne les retire pas.
--
--   b) grant au pseudo-rôle PUBLIC (`=X/postgres` dans proacl), qui est le
--      défaut PostgreSQL natif sur toute fonction. Celui-là, à l'inverse,
--      n'est PAS retiré par « REVOKE ... FROM anon, authenticated ».
--
-- Constat déterminant : les 5 fonctions dites « réouvertes » depuis
-- 20260721e (send_autoeval_reminders, send_autopilot_reminders,
-- purge_old_notifications, audio_jobs_cost_summary, handle_new_user) n'ont
-- AUCUN grant nommé à anon — leur ACL est {=X/postgres, postgres, service_role}.
-- Le REVOKE de juillet a donc bien tenu sur les grants nommés ; ce qui les
-- rouvre est le grant PUBLIC revenu avec le DROP + CREATE. Rejouer le seul
-- « REVOKE FROM anon, authenticated » ne les fermerait pas.
--
-- D'où la forme systématique ci-dessous : REVOKE PUBLIC, puis REVOKE nommé,
-- puis GRANT explicite aux rôles légitimes.

-- ============================================================================
-- 1 — Fermeture à anon ET authenticated (8 fonctions)
--     Appelant réel indiqué en regard de chaque bloc.
-- ============================================================================

-- Route /api/admin/audio-jobs/cost-summary — createAdminClient() = service_role
REVOKE EXECUTE ON FUNCTION public.audio_jobs_cost_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audio_jobs_cost_summary() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.audio_jobs_cost_summary() TO postgres, service_role;

-- Edge Function score_articles (supabase/functions/score_articles/index.ts:256) — service_role
REVOKE EXECUTE ON FUNCTION public.count_unscored_articles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_unscored_articles() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.count_unscored_articles() TO postgres, service_role;

-- pg_cron : notifications_purge_monthly (jobid 40, « 0 4 1 * * »)
REVOKE EXECUTE ON FUNCTION public.purge_old_notifications() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_old_notifications() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_old_notifications() TO postgres, service_role;

-- pg_cron : autoeval_reminder_oct (jobid 38), autoeval_reminder_dec (jobid 39)
REVOKE EXECUTE ON FUNCTION public.send_autoeval_reminders(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_autoeval_reminders(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.send_autoeval_reminders(text) TO postgres, service_role;

-- pg_cron : autopilot_reminder_mid (jobid 41), autopilot_reminder_end (jobid 42)
REVOKE EXECUTE ON FUNCTION public.send_autopilot_reminders(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_autopilot_reminders(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.send_autopilot_reminders(text) TO postgres, service_role;

-- Route /api/admin/news/syntheses/[id]/regenerate:221 — adminSupabase = service_role
REVOKE EXECUTE ON FUNCTION public.regenerate_synthesis_from_fulltext(
  uuid, text, text, text, text, text, jsonb, vector, text, text[],
  text, text, text, text[], text[], text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerate_synthesis_from_fulltext(
  uuid, text, text, text, text, text, jsonb, vector, text, text[],
  text, text, text, text[], text[], text, text, uuid) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.regenerate_synthesis_from_fulltext(
  uuid, text, text, text, text, text, jsonb, vector, text, text[],
  text, text, text, text[], text[], text, text, uuid) TO postgres, service_role;

-- Plus appelée par le front depuis 19a589c (CLAUDE.md, dette AUTO-INSCR-D4).
-- Appels internes seulement, depuis get_formation_completion_metrics,
-- get_user_completed_sequences et is_formation_fully_completed : toutes
-- SECURITY DEFINER owner postgres, donc non impactées par ce REVOKE.
REVOKE EXECUTE ON FUNCTION public.is_sequence_completed(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_sequence_completed(uuid, uuid) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_sequence_completed(uuid, uuid) TO postgres, service_role;

-- Idem : plus appelée par le front depuis 19a589c (CLAUDE.md).
REVOKE EXECUTE ON FUNCTION public.get_user_completed_sequences(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_completed_sequences(uuid, uuid) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_completed_sequences(uuid, uuid) TO postgres, service_role;

-- ============================================================================
-- 2 — Fermeture à anon SEULEMENT (1 fonction)
-- ============================================================================
-- is_cs_member est un helper de 3 policies RLS — editorial_validations_cs_read,
-- editorial_validations_cs_insert, news_episodes_cs_read — toutes déclarées
-- sur le rôle {authenticated} uniquement. Une expression de policy s'évalue
-- avec les droits de l'appelant : authenticated DOIT conserver EXECUTE.
-- anon n'est concerné par aucune de ces policies.
-- Le REVOKE FROM PUBLIC ne prive pas authenticated, qui garde son grant nommé.
REVOKE EXECUTE ON FUNCTION public.is_cs_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_cs_member(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_cs_member(uuid) TO postgres, service_role, authenticated;

-- ============================================================================
-- NON TOUCHÉ VOLONTAIREMENT
-- ============================================================================
-- verify_attestation_public(varchar)   : publique par conception (page /verify)
-- user_can_see_formation(uuid,uuid)    : helper de 3 policies RLS en rôle
--                                        {public} — la fermer casserait la
--                                        lecture de sequences / questions /
--                                        epp_audits
-- handle_new_user()                    : hors périmètre validé pour ce lot
-- 6 fonctions sans appelant identifié  : cf. « catégorie 3 » du rapport
