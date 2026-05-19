-- Rollback de 20260519_sequences_script_text.sql.

ALTER TABLE sequences
  DROP COLUMN IF EXISTS script_text;
