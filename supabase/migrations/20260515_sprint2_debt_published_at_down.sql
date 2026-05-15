-- Rollback : 20260515_sprint2_debt_published_at.sql
DROP INDEX IF EXISTS live_sessions_published_at_idx;
ALTER TABLE live_sessions DROP COLUMN IF EXISTS published_at;
