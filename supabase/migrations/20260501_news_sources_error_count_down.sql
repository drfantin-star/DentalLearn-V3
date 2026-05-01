-- Nom du fichier : 20260501_news_sources_error_count_down.sql
-- Date de création : 2026-05-01
-- Description : rollback symétrique de 20260501_news_sources_error_count.sql.

ALTER TABLE public.news_sources
  DROP COLUMN IF EXISTS error_count;
