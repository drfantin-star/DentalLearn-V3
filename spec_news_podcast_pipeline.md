# DentalLearn — Section News
## Spécification technique : pipeline de veille automatisée et génération de podcast

**Version** : 1.1
**Date** : 22 avril 2026
**Porteur** : Dr Julie Fantin — Dentalschool / EROJU SAS
**Directrice de la publication** : Dr Julie Fantin
**Statut** : Spec validée, prête pour implémentation Phase 1
**Destinataire technique** : Claude Code

**Journal des versions**
- v1.0 (22/04/2026) — Première version
- v1.1 (22/04/2026) — Intégration décisions arbitrées : réutilisation `generate_audio.py` existant (voix Sophie/Martin dialogue), mentions légales, politique de rectification, CS traité séparément
- v1.2 (22/04/2026) — Ajout architecture Knowledge Base réutilisable : tags 3 dimensions, recherche sémantique pgvector, export Google Drive Markdown, ajout manuel d'articles, suppression auto si rétractation PubMed, rétention illimitée

---

## 1. Objectif

Fournir aux utilisateurs de DentalLearn, dans la section **News** de l'application, un digest audio hebdomadaire (≈12 min) synthétisant l'actualité scientifique et professionnelle dentaire, complété par des épisodes **Insight** ponctuels approfondissant une étude ou une recommandation marquante.

Le pipeline est majoritairement automatisé, avec validation humaine obligatoire par le Conseil Scientifique (CS) et la directrice scientifique avant toute publication.

---

## 2. Périmètre éditorial

### 2.1 Spécialités couvertes
Endodontie, parodontologie, chirurgie orale & implantologie, dentisterie restauratrice et esthétique, prothèse, pédodontie, orthodontie, occlusodontie, gérodontologie, santé publique dentaire, prévention, actualité professionnelle (exercice, syndicats, réglementation, DPC).

### 2.2 Formats de publication

| Format | Durée | Fréquence | Jour de publication |
|--------|-------|-----------|---------------------|
| Digest hebdomadaire | 12 min | 1 / semaine | Vendredi 12h00 (Europe/Paris) |
| Insight (approfondissement) | 5-8 min | À la demande | Sur décision éditoriale |

### 2.3 Langue
- Scripts et audio : **français**
- Sources : francophones et internationales (anglais principalement)
- Fiches synthèses internes : françaises (pour relecture CS)

---

## 3. Catalogue des sources

### 3.1 Sources automatisées (API / RSS)

| Source | Type | Accès | Coût |
|--------|------|-------|------|
| PubMed / MEDLINE | API | NCBI E-utilities | Gratuit |
| Cochrane Oral Health | RSS | Flux public | Gratuit |
| Crossref | API | api.crossref.org | Gratuit |
| Semantic Scholar | API | api.semanticscholar.org (100 req/5 min) | Gratuit |
| OpenAlex | API | api.openalex.org | Gratuit |
| Unpaywall | API | api.unpaywall.org | Gratuit (email requis) |
| L'Information Dentaire | RSS | À confirmer présence flux | Gratuit |
| Clinic (Éditions CdP) | RSS | À confirmer | Gratuit |
| British Dental Journal | RSS | nature.com | Gratuit |
| JADA | RSS | ada.org | Gratuit |
| Journal of Dental Research | RSS | sagepub.com | Gratuit |
| J Clin Periodontol | RSS | Wiley | Gratuit |
| International Endodontic Journal | RSS | Wiley | Gratuit |
| Clinical Oral Implants Research | RSS | Wiley | Gratuit |
| FDI World Dental Federation | RSS | fdiworlddental.org | Gratuit |
| SFOP, SFPIO, SFCO, SF Endo | RSS / page news | À vérifier par société | Gratuit |
| ADF | RSS / page news | adf.asso.fr | Gratuit |
| CNSD, FSDL | RSS / page news | À vérifier | Gratuit |
| HAS | RSS | has-sante.fr | Gratuit |
| ANSM | RSS | ansm.sante.fr | Gratuit |
| DGS / Ministère Santé | RSS | solidarites-sante.gouv.fr | Gratuit |

### 3.2 Sources à ingestion manuelle
Sources sans RSS/API publique stable. L'admin présente une liste de liens à copier-coller pour ingestion à la demande :
- Dentaire365 (si RSS absent — à vérifier)
- Presse Éditions CdP hors Clinic
- Articles repérés ad hoc par un membre du CS
- Articles ResearchGate signalés manuellement par un CS (consultation directe, pas de scraping automatisé)

