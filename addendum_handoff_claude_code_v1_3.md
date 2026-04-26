# Addendum Handoff Claude Code — v1.3
## Mises à jour du plan de tickets pour la spec v1.3

**Document de référence** : `spec_news_podcast_pipeline_v1_3.md`
**Document parent** : `handoff_claude_code_v1_2.md` (la version modifiée par Dr Fantin)
**Date** : 26 avril 2026

Ce document **ne remplace pas** le handoff v1.2 — il en complète et corrige certains tickets. À lire en parallèle.

---

## 0. État d'avancement (au 26/04/2026)

- ✅ Ticket 1 — Schéma BDD Supabase (tables `news_*` créées)
- ✅ Ticket 2 — Ingestion PubMed
- 🔄 Ticket 3 — Ingestion RSS (en cours)
- ⏳ Ticket 4 — Filtrage Claude Haiku (non commencé)
- ⏳ Tickets 5 à 11 — non commencés

**Important** : les Tickets 1, 2 et 3 ne sont pas impactés par v1.3. Tu peux continuer Ticket 3 puis enchaîner Ticket 4 sans attendre.

---

## 1. Migrations BDD additionnelles à appliquer

Trois nouvelles migrations à créer (cf §5.2 spec v1.3) :

| Fichier migration | Objet |
|-------------------|-------|
| `0010_news_v1_3_episodes_format.sql` | Colonnes `format`, `narrator`, `target_duration_min`, `editorial_tone` sur `news_episodes` |
| `0011_news_v1_3_syntheses_categories_cover.sql` | Colonnes `category_editorial`, `formation_category_match`, `display_title`, `cover_image_url`, `cover_image_source` sur `news_syntheses` + index |
| `0012_news_v1_3_questions_link.sql` | Colonne `news_synthesis_id` sur `questions` + contrainte `questions_source_check` + index |

**Quand les appliquer** : avant le Ticket 5 (synthèse), au plus tard. Migrations idempotentes, scripts `_down.sql` correspondants à fournir.

**Précaution** : la migration sur `questions` touche une table en production avec 374 lignes existantes. Le script :
- N'ajoute QUE des colonnes nullables et une contrainte `CHECK` qui sera satisfaite par les données existantes (toutes ont `sequence_id is not null`)
- Ne change PAS le default de `is_daily_quiz_eligible`
- À tester sur branch Supabase (`create_branch` MCP) avant merge

---

## 2. Variables d'environnement supplémentaires

À ajouter dans `.env.local` (en plus de celles du handoff v1.2) :

```bash
# Génération covers IA — cascade
REPLICATE_API_TOKEN=r8_...                     # pour Flux schnell (recommandé, ~0,003 $/image)
# OU
OPENAI_DALLE_API_KEY=sk-...                    # même clé que OPENAI_API_KEY, pour DALL-E 3 (~0,04 $/image)

# Fallback images photographiques
UNSPLASH_ACCESS_KEY=...                        # https://unsplash.com/developers (gratuit, 50 req/h ou plus avec compte dev)

# Bucket Supabase Storage covers
SUPABASE_STORAGE_BUCKET_COVERS=news-covers     # à créer côté Supabase Studio si pas déjà fait
```

**À choisir** : Replicate Flux schnell (15× moins cher) ou DALL-E 3 (légèrement meilleure qualité photoréaliste). Recommandation Phase 1 : Flux schnell. À ré-évaluer après une dizaine de générations.

---

## 3. Tickets révisés et nouveaux

### Ticket 5 — Synthèse + tagging + embedding (RÉVISÉ v1.3)

**Modif par rapport à v1.2** : le prompt LLM produit désormais en un seul appel **synthèse + tags 3D + tagging éditorial + display_title + 3-4 questions quiz + embedding**.

**Tâches mises à jour**
- Edge Function Deno `synthesize_articles`
- Modèle `claude-sonnet-4-6`, output JSON strict
- Schéma JSON : ajout `category_editorial`, `formation_category_match`, `display_title`, `quiz` (array de 3-4 questions au format compatible `questions.options` JSONB)
- Lecture en contexte de prompt : taxonomy news + liste des 28 slugs `formations.category` + liste des 4 valeurs `category_editorial`
- Génération embedding via OpenAI `text-embedding-3-small`
- Insertion `news_syntheses` (1 ligne)
- **Insertion `questions` (3-4 lignes)** avec `news_synthesis_id` rempli, `sequence_id` null, `is_daily_quiz_eligible = false`
- Cron lundi 20h00

