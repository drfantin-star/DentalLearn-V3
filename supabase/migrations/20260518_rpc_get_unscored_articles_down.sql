-- Nom du fichier : 20260518_rpc_get_unscored_articles_down.sql
-- Date de création : 2026-05-18
-- Ticket : fix/score-articles-timeout
-- Description : Rollback symétrique — DROP des RPC get_unscored_articles
--               et count_unscored_articles.
-- Rollback : (ce fichier — pas de rollback de rollback)

DROP FUNCTION IF EXISTS public.get_unscored_articles(int);
DROP FUNCTION IF EXISTS public.count_unscored_articles();
