-- Down de 20260720b_formateur_search_trgm.sql
-- On retire la RPC et les index ajoutés. On NE droppe PAS les extensions
-- pg_trgm / unaccent (potentiellement utilisées ailleurs) ni le wrapper
-- immutable_unaccent (utilitaire générique réutilisable).

drop function if exists public.search_formateur_candidates(text);

drop index if exists public.idx_user_profiles_first_name_trgm;
drop index if exists public.idx_user_profiles_last_name_trgm;
