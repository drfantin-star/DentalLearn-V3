-- Backfill formateur_profiles.display_name depuis user_profiles.first_name/
-- last_name quand ces deux champs sont déjà renseignés — corrige les valeurs
-- auto-générées depuis le local-part de l'email (ex: "drfantin") lors de la
-- création à la volée du profil formateur (cf. INSERT ON CONFLICT DO NOTHING,
-- src/app/api/formateur/profil/route.ts).
--
-- Migration douce (CLAUDE.md) : ne touche PAS les display_name des
-- formateurs sans prénom/nom renseigné (fallback affichage conservé).

update public.formateur_profiles fp
set display_name = trim(concat_ws(' ', up.first_name, up.last_name)),
    updated_at = now()
from public.user_profiles up
where up.id = fp.user_id
  and nullif(trim(up.first_name), '') is not null
  and nullif(trim(up.last_name), '') is not null;
