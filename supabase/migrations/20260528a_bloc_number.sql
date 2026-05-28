-- ============================================
-- Migration: 20260528a_bloc_number
-- Modèle d'acquisition par bloc (PARTIE_A_v4 §2.4 / §4.3)
-- ============================================
-- Ajoute sequences.bloc_number (1..4) et backfill par clamp littéral sur
-- sequence_number :
--   0      -> bloc 1 (intro audio-only)
--   1..5   -> bloc 1
--   6..10  -> bloc 2
--   11..14 -> bloc 3
--   >=15   -> bloc 4 (intégration globale + conclusion éventuelle)
-- Décision Dr Fantin (28/05/2026) : clamp littéral, pas de quartiles.
-- Le modèle 4-blocs n'est exploité (UI/verrou/attestation) que pour les
-- formations CP (axe_cp IS NOT NULL) ; la colonne reste néanmoins remplie
-- pour toutes les séquences afin de garantir NOT NULL.

ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS bloc_number integer NOT NULL DEFAULT 1
  CONSTRAINT sequences_bloc_number_check CHECK (bloc_number BETWEEN 1 AND 4);

UPDATE public.sequences
   SET bloc_number = CASE
     WHEN sequence_number <= 5  THEN 1
     WHEN sequence_number <= 10 THEN 2
     WHEN sequence_number <= 14 THEN 3
     ELSE 4
   END;

CREATE INDEX IF NOT EXISTS idx_sequences_formation_bloc
  ON public.sequences (formation_id, bloc_number);
