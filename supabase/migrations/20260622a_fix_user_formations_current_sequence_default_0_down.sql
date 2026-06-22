-- Rollback : rétablit l'ancien DEFAULT (1).
ALTER TABLE user_formations ALTER COLUMN current_sequence SET DEFAULT 1;