**Critères d'acceptation enrichis**
- [ ] Tous les tags (specialite, themes, niveau_preuve, category_editorial, formation_category_match) appartiennent aux listes fournies
- [ ] `formation_category_match` est NULL si pas de correspondance, sinon égal à un slug de `formations.category`
- [ ] Embedding stocké, recherche `<=>` opérationnelle
- [ ] Questions générées respectent le format JSONB `questions.options` (vérifier sur 5 échantillons)
- [ ] `is_daily_quiz_eligible = false` sur 100 % des questions news en sortie de pipeline
- [ ] `feedback_correct = feedback_incorrect` toujours
- [ ] Source citée dans tous les feedbacks

---

### Ticket 6 — Export Google Drive Markdown (mise à jour mineure)

Ajout au frontmatter YAML : `category_editorial`, `formation_category_match`, `display_title`, `cover_image_url`, `cover_image_source`. Aucun autre changement.

---

### Ticket 7 — Génération script paramétrique (RÉVISÉ v1.3)

**Modif majeure** : la fonction n'est plus déclenchée par cron mardi 08h00. Elle est déclenchée **manuellement** par Dr Fantin via l'admin (bouton "Générer le script") après arbitrage des paramètres format/durée/narrateur/ton.

**Tâches mises à jour**
- Edge Function Deno `generate_episode_script` (callable via HTTP POST avec auth admin)
- Inputs : `synthesis_ids[]`, `format`, `narrator`, `target_duration_min`, `editorial_tone`
- Calcul cible mots = target_duration_min × 150
- Sélection du prompt selon `format` (dialogue ou monologue) — cf §6.6 spec v1.3
- Pour monologue : préfixe `Sophie:` ou `Martin:` selon `narrator`, mais une seule personne parle
- Insertion `news_episodes` avec tous les paramètres conservés, status='draft'
- Cron mardi 08h00 SUPPRIMÉ (remplacé par notification admin "Pipeline prêt à scripter")

**Critères d'acceptation**
- [ ] Format dialogue : alternance Sophie/Martin systématique
- [ ] Format monologue : préfixe unique respecté
- [ ] Compatible parsing `generate_audio.py` (test CI sur 1 script échantillon par variante)
- [ ] Longueur ± 10 % de la cible
- [ ] Audio tags présents et dosés
- [ ] Toutes les sources citées (auteurs + journal + année)

---

### Ticket 8 — Interface admin "News Editor" (RÉVISÉ v1.3)

**Modif majeure** : l'admin devient le centre névralgique d'arbitrage humain. Beaucoup plus riche que la v1.2.

**Tâches mises à jour**
- Page `/admin/news` rôle admin
- **Dashboard hebdo** avec compteurs pipeline (cf §8.1 spec)
- **Vue article** enrichie (cf §8.2) : tags éditables, lien cross-merch formation, cover preview, régénération cover, upload manuel
- **Vue épisode arbitrage** (NOUVELLE — cf §8.3) : sélecteurs format / narrateur / durée / ton, cochage des synthèses, ajout depuis KB ou articles <0.7, estimation mots/durée, bouton "Générer le script"
- **Vue Quiz** (NOUVELLE — cf §8.4) : approbation des questions news pour le pool quotidien, filtres
- **Recherche KB** (cf §8.5) : full-text + sémantique + filtres + grille covers
- **Ingestion manuelle** (cf §8.6) : URL/PDF + bouton "Inclure dans le digest courant"

**Critères d'acceptation**
- [ ] Toutes les sections fonctionnelles
- [ ] Aucune ligne `localStorage` / `sessionStorage` (CI grep)
- [ ] Responsive mobile (validation depuis iPhone/iPad)
- [ ] Recherche KB renvoie résultats sur 10 requêtes-test
- [ ] Génération script depuis l'UI fonctionne pour les 4 combinaisons format × narrator
- [ ] Approbation quiz : passage `is_daily_quiz_eligible` à `true` puis vérification que la question apparaît dans le pool `get_daily_quiz`

---

### Ticket 9 (NOUVEAU) — Génération et validation des quiz

**Note** : la génération est intégrée au Ticket 5 (un seul appel LLM par article). Ce ticket couvre la **partie validation** côté admin et le **monitoring du pool quotidien**.

**Objectif** : permettre à Dr Fantin d'approuver / éditer / rejeter les questions quiz issues des synthèses news, et garantir l'équilibre du pool de questions du quiz du jour.

**Tâches**
- UI admin "Vue Quiz" (cf Ticket 8)
- Endpoint API `/api/admin/news-questions/{id}/approve` qui passe `is_daily_quiz_eligible` à `true`
- Endpoint API `/api/admin/news-questions/{id}/reject` qui delete la ligne
- Endpoint API `/api/admin/news-questions/{id}` (PATCH) pour édition manuelle
- Vue dashboard : compteur "X questions news approuvées dans le pool" + ratio formation/news pour monitoring
- Documentation pour Dr Fantin : critères de validation (toutes les options plausibles, source bien citée, niveau de difficulté pertinent pour quiz quotidien)

