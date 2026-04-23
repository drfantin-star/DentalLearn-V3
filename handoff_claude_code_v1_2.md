# Handoff Claude Code — Section News DentalLearn
## Plan de travail actionnable pour implémentation Phase 1

**Document compagnon de** : `spec_news_podcast_pipeline.md` (v1.2)
**Version handoff** : 1.2
**Date** : 23 avril 2026
**Destinataire** : Claude Code

**Journal des versions**
- v1.0 (22/04/2026) — Première version
- v1.1 (22/04/2026) — Décisions arbitrées par Dr Fantin :
  - Sources RSS pilotes Ticket 3 : **Cochrane Oral Health + British Dental Journal + HAS** (L'Information Dentaire n'a pas de flux RSS public, bascule en ingestion manuelle §3.2 de la spec)
  - **Ticket 2 enrichi** : `check_retractions` intégré (cron lundi 05h30, avant ingestion PubMed)
  - Ticket 8 : réutilisation obligatoire des patterns admin DentalLearn existants (auth, layout, détection rôle admin via `access_type`)
- v1.2 (23/04/2026) — Ajout de **L'Information Dentaire** comme 4ᵉ source pilote au Ticket 3 via un flux RSS généré par rss.app (https://rss.app/feeds/WIB3eb2uxxBjWIfT.xml). Note de vigilance "dépendance service tiers" documentée.

---

## 0. Comment utiliser ce document

1. Dr Fantin prépare les secrets listés en §2 dans un `.env.local` (ne jamais commit).
2. Dr Fantin ouvre Claude Code dans le repo DentalLearn et lui colle le **prompt de démarrage** (§1).
3. Claude Code effectue d'abord l'audit Supabase existant et rend compte avant d'écrire du code.
4. Les tickets (§3) sont attaqués **un par un**, chacun clôturé par un PR relu par Dr Fantin avant de passer au suivant.
5. Les contraintes non-négociables (§4) doivent être rappelées à Claude Code si jamais il s'en écarte.

---

## 1. Prompt de démarrage (à coller dans Claude Code la première fois)

```
Tu travailles sur le projet DentalLearn, application de révision post-formation
pour chirurgiens-dentistes éditée par EROJU SAS (marque Dentalschool Formations).
Stack : Next.js 14 / TypeScript / Supabase / Vercel.

Ta mission : implémenter la Phase 1 du pipeline "Section News" décrit dans le
document `spec_news_podcast_pipeline.md` à la racine du repo (v1.2).

Contexte complémentaire : `handoff_claude_code_v1_2.md` (ce fichier) définit le
plan de travail, les secrets, les tickets et les contraintes.

Avant d'écrire la moindre ligne de code :

1. Lis intégralement `spec_news_podcast_pipeline.md` et `handoff_claude_code_v1_2.md`.
2. Inspecte le schéma Supabase existant du projet DentalLearn via le MCP Supabase
   (list_tables, list_extensions, list_migrations). Identifie ce qui existe déjà
   (38 tables documentées dans DATABASE_SCHEMA.md) et ce qui doit être créé
   pour la section News.
3. Inspecte les patterns admin existants dans l'app (pages sous /app/admin/*,
   détection du rôle admin via access_type, composants layout admin réutilisables).
   Le Ticket 8 doit réutiliser ces patterns, pas créer une admin parallèle.
4. Lis le script `generate_audio.py` dans le dossier DentalLearn-Audio (chemin à
   demander à Dr Fantin si pas accessible directement) pour comprendre le format
   attendu pour la génération audio Phase 2.
5. Produis un compte-rendu en 4 parties :
   a) État actuel de la BDD (tables présentes, extensions, migrations)
   b) Patterns admin DentalLearn détectés (auth, layout, composants à réutiliser)
   c) Delta à créer pour la section News (tables news_*, pgvector, taxonomy)
   d) Questions bloquantes éventuelles
6. ATTENDS la validation de Dr Fantin avant de passer au Ticket 1.

Respecte impérativement les contraintes listées dans `handoff_claude_code_v1_2.md` §4.
```

---

## 2. Secrets et environnement

Fichier `.env.local` à créer à la racine du projet (ajouter à `.gitignore`) :

