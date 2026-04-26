# DentalLearn — Section News
## Spécification technique : pipeline de veille automatisée et génération de podcast (v1.3)

**Version** : 1.3 — consolidée
**Date** : 26 avril 2026
**Porteur** : Dr Julie Fantin — Dentalschool / EROJU SAS
**Directrice de la publication** : Dr Julie Fantin
**Statut** : Spec validée pour Phase 1 (Tickets 1-2 livrés, Ticket 3 en cours, Tickets 4-11 à faire)
**Destinataire technique** : Claude Code

**Documents associés**
- `DATABASE_SCHEMA.md` — schéma Supabase complet (44 tables)
- `SYNTHESE_FONCTIONNALITES_DENTALLEARN_V3.md` — fonctionnalités existantes app
- `addendum_handoff_claude_code_v1_3.md` — plan de tickets actualisé
- `addendum_formations_audio_batch_niveau1.md` — pipeline bonus formations

**Journal des versions**
- v1.0 (22/04/2026) — Première version
- v1.1 (22/04/2026) — TTS Sophie/Martin existants, mentions légales, politique rectification, CS séparé
- v1.2 (22/04/2026) — Knowledge Base réutilisable (tags 3D, recherche sémantique, export Google Drive)
- **v1.3 (26/04/2026)** — Catégories app + cover image (mix IA + Unsplash), génération quiz du jour, format/durée/narrateur/ton paramétriques avant script, ajout manuel forcé dans digest, alignement sur tables `formations` et `questions` existantes

---

## 1. Objectif

Fournir aux utilisateurs de DentalLearn, dans la section **News** de l'application, un digest audio hebdomadaire (~12 min) synthétisant l'actualité scientifique et professionnelle dentaire, complété par des **Insights** ponctuels, **alimentant simultanément** la Knowledge Base réutilisable et le **pool de questions du quiz du jour**.

Le pipeline est majoritairement automatisé, avec arbitrage humain à chaque étape clé et validation finale obligatoire par Dr Fantin avant publication.

---

## 2. Périmètre éditorial

### 2.1 Spécialités couvertes
Endodontie, parodontologie, chirurgie orale & implantologie, dentisterie restauratrice et esthétique, prothèse, pédodontie, orthodontie, occlusodontie, gérodontologie, santé publique dentaire, prévention, actualité professionnelle (exercice, syndicats, réglementation, DPC).

### 2.2 Formats de publication

| Format | Durée | Fréquence | Jour de publication | Choix |
|--------|-------|-----------|---------------------|-------|
| Digest hebdomadaire | 3 / 5 / 8 / 12 min | 1 / semaine | Vendredi 12h00 | Format dialogue ou monologue, ton éditorial paramétrable |
| Insight | 5 / 8 / 12 min | À la demande | Sur décision éditoriale | Idem |

### 2.3 Langue
- Scripts et audio : français
- Sources : francophones et internationales (anglais principalement)
- Fiches synthèses internes : françaises (pour relecture éditoriale)

---

## 3. Catalogue des sources

### 3.1 Sources automatisées (API / RSS)
PubMed E-utilities (gratuit), Cochrane Oral Health RSS, Crossref, Semantic Scholar, OpenAlex, Unpaywall, L'Information Dentaire RSS, Clinic (Éditions CdP) RSS, British Dental Journal RSS, JADA, JDR, J Clin Periodontol, Int Endod J, Clin Oral Implants Res, FDI, sociétés savantes (SFOP, SFPIO, SFCO, SF Endo), ADF, CNSD, FSDL, HAS, ANSM, DGS Ministère Santé.

### 3.2 Sources à ingestion manuelle
Sources sans RSS / API publique stable, ou articles ad hoc repérés par Dr Fantin (dont articles ResearchGate signalés manuellement, jamais scrapés).