**Critères d'acceptation**
- [ ] Approbation déclenche bien l'apparition dans `get_daily_quiz`
- [ ] Rejet supprime la question proprement (ON DELETE SET NULL sur `news_synthesis_id`)
- [ ] Édition respecte le schéma JSONB `options`
- [ ] Pas de question news avec `is_daily_quiz_eligible = true` sans validation explicite Dr Fantin

---

### Ticket 10 (NOUVEAU) — Génération cover image en cascade

**Objectif** : produire automatiquement une cover image pour chaque synthèse, selon la cascade SVG → IA → Unsplash → upload manuel.

**Tâches**
- **Composant front** `<NewsCover>` qui génère un SVG inline à partir de `(category_editorial, specialite, display_title)` — affiché par défaut sans appel API. Palette de gradients prédéfinie alignée sur les axes CP existants.
- **Edge Function `generate_cover_image_ai`** (callable depuis admin via bouton "Générer cover IA") :
  - Construction du prompt à partir de la fiche synthèse
  - Appel Replicate Flux schnell (modèle par défaut) ou DALL-E 3 si configuré
  - Téléchargement de l'image générée, redimensionnement à 1200×630 (Open Graph standard)
  - Upload Supabase Storage `news-covers/YYYY-Www/{synthesis_id}.png`
  - Mise à jour `news_syntheses.cover_image_url` et `cover_image_source = 'ai_generated'`
- **Edge Function `generate_cover_image_unsplash`** (fallback automatique si IA échoue 2 fois) :
  - Recherche Unsplash par `keywords_libres` (orientation paysage)
  - Sélection 1ère image, téléchargement, upload Supabase Storage
  - `cover_image_source = 'unsplash'` + crédit photographe en métadonnée (obligation Unsplash)
- **Endpoint upload manuel** : drag&drop dans l'admin, validation type/taille image, upload Supabase Storage, `cover_image_source = 'manual_upload'`

**Critères d'acceptation**
- [ ] SVG par défaut s'affiche pour 100 % des synthèses sans appel API
- [ ] Génération IA fonctionne pour les 12 spécialités (test sur échantillon de 12 synthèses)
- [ ] Fallback Unsplash déclenché correctement
- [ ] Upload manuel valide les contraintes (max 5 Mo, formats jpg/png/webp)
- [ ] Crédit photographe Unsplash visible quelque part (footer image ou metadata)
- [ ] Coût mensuel mesuré <5 € sur le premier mois

---

### Ticket 11 (NOUVEAU, indépendant) — Wrapper batch audio formations (Niveau 1)

**Voir document séparé** : `addendum_formations_audio_batch_niveau1.md` (specs détaillées).

**Indépendance** : ce ticket peut être réalisé en parallèle des tickets news par un autre dev, ou par Claude Code en parallèle de Ticket 5/6/7. Aucune dépendance sur le pipeline news.

---

## 4. Contraintes additionnelles v1.3

En complément des 10 contraintes du handoff v1.2 :

11. **Ne JAMAIS modifier le default de `questions.is_daily_quiz_eligible`** — reste à `true`. Pour les questions news, l'INSERT positionne explicitement `false`.
12. **Aucun script de génération automatique d'épisode** — la génération du script `news_episodes` doit toujours être déclenchée manuellement par Dr Fantin depuis l'admin (suppression du cron mardi 08h00 prévu en v1.2).
13. **Cover SVG par défaut sans appel réseau** — aucun fetch externe au montage. Le SVG est généré côté client à partir des champs synthèse.
14. **Crédit Unsplash obligatoire** si une image Unsplash est servie — affichage du nom du photographe (CGU Unsplash).
15. **Tests CI sur le format script** — un script `lint_episode_format.py` doit valider que les outputs respectent le format `Sophie:` / `Martin:` (cf `parse_dialogue` de `generate_audio.py`) avant tout merge sur Ticket 7.

---

## 5. Workflow de review (inchangé v1.2)

Un PR par ticket, validation Dr Fantin avant merge, pas de deploy avant validation ticket suivant.

---

## 6. Questions résiduelles à trancher avant Ticket 7

Pour rappel (cf §12 spec v1.3), les points reportés ne bloquent pas Phase 1. À traiter au fil de l'eau.

---

*Fin de l'addendum v1.3. Lire en parallèle avec `handoff_claude_code_v1_2.md` (modifié par Dr Fantin) et `spec_news_podcast_pipeline_v1_3.md`.*