```bash
# Supabase (existant projet DentalLearn)
SUPABASE_URL=https://dxybsuhfkwuemapqrvgv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# LLM
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...                    # pour embeddings text-embedding-3-small

# PubMed / NCBI (obligatoire pour E-utilities)
PUBMED_EMAIL=drfantin@gmail.com
PUBMED_API_KEY=                          # optionnel, augmente le rate limit de 3 à 10 req/s

# Google Drive (export KB)
GOOGLE_SERVICE_ACCOUNT_JSON=./secrets/gdrive-service-account.json
GOOGLE_DRIVE_KB_FOLDER_ID=xxxxxxxxxxxxxxxx   # ID du dossier /DentalLearn-KB/ partagé au service account

# ElevenLabs (Phase 2)
ELEVENLABS_API_KEY=sk_...                # déjà existant dans generate_audio.py, à sortir du code

# Admin
ADMIN_NOTIFICATION_EMAIL=drfantin@gmail.com
ERRATUM_EMAIL=erratum@dentalschool.fr
```

### Préparation Google Drive service account
1. Créer un service account sur Google Cloud Console, activer l'API Drive.
2. Télécharger le JSON key, le placer dans `./secrets/` (ignoré par git).
3. Créer le dossier `/DentalLearn-KB/` sur Google Drive.
4. Partager ce dossier avec l'email du service account en droit "Éditeur".
5. Récupérer l'ID du dossier dans l'URL.

### Préparation boîte erratum
Créer `erratum@dentalschool.fr` côté messagerie Dentalschool avant la mise en production (peut être fait en parallèle du développement, pas bloquant pour Phase 1).

---

## 3. Tickets Phase 1 (dans cet ordre)

### Ticket 1 — Schéma BDD Supabase
**Objectif** : créer toutes les tables de la section News avec leurs index, et seed de la taxonomy.

