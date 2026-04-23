# Notes de fin de Ticket 2 — Section News

**Date** : 2026-04-23
**Branche** : `feature/news-ticket-2`
**Statut** : validé en prod par Dr Fantin — 172 articles ingérés sur 3 sources pilotes (endo 28 / paro 71 / dent-resto 73), dedup parfait, `check_retractions` opérationnel sur KB vide.

---

## 1. Colonnes de `news_raw` utilisées par `ingest_pubmed`

Référence pour les Tickets 4 à 7. Snapshot de l'INSERT dans `supabase/functions/ingest_pubmed/index.ts:173-188`.

| Colonne | Type | Signification | Exemple ingéré |
|---|---|---|---|
| `source_id` | `uuid` (FK `news_sources.id`) | Source d'origine (PubMed spécialité) | `<uuid de la source Endodontie>` |
| `external_id` | `text` | PMID NCBI — **clé de dedup** avec `source_id` | `"40123456"` |
| `doi` | `text \| null` | DOI extrait de `<ArticleIdList><ArticleId IdType="doi">` | `"10.1016/j.joen.2026.03.001"` |
| `title` | `text` NOT NULL | `<ArticleTitle>` | `"Outcome of regenerative endodontic..."` |
| `abstract` | `text \| null` | Concat de tous les `<AbstractText>` avec label si présent (`BACKGROUND: ...`) | `"BACKGROUND: ...\n\nMETHODS: ..."` |
| `authors` | `text[] \| null` | `<Author>` → `ForeName + LastName`, ou `CollectiveName` si collectif. `null` si liste vide | `["Marie Dupont", "John Smith"]` |
| `journal` | `text \| null` | `<Journal><Title>` (fallback `<ISOAbbreviation>`) | `"Journal of Endodontics"` |
| `published_at` | `date \| null` | `<ArticleDate>` complet, fallback `<PubDate>` avec `monthToNum()` | `"2026-04-15"` |
| `url` | `text` | Construit : `https://pubmed.ncbi.nlm.nih.gov/{pmid}/` | `"https://pubmed.ncbi.nlm.nih.gov/40123456/"` |
| `raw_payload` | `jsonb` | Snapshot forensic : `{pmid, doi, retracted_at_ingestion}` | `{"pmid":"40123456","doi":"10.1016/...","retracted_at_ingestion":false}` |

Colonnes **non écrites** par `ingest_pubmed` (valeurs par défaut du schéma Ticket 1) :
- `id` (uuid gen_random_uuid)
- `ingested_at` (timestamptz default now())

**Dedup strict** : contrainte UNIQUE `(source_id, external_id)` → `news_raw_source_external_uniq` (cf. `supabase/migrations/20260423_news_schema.sql:64`). 2 runs consécutifs de `ingest_pubmed` sur les mêmes 7 jours = 0 nouvel insert, confirmé en prod.

---

## 2. Contrainte deno-dom sur Supabase Edge Functions

Pertinent pour le **Ticket 3 (ingestion RSS)** — même librairie probable.

- `deno-dom-wasm@v0.1.46` n'expose que le mimeType **`"text/html"`**. `"text/xml"` lève *`DOMParser: "text/xml" unimplemented`* à l'exécution (pas à `deno check`, donc invisible en dev).
- En mode HTML, deno-dom **lowercase tous les noms de balises et d'attributs** au parse. Les sélecteurs CSS et `getAttribute()` doivent utiliser des noms en lowercase.
- `textContent` n'est **PAS** lowercased — comparaisons de contenu (`=== "Retracted Publication"`) restent case-sensitive.
- `querySelectorAll` retourne `NodeList` typée `Node[]`. Pour narrow vers `Element[]` : `.filter((n): n is Element => n.nodeType === 1)` (type guard propre sans cast).
- Alternative écartée : linkedom via esm.sh — tire `canvas` en transitif, bundle Edge Functions échoue sur `canvas.node` introuvable.

**Implication Ticket 3** : pour parser un flux RSS/Atom (XML), soit :
- passer par deno-dom en mode `text/html` + sélecteurs lowercase (ex: `item > title`, `entry > link`), ou
- utiliser un parser RSS-dédié compatible Deno runtime (`jsr:@foo/rss` ou équivalent sans dépendance native).

---

## 3. pg_cron timezone sur Supabase

Pertinent pour tout ticket futur ajoutant un job cron.

- Supabase managé **n'expose pas** la signature `cron.schedule(..., timezone => ...)` de pg_cron ≥ 1.6, uniquement les variantes positionnelles `(schedule, command)` et `(job_name, schedule, command)`.
- `cron.timezone` est classé **PGC_POSTMASTER** — non modifiable via `ALTER DATABASE` côté utilisateur (nécessite un redémarrage serveur, hors de contrôle). Valeur figée à `GMT`.
- **Convention retenue** : toutes les expressions cron du projet sont **encodées en UTC** pour correspondre à `Europe/Paris` en heure d'été (UTC+2). Exemple : `'30 3 * * 1'` = lundi 03h30 UTC = 05h30 Paris en été, 04h30 en hiver. Décalage d'1h en période d'hiver assumé (aucun impact fonctionnel vu que les jobs tournent avant 6h du matin Paris).
- Ticket de dette technique futur si Supabase expose `timezone =>` ou permet d'éditer `cron.timezone` : rebasculer en mode DST-aware.

---

## 4. CLI Supabase en local

- `supabase functions deploy <name>` désormais exécutable en local chez Dr Fantin — tous les futurs déploiements de fonctions passent par cette CLI.
- Le bundler CLI est strict sur les dépendances natives : toute lib via `esm.sh` qui tire un binaire `.node` (ex: `canvas`) casse le deploy. Préférer `deno.land/x/...` WASM ou `jsr:` quand possible.
- Commande type : `supabase functions deploy ingest_pubmed check_retractions --project-ref dxybsuhfkwuemapqrvgz`.

---

## 5. Dette technique identifiée (à traiter hors Ticket 2)

1. **Clé service_role en clair dans `cron.job.command`** — inhérent à pg_cron + pg_net (pas de secrets management natif côté job). Ticket futur : migrer vers `vault.secrets` + fetch dynamique au tick cron.
2. **Email admin de notification Phase 1 absent** — décision produit (cf. échanges Ticket 2). Ticket futur dédié "notifications admin" pour envoyer un mail quand `news_corrections` est créé (détection rétraction) ou quand une ingestion échoue.
3. **Typage local Deno** — `deno check` remonte `Cannot find name 'Deno'` (TS2304) et des erreurs `LogContext` index signature (TS7053). Non bloquant runtime (bundler Supabase ignore), ticket de config `tsconfig.json` / `deno.json` plus tard.
4. **Auth admin par email hardcodé (`drfantin@gmail.com`)** — pattern existant DentalLearn, déjà documenté dans `supabase/migrations/README.md`. Hors périmètre Section News.

---

## 6. Étape suivante

**Ticket 3** — Edge Function `ingest_rss` (4 sources pilotes : Cochrane Oral Health, British Dental Journal, HAS, L'Information Dentaire via rss.app), cron lundi 06h15 Europe/Paris = **04h15 UTC** en respectant la convention UTC figée. Réutilisera `_shared/supabase.ts` et `_shared/logger.ts`.