### 3.3 Sources écartées
- **Eugenol** : forum communautaire non peer-reviewed. Risque de pollution scientifique.
- **ResearchGate en ingestion automatique** : pas d'API publique officielle, scraping contraire aux CGU, historique DMCA. Périmètre équivalent couvert par Semantic Scholar + OpenAlex + Unpaywall.

---

## 4. Architecture technique

### 4.1 Stack
- **Backend** : Supabase (Postgres + Edge Functions Deno + Storage + Auth)
- **Orchestration cron** : Supabase Scheduled Edge Functions
- **LLM** : Anthropic API — Claude Haiku (filtrage), Claude Sonnet (synthèse et scripts)
- **TTS** : ElevenLabs API, modèle `eleven_v3`, **format dialogue 2 voix** (Sophie + Martin)
- **Script TTS existant réutilisé** : `generate_audio.py` (dossier `DentalLearn-Audio` sur poste Dr Fantin), fonction `text_to_dialogue.convert` ElevenLabs
- **Frontend admin** : intégré à l'app DentalLearn existante (React / Next.js / TypeScript)

### 4.1.1 Voix retenues (réutilisation de l'existant)
| Personnage | Voix ElevenLabs | Voice ID |
|------------|-----------------|----------|
| Sophie | Voix féminine FR | `t8BrjWUT5Z23DLLBzbuY` |
| Martin | Voix masculine FR | `ohItIVrXTBI80RrUECOD` |

