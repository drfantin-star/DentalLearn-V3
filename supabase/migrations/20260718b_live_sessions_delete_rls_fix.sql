-- Fix : suppression (soft delete via deleted_at) toujours rejetée par la RLS,
-- pour tout formateur, quel que soit review_status ("Erreur lors de la
-- suppression" systématique, y compris sur une session `rejected`).
--
-- Cause racine (diagnostiquée en simulant une session `authenticated` via
-- SET LOCAL ROLE + request.jwt.claim.sub, cf. protocole MCP) : PostgreSQL
-- exige, pour un UPDATE sous RLS, que la ligne RÉSULTANTE satisfasse aussi
-- la policy SELECT de la table (pas seulement le WITH CHECK de la policy
-- UPDATE). Or `live_sessions_select` exigeait `deleted_at IS NULL` pour
-- TOUTE visibilité, y compris pour le propriétaire — donc la ligne
-- résultante d'un soft delete (deleted_at NON NULL) ne pouvait jamais
-- satisfaire la policy SELECT, et Postgres rejetait l'UPDATE avec
-- `42501 new row violates row-level security policy`, quel que soit le
-- contenu de la policy UPDATE elle-même (vérifié empiriquement : même une
-- policy UPDATE `USING (true) WITH CHECK (true)` échouait tant que la
-- policy SELECT n'était pas corrigée).
--
-- Fix en deux volets :
-- (a) live_sessions_select : `deleted_at IS NULL` ne s'applique plus qu'à
--     la branche "publique" (is_published) ; le propriétaire et le
--     superadmin gardent visibilité sur leurs lignes même soft-deleted
--     (nécessaire structurellement pour que l'UPDATE passe, et cohérent :
--     un admin doit pouvoir auditer une session supprimée).
-- (b) live_sessions_update : WITH CHECK explicite autorisant la
--     transition deleted_at NULL -> NOT NULL uniquement pour les sessions
--     en draft/rejected (règle métier du ticket) ; les edits normaux
--     (deleted_at reste NULL) sont inchangés.

drop policy if exists live_sessions_select on public.live_sessions;
create policy live_sessions_select
  on public.live_sessions
  for select
  to public
  using (
    (deleted_at is null and is_published = true)
    or formateur_user_id = auth.uid()
    or is_super_admin(auth.uid())
  );

drop policy if exists live_sessions_update on public.live_sessions;
create policy live_sessions_update
  on public.live_sessions
  for update
  to public
  using (
    deleted_at is null
    and (formateur_user_id = auth.uid() or is_super_admin(auth.uid()))
  )
  with check (
    is_super_admin(auth.uid())
    or (
      formateur_user_id = auth.uid()
      and (
        deleted_at is null
        or review_status in ('draft', 'rejected')
      )
    )
  );
