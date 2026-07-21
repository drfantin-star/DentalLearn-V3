# RECAP — Migration 1 : accès des membres CS aux épisodes news

**Date :** 21 juillet 2026
**Demandeur :** Dr Julie Fantin
**Branche de session :** `claude/audit-cs-validations-etipt2`
**Projet Supabase :** `dxybsuhfkwuemapqrvgz` (DentalLearn)
**Nature :** SQL uniquement. Aucun changement front.

---

## Périmètre

Débloquer l'espace `/cs` pour les épisodes news : aujourd'hui un `cs_member`
non super_admin voit une file vide côté news et tombe sur `notFound()` à
l'aperçu, parce que `news_episodes` n'est lisible que par `is_super_admin` et
`service_role`.

Le chantier synthèses (`news_synthesis`) fait l'objet d'une **migration 2**
séparée : rien n'a été anticipé ici.

## Décisions actées

- **2A** — Ajout d'une policy `SELECT` sur `public.news_episodes` autorisant
  un membre CS actif (`is_cs_member(auth.uid())`). Portée volontairement large :
  le membre voit **tous** les épisodes, brouillons compris (il valide avant
  publication). Les policies existantes (`news_episodes_admin_read_all`,
  `Service role full access`) restent inchangées — les policies RLS se cumulent
  en OR, rien ne se perd.
- **11A** — Garde-fou `is_lead` sur la validation principale. La policy
  `editorial_validations_cs_insert` exigeait que `validated_by_lead` corresponde
  au `cs_members.id` de l'utilisateur courant, mais **ne vérifiait pas** que ce
  membre porte `is_lead = true`. Un membre secondaire pouvait donc s'enregistrer
  comme validateur principal. Correctif : ajout de `AND m.is_lead = true` dans la
  sous-requête (via `DROP` + `CREATE`, une policy ne s'altère pas en place). Le
  reste de la logique (anti-usurpation, cohérence FK, `OR is_super_admin`) est
  conservé à l'identique.
  - **Effet :** seule Dr Fantin (unique `is_lead`) peut créer une validation
    principale. Les trois autres membres conservent la co-signature via
    `add_secondary_validation`, **non touchée**.

## Fichiers livrés

- `supabase/migrations/20260721a_cs_news_episodes_access.sql`
- `supabase/migrations/20260721a_cs_news_episodes_access_down.sql`

Nommage : préfixe `20260721a` (vérifié libre — aucun `^20260721` préexistant),
convention alignée sur `20260720a_cs_space_v1.sql`. Le `_down.sql` restaure
exactement la policy d'INSERT d'origine (sans `is_lead`) et retire
`news_episodes_cs_read`.

**Migration appliquée directement via MCP Supabase** (`apply_migration`,
`success: true`).

## Résultat des 4 vérifications post-migration (SELECT uniquement)

1. **`pg_policies` sur `news_episodes` → 3 policies, dont `news_episodes_cs_read`.**
   ✅ `Service role full access` (ALL, service_role) ·
   `news_episodes_admin_read_all` (SELECT, `is_super_admin(auth.uid())`) ·
   `news_episodes_cs_read` (SELECT, authenticated, `is_cs_member(auth.uid())`).
2. **`with_check` de `editorial_validations_cs_insert` contient `is_lead`.** ✅
   `((is_cs_member(auth.uid()) OR is_super_admin(auth.uid())) AND (validated_by_lead IN (SELECT m.id FROM cs_members m WHERE m.user_id = auth.uid() AND m.active = true AND m.is_lead = true)))`.
3. **Validations courantes avec lead `is_lead=false` → 0.** ✅ (pré-contrôle
   avant migration : 0 également ; les 26 lignes existantes — 21 courantes +
   5 non-courantes — ont toutes pour lead Dr Julie Fantin, `is_lead=true`).
4. **`add_secondary_validation`, `validate_content`, `validate_content_bulk`,
   `revoke_validation` inchangées.** ✅ Signatures et définitions présentes,
   aucune touchée par la migration.

## Build de non-régression

`npx next build` — **succès** (`✓ Compiled successfully`, 69/69 pages générées,
exit 0).

> Note environnement : le premier run échouait au stade *prerender* de `/login`
> et `/admin/editorial-validations` avec
> `@supabase/ssr: Your project's URL and API key are required` — cause :
> variables `NEXT_PUBLIC_SUPABASE_*` **absentes du sandbox**, sans lien avec le
> changement (migration 100 % SQL, 0 fichier front modifié). Après ajout des
> variables publiques dans une `.env.local` **gitignorée** (URL + clé anon,
> valeurs publiques), le build passe au vert. `.env.local` n'est pas committée.
> `npm ci` a été utilisé pour installer les dépendances (lockfile inchangé) ;
> `package-lock.json` n'est pas committé.

## Dette / points ouverts

- **Première connexion des membres CS** (hors périmètre SQL) : pas de flux
  d'invitation ; login mot de passe uniquement. Les 3 comptes externes
  (`last_sign_in_at` NULL) devront passer par « Mot de passe oublié » pour
  définir un mot de passe. À traiter côté produit / communication.
- **Titres d'épisodes dans « Mes validations » (`/cs/historique`)** : désormais
  résolus pour un membre CS grâce à `news_episodes_cs_read` (avant : « (contenu
  supprimé) »).

## Prochaine étape — Migration 2 (synthèses), à NE PAS traiter ici

Arbitrages déjà tranchés par Julie :
- **8A** — canal de lecture des synthèses via RPC `SECURITY DEFINER` à colonnes
  sûres (pas de policy RLS, qui exposerait `embedding`, `llm_model`, ids
  internes).
- **9B** — payload du hash limité au noyau stable : `display_title`,
  `summary_fr`, `method`, `key_figures`, `evidence_level`, `clinical_impact`,
  `caveats`. Exclure `themes`, `keywords_libres`, `category_editorial`
  (réécrits par le pipeline → faux « stale » massif).
- **10A** — backfill des 623 synthèses actives par lots de 200, en SQL direct
  hors PostgREST.

## Remise

Commit sur la branche de session. **Pas de PR** : Dr Julie Fantin valide sur la
preview Vercel puis crée la PR manuellement.
