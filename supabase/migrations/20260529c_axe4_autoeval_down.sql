-- Rollback de 20260529c_axe4_autoeval.sql
-- DROP dans l'ordre inverse des dépendances (FK).

drop table if exists public.autoeval_completions;
drop table if exists public.questionnaire_routing;
drop table if exists public.questionnaire_items;
drop table if exists public.questionnaire_blocks;
drop table if exists public.questionnaires;

drop function if exists public.autoeval_set_updated_at();
