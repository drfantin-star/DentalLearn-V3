-- Nom du fichier : 20260428_news_v1_3_questions_link.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Migration v1.3 — lien questions ↔ news_syntheses (pool quiz du jour étendu) + contrainte source exclusive + index FK
-- Rollback : supabase/migrations/20260428_news_v1_3_questions_link_down.sql

-- ============================================================================
-- ⚠️ CHECKLIST DE SAFETY — table en production avec 374 lignes
-- ============================================================================
-- Cette migration touche public.questions, qui contient à ce jour 374 lignes
-- issues du pipeline formations. Avant exécution, vérifier les invariants :
--
--   1. La nouvelle colonne `news_synthesis_id` est NULLABLE.
--      → Aucune valeur à backfiller : toutes les lignes existantes auront
--        news_synthesis_id IS NULL, ce qui est valide (pas de DEFAULT requis,
--        pas de UPDATE post-ALTER nécessaire, pas de table rewrite long sur
--        une nullable text/uuid sans DEFAULT en PG ≥ 11).
--
--   2. La contrainte CHECK `questions_source_check` est satisfaite par les
--      données existantes :
--        ((sequence_id IS NOT NULL AND news_synthesis_id IS NULL) OR
--         (sequence_id IS NULL     AND news_synthesis_id IS NOT NULL))
--      Comme TOUTES les lignes existantes ont sequence_id IS NOT NULL et que
--      news_synthesis_id sera NULL pour 100 % d'entre elles, la première
--      branche du OR est vraie partout → la contrainte sera validée sans
--      rejet à l'ALTER TABLE.
--
--   3. Le DEFAULT de `is_daily_quiz_eligible` n'est PAS touché (reste TRUE).
--      Les questions news ne respecteront pas ce default à l'INSERT — c'est
--      l'Edge Function synthesize_articles (Ticket 5) qui positionne
--      explicitement is_daily_quiz_eligible=false sur ses INSERT, et le
--      bouton admin "Approuver pour quiz du jour" (Ticket 9) bascule à true
--      après validation manuelle Dr Fantin.
--
--   4. La contrainte FK ON DELETE SET NULL préserve les questions news si
--      leur synthèse parente est hard-deletée (cas rare ; le soft-delete via
--      news_syntheses.status='deleted' reste la norme). La question subsiste
--      avec news_synthesis_id IS NULL, mais la CHECK ci-dessus la rejettera
--      au prochain UPDATE → c'est volontaire, ça force un nettoyage
--      applicatif explicite (DELETE de la question) si on hard-delete une
--      synthèse. Acceptable, scénario marginal.
--
-- Vérification pré-migration recommandée (à lancer dans un RUN séparé avant
-- l'application de cette migration) :
--
--   SELECT
--     count(*)                                                        AS total,
--     count(*) FILTER (WHERE sequence_id IS NULL)                    AS without_sequence,
--     count(*) FILTER (WHERE sequence_id IS NOT NULL)                AS with_sequence
--   FROM public.questions;
--
--   Résultat attendu : total = with_sequence (toutes les lignes ont
--   sequence_id IS NOT NULL). Si without_sequence > 0, la contrainte
--   échouera et il faudra arbitrer ces lignes orphelines avant migration.

-- ============================================================================
-- 1. Ajout de la colonne news_synthesis_id (nullable, FK ON DELETE SET NULL)
-- ============================================================================

ALTER TABLE public.questions
  ADD COLUMN news_synthesis_id uuid REFERENCES public.news_syntheses(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. Contrainte CHECK : une question vient d'une séquence formation OU d'une
--    synthèse news, jamais des deux et jamais des aucun.
-- ============================================================================
-- Validation immédiate sur les données existantes : toutes les lignes ont
-- sequence_id IS NOT NULL et news_synthesis_id IS NULL → branche 1 vraie.

ALTER TABLE public.questions
  ADD CONSTRAINT questions_source_check CHECK (
    (sequence_id IS NOT NULL AND news_synthesis_id IS NULL) OR
    (sequence_id IS NULL     AND news_synthesis_id IS NOT NULL)
  );

-- ============================================================================
-- 3. Index FK (Postgres ne crée pas automatiquement d'index sur les FK)
-- ============================================================================

CREATE INDEX IF NOT EXISTS questions_news_synthesis_idx
  ON public.questions (news_synthesis_id);

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'questions'
--    AND column_name  = 'news_synthesis_id';
--
-- Résultat attendu : 1 ligne, data_type='uuid', is_nullable='YES'.
--
-- SELECT conname
--   FROM pg_constraint
--  WHERE conname = 'questions_source_check';
--
-- Résultat attendu : 1 ligne.
--
-- SELECT count(*) AS questions_violating
--   FROM public.questions
--  WHERE NOT (
--    (sequence_id IS NOT NULL AND news_synthesis_id IS NULL) OR
--    (sequence_id IS NULL     AND news_synthesis_id IS NOT NULL)
--  );
--
-- Résultat attendu : 0 (sinon la contrainte n'aurait pas été ajoutée).
--
-- Sanity check default is_daily_quiz_eligible préservé :
--
-- SELECT column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'questions'
--    AND column_name  = 'is_daily_quiz_eligible';
--
-- Résultat attendu : 'true' (default INCHANGÉ par cette migration).
