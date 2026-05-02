-- Rollback de 20260501_news_quiz_rpc.sql

DROP FUNCTION IF EXISTS get_news_quiz_by_specialite(text, int);
