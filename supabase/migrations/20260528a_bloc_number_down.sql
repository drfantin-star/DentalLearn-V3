-- ============================================
-- Down: 20260528a_bloc_number
-- ============================================

DROP INDEX IF EXISTS public.idx_sequences_formation_bloc;

ALTER TABLE public.sequences
  DROP COLUMN IF EXISTS bloc_number;
