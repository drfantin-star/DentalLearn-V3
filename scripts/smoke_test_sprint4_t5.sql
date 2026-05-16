-- Smoke test T5 — FormationAudioBlock
-- Vérifie que les routes API T4 répondent correctement pour une séquence test.
-- Exécuter via psql ou via le MCP Supabase (read-only).

-- 1. Vérifier qu'une séquence existe pour tester
SELECT id, title, course_media_url, audio_generated_at
FROM sequences
LIMIT 5;

-- 2. Vérifier l'état de la table audio_generation_jobs (doit être vide ou
--    contenir des jobs de test).
SELECT status, count(*) AS n
FROM audio_generation_jobs
GROUP BY status;

-- 3. Vérifier les colonnes audio sur sequences pour les séquences déjà
--    générées (audio_history doit s'incrémenter à chaque régénération).
SELECT
  id,
  audio_generated_at,
  audio_chars_consumed,
  audio_cost_eur,
  jsonb_array_length(COALESCE(audio_history, '[]'::jsonb)) AS history_count
FROM sequences
WHERE audio_generated_at IS NOT NULL
LIMIT 5;