Speed : 1.1. Format dialogue co-animé : le digest et les insights sont écrits et joués comme un échange à deux voix (approche type podcast professionnel d'actualité).

### 4.1.2 Sécurisation clé API ElevenLabs
Le script `generate_audio.py` actuel contient la clé API en dur (ligne 19). **À corriger avant intégration pipeline News** : basculer vers variable d'environnement (`.env` + `python-dotenv` en local, secret Supabase Edge Function côté serveur).

### 4.2 Flux hebdomadaire

```
[Sources]
   ↓ cron Lundi 06h00 — Ingestion
[news_raw]
   ↓ cron Lundi 14h00 — Filtrage Claude Haiku
[news_scored] → top 10-15 articles
   ↓ cron Lundi 20h00 — Synthèse Claude Sonnet
[news_syntheses]
   ↓ cron Mardi 08h00 — Génération script digest
[news_episodes (status=draft)]
   ↓ notification email CS + Dr Fantin
[Relecture NotebookLM + Claude + humaine — Mardi → Jeudi]
   ↓ validation admin UI (Dr Fantin)
[Génération audio ElevenLabs — Vendredi 10h00]
   ↓
[Publication in-app — Vendredi 12h00]
```

---

## 5. Schéma base de données (Supabase / Postgres)

```sql
-- Extension pour recherche sémantique
create extension if not exists vector;

-- Catalogue des sources
create table news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in (
    'pubmed','rss','crossref','semantic_scholar','openalex','manual'
  )),
  url text,
  query jsonb,                      -- requête MeSH, params API ou config RSS
  spe_tags text[],                  -- spécialités associées par défaut
  active boolean default true,
  last_fetched_at timestamptz,
  created_at timestamptz default now()
);

-- Articles ingérés (bruts)
create table news_raw (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references news_sources(id),
  external_id text,                 -- PMID, DOI ou GUID RSS
  doi text,
  title text not null,
  abstract text,
  authors text[],
  journal text,
  published_at date,
  url text,
  raw_payload jsonb,
  ingested_at timestamptz default now(),
  unique (source_id, external_id)
);

-- Scoring et sélection
create table news_scored (
  id uuid primary key default gen_random_uuid(),
  raw_id uuid references news_raw(id) on delete cascade,
  relevance_score numeric(3,2),     -- 0.00 à 1.00
  spe_tags text[],
  reasoning text,
  dedupe_hash text,                 -- hash title+DOI pour dédoublonnage
  status text default 'candidate' check (status in (
    'candidate','selected','rejected','duplicate'
  )),
  llm_model text,
  scored_at timestamptz default now()
);

-- Fiches de synthèse (aussi Knowledge Base réutilisable — cf §8bis)
create table news_syntheses (
  id uuid primary key default gen_random_uuid(),
  scored_id uuid references news_scored(id),         -- null si ajout manuel
  raw_id uuid references news_raw(id),               -- lien direct article
  summary_fr text not null,
  method text,
  key_figures text[],
  evidence_level text,                               -- cf taxonomy niveau_preuve
  clinical_impact text,
  caveats text,
  -- Tagging KB (3 dimensions + mots-clés libres)
  specialite text,                                   -- slug taxonomy
  themes text[],                                     -- slugs taxonomy
  niveau_preuve text,                                -- slug taxonomy
  keywords_libres text[],                            -- non filtrants, boost recherche
  -- Recherche sémantique
  embedding vector(1536),                            -- modèle à définir (OpenAI text-embedding-3-small par défaut)
  -- Export Google Drive
  gdrive_file_id text,
  gdrive_url text,
  gdrive_synced_at timestamptz,
  -- Provenance
  manual_added boolean default false,                -- true si ajout manuel post-filtrage
  added_by uuid,                                     -- user id si manual_added
  -- État
  status text default 'active' check (status in ('active','retracted','deleted')),
  retracted_at timestamptz,                          -- si article source rétracté
  llm_model text,
  created_at timestamptz default now()
);

-- Index recherche
create index news_syntheses_embedding_idx
  on news_syntheses using ivfflat (embedding vector_cosine_ops);
create index news_syntheses_spe_idx on news_syntheses (specialite);
create index news_syntheses_themes_idx on news_syntheses using gin (themes);
create index news_syntheses_fulltext_idx
  on news_syntheses using gin (to_tsvector('french', coalesce(summary_fr,'')));

-- Taxonomy (vocabulaires contrôlés)
create table news_taxonomy (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('specialite','theme','niveau_preuve')),
  slug text not null,
  label text not null,
  description text,
  active boolean default true,
  created_at timestamptz default now(),
  unique (type, slug)
);

-- Épisodes publiables
create table news_episodes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('digest','insight')),
  week_iso text,                    -- ex: '2026-W17' pour digest
  title text not null,
  script_md text not null,          -- script rédactionnel
  script_with_tags text,            -- script avec audio tags ElevenLabs
  audio_url text,                   -- URL Supabase Storage
  duration_s integer,
  status text default 'draft' check (status in (
    'draft','review_cs','ready','published','archived'
  )),
  validated_by uuid,                -- user id Dr Fantin
  cs_reviewed_by uuid[],            -- membres CS ayant validé
  published_at timestamptz,
  created_at timestamptz default now()
);

-- Articles composant un épisode
create table news_episode_items (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid references news_episodes(id) on delete cascade,
  synthesis_id uuid references news_syntheses(id),
  order_idx integer not null
);

-- Références archivées (DOI + citation APA)
create table news_references (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid references news_episodes(id) on delete cascade,
  doi text,
  citation_apa text,
  url text,
  archived_at timestamptz default now()
);

-- Commentaires CS
create table news_cs_comments (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid references news_episodes(id) on delete cascade,
  cs_member uuid not null,
  comment text,
  status text check (status in ('note','request_change','approved')),
  created_at timestamptz default now()
);
```

---

## 6. Détails d'implémentation

### 6.1 Ingestion PubMed (Edge Function `ingest_pubmed`)
Requêtes E-utilities par spécialité, exemples MeSH :
- Endodontie : `("Endodontics"[MeSH] OR "Root Canal Therapy"[MeSH]) AND ("last 7 days"[DP])`
- Parodontie : `"Periodontics"[MeSH] OR "Periodontal Diseases"[MeSH]`
- Implantologie / chirurgie : `"Dental Implants"[MeSH] OR "Oral Surgery"[MeSH]`
- Reco / preuves : `publication type: "Practice Guideline" OR "Meta-Analysis" OR "Randomized Controlled Trial"`

Filtres par défaut : publications des 7 derniers jours, en français ou anglais.

### 6.2 Ingestion RSS (Edge Function `ingest_rss`)
Parser RSS / Atom côté Deno (lib `rss-parser` ou équivalent). Dédoublonnage par `guid` puis par similarité de titre (distance de Levenshtein > 0.9).

### 6.3 Filtrage LLM — modèle Claude Haiku
Prompt par article :

> Tu es assistant scientifique en odontologie. Évalue la pertinence de l'article suivant pour un podcast destiné aux chirurgiens-dentistes francophones en exercice.
>
> Critères :
> - Rigueur scientifique
> - Applicabilité clinique
> - Nouveauté / originalité
> - Impact sur la pratique quotidienne
>
> Réponds exclusivement en JSON strict :
> `{"score": 0.0-1.0, "spe_tags": ["..."], "raison": "..."}`
>
> Ne tranche que sur les informations fournies. Si information insuffisante pour évaluer, score ≤ 0.3. N'invente jamais un élément absent de l'abstract.

Seuil retenu pour sélection : `score >= 0.70`. Top 10-15 articles / semaine.

### 6.4 Synthèse LLM — modèle Claude Sonnet
Prompt par article sélectionné :

> Tu es rédacteur scientifique pour Dentalschool. À partir de l'abstract suivant, rédige une fiche en français structurée ainsi :
> 1. **Contexte clinique** (2-3 phrases)
> 2. **Méthode** (type d'étude, population, intervention, comparateur)
> 3. **Résultats chiffrés** — cite uniquement les chiffres présents dans le texte source
> 4. **Implications pour la pratique** du chirurgien-dentiste
> 5. **Niveau de preuve** selon classification Oxford CEBM
> 6. **Limites et précautions d'interprétation**
>
> Règles impératives :
> - Interdiction d'inventer ou d'approximer une donnée absente du texte source
> - Si une donnée manque : écrire explicitement "non renseigné dans le texte source"
> - Citer auteurs + journal + année à la fin de la fiche

### 6.5 Génération script digest hebdomadaire — Claude Sonnet (format dialogue 2 voix)

> Tu es co-auteur d'un podcast hebdomadaire dentaire animé par deux voix : **Sophie** (journaliste scientifique, pose les questions, reformule pour le praticien) et **Martin** (expert de veille, présente les études, donne les chiffres et les implications cliniques). Ton confraternel, professionnel, tutoiement entre Sophie et Martin, vouvoiement implicite envers l'auditeur.
>
> Format de sortie **strictement respecté** pour être lu par `generate_audio.py` :
> ```
> Sophie: [texte de la réplique avec audio tags éventuels]
> Martin: [texte de la réplique]
> Sophie: …
> ```
>
> À partir des 4 à 6 fiches de synthèse fournies, rédige un script de 12 minutes (≈1 800-2 000 mots en français) structuré ainsi :
> - **Introduction** (30 s) : Sophie accueille, teaser des news
> - **Sommaire** (15 s) : Martin annonce les sujets
> - **4-6 news commentées** (≈1 min 30 à 2 min chacune), regroupées par spécialité. Alternance Sophie/Martin : Sophie introduit le sujet et pose la question, Martin donne l'étude + les chiffres + l'implication
> - **Focus de la semaine** (3 min) : échange plus long entre les deux sur l'étude ou la reco la plus marquante
> - **Conclusion + teaser semaine suivante** (30 s) : Sophie clôture, Martin donne le teaser
>
> Intègre des audio tags ElevenLabs v3 pour une lecture naturelle : `[pause]`, `[pause-short]`, `[curious]`, `[thoughtful]`, `[emphasis]`, `[serious]`. À doser, pas plus d'un tag toutes les 2-3 répliques.
>
> Cite systématiquement la source à chaque news : auteurs + journal + année.
>
> **Interdiction formelle** d'inventer une donnée. Si une fiche signale "non renseigné", le script le mentionne honnêtement ou évite le chiffre.

### 6.6 Génération script Insight — Claude Sonnet (format dialogue 2 voix)
Même format dialogue Sophie/Martin, monosujet : approfondissement méthodologique, contexte historique, implication sur l'évolution des pratiques, recommandations actionnables, alertes sur limites et biais. Sophie joue le rôle du praticien curieux qui pose les questions de mise en pratique, Martin développe la rigueur méthodologique.

### 6.7 TTS ElevenLabs — réutilisation `generate_audio.py`
- Modèle : `eleven_v3` via `text_to_dialogue.convert`
- Voix : Sophie + Martin (voice IDs ci-dessus, §4.1.1)
- Speed : 1.1
- Découpage automatique en chunks de 4500 caractères max, retry 3 fois, pause 2s entre chunks (logique déjà implémentée dans `generate_audio.py`)
- Format sortie : MP3
- Stockage : bucket Supabase Storage `news-audio/YYYY-Www/`
- URL signée pour lecture in-app

**Intégration pipeline** : le LLM produit un fichier texte au format attendu par `generate_audio.py` (`Sophie:` / `Martin:` par ligne). Le script est appelé en CLI ou via wrapper Node depuis l'Edge Function de publication. Le MP3 généré est uploadé sur Supabase Storage.

---

## 7. Workflow de validation

**Directrice scientifique** : Dr Julie Fantin (validation finale obligatoire).
**Conseil Scientifique** : circuit et répartition thématique **gérés séparément** par Dr Fantin, spécification à fournir ultérieurement.

### 7.1 Circuit hebdomadaire digest (version Phase 1-2, hors CS)
1. **Mardi 08h00** : script draft généré, notification Dr Fantin avec lien vers interface admin.
2. **Mardi → jeudi** : Dr Fantin relit, édite si besoin via l'admin, peut demander régénération d'une section.
3. **Jeudi 18h00** : double lecture via NotebookLM (upload script + fiches sources) et via dialogue Claude dans ce projet.
4. **Vendredi 10h00** : génération audio ElevenLabs après validation (`status = 'ready'`).
5. **Vendredi 12h00** : publication automatique in-app.

Le circuit CS sera intégré dans une v1.2 de la spec une fois la répartition et les modalités arrêtées.

### 7.2 Circuit Insight
Délai minimum 72h entre génération et publication. Aucune publication automatique sans validation explicite (`status = 'ready'`).

### 7.3 Traçabilité des épisodes
Chaque épisode publié conserve en base : DOI et références citées, validation `validated_by`, modèles LLM utilisés, timestamps des étapes, version finale du script et URL audio.

---

## 7bis. Mentions légales & obligations réglementaires

### 7bis.1 Responsabilité éditoriale
- **Directrice de la publication** : Dr Julie Fantin (en sa qualité de responsable pédagogique Dentalschool et dirigeante EROJU SAS).
- **Éditeur** : EROJU SAS, marque commerciale Dentalschool Formations.
- **Mentions légales** : la section News renvoie aux mentions légales globales de l'application DentalLearn (pas de bloc juridique spécifique à dupliquer).

### 7bis.2 Disclaimer transparence IA (AI Act article 50)
À afficher sous chaque épisode dans l'app **et** dans la description audio :

> *"Les épisodes de la section News sont rédigés avec assistance de systèmes d'intelligence artificielle à partir de publications scientifiques indexées, puis validés scientifiquement par le Conseil Scientifique Dentalschool avant publication. Les voix Sophie et Martin sont des voix synthétiques (ElevenLabs)."*

### 7bis.3 Disclaimer scientifique & positionnement hors-DPC (unifié A4 + A6)
À afficher de manière permanente dans la section News :

> *"Les contenus publiés dans la section News ont une visée de veille professionnelle continue et d'information scientifique. Ils ne constituent pas une action de formation DPC validée, ne se substituent pas au jugement clinique du praticien, et ne remplacent pas la consultation des recommandations officielles (HAS, sociétés savantes, ANSM). En cas de doute clinique, le praticien se référera à ces sources et à sa propre analyse."*

### 7bis.4 Gestion des droits d'auteur & citations
Règles impératives, à inscrire dans les prompts LLM et à contrôler à la relecture :
- Reformulation intégrale systématique, pas de citation littérale de plus de quelques mots sans guillemets
- Attribution systématique à chaque news : auteurs + journal + année + DOI
- Pas de reproduction d'abstract in extenso, même traduit
- **Affichage public des références** : chaque épisode expose dans l'app la liste des références citées (auteurs, journal, année, DOI cliquable) pour pédagogie et traçabilité scientifique

### 7bis.5 Pas de tracking d'écoute (Phase 1-2)
Par choix éditorial, la section News ne met pas en place de mesure d'écoute en Phase 1-2. Simplification RGPD associée : pas de cookie ni d'analytics spécifique section News. Révision possible en Phase 3 si besoin d'évaluer l'engagement.

---

## 7ter. Politique de rectification

### 7ter.1 Canaux de signalement
- **Canal officiel unique** : `erratum@dentalschool.fr` (adresse à créer et à maintenir active)
- Ouvert à : utilisateurs DentalLearn, membres du Conseil Scientifique, auteurs d'articles cités, confrères tiers
- Monitoring automatique complémentaire : surveillance hebdomadaire du statut PubMed (flag `Retracted Publication`) sur tous les articles cités dans des épisodes publiés

### 7ter.2 Classification de la gravité (échelle à 3 niveaux)

| Niveau | Nature | Action | Délai |
|--------|--------|--------|-------|
| **1 — Mineur** | Coquille, lapsus non ambigu, typo référence | Correction silencieuse de la fiche écrite, pas de re-publication audio | ≤ 7 jours |
| **2 — Significatif** | Erreur chiffre, mauvaise attribution, nuance clinique mal restituée | Erratum visible sur la page épisode + mention dans l'intro du digest suivant (option D). Pas de re-génération audio de l'épisode fautif. | ≤ 72h |
| **3 — Critique** | Information cliniquement dangereuse, article source rétracté, reco officielle contredite | Dépublication immédiate + nouvel épisode correctif + notification push aux utilisateurs ayant ouvert l'épisode concerné (option B) + mention dans l'intro du digest suivant (option D) | ≤ 4h ouvrées |

### 7ter.3 Communication aux auditeurs
- **Niveau 1** : aucune communication, correction silencieuse
- **Niveau 2** : option B (notification push aux utilisateurs ayant ouvert l'épisode) + option D (mention dans l'intro du digest suivant)
- **Niveau 3** : option B + option D, renforcés par bannière sur la page épisode

### 7ter.4 Surveillance rétroactive des rétractations
Job hebdomadaire (Edge Function `check_retractions`) qui interroge PubMed sur la liste des PMID déjà cités dans des épisodes publiés **et/ou présents en Knowledge Base**. Tout flag `Retracted Publication` déclenche :
- Si l'article est dans un épisode publié : alerte niveau 3 en interface admin (procédure §7ter.2).
- Si l'article est seulement en KB (jamais publié) : suppression automatique de la synthèse selon la procédure §8bis.5 (soft delete + archivage Google Drive dans `/DentalLearn-KB/_retracted/`).

### 7ter.5 Droit de réponse auteur d'article cité
Si un auteur d'article cité conteste l'interprétation :
- Examen par Conseil Scientifique sous 15 jours
- Réponse motivée à l'auteur
- Si demande fondée : rectification niveau 2
- Si désaccord maintenu : publication du droit de réponse comme note d'épisode

### 7ter.6 Traçabilité des corrections (version allégée)
Table dédiée `news_corrections`, conservation **3 ans** (prescription civile courante). Archive du script fautif stockée dans un champ JSONB de la même ligne — pas de table séparée.

```sql
create table news_corrections (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid references news_episodes(id),
  reported_by_email text,
  reported_at timestamptz default now(),
  severity text not null check (severity in ('1_mineur','2_significatif','3_critique')),
  nature text not null,              -- description de l'erreur
  faulty_script_snapshot jsonb,      -- version fautive archivée
  decided_by uuid,                   -- Dr Fantin
  decided_at timestamptz,
  correction_applied_at timestamptz,
  retention_until date default (current_date + interval '3 years')
);
```

### 7ter.7 Délais de disponibilité
La directrice de la publication s'engage sur les délais §7ter.2 pendant les jours ouvrés. En cas d'absence planifiée, une suppléance doit être organisée (point ouvert à trancher).

---

## 8. Interface admin "News Editor"

Intégrée à l'app admin DentalLearn existante :
- **Dashboard hebdo** : statut du pipeline (ingestion, scoring, synthèse, script), compteurs articles ingérés / sélectionnés / rejetés.
- **Vue article** : abstract original + fiche synthèse + lien source + DOI. Boutons Valider / Éditer / Rejeter.
- **Vue épisode** : script éditable (markdown), prévisualisation des audio tags, bouton "Générer audio".
- **Player audio preview** : lecture inline, possibilité de re-générer si le rendu ne convient pas.
- **Zone commentaires CS** : fil de commentaires par épisode.
- **Bouton publication** : passe le statut à `published`, déclenche la mise en ligne in-app.
- **Ingestion manuelle** : champ URL pour ajouter un article ad hoc (ex: article signalé par un CS).
- **Ajout manuel à la Knowledge Base** : bouton "Ajouter à la KB" sur un article scoré < 0.7 non retenu pour épisode. Bypasse le filtrage, déclenche la synthèse et l'export KB (cf §8bis).
- **Recherche Knowledge Base** : interface de consultation des synthèses archivées (plein texte + filtres spécialité/thème/niveau de preuve + recherche sémantique).

---

## 8bis. Knowledge Base réutilisable

Les synthèses produites ne sont pas jetables : elles constituent un **actif patrimonial** de Dentalschool, réutilisable pour mise à jour de formations, préparation de nouvelles séquences pédagogiques, bibliographies, veille ciblée par spécialité.

### 8bis.1 Périmètre
- **Articles retenus pour un épisode** → synthèse automatique → intégration KB (flux nominal).
- **Articles scorés < 0.7 non retenus** → synthèse **à la demande** via bouton admin "Ajouter à la KB" (flag `manual_added = true`). Permet de capitaliser un article pertinent pour formation sans pour autant en faire un sujet de podcast.
- **Ingestion manuelle** (URL ad hoc) → même circuit, synthèse puis ajout KB.

### 8bis.2 Système de tags (3 dimensions + mots-clés libres)

| Dimension | Type | Valeurs |
|-----------|------|---------|
| **Spécialité** | vocabulaire fermé | endo, paro, chir-orale, implanto, dent-resto, proth, pedo, odf, occluso, gero, sante-pub, actu-pro |
| **Thème clinique** | vocabulaire semi-ouvert (géré via admin) | ex: greffe-gencive, ids, endocrown, aligneurs, bruxisme, apnee, peri-implantite, retraitement-endo… |
| **Niveau de preuve** | fermé (Oxford CEBM) | meta-analyse, revue-systematique, rct, cohorte, cas-temoin, transversal, cas-clinique, consensus, opinion-expert, reco-officielle |
| **Mots-clés libres** | non filtrants | proposés par LLM, boost recherche uniquement |

Les 3 vocabulaires fermés/semi-ouverts sont stockés dans la table `news_taxonomy` et éditables via l'admin. Le LLM ne peut que **proposer** des thèmes existants ; la création d'un nouveau thème est une action explicite de l'admin (évite la prolifération de tags quasi-synonymes).

### 8bis.3 Recherche
- **Full-text Postgres** dictionnaire français sur titre + summary_fr + tags (index GIN déjà déclaré §5)
- **Filtres combinés** par spécialité / thèmes / niveau de preuve / année / journal
- **Recherche sémantique** via `pgvector` : embedding de chaque synthèse (modèle par défaut : OpenAI `text-embedding-3-small`, 1536 dims, ≈ 0,00002 $ par synthèse → coût annuel négligeable). Permet requêtes type "tout ce qu'on a sur la reminéralisation" même sans correspondance exacte de mots.

### 8bis.4 Export Google Drive (Markdown)

Chaque synthèse validée déclenche un export automatique vers Google Drive (Edge Function `export_to_gdrive`, auth via Google service account).

**Arborescence** :
```
/DentalLearn-KB/
├── syntheses/
│   ├── paro/2026-W17_dupont_greffes-libres.md
│   ├── endo/…
│   └── …/ (un dossier par slug de spécialité)
├── episodes/
│   ├── 2026-W17-digest.md
│   └── 2026-W18-insight_aligneurs.md
└── taxonomy.md          ← export automatique des vocabulaires (auto-généré quotidiennement)
```

**Format fichier Markdown avec frontmatter YAML** :

```yaml
---
id: synth-2026-W17-001
doi: 10.1111/jcpe.12345
title: "Efficacité des greffes libres vs tunnel technique"
authors: [Dupont J, Martin P]
journal: J Clin Periodontol
year: 2026
specialite: paro
themes: [greffe-gencive, recession-gingivale, esthetique]
niveau_preuve: rct
source_episode: 2026-W17-digest
manual_added: false
keywords_libres: [tunnel, recouvrement-radiculaire]
url_source: https://doi.org/10.1111/jcpe.12345
archived_at: 2026-04-22
---

# Efficacité des greffes libres vs tunnel technique

## Contexte clinique
…

## Méthode
…

## Résultats chiffrés
…

## Implications pour la pratique
…

## Niveau de preuve
…

## Limites
…

## Référence complète
Dupont J, Martin P. Efficacité des greffes libres vs tunnel technique. J Clin Periodontol. 2026. DOI : 10.1111/jcpe.12345
```

**Partage Google Drive** : lecture/écriture limités à Dr Fantin en Phase 1-2. Élargissement au Conseil Scientifique ou autres collaborateurs à décider ultérieurement.

### 8bis.5 Rétention & suppression

- **Rétention par défaut** : **illimitée**. La Knowledge Base est un actif patrimonial, conservé indéfiniment.
- **Suppression automatique** si l'article source est rétracté sur PubMed :
  1. Le job hebdomadaire `check_retractions` (§7ter.4) détecte le flag `Retracted Publication`.
  2. La synthèse associée passe au statut `retracted`, puis `deleted` après confirmation admin (soft delete 7 jours pour éviter suppression accidentelle).
  3. Le fichier Markdown Google Drive est **déplacé** dans un dossier `/DentalLearn-KB/_retracted/` (archivé plutôt que détruit, pour traçabilité interne) avec frontmatter enrichi `retracted_at` et motif.
  4. Si l'article rétracté apparaît dans un épisode publié : déclenchement parallèle de la procédure de rectification niveau 3 (§7ter.2).

### 8bis.6 Gouvernance taxonomy
La gouvernance du vocabulaire (qui peut ajouter un thème clinique, valider un niveau de preuve) est **à décider ultérieurement** par Dr Fantin. En Phase 1-2, la gestion se fait via admin accessible à Dr Fantin uniquement.

---

## 9. Budget mensuel consolidé

| Poste | Estimation |
|-------|------------|
| PubMed / Crossref / Semantic Scholar / OpenAlex / RSS | 0 € |
| LLM filtrage Claude Haiku (~500 articles/semaine) | ≈ 2 € |
| LLM synthèse Claude Sonnet (~15 articles/semaine) | ≈ 5 € |
| LLM génération scripts digest + insight | ≈ 3 € |
| Embeddings KB (OpenAI text-embedding-3-small, ~15 synthèses/sem) | < 0,10 € |
| Google Drive API (service account, quotas gratuits) | 0 € |
| ElevenLabs Creator (100 min / mois) | 22 € |
| Supabase (free tier en démarrage) | 0 € |
| Hébergement front (free tier) | 0 € |
| **Total estimé** | **≈ 32 €/mois** |

Marge de ≈ 18 € sur le plafond de 50 €. Utilisable pour :
- Montée en puissance (insights plus fréquents)
- Passage ElevenLabs Pro si la qualité vocale demande des itérations nombreuses
- Services complémentaires (Firecrawl pour sites sans RSS)

---

## 10. Roadmap d'implémentation

### Phase 1 — MVP texte + KB (3 à 4 semaines)
- Création du schéma BDD Supabase (incluant pgvector, taxonomy, news_corrections)
- Edge Functions d'ingestion PubMed + 3 à 5 RSS clés
- Filtrage + synthèse Claude opérationnels
- Génération script digest en **format dialogue Sophie/Martin**, texte seul (sans audio)
- Interface admin minimale : validation texte, édition script, bouton "Ajouter à la KB"
- **Export automatique Google Drive** (Markdown avec frontmatter YAML, arborescence par spécialité)
- **Embeddings + recherche sémantique + full-text** opérationnels sur la KB
- Job `check_retractions` hebdomadaire
- 1er épisode test texte validé

### Phase 2 — Audio et publication (2 semaines)
- Intégration `generate_audio.py` (voix Sophie + Martin, sécurisation clé API)
- Calibration paramètres voix sur un digest complet
- Publication audio in-app section News
- Lancement officiel du digest hebdomadaire

### Phase 3 — Extension et Insights (continu)
- Format Insight opérationnel
- Ajout complet des sources sociétés savantes, HAS, ANSM, syndicats
- Interface de recherche KB plus avancée (facettes, tri par pertinence sémantique)
- Décisions gouvernance taxonomy et partage Google Drive
- Éventuel tableau de bord statistiques (hors tracking utilisateur)
- Préparation export RSS podcast public (Spotify, Apple Podcasts, Deezer)

---

## 11. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Erreur scientifique générée par LLM | Double relecture CS + Dr Fantin obligatoire. Prompts contiennent l'interdiction d'inventer. Mention "non renseigné" si donnée manquante. |
| Source API ou RSS indisponible | Monitoring des ingestions, alerte email si zéro article pour une source sur 7 jours. |
| Dépassement budget ElevenLabs | Suivi mensuel de la consommation, alerte automatique à 80 % du plafond. |
| Droits d'auteur presse | Reformulation systématique, citation conforme (auteurs + journal + année), pas de reproduction d'articles entiers, archivage limité au DOI et à la référence APA. |
| Validation CS retardée | Délai tampon Mardi → Jeudi (48h). Si pas de validation au Jeudi 18h, épisode reporté à la semaine suivante. |
| Article rétracté publié | Vérification du statut PubMed "Retracted Publication" avant synthèse. Champ `raw_payload.retracted` contrôlé. |
| Dérive qualité voix synthétique | Relecture audio par Dr Fantin avant publication Phase 2. Possibilité de re-générer segments spécifiques. |
| Dérive éditoriale | Revue trimestrielle de la ligne éditoriale par le Conseil Scientifique. |

---

## 12. Points ouverts restants

**Points traités dans cette v1.2**
- Voix ElevenLabs : Sophie + Martin existantes réutilisées, format dialogue (§4.1.1)
- Mentions légales : arbitrées (§7bis)
- Politique de rectification : arbitrée (§7ter)
- Email dédié signalement : `erratum@dentalschool.fr`
- Knowledge Base réutilisable : architecture complète (§8bis)

**Points reportés (à trancher ultérieurement par Dr Fantin)**
1. **Circuit Conseil Scientifique** : géré séparément, intégration au fil de l'eau.
2. **Partage Google Drive de la KB** (CS et autres collaborateurs) : décision reportée.
3. **Gouvernance taxonomy clinique** (qui peut ajouter un thème) : décision reportée.
4. **Jingle / habillage sonore** intro-outro du podcast (création externe, hors budget initial).
5. **Suppléance éditoriale** en cas d'absence de la directrice de la publication (pour tenir les délais §7ter.2).
6. **Validation juridique finale** des disclaimers §7bis.2 et §7bis.3 (optionnel mais recommandé — avocat spécialisé santé numérique).
7. **Création effective** de la boîte mail `erratum@dentalschool.fr` côté messagerie Dentalschool.

---

*Fin de spécification v1.2. Document prêt à être transmis à Claude Code pour implémentation de la Phase 1 sur le périmètre technique complet : schéma BDD (Supabase + pgvector), ingestion sources automatisées, filtrage LLM, synthèse LLM avec tagging 3 dimensions, génération script dialogue Sophie/Martin, export Google Drive Markdown, recherche sémantique et full-text, job de surveillance des rétractations PubMed. La génération audio réutilisera `generate_audio.py` existant en Phase 2, à sécuriser côté clé API avant intégration.*
