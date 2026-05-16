-- Smoke test T4 — routes API (vérifications BDD)

-- Vérifier colonnes sequences mises à jour par la route generate
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sequences' AND table_schema = 'public'
AND column_name IN (
  'course_media_url', 'audio_generated_at', 'audio_chars_consumed',
  'audio_cost_eur', 'audio_history', 'timeline_url'
)
ORDER BY column_name;

-- Vérifier qu'aucun job orphelin n'est en base (table doit être vide)
SELECT count(*), status
FROM audio_generation_jobs
GROUP BY status;