### 3.3 Sources écartées
Eugenol (forum non peer-reviewed), ResearchGate en automatisé (pas d'API publique, scraping contraire CGU).

---

## 4. Architecture technique

### 4.1 Stack
- **Backend** : Supabase (Postgres 17 + Edge Functions Deno + Storage + Auth) — projet existant `dxybsuhfkwuemapqrvgz`
- **Orchestration cron** : Supabase Scheduled Edge Functions
- **LLM** : Anthropic API (Claude Haiku pour filtrage, Claude Sonnet pour synthèse + tags + quiz + scripts)
- **Embeddings** : OpenAI `text-embedding-3-small` (1536 dims)
- **Génération images** : mix Replicate API (Flux) ou OpenAI DALL-E 3 + Unsplash fallback
- **TTS** : ElevenLabs API, modèle `eleven_v3` via `text_to_dialogue.convert`, voix Dr Sophie + Dr Martin (script existant `generate_audio.py` réutilisé)
- **Frontend admin** : intégré à l'app DentalLearn existante (Next.js / TypeScript)

### 4.2 Voix retenues (réutilisation existant — déjà utilisé pour formations)

| Personnage | Rôle éditorial | Voice ID |
|------------|----------------|----------|
| **Dr Sophie** | Praticienne curieuse 5-10 ans XP, pose les questions du praticien | `t8BrjWUT5Z23DLLBzbuY` |
| **Dr Martin** | Expert pédagogue 20+ ans, donne les chiffres et l'analyse | `ohItIVrXTBI80RrUECOD` |

Speed 1.1, modèle `eleven_v3`. Format dialogue identique à celui des séquences de formation.

### 4.3 Sécurisation clé API ElevenLabs
Le script `generate_audio.py` actuel contient la clé en dur. **À sortir en variable d'environnement** avant intégration au pipeline news (cf addendum formations §3 pour le wrapper batch).

### 4.4 Flux hebdomadaire mis à jour (v1.3)

```
Lundi 06h00 — Ingestion PubMed + RSS                  → news_raw
Lundi 14h00 — Filtrage Claude Haiku                    → news_scored (selected ≥ 0.70)
Lundi 20h00 — Synthèse + tagging + quiz + cover SVG    → news_syntheses + questions
                                                          (questions news : is_daily_quiz_eligible=false par défaut)
Lundi 22h00 — Export Google Drive (Markdown)           → KB
Mardi 08h00 — Notification "Pipeline prêt à scripter"
   ↓ (PAS de génération automatique de script)
Mardi → mercredi  Tu arbitres dans l'admin
   - Sélection des synthèses à inclure (par défaut toutes les selected)
   - Ajout manuel d'articles scorés < 0.7 ou ad hoc
   - Choix format (dialogue / monologue), durée (3/5/8/12 min),
     narrateur (si monologue : Sophie ou Martin), ton éditorial
   - Validation/ajustement covers et catégories éditoriales
   - Approbation des questions quiz pour le pool quotidien
   ↓
Mercredi midi  Tu cliques "Générer le script"          → news_episodes (status=draft)
Jeudi 18h00 — Double lecture NotebookLM + Claude
Vendredi 10h00 — Génération audio ElevenLabs           → audio_url
Vendredi 12h00 — Publication automatique in-app        → news_episodes (status=published)
```

---

## 5. Schéma base de données (Supabase / Postgres)

### 5.1 État actuel
Les tables `news_*` ont été créées au Ticket 1 conformément à v1.2. Les modifications v1.3 sont **additives** (colonnes ajoutées, pas de tables supprimées).

### 5.2 Migrations v1.3 à appliquer

```sql
-- ──────────────────────────────────────────────────────────────────
-- Migration 0010_news_v1_3_episodes_format.sql
-- Format / durée / narrateur / ton paramétriques sur les épisodes
-- ──────────────────────────────────────────────────────────────────

alter table news_episodes
  add column format text default 'dialogue'
    check (format in ('dialogue','monologue')),
  add column narrator text
    check (narrator in ('sophie','martin') or narrator is null),
  add column target_duration_min int
    check (target_duration_min in (3,5,8,12)),
  add column editorial_tone text default 'standard'
    check (editorial_tone in ('standard','flash_urgence','pedagogique','focus_specialite'));

-- Contrainte cohérence : narrator obligatoire seulement si format=monologue
alter table news_episodes
  add constraint news_episodes_narrator_check check (
    (format = 'dialogue' and narrator is null) or
    (format = 'monologue' and narrator is not null)
  );

-- ──────────────────────────────────────────────────────────────────
-- Migration 0011_news_v1_3_syntheses_categories_cover.sql
-- Catégories éditoriales + alignement formations + cover image
-- ──────────────────────────────────────────────────────────────────

alter table news_syntheses
  add column category_editorial text
    check (category_editorial in ('reglementaire','scientifique','pratique','humour') or category_editorial is null),
  add column formation_category_match text,   -- slug de formations.category si correspondance, sinon NULL
  add column display_title text,                -- titre court d'affichage (≤60 car)
  add column cover_image_url text,              -- URL custom (override SVG par défaut)
  add column cover_image_source text            -- 'svg_auto' / 'ai_generated' / 'unsplash' / 'manual_upload'
    check (cover_image_source in ('svg_auto','ai_generated','unsplash','manual_upload') or cover_image_source is null);

create index news_syntheses_category_editorial_idx on news_syntheses (category_editorial);
create index news_syntheses_formation_match_idx on news_syntheses (formation_category_match);

-- ──────────────────────────────────────────────────────────────────
-- Migration 0012_news_v1_3_questions_link.sql
-- Lien questions → synthèses news (pool quiz du jour étendu)
-- ──────────────────────────────────────────────────────────────────

alter table questions
  add column news_synthesis_id uuid references news_syntheses(id) on delete set null;

-- Une question est issue soit d'une séquence formation, soit d'une synthèse news
alter table questions
  add constraint questions_source_check check (
    (sequence_id is not null and news_synthesis_id is null) or
    (sequence_id is null and news_synthesis_id is not null)
  );

create index questions_news_synthesis_idx on questions (news_synthesis_id);

-- ATTENTION : on ne change PAS le default de is_daily_quiz_eligible (reste true).
-- L'insertion des questions news doit explicitement positionner is_daily_quiz_eligible=false
-- via le code Edge Function ; le bouton admin "Approuver pour quiz du jour" bascule à true.
```

### 5.3 Note sur la fonction RPC `get_daily_quiz`
Aucune modification. Le filtre `WHERE is_daily_quiz_eligible = true` continue de fonctionner — les questions news approuvées entrent dans le pool au même titre que les questions formation. Pondération 70/30 ou autre rotation possible plus tard si besoin (hors Phase 1).

---

## 6. Détails d'implémentation (mises à jour v1.3)

### 6.1 Ingestion PubMed (inchangé v1.2)
Edge Function `ingest_pubmed`, requêtes E-utilities par spécialité, dédup par (source_id, external_id).

### 6.2 Ingestion RSS (inchangé v1.2)
Edge Function `ingest_rss`, parser Deno, dédup par guid + similarité titre.

### 6.3 Filtrage LLM Claude Haiku (inchangé v1.2)
Score 0-1, seuil sélection 0.70.

### 6.4 Synthèse + tagging + quiz + cover (Edge Function `synthesize_articles`, ENRICHI v1.3)

**Modèle** : `claude-sonnet-4-6` (un seul appel API par article qui produit synthèse + tags + 3-4 questions)

**Prompt étendu** (sortie JSON unique avec tous les champs) :

> Tu es rédacteur scientifique et concepteur pédagogique pour Dentalschool. À partir de l'abstract suivant, produis un objet JSON strict conforme au schéma fourni, contenant :
>
> 1. **Fiche synthèse** (français) : `summary_fr`, `method`, `key_figures`, `evidence_level`, `clinical_impact`, `caveats`
> 2. **Tagging 3 dimensions + éditorial** :
>    - `specialite` : choisie parmi la liste fournie de slugs taxonomy news (vocabulaire fermé, plus large que `formations.category`)
>    - `themes` : 1 à 3 slugs choisis parmi la liste fournie
>    - `niveau_preuve` : 1 slug parmi la liste fournie
>    - `keywords_libres` : 3 à 6 mots-clés libres (boost recherche, non filtrants)
>    - `category_editorial` : 1 valeur parmi `reglementaire`, `scientifique`, `pratique`, `humour`
>    - `formation_category_match` : si `specialite` correspond à un slug de la liste `formations.category` fournie (28 valeurs), renvoie ce slug, sinon `null`
> 3. **Affichage** : `display_title` (≤60 caractères, percutant)
> 4. **Quiz** : 3 à 4 questions au format JSONB compatible avec la table `questions` existante. Distribution recommandée : 2 mcq (4 options 1 correcte) + 1 true_false + éventuellement 1 case_study si l'abstract s'y prête. Règles strictes :
>    - `feedback_correct = feedback_incorrect` (un seul feedback explicatif)
>    - Toute mauvaise réponse illustre une **erreur réelle plausible**, pas un piège artificiel
>    - Source citée dans chaque feedback (auteurs + journal + année + DOI)
>    - Points multiples de 5 (10/15/30)
>    - `difficulty` : 1 (facile) à 3 (difficile), majoritairement 1-2 pour le quiz quotidien
>
> Règles transverses impératives :
> - Interdiction d'inventer ou d'extrapoler une donnée. Si une donnée est absente du texte source, écris `"non renseigné dans le texte source"` (sauf pour les options de question, où il faut produire des distracteurs réalistes).
> - Tous les tags `specialite`, `themes`, `niveau_preuve`, `category_editorial` doivent provenir exclusivement des listes fournies.

**Insertion** :
- 1 ligne dans `news_syntheses` avec tous les champs
- 1 embedding via OpenAI `text-embedding-3-small`
- 3-4 lignes dans `questions` avec `news_synthesis_id` rempli, `sequence_id` null, **`is_daily_quiz_eligible = false`** (validation manuelle requise)

**Cron** : lundi 20h00.

### 6.5 Génération de la cover image (NOUVEAU v1.3) — Edge Function `generate_cover_image`

Stratégie en cascade pour minimiser le coût :

**Cascade** :
1. **SVG auto** par défaut généré côté front à la volée (gradient de la `category_editorial` + emoji de la `specialite` + `display_title` tronqué). Coût zéro, pas de stockage. Utilisé dès l'apparition de la synthèse, sans appel API.
2. **Génération IA à la demande** déclenchée par bouton admin "Générer cover IA" :
   - Prompt construit à partir de `display_title` + `specialite` + `category_editorial`, avec style éditorial Dentalschool figé : *"illustration éditoriale épurée, palette violet/teal/orange/rose selon la catégorie, fond clair, semi-réaliste, sans texte ni logo"*
   - Modèle : Replicate Flux schnell (≈ 0,003 $/image) ou OpenAI DALL-E 3 standard (≈ 0,04 $/image)
   - Stockage : Supabase Storage `news-covers/YYYY-Www/`, `cover_image_source = 'ai_generated'`
3. **Fallback Unsplash** si génération IA échoue 2 fois ou si tu préfères du photographique : recherche par mots-clés issus de `keywords_libres`, sélection de la première image avec orientation paysage. `cover_image_source = 'unsplash'`.
4. **Upload manuel** : à tout moment, tu peux uploader une image custom dans l'admin → `cover_image_source = 'manual_upload'`.

**Coût mensuel estimé** :
- 60 covers/mois (15 syntheses × 4 sem)
- IA Flux schnell : 60 × 0,003 = **~0,20 $/mois**
- DALL-E 3 si tu préfères : 60 × 0,04 = **~2,50 $/mois**
- Unsplash gratuit
→ Budget retenu : **~3 €/mois max** côté images.

### 6.6 Génération script paramétrique (Edge Function `generate_episode_script`, NOUVEAU FLUX v1.3)

**Trigger** : déclenchée manuellement par Dr Fantin via l'admin (bouton "Générer le script") après arbitrage des paramètres.

**Inputs** :
- Liste de `synthesis_id` sélectionnés pour l'épisode (mix automatique + manuel + ajouts ad hoc)
- `format` : `dialogue` | `monologue`
- `narrator` (si monologue) : `sophie` | `martin`
- `target_duration_min` : 3 / 5 / 8 / 12
- `editorial_tone` : `standard` | `flash_urgence` | `pedagogique` | `focus_specialite`

**Calcul cible mots** : ~150 mots / minute en français → 3 min ≈ 450 mots, 5 min ≈ 750, 8 min ≈ 1200, 12 min ≈ 1800.

**Variantes de prompt** :

#### Dialogue Sophie/Martin
> Tu es co-auteur d'un podcast dentaire animé par Dr Sophie (curieuse, 5-10 ans XP, pose les questions du praticien) et Dr Martin (expert 20+ ans, donne chiffres et analyse). Ton confraternel, professionnel, tutoiement entre Sophie et Martin, vouvoiement implicite envers l'auditeur.
>
> Format de sortie strict pour `generate_audio.py` :
> ```
> Sophie: [audio tag] Texte
> Martin: [audio tag] Texte
> ```
> Tons éditoriaux disponibles : `standard` (normal), `flash_urgence` (rythme rapide, sujet urgent), `pedagogique` (ralenti, vulgarisation maximale), `focus_specialite` (audience experte d'une spé). Adapte la modulation et le vocabulaire en conséquence.
>
> Audio tags v3 disponibles : `[curious]`, `[excited]`, `[concerned]`, `[impressed]`, `[reassuring]`, `[explaining]`, `[serious]`, `[enthusiastic]`, `[laughs]`, `[sighs]`, `[pause]`, `[pause-short]`. À doser, pas plus d'1 tag toutes les 2-3 répliques.
>
> Cible mots : {target_words} ± 10 %. Cite systématiquement la source de chaque news (auteurs + journal + année). Interdiction d'inventer une donnée.

#### Monologue (Sophie OU Martin)
> Tu rédiges un script de podcast monovoix, narrateur {narrator}. Format de sortie strict :
> ```
> Sophie: Texte
> Sophie: Texte (ou Martin: selon le narrateur retenu)
> ```
> (Une seule personne parle, mais on garde le préfixe pour compatibilité `generate_audio.py`.)
>
> Style à choisir selon le narrateur : Dr Sophie = ton curieux et accessible, Dr Martin = ton expert et didactique. Cible mots : {target_words} ± 10 %. Mêmes règles d'audio tags, citations et interdiction d'invention que pour le dialogue.

**Insertion** : `news_episodes` avec `status='draft'`, `script_md` rempli, paramètres conservés.

### 6.7 TTS ElevenLabs — réutilisation `generate_audio.py`
Inchangé. Le format `Sophie:` / `Martin:` strict est respecté pour les deux variantes (dialogue et monologue).

---

## 7. Workflow de validation
Inchangé v1.2 (Dr Fantin valide en finale, Conseil Scientifique géré séparément, intégration v1.4 ultérieure).

---

## 7bis. Mentions légales & obligations réglementaires
Inchangé v1.1.

---

## 7ter. Politique de rectification
Inchangé v1.1. Email dédié : `erratum@dentalschool.fr`.

---

## 8. Interface admin "News Editor" (ENRICHIE v1.3)

Page admin Next.js `/admin/news` (rôle admin requis, RLS).

### 8.1 Dashboard hebdomadaire
- Compteurs pipeline (ingérés, scorés, sélectionnés, synthétisés)
- Pool de questions news en attente d'approbation
- Synthèses prêtes à inclure dans le digest courant
- Status de l'épisode en cours (draft / ready / published)

### 8.2 Vue article
- Abstract original + fiche synthèse + cover preview
- Tags : specialite, themes, niveau_preuve, **category_editorial** (modifiables)
- **Lien direct** vers la formation Dentalschool si `formation_category_match` rempli (cross-merchandising)
- Boutons : Valider / Éditer / Rejeter / Ajouter au digest courant
- Bouton "Régénérer cover IA" (relance la génération avec un nouveau prompt si la première ne convient pas)
- Upload manuel d'image (drag & drop)

### 8.3 Vue épisode (NOUVELLE étape arbitrage)
**Avant génération du script** :
- Liste des synthèses de la semaine, cochables (par défaut toutes les `selected`)
- Champ recherche pour ajouter une synthèse de la KB ou un article scoré <0.7 pour ce digest spécifique
- Sélecteur **format** : dialogue / monologue
- Si monologue : sélecteur **narrateur** (Sophie / Martin)
- Sélecteur **durée** : 3 / 5 / 8 / 12 min
- Sélecteur **ton éditorial** : standard / flash_urgence / pedagogique / focus_specialite
- Estimation mots et durée projetée
- Bouton "Générer le script"

**Après génération** :
- Éditeur markdown du script avec preview audio tags surlignés
- Bouton "Régénérer" (si tu changes d'avis sur les paramètres)
- Bouton "Générer audio" (déclenche `generate_audio.py`)
- Player audio avec re-générer possible
- Bouton "Publier"

### 8.4 Vue Quiz
- Liste des questions news en attente (`news_synthesis_id` rempli, `is_daily_quiz_eligible = false`)
- Pour chaque question : preview question + options + feedback + source
- Boutons : Approuver pour quiz du jour / Éditer / Rejeter
- Filtres par spécialité, niveau de preuve, type de question
- Compteur "X questions news approuvées dans le pool"

### 8.5 Recherche Knowledge Base
- Full-text + filtres (spécialité, thèmes, niveau de preuve, catégorie éditoriale, année, journal)
- Recherche sémantique (toggle ON/OFF)
- Affichage covers en grille
- Lien direct vers fichier Markdown Google Drive

### 8.6 Ingestion manuelle
- Champ URL ou upload PDF pour ajouter un article ad hoc
- Extraction métadonnées tentée automatiquement (DOI, titre, auteurs, abstract)
- Champs manquants à compléter manuellement
- Bouton "Synthétiser" → bypass filtrage, passe direct synthèse + KB
- Option : "Inclure dans le digest courant" → ajoute à l'épisode en construction de la semaine

---

## 8bis. Knowledge Base réutilisable (mise à jour v1.3)

### 8bis.1 Périmètre (mis à jour)
Inchangé : articles retenus + articles ajoutés manuellement post-filtrage. Toutes les synthèses entrent en KB, qu'elles soient publiées ou non dans un épisode.

### 8bis.2 Tags v1.3 (étendu)
3 dimensions originales + nouveaux champs :
- `specialite` (vocabulaire fermé taxonomy news, **plus large que formations.category**)
- `themes` (semi-ouvert)
- `niveau_preuve` (fermé Oxford CEBM)
- `category_editorial` (NEW — fermé : reglementaire / scientifique / pratique / humour)
- `formation_category_match` (NEW — slug de `formations.category` ou NULL)
- `keywords_libres` (non filtrants)

### 8bis.3 Recherche
Full-text + sémantique + filtres combinés. Filtres v1.3 enrichis avec `category_editorial` et `formation_category_match`.

### 8bis.4 Export Google Drive Markdown — frontmatter étendu

```yaml
---
id: synth-2026-W17-001
doi: 10.1111/jcpe.12345
title: "..."
authors: [...]
journal: J Clin Periodontol
year: 2026
specialite: paro
themes: [greffe-gencive, recession-gingivale, esthetique]
niveau_preuve: rct
category_editorial: scientifique           # NEW
formation_category_match: parodontologie    # NEW (NULL si pas de match)
display_title: "Greffes vs tunnel : verdict 2026"   # NEW
cover_image_url: https://...                # NEW
cover_image_source: ai_generated            # NEW
source_episode: 2026-W17-digest
manual_added: false
keywords_libres: [tunnel, recouvrement-radiculaire]
url_source: https://doi.org/10.1111/jcpe.12345
archived_at: 2026-04-22
---
```

### 8bis.5 Rétention & suppression
Inchangé v1.2.

### 8bis.6 Gouvernance taxonomy
Inchangé v1.2 (à décider ultérieurement).

---

## 9. Budget mensuel consolidé v1.3

| Poste | Estimation |
|-------|------------|
| PubMed / Crossref / Semantic Scholar / OpenAlex / RSS | 0 € |
| Claude Haiku (filtrage ~500 articles/sem) | ~2 € |
| Claude Sonnet (synthèse + tags + quiz, ~15 articles/sem) | ~7 € |
| Claude Sonnet (génération scripts digest + insight) | ~3 € |
| OpenAI embeddings (KB sémantique) | <0,10 € |
| Génération cover images (Flux schnell ou DALL-E 3) | ~3 € |
| ElevenLabs Creator (100 min / mois) | 22 € |
| Supabase + Vercel (free tier) | 0 € |
| Google Drive API + Unsplash API | 0 € |
| **Total estimé** | **~37 €/mois** |

Marge de ~13 € sur le plafond de 50 €.

---

## 10. Roadmap d'implémentation v1.3

### Phase 1 — MVP texte + KB + quiz + covers (5 à 6 semaines)

**Tickets livrés**
- ✅ Ticket 1 — Schéma BDD initial
- ✅ Ticket 2 — Ingestion PubMed
- 🔄 Ticket 3 — Ingestion RSS (en cours)

**Tickets à livrer**
- Ticket 4 — Filtrage Claude Haiku
- Ticket 5 — Synthèse + tagging + embedding (base v1.2)
- **Ticket 5bis (NEW)** — Tagging étendu : category_editorial + formation_category_match
- Ticket 6 — Export Google Drive Markdown
- **Ticket 7 (RÉVISÉ)** — Génération script paramétrique (format/durée/narrateur/ton)
- Ticket 8 — Interface admin enrichie (arbitrage format, quiz validation, cover preview, ingestion manuelle, ajout digest courant)
- **Ticket 9 (NEW)** — Génération quiz (3-4 questions/synthèse, validation admin)
- **Ticket 10 (NEW)** — Génération cover image (cascade IA + Unsplash + manual)
- **Ticket 11 (NEW, indépendant)** — Wrapper batch audio formations Niveau 1 (cf addendum séparé)

### Phase 2 — Audio et publication (2 semaines)
Génération audio ElevenLabs, calibration, publication in-app.

### Phase 3 — Extension (continu)
Insights, sources élargies, gouvernance taxonomy, partage Google Drive, export RSS Spotify/Apple, upgrade formations Niveau 2 si désir.

---

## 11. Risques et mitigations
Inchangé v1.2, complété :

| Risque | Mitigation v1.3 |
|--------|-----------------|
| Qualité quiz LLM insuffisante (option fausse trop évidente, source absente) | Validation manuelle systématique avant approbation pour quiz du jour. Règle prompt strictement appliquée. |
| Cover IA hors sujet ou inappropriée | SVG auto par défaut (toujours OK), génération IA à la demande, override manuel possible, fallback Unsplash. |
| Pollution du pool quiz du jour si beaucoup de questions news non approuvées | `is_daily_quiz_eligible = false` par défaut, RPC inchangée (ne tire que les approuvées). |
| Confusion users entre questions news et formations dans le quiz du jour | Option future : badge visuel distinctif sur la question. À évaluer après lancement. |

---

## 12. Points ouverts restants

**Traités v1.3** :
- ✅ Catégorie éditoriale + alignement formation
- ✅ Cover image (cascade IA + fallback)
- ✅ Génération quiz pour pool quotidien
- ✅ Format/durée/narrateur/ton paramétriques
- ✅ Ajout manuel forcé dans digest

**Reportés** (à trancher ultérieurement) :
1. Circuit Conseil Scientifique
2. Partage Google Drive de la KB
3. Gouvernance taxonomy
4. Jingle / habillage sonore
5. Suppléance éditoriale en cas d'absence
6. Validation juridique des disclaimers
7. Création boîte mail `erratum@dentalschool.fr`
8. Pondération du pool quiz (formation vs news) si déséquilibre constaté

---

*Fin de spécification v1.3. Document complet, prêt pour implémentation des tickets 4-11. Voir `addendum_handoff_claude_code_v1_3.md` pour le plan de tickets actualisé et `addendum_formations_audio_batch_niveau1.md` pour le pipeline bonus formations.*