**Tâches**
- Migration Supabase `0001_news_schema.sql` reprenant intégralement §5 de la spec
- Activation extension `pgvector`
- Création des tables : `news_sources`, `news_raw`, `news_scored`, `news_syntheses`, `news_episodes`, `news_episode_items`, `news_references`, `news_cs_comments`, `news_corrections`, `news_taxonomy`
- Index : `news_syntheses_embedding_idx` (ivfflat), `news_syntheses_spe_idx`, `news_syntheses_themes_idx` (GIN), `news_syntheses_fulltext_idx` (GIN tsvector français)
- Seed `news_taxonomy` : 12 spécialités + 10 niveaux de preuve (contenu §8bis.2 de la spec)
- Seed `news_sources` : requêtes MeSH PubMed pour les 12 spécialités + **4 flux RSS pilotes** (Cochrane Oral Health, British Dental Journal, HAS, L'Information Dentaire via rss.app)
- Politique RLS adaptée au rôle admin DentalLearn (aligné sur pattern existant des tables admin)

**Critères d'acceptation**
- [ ] `supabase db push` passe sans erreur
- [ ] Les 10 tables sont présentes via `list_tables`
- [ ] Extension `vector` active
- [ ] Seed taxonomy retourne 12 spécialités + 10 niveaux via `select * from news_taxonomy`
- [ ] Seed news_sources retourne 12 entrées PubMed + 4 entrées RSS
- [ ] Script de rollback `0001_news_schema_down.sql` fourni

---

### Ticket 2 — Edge Function ingestion PubMed + surveillance rétractations
**Objectif** : ingérer quotidiennement les nouvelles publications PubMed des 7 derniers jours pour chaque spécialité, ET vérifier hebdomadairement si des articles déjà cités/synthétisés ont été rétractés.

**Tâches**

**2A — Ingestion PubMed**
- Edge Function Deno `ingest_pubmed`
- Lecture des sources actives de type `pubmed` dans `news_sources` (queries MeSH par spécialité)
- Appel NCBI E-utilities `esearch` + `efetch` avec respect du rate limit (3 req/s sans API key, 10 req/s avec)
- Parse XML réponse, insertion dans `news_raw` avec dedup par `(source_id, external_id)`
- Cron scheduling Supabase : **lundi 06h00 Europe/Paris**
- Logs structurés (articles ingérés / doublons / erreurs par source)

**2B — Surveillance rétractations (`check_retractions`)**
- Edge Function Deno `check_retractions`
- Cron : **lundi 05h30 Europe/Paris** (tourne AVANT l'ingestion PubMed)
- Input : liste des PMID déjà présents en KB (`news_syntheses` status `active` avec `raw_id` non null) ET/OU cités dans des épisodes publiés (jointure `news_episode_items` → `news_syntheses` → `news_raw`)
- Appel NCBI E-utilities `efetch` en batch (max 200 PMID par requête) avec paramètre `rettype=xml` pour lire le flag `<PublicationType>Retracted Publication</PublicationType>`
- Actions selon présence du flag :
  - Si synthèse en KB uniquement (jamais publiée) : passage au statut `retracted`, trigger du déplacement fichier Markdown dans `/DentalLearn-KB/_retracted/` (Ticket 6 gérera l'effet Google Drive)
  - Si synthèse citée dans un épisode publié : création d'une entrée `news_corrections` en severity `3_critique`, notification admin par email (pas d'action automatique sur l'épisode — c'est à Dr Fantin de déclencher la procédure §7ter.2)
- Logs structurés (PMID vérifiés / rétractations détectées / actions déclenchées)

**Critères d'acceptation**
- [ ] Fonction `ingest_pubmed` s'exécute sans erreur sur les 12 spécialités
- [ ] Aucun doublon inséré (vérifier avec 2 runs consécutifs)
- [ ] Respecte le rate limit NCBI (pas de ban)
- [ ] Seed au moins 50 articles en base sur la première semaine d'exécution
- [ ] Fonction `check_retractions` s'exécute sans erreur même avec KB vide (idempotent)
- [ ] Test manuel : insérer un PMID connu rétracté (ex: PMID de papier Wakefield 1998 retracté) et vérifier que le flag est bien détecté
- [ ] Entrée `news_corrections` créée correctement si article publié rétracté détecté
- [ ] Email admin envoyé en cas de détection (vérifier template)

---

### Ticket 3 — Edge Function ingestion RSS (4 sources pilotes)
**Objectif** : ingérer 4 flux RSS pilotes avant généralisation.

**Tâches**
- Edge Function Deno `ingest_rss`
- Lib parsing RSS/Atom compatible Deno
- **Sources pilotes confirmées** :
  - **Cochrane Oral Health** — meta-analyses, niveau de preuve élevé
  - **British Dental Journal** (nature.com) — revue généraliste de référence
  - **HAS** (has-sante.fr) — autorité française, recommandations
  - **L'Information Dentaire** — actualité francophone dentaire, via flux généré par rss.app : `https://rss.app/feeds/WIB3eb2uxxBjWIfT.xml`
- Dedup par `guid` puis similarité de titre (Levenshtein > 0.9)
- Cron lundi 06h15 (décalé après PubMed)

**⚠️ Note de vigilance pour la source L'Information Dentaire**
Le flux RSS de L'Information Dentaire est généré par un service tiers (rss.app) qui scrape la page HTML du site. Cette source présente un risque de rupture si :
- rss.app change son modèle économique ou disparaît
- La structure HTML du site information-dentaire.fr évolue

Mesures à implémenter :
- Dans `news_sources`, ajouter un champ `notes` documentant la dépendance rss.app pour cette entrée
- Monitoring : si aucun nouvel article n'a été ingéré depuis 14 jours pour cette source, log warning + notification admin
- La gestion d'erreur générique du ticket (timeout, 5xx) couvre déjà le cas "rss.app indisponible"

**Critères d'acceptation**
- [ ] Les 4 flux parsent correctement (test manuel sur 1 run)
- [ ] Insertions dans `news_raw` avec `source_id` correct
- [ ] Gestion flux indisponible (timeout, 5xx) → log + continuer
- [ ] Documentation pour ajouter une nouvelle source en 5 min (row dans `news_sources`)
- [ ] Note de vigilance rss.app documentée dans le champ `notes` de la source L'Information Dentaire
- [ ] Monitoring "flux silencieux > 14 jours" implémenté

---

### Ticket 4 — Edge Function filtrage LLM (Claude Haiku)
**Objectif** : scorer la pertinence de chaque article brut et sélectionner les candidats pour synthèse.

**Tâches**
- Edge Function Deno `score_articles`
- Prompt §6.3 de la spec, réponse JSON stricte
- Modèle `claude-haiku-4-5-20251001`
- Batching : 10 articles par appel API pour optimiser coût/latence
- Calcul `dedupe_hash` (SHA256 de titre normalisé + DOI)
- Insertion `news_scored` avec status `candidate` / `selected` (si score ≥ 0.70) / `duplicate`
- Cron lundi 14h00

**Critères d'acceptation**
- [ ] JSON parsing robuste (retry si malformé, max 3 tentatives)
- [ ] Dedup fonctionnelle (pas de double insertion scoré pour un même hash)
- [ ] Top 10-15 articles en status `selected` par semaine en moyenne
- [ ] Coût total < 3 € / semaine

---

### Ticket 5 — Edge Function synthèse + tagging + embedding
**Objectif** : produire une fiche synthèse structurée et taguée pour chaque article sélectionné, avec embedding.

**Tâches**
- Edge Function Deno `synthesize_articles`
- Prompt §6.4 enrichi du tagging 3 dimensions (sortie JSON : summary_fr, method, key_figures, evidence_level, clinical_impact, caveats, specialite, themes, niveau_preuve, keywords_libres)
- Modèle `claude-sonnet-4-6`
- Contrainte LLM : les tags `specialite`, `themes`, `niveau_preuve` doivent correspondre à des slugs existants dans `news_taxonomy` (passer la liste en contexte du prompt)
- Génération embedding via OpenAI `text-embedding-3-small` (1536 dims)
- Insertion `news_syntheses` avec tous les champs
- Cron lundi 20h00

**Critères d'acceptation**
- [ ] Synthèses respectent le schéma (vérifier JSON schema validation)
- [ ] Aucun tag hors taxonomy (test unitaire)
- [ ] Embeddings stockés et recherche `order by embedding <=> query` fonctionne
- [ ] Règle "non renseigné dans le texte source" respectée (vérification manuelle sur 5 échantillons)

---

### Ticket 6 — Export Google Drive Markdown
**Objectif** : exporter chaque synthèse validée comme fichier Markdown sur Google Drive dans l'arborescence `/DentalLearn-KB/syntheses/{specialite}/`, et gérer le déplacement en `_retracted/` si rétractation détectée.

**Tâches**
- Edge Function Deno `export_to_gdrive`
- Auth service account (JSON via secret Supabase)
- Création fichier Markdown avec frontmatter YAML (format §8bis.4 de la spec)
- Nommage : `{week_iso}_{firstauthor_slug}_{title_slug_short}.md`
- Mise à jour `news_syntheses.gdrive_file_id`, `gdrive_url`, `gdrive_synced_at`
- Gestion idempotente : si fichier existe déjà (via `gdrive_file_id`), update plutôt que recréer
- **Gestion rétractation** : si `news_syntheses.status` passe à `retracted` (détecté par Ticket 2B), déplacer le fichier vers `/DentalLearn-KB/_retracted/{specialite}/` et enrichir frontmatter avec `retracted_at` + motif
- Trigger : à la validation d'une synthèse côté admin (webhook Supabase) + trigger sur changement `status` → `retracted`

**Critères d'acceptation**
- [ ] Fichier Markdown créé dans le bon sous-dossier spécialité
- [ ] Frontmatter YAML parsable
- [ ] Arborescence respectée même avec volume (test avec 50 synthèses)
- [ ] Mise à jour (et non duplication) si synthèse ré-exportée
- [ ] Déplacement vers `_retracted/` fonctionnel sur test manuel (changer status via SQL, vérifier déplacement)

---

### Ticket 7 — Génération script digest dialogue Sophie/Martin
**Objectif** : produire le script du digest hebdomadaire au format compatible `generate_audio.py`.

**Tâches**
- Edge Function Deno `generate_script_digest`
- Prompt §6.5 de la spec (format dialogue strict `Sophie:` / `Martin:`)
- Modèle `claude-sonnet-4-6`
- Input : synthèses sélectionnées de la semaine en cours
- Output : `news_episodes` avec `type='digest'`, `status='draft'`, `script_md` et `script_with_tags`
- Cron mardi 08h00
- Test de linting : le script produit doit parser correctement avec la fonction `parse_dialogue` de `generate_audio.py` (l'exécuter en CI sur l'échantillon)

**Critères d'acceptation**
- [ ] Format `Sophie:` / `Martin:` respecté (parse OK par `generate_audio.py`)
- [ ] Longueur ≈ 1 800-2 000 mots FR
- [ ] Chaque news a sa source citée (auteurs + journal + année)
- [ ] Audio tags présents mais dosés (< 1 tag / 2-3 répliques)
- [ ] Aucune donnée chiffrée absente des fiches sources (vérification manuelle)

---

### Ticket 8 — Interface admin minimale "News Editor"
**Objectif** : permettre à Dr Fantin de valider le pipeline et d'éditer le script.

**⚠️ Contrainte architecture** : cette interface DOIT réutiliser les patterns admin existants de DentalLearn (détection rôle admin via `access_type`, layout admin, composants réutilisables). Ne pas créer d'admin parallèle. Avant de commencer, relire les pages existantes sous `/app/admin/*` et s'aligner.

**Tâches**
- Page Next.js protégée admin `/admin/news` (réutilise le layout admin existant)
- Dashboard pipeline hebdo (compteurs)
- Vue articles scorés avec boutons Valider / Éditer / Rejeter
- Bouton "Ajouter à la KB" pour articles score < 0.7
- **Ingestion manuelle** : champ URL pour ajouter un article ad hoc (important — couvre notamment L'Information Dentaire sans RSS)
- Éditeur markdown script digest
- Bouton "Publier" qui change `status = 'ready'` (publication réelle automatique le vendredi 12h)
- Zone recherche KB (full-text + filtres spécialité/thème/niveau + recherche sémantique)
- **Vue corrections/rétractations** : liste des entrées `news_corrections` créées par `check_retractions` (Ticket 2B), action pour déclencher procédure §7ter.2
- **React state uniquement, aucun localStorage**

**Critères d'acceptation**
- [ ] Page accessible seulement aux users rôle admin (réutilise pattern existant)
- [ ] Layout cohérent avec les autres pages admin
- [ ] Tous les boutons fonctionnels
- [ ] Pas une ligne de `localStorage` / `sessionStorage` dans le bundle (grep en CI)
- [ ] Responsive mobile (Dr Fantin valide depuis iPhone/iPad aussi)
- [ ] Recherche KB renvoie résultats pertinents sur 10 requêtes-test fournies
- [ ] Vue rétractations affiche correctement les entrées test du Ticket 2B

---

## 4. Contraintes non-négociables

Ces règles sont **absolues**. À rappeler à Claude Code si dérapage.

1. **Jamais `localStorage` ou `sessionStorage`** — React state (useState, useReducer) uniquement. Règle projet DentalLearn absolue.
2. **Réutilisation stricte de `generate_audio.py`** — pas de réécriture, pas de port en TypeScript. Le script Python existant est appelé en CLI ou via wrapper. Seule modif autorisée : sortir la clé API du code source et la passer via variable d'environnement.
3. **Format dialogue Sophie/Martin strict** — compatible avec `parse_dialogue()` du script existant. Tester en CI.
4. **Rien inventer scientifiquement** — tous les prompts LLM contiennent l'interdiction d'inventer et l'obligation d'écrire "non renseigné dans le texte source" en cas de donnée manquante.
5. **Secrets hors du code** — aucune clé API, aucun token, aucune URL privée en dur. Variables d'environnement exclusivement.
6. **Rate limits respectés** — NCBI (3 req/s sans key, 10 avec), Anthropic, OpenAI, ElevenLabs. Implémenter backoff exponentiel sur 429.
7. **Dedup avant insertion** — toujours vérifier `news_raw` et `news_scored` pour éviter retraitements.
8. **Migrations avec rollback** — chaque migration BDD a son script `_down.sql`.
9. **RGPD minimaliste** — aucun tracking utilisateur en Phase 1-2, aucune PII dans les logs ni dans les prompts LLM.
10. **Tags limités à la taxonomy** — le LLM propose dans la liste fermée ; pas de nouveau tag créé automatiquement.
11. **Réutilisation des patterns admin DentalLearn** — Ticket 8 doit s'aligner sur les pages `/app/admin/*` existantes (auth, layout, composants). Pas d'admin parallèle.
12. **Modifications additives** — jamais de réécriture complète de fichiers existants. Seulement des ajouts ou modifications ciblées.

---

## 5. Workflow de review par ticket

Pour chaque ticket :

1. **Claude Code** travaille sur une branche `feature/news-ticket-N`.
2. À la fin du ticket, il ouvre un PR avec :
   - Description claire de ce qui a été fait
   - Liste des critères d'acceptation cochés
   - Instructions de test manuel pour Dr Fantin
   - Tout écart par rapport à la spec, explicité et justifié
3. **Dr Fantin** relit, teste manuellement, demande modifs si besoin.
4. Une fois validé, merge. **Puis** passage au ticket suivant.
5. Jamais de deploy production avant validation du ticket N+1 (permet rollback simple).

Pour les migrations BDD : toujours tester d'abord sur un branch Supabase (`create_branch` MCP), valider, puis merger sur main.

---

## 6. Questions que Claude Code peut poser à Dr Fantin

Claude Code doit **toujours demander** plutôt qu'inventer sur :
- Les sources RSS additionnelles à activer après les 3 pilotes du Ticket 3
- L'URL du repo Next.js existant
- Les IDs Supabase / projet Google Cloud / secret values
- Les décisions sur les spécialités prioritaires si un choix doit être fait faute de volume
- Toute ambiguïté scientifique ou éditoriale

Claude Code **ne doit jamais** :
- Inventer une information médicale
- Créer de nouveaux tags hors taxonomy de son propre chef
- Modifier la ligne éditoriale de la spec sans aval
- Mettre en production sans validation explicite

---

## 7. En cas de blocage

Si Claude Code est bloqué :
- Il documente le blocage dans un commentaire de PR
- Il propose 2-3 options avec avantages/inconvénients
- Il attend la décision de Dr Fantin avant de continuer

---

*Fin du handoff v1.1. Document prêt à être utilisé pour démarrer l'implémentation.*
