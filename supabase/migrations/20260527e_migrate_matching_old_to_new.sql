-- Migration : standardisation du format matching (D-DQ-03)
-- Objectif : convertir les 13 questions matching au format OLD vers le format NEW.
-- Backup CSV : docs/migrations/20260527_matching_old_format_backup.csv
--
-- OLD format détectés (3 sous-variantes) :
--   OLD-A : {pairs: [{id: "1", left, right}, ...]}                    (8 questions)
--   OLD-B : {pairs: [{left, right}, ...]}                              (4 questions)
--   OLD-C : {pairs: [{left, right, rightId: "C"}, ...]}                (1 question, fd08469b)
--
-- NEW format cible :
--   {
--     pairs: [{left, rightId}, ...],
--     options: [{id, text}, ...],
--     correctAnswers: ["1-A", "2-B", ...]
--   }
--
-- Algorithme :
--   - rid = COALESCE(pair.rightId, chr(65 + (idx-1)))  (préserve OLD-C, génère A/B/C... sinon)
--   - options[] et pairs[] et correctAnswers[] suivent l'ordre source (ORDER BY idx)
--
-- Idempotence : la clause WHERE exclut les rows déjà au NEW format (présence de correctAnswers).
-- Replay safe.

UPDATE questions q
SET options = sub.new_options
FROM (
  SELECT
    q2.id,
    jsonb_build_object(
      'pairs', built.prs,
      'options', built.opts,
      'correctAnswers', built.ans
    ) AS new_options
  FROM questions q2
  CROSS JOIN LATERAL (
    WITH pairs_with_rid AS (
      SELECT
        idx,
        pair,
        COALESCE(
          pair->>'rightId',
          chr(65 + (idx - 1)::int)
        ) AS rid
      FROM jsonb_array_elements(q2.options->'pairs') WITH ORDINALITY AS t(pair, idx)
    )
    SELECT
      (SELECT jsonb_agg(jsonb_build_object('left', pair->>'left', 'rightId', rid) ORDER BY idx)
       FROM pairs_with_rid) AS prs,
      (SELECT jsonb_agg(jsonb_build_object('id', rid, 'text', pair->>'right') ORDER BY idx)
       FROM pairs_with_rid) AS opts,
      (SELECT jsonb_agg(to_jsonb(idx::text || '-' || rid) ORDER BY idx)
       FROM pairs_with_rid) AS ans
  ) built
  WHERE q2.question_type = 'matching'
    AND NOT (q2.options ? 'correctAnswers')
) sub
WHERE q.id = sub.id;

-- Contrainte d'intégrité : interdit tout retour au format OLD ou tout payload malformé.
-- Vérifie présence + type + cohérence des longueurs.
ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS matching_new_format_only;

ALTER TABLE questions
  ADD CONSTRAINT matching_new_format_only
  CHECK (
    question_type != 'matching'
    OR (
      jsonb_typeof(options->'pairs') = 'array'
      AND jsonb_typeof(options->'options') = 'array'
      AND jsonb_typeof(options->'correctAnswers') = 'array'
      AND jsonb_array_length(options->'pairs') = jsonb_array_length(options->'options')
      AND jsonb_array_length(options->'pairs') = jsonb_array_length(options->'correctAnswers')
    )
  );
