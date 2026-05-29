-- Rollback de 20260529a_bibliotheque_ressources.sql
-- Supprime les policies storage, le trigger, la fonction, et la table.
-- NB : ne supprime PAS les fichiers PDF déjà présents dans le bucket
--      bibliotheque-publique (gérés hors migration).

drop policy if exists "bibliotheque-publique admin delete" on storage.objects;
drop policy if exists "bibliotheque-publique admin update" on storage.objects;
drop policy if exists "bibliotheque-publique admin insert" on storage.objects;
drop policy if exists "bibliotheque-publique public read" on storage.objects;

drop trigger if exists trg_biblio_updated_at on public.bibliotheque_ressources;

drop table if exists public.bibliotheque_ressources;

drop function if exists public.biblio_set_updated_at();
