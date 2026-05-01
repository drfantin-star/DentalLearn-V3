-- Nom du fichier : 20260501_news_sources_error_count.sql
-- Date de création : 2026-05-01
-- Ticket : Ticket 8 Phase 2 — admin News sources (claude/news-sources-admin-ticket8-phase2)
-- Description : ajoute la colonne error_count à news_sources pour suivre
--               le nombre d'échecs successifs d'une source d'ingestion.

-- ============================================================================
-- Contexte
-- ============================================================================
-- La phase 2 introduit un panneau /admin/news/sources qui affiche un badge
-- "🟠 En erreur" dès que error_count >= 3. Les Edge Functions ingest_pubmed
-- et ingest_rss seront ultérieurement mises à jour pour incrémenter ce
-- compteur sur échec et le remettre à 0 sur succès. La migration est
-- additive et idempotente : elle peut être ré-appliquée sans effet de bord.

ALTER TABLE public.news_sources
  ADD COLUMN IF NOT EXISTS error_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.news_sources.error_count IS
  'Nombre d''échecs consécutifs lors du dernier fetch (incrémenté par les Edge Functions ingest_*, remis à 0 sur succès). Seuil d''alerte UI : >= 3.';

-- ============================================================================
-- Sanity check (à exécuter manuellement après application)
-- ============================================================================
-- SELECT name, type, active, error_count FROM public.news_sources ORDER BY name;
-- → toutes les lignes existantes doivent avoir error_count = 0.
