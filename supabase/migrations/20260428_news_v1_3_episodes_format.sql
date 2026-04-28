-- Nom du fichier : 20260428_news_v1_3_episodes_format.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Migration v1.3 — colonnes paramétriques sur news_episodes (format, narrator, target_duration_min, editorial_tone) + contrainte cohérence narrator
-- Rollback : supabase/migrations/20260428_news_v1_3_episodes_format_down.sql

-- ============================================================================
-- Contexte (spec_news_podcast_pipeline_v1_3.md §5.2 — migration 0010)
-- ============================================================================
-- Le Ticket 7 (génération script paramétrique) a besoin de stocker, sur chaque
-- épisode :
--   - format       : 'dialogue' (Sophie + Martin) ou 'monologue' (1 narrateur)
--   - narrator     : 'sophie' ou 'martin' SI format='monologue', sinon NULL
--   - target_duration_min : 3 / 5 / 8 / 12 minutes
--   - editorial_tone : standard / flash_urgence / pedagogique / focus_specialite
--
-- La contrainte news_episodes_narrator_check garantit l'invariant produit :
--   - format='dialogue'  ⇔ narrator IS NULL
--   - format='monologue' ⇔ narrator IS NOT NULL
--
-- État BDD à l'application : 0 ligne dans news_episodes (Tickets 4-6 non
-- encore livrés au moment du Ticket 5). Les 4 colonnes sont ajoutées avec
-- DEFAULT pour 'format' et 'editorial_tone' ; 'narrator' et
-- 'target_duration_min' restent NULL côté défaut, à remplir lors de
-- l'arbitrage admin (Ticket 8 vue épisode).

-- ============================================================================
-- 1. Ajout des 4 colonnes
-- ============================================================================

ALTER TABLE public.news_episodes
  ADD COLUMN format text DEFAULT 'dialogue'
    CHECK (format IN ('dialogue','monologue')),
  ADD COLUMN narrator text
    CHECK (narrator IN ('sophie','martin') OR narrator IS NULL),
  ADD COLUMN target_duration_min int
    CHECK (target_duration_min IN (3,5,8,12)),
  ADD COLUMN editorial_tone text DEFAULT 'standard'
    CHECK (editorial_tone IN ('standard','flash_urgence','pedagogique','focus_specialite'));

-- ============================================================================
-- 2. Contrainte cohérence format / narrator
-- ============================================================================
-- Cette CHECK est ajoutée APRÈS les colonnes pour pouvoir référencer les deux
-- noms. Elle interdit :
--   - format='dialogue' AND narrator IS NOT NULL
--   - format='monologue' AND narrator IS NULL
--
-- Format='dialogue' est le DEFAULT, donc une INSERT minimaliste reste valide
-- (narrator NULL, format='dialogue' implicite).

ALTER TABLE public.news_episodes
  ADD CONSTRAINT news_episodes_narrator_check CHECK (
    (format = 'dialogue'  AND narrator IS NULL) OR
    (format = 'monologue' AND narrator IS NOT NULL)
  );

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'news_episodes'
--    AND column_name IN ('format','narrator','target_duration_min','editorial_tone')
--  ORDER BY column_name;
--
-- Résultat attendu : 4 lignes, defaults 'dialogue' et 'standard' visibles.
--
-- SELECT conname
--   FROM pg_constraint
--  WHERE conname = 'news_episodes_narrator_check';
--
-- Résultat attendu : 1 ligne.
