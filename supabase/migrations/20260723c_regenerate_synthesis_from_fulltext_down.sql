-- 20260723c_regenerate_synthesis_from_fulltext_down.sql
-- Rollback de 20260723c_regenerate_synthesis_from_fulltext.sql.
-- Supprime uniquement la RPC creee par la migration up. Aucune donnee touchee.

DROP FUNCTION IF EXISTS public.regenerate_synthesis_from_fulltext(
  uuid, text, text, text, text, text, jsonb, vector,
  text, text[], text, text, text, text[], text[], text, text, uuid
);
