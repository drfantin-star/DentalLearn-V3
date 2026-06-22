-- Fix : point de départ de progression d'une formation.
-- "Rien complété" doit valoir 0 pour que SEULE l'intro (sequence_number=0)
-- soit accessible à un nouvel utilisateur. La séquence 1 se débloque après
-- complétion de l'intro (markCompleted pose current_sequence=1).
ALTER TABLE user_formations ALTER COLUMN current_sequence SET DEFAULT 0;
