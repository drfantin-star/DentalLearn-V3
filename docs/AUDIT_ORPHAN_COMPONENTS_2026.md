# Audit Orphan Components — 2026-05-13

> Lecture seule. Aucun changement de code. Pré-requis à l'étape 2 du design
> system (PR #265 a révélé que des migrations ont été appliquées à du code
> jamais rendu).

## 1. Synthèse executive

**Périmètre audité** : 93 fichiers `.tsx` (87 dans `src/components/`, 6 client
components dans `src/app/`), 94 composants exportés (un fichier peut exporter
plusieurs composants — ex. `SortableList.tsx` exporte `SortableList` +
`DragHandle`).

**Pages App Router exclues** (`page.tsx`, `layout.tsx`, etc.) : par définition
rendues par Next.js, hors scope d'un audit "code mort".

### Répartition

| Catégorie | Nb composants | Nb fichiers |
|---|---|---|
| 🟢 **Actif** (importé ET rendu) | 87 | 86 |
| 🟡 **Type-only** (le fichier sert pour ses types, le composant lui-même est orphan) | 0 composant — 1 fichier (`ThemeCard.tsx`) sert pour le type `Theme` exporté | 1 |
| 🔴 **Orphan** (jamais importé ni rendu) | 7 | 7 |
| ❓ **Ambigu** (détection dynamique, lazy load, map de composants) | 0 | 0 |

> Note : `src/components/ui/ThemeCard.tsx` est comptabilisé une fois (composant
> orphan). Le fichier reste **utile** car 3 fichiers en importent le type
> `Theme`. Si on supprime un jour le composant, **garder le type**.

### Top 3 zones avec code mort

1. **`src/components/home/`** — 4 orphans sur 11 fichiers (`FormationCard`,
   `GlobalProgressBars`, `NewsSection`, `TrainingCard`). Tous proviennent du
   prototype `docs/prototypes/home-v3.tsx` extrait en modules mais jamais
   branché — la home en prod (`src/app/(app)/page.tsx`) utilise une approche
   différente (`FormationCardOverlay`, etc.).
2. **`src/components/quiz/` + `src/components/news/`** — 2 orphans
   (`QuizModal`, `QuizActuModal`). Les seuls modaux de quiz utilisés en prod
   sont `DailyQuizModal` (home/) et le quiz du player de séquence.
3. **`src/components/ui/`** — 1 orphan (`ThemeCard` composant, fichier conservé
   pour le type `Theme`).

### 🚨 Découverte critique — Badge en orphan transitif

`src/components/ui/Badge.tsx` est techniquement "importé + rendu" (mes
critères naïfs le classent 🟢 Actif), mais **un examen détaillé montre que** :

- Ses 2 seuls imports proviennent de **fichiers orphans** (`ThemeCard.tsx`
  et `FormationCard.tsx`).
- Les 10 `<Badge>` JSX comptés dans `src/` incluent 8 occurrences dans
  `src/app/admin/news/[id]/page.tsx` qui utilisent une **fonction `Badge`
  locale** (déclarée ligne 319 du fichier) avec une API différente
  (`<Badge cls="...">` vs `<Badge variant="...">`).

→ **Le composant `Badge` du design system n'a actuellement aucun chemin de
rendu en production.** Les migrations de la PR #265 sont effectivement
inertes côté UI.

### Estimation : faut-il prévoir un ticket de nettoyage ?

**Oui, mais pas en urgence.** Le code mort identifié représente ~1 600 lignes
de TSX. Pas de risque fonctionnel — c'est juste du bruit qui :
1. Apparaît dans les recherches `grep` et les recommandations d'IA.
2. Sera modifié inutilement par les futures migrations design system
   (comme dans la PR #265).
3. Crée une dette de "lecture" : un nouveau dev qui ouvre
   `src/components/home/FormationCard.tsx` ne sait pas qu'il n'est jamais
   rendu.

Recommandation : **un ticket "cleanup-orphans" après l'étape 2** du design
system (pour ne pas perdre les sites de référence Badge avant les ayant
migrés sur les composants vraiment actifs).

---

## 2. Tableau complet

Tous les composants audités, triés par catégorie puis par chemin.

**Colonnes** :
- `imports val.` = imports de valeur (le composant lui-même)
- `imports type` = imports de type uniquement (`import type {...}` ou
  `import { type ... }`)
- `rendus JSX` = nombre de `<NomComposant>` trouvés dans `src/` hors fichier
  source

> Méthodologie : `grep -rE "import.*\bNAME\b.*from" src/` + `grep -rE
> "<NAME\b" src/`, en excluant le fichier source et les `import type`. Pas
> de détection dynamique : aucun usage de `React.lazy`, `next/dynamic`, ou
> map de composants n'a été trouvé dans le repo (vérifié par `grep -r`).

### 🟢 Actif (87 composants)

| Fichier | Composant | Export | imports val. | imports type | rendus JSX | Catégorie |
|---|---|---|---|---|---|---|
| `src/app/admin/news/sources/SourcesPageClient.tsx` | `SourcesPageClient` | named | 1 | 0 | 2 | 🟢 Actif |
| `src/app/admin/poc/enriched-player/[type]/[id]/EnrichedPlayerPocClient.tsx` | `EnrichedPlayerPocClient` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/app/admin/poc/extract-scenes/ExtractScenesClient.tsx` | `ExtractScenesClient` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/app/admin/poc/karaoke/KaraokePOCClient.tsx` | `KaraokePOCClient` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/app/admin/poc/whiteboard-templates/WhiteboardTemplatesPOCClient.tsx` | `WhiteboardTemplatesPOCClient` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/app/admin/timelines/[type]/[id]/TimelineEditorClient.tsx` | `TimelineEditorClient` | named | 2 | 0 | 2 | 🟢 Actif |
| `src/components/Confetti.tsx` | `Confetti` | default | 2 | 0 | 2 | 🟢 Actif |
| `src/components/MiniPlayer.tsx` | `MiniPlayer` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/PWAInstallBanner.tsx` | `PWAInstallBanner` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/PushNotificationToggle.tsx` | `PushNotificationToggle` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/admin/ImageUpload.tsx` | `ImageUpload` | default | 2 | 0 | 2 | 🟢 Actif |
| `src/components/admin/MediaUpload.tsx` | `MediaUpload` | default | 3 | 0 | 6 | 🟢 Actif |
| `src/components/admin/news/AudioPodcastBlock.tsx` | `AudioPodcastBlock` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/admin/news/QuestionApprovalButton.tsx` | `QuestionApprovalButton` | named | 2 | 0 | 2 | 🟢 Actif |
| `src/components/admin/news/QuestionsListPage.tsx` | `QuestionsListPage` | named | 2 | 0 | 2 | 🟢 Actif |
| `src/components/admin/news/RetryButton.tsx` | `RetryButton` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/admin/satisfaction/SatisfactionAggregatesTable.tsx` | `SatisfactionAggregatesTable` | both | 1 | 0 | 1 | 🟢 Actif (import multi-ligne) |
| `src/components/admin/satisfaction/VerbatimCard.tsx` | `VerbatimCard` | both | 1 | 0 | 1 | 🟢 Actif (import multi-ligne) |
| `src/components/admin/timeline-editor/CardContentEditor.tsx` | `CardContentEditor` | named | 3 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/ConceptsEditor.tsx` | `ConceptsEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/DirtyStateIndicator.tsx` | `DirtyStateIndicator` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/PublishToggleButton.tsx` | `PublishToggleButton` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/RegenerateConfirmModal.tsx` | `RegenerateConfirmModal` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/SceneEditor.tsx` | `SceneEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/SceneListSidebar.tsx` | `SceneListSidebar` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/SceneMetadataEditor.tsx` | `SceneMetadataEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/SceneTemplateEditor.tsx` | `SceneTemplateEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/SortableList.tsx` | `DragHandle` | named | 6 | 0 | 6 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/SortableList.tsx` | `SortableList` | named | 6 | 0 | 6 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/TimelinePreviewPanel.tsx` | `TimelinePreviewPanel` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/VersionsPanel.tsx` | `VersionsPanel` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/templates/CausalEditor.tsx` | `CausalEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/templates/ComparisonEditor.tsx` | `ComparisonEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/templates/FiguresEditor.tsx` | `FiguresEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/templates/FlowchartEditor.tsx` | `FlowchartEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/templates/GridEditor.tsx` | `GridEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/admin/timeline-editor/templates/TimelineTemplateEditor.tsx` | `TimelineTemplateEditor` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/attestations/GenerateAttestationButton.tsx` | `GenerateAttestationButton` | named | 2 | 0 | 2 | 🟢 Actif |
| `src/components/attestations/SatisfactionSurveyModal.tsx` | `SatisfactionSurveyModal` | both | 1 | 0 | 1 | 🟢 Actif |
| `src/components/audio-enriched/KaraokeTranscript.tsx` | `KaraokeTranscript` | named | 2 | 0 | 2 | 🟢 Actif (POC) |
| `src/components/audio-enriched/KaraokeWord.tsx` | `KaraokeWord` | named | 1 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/audio-enriched/SpeakerBadge.tsx` | `SpeakerBadge` | named | 1 | 0 | 1 | 🟢 Actif (POC) |
| `src/components/audio-enriched/StructuredWhiteboard.tsx` | `StructuredWhiteboard` | named | 3 | 0 | 8 | 🟢 Actif (POC) |
| `src/components/audio-enriched/templates/Causal.tsx` | `Causal` | named | 3 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/audio-enriched/templates/Comparison.tsx` | `Comparison` | named | 3 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/audio-enriched/templates/Figures.tsx` | `Figures` | named | 3 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/audio-enriched/templates/Flowchart.tsx` | `Flowchart` | named | 3 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/audio-enriched/templates/Grid.tsx` | `Grid` | named | 3 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/audio-enriched/templates/Recap.tsx` | `Recap` | named | 2 | 0 | 4 | 🟢 Actif (POC) |
| `src/components/audio-enriched/templates/Timeline.tsx` | `TimelineTemplate` | named | 3 | 0 | 3 | 🟢 Actif (POC) |
| `src/components/auth/CreateCabinetModal.tsx` | `CreateCabinetModal` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/auth/SiretCabinetForm.tsx` | `SiretCabinetForm` | default | 2 | 0 | 2 | 🟢 Actif (import multi-ligne) |
| `src/components/editorial/ValidationBadgeNews.tsx` | `ValidationBadgeNews` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/editorial/ValidationFooter.tsx` | `ValidationFooter` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/formateur/ComingSoonStub.tsx` | `ComingSoonStub` | default | 3 | 0 | 3 | 🟢 Actif |
| `src/components/formateur/EmptyStateNoFormations.tsx` | `EmptyStateNoFormations` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/formateur/FormateurShell.tsx` | `FormateurShell` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/formateur/FormationStatsCard.tsx` | `FormationStatsCard` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/formateur/KPICard.tsx` | `KPICard` | default | 1 | 0 | 4 | 🟢 Actif |
| `src/components/formation/AudioPlayer.tsx` | `AudioPlayer` | default | 2 | 0 | 6 | 🟢 Actif |
| `src/components/formation/EnrichedAudioPlayer.tsx` | `EnrichedAudioPlayer` | default | 1 | 0 | 8 | 🟢 Actif |
| `src/components/formation/FormationDetail.tsx` | `FormationDetail` | default | 3 | 0 | 3 | 🟢 Actif |
| `src/components/formation/SequencePlayer.tsx` | `SequencePlayer` | default | 3 | 0 | 3 | 🟢 Actif |
| `src/components/home/DailyQuizButton.tsx` | `DailyQuizButton` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/home/DailyQuizModal.tsx` | `DailyQuizModal` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/home/DemarcheCard.tsx` | `DemarcheCard` | default | 2 | 0 | 2 | 🟢 Actif |
| `src/components/home/FormationCardOverlay.tsx` | `FormationCardOverlay` | default | 4 | 0 | 4 | 🟢 Actif |
| `src/components/home/JournalDetailModal.tsx` | `JournalDetailModal` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/home/JournalWeekCard.tsx` | `JournalWeekCard` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/home/StatsCards.tsx` | `StatsCards` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/layout/BottomNav.tsx` | `BottomNav` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/leaderboard/LeaderboardPanel.tsx` | `LeaderboardPanel` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/news/AudioQueuePlayer.tsx` | `AudioQueuePlayer` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/news/NewsCardItem.tsx` | `NewsCardItem` | default | 2 | 0 | 2 | 🟢 Actif |
| `src/components/news/NewsCardSVG.tsx` | `NewsCardSVG` | default | 1 | 0 | 2 | 🟢 Actif |
| `src/components/news/NewsModal.tsx` | `NewsModal` | default | 2 | 0 | 2 | 🟢 Actif |
| `src/components/news/NewsRecapCard.tsx` | `NewsRecapCard` | named | 1 | 0 | 3 | 🟢 Actif |
| `src/components/news/NewsVisualSequence.tsx` | `NewsVisualSequence` | named | 1 | 0 | 7 | 🟢 Actif |
| `src/components/profile/RadarCP.tsx` | `RadarCP` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/profile/attestations/AttestationCard.tsx` | `AttestationCard` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/profile/attestations/AttestationEmptyState.tsx` | `AttestationEmptyState` | named | 1 | 0 | 1 | 🟢 Actif |
| `src/components/satisfaction/ColdSurveyEligibilityBadge.tsx` | `ColdSurveyEligibilityBadge` | both | 1 | 0 | 1 | 🟢 Actif |
| `src/components/sequences/TreasureChest.tsx` | `TreasureChest` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/shared/ThemeDetail.tsx` | `ThemeDetail` | default | 2 | 0 | 2 | 🟢 Actif |
| `src/components/tenant/TenantShell.tsx` | `TenantShell` | default | 1 | 0 | 1 | 🟢 Actif |
| `src/components/ui/Badge.tsx` | `Badge` | default | 2 | 0 | 2 | 🟢 Actif **mais transitif** ⚠️ (voir §5) |
| `src/components/ui/FilterTabs.tsx` | `FilterTabs` | default | 1 | 0 | 1 | 🟢 Actif |

> Note `Badge` : la colonne "rendus JSX" indique 2 (les renderings depuis
> `ThemeCard.tsx` et `FormationCard.tsx`). 8 autres tags `<Badge>` existent
> dans `src/app/admin/news/[id]/page.tsx` mais réfèrent à une fonction
> `Badge` **locale** définie dans ce même fichier (ligne 319), pas au
> composant `@/components/ui/Badge`. Donc le Badge du design system n'a
> aucun chemin de rendu effectif (voir §5).

### 🔴 Orphan (7 composants)

| Fichier | Composant | Export | imports val. | imports type | rendus JSX | Note |
|---|---|---|---|---|---|---|
| `src/components/home/FormationCard.tsx` | `FormationCard` | default | 0 | 0 | 0 | Type `FormationEnCours` également exporté mais non importé ailleurs |
| `src/components/home/GlobalProgressBars.tsx` | `GlobalProgressBars` | default | 0 | 0 | 0 | |
| `src/components/home/NewsSection.tsx` | `NewsSection` | default | 0 | 0 | 0 | |
| `src/components/home/TrainingCard.tsx` | `TrainingCard` | default | 0 | 0 | 0 | ⚠️ Annoncé "actif" dans PR #265 mais en réalité orphan |
| `src/components/news/QuizActuModal.tsx` | `QuizActuModal` | default | 0 | 0 | 0 | |
| `src/components/quiz/QuizModal.tsx` | `QuizModal` | default | 0 | 0 | 0 | |
| `src/components/ui/ThemeCard.tsx` | `ThemeCard` | default | 0 | 3 (type) | 0 | Fichier conservé : le type `Theme` est importé par 3 fichiers actifs |

---

## 3. Focus "5 sites Étape 2" (PR #265)

PR #265 listait 5 sites comme candidats à migrer vers `<Badge>` après extension
du composant. Vérification de leur état réel :

| # | Site (PR #265) | Fichier | Importé ? | Rendu JSX ? | Statut |
|---|---|---|---|---|---|
| 1 | CP violet sur FormationCard | `src/components/home/FormationCard.tsx` (lignes 31-35) | ❌ 0 imports | ❌ 0 renders | 🔴 **Orphan** (déjà identifié par PR #265) |
| 2 | Badges CP/Bonus sur ThemeDetail | `src/components/shared/ThemeDetail.tsx` (lignes 220-230) | ✅ 2 imports | ✅ 2 renders (`(app)/patient/page.tsx`, `(app)/sante/page.tsx`) | 🟢 **Actif** |
| 3 | Badge sur liste formations | `src/app/(app)/formation/page.tsx:57` | N/A (page Next.js) | ✅ rendu (page App Router) | 🟢 **Actif** |
| 4 | Badges catégorie news | `src/components/news/NewsCardItem.tsx` | ✅ 2 imports | ✅ 2 renders (`(app)/page.tsx`, `(app)/news/page.tsx`) | 🟢 **Actif** |
| 5 | Badge "+1 pt" / icône sur TrainingCard | `src/components/home/TrainingCard.tsx` | ❌ 0 imports | ❌ 0 renders | 🔴 **Orphan** ⚠️ |

### Conséquences pour l'étape 2

- **3 sites sur 5 sont effectivement actifs** (ThemeDetail, formation/page,
  NewsCardItem). Ce sont eux qu'il faut migrer pour avoir un impact UI réel.
- **2 sites sur 5 sont orphans** (FormationCard ✅ PR le savait, TrainingCard
  ⚠️ pas mentionné comme orphan dans la PR). Décision à prendre :
  - Soit migrer quand même comme "reference pattern" (option PR #265),
  - Soit **ne pas migrer** et les supprimer du backlog étape 2.
  - **Recommandation** : ne pas migrer ; le pattern de référence existe déjà
    dans `FormationCard.tsx` après PR #265. Ajouter un `TrainingCard` migré
    n'apporte rien — pire, ça gonfle artificiellement le ratio "sites
    migrés".

### Implication pour le scope étape 2

Étape 2 telle qu'annoncée (« extension Badge + migration 5 sites ») devient
en pratique : **extension Badge + migration 3 sites** (ThemeDetail,
formation/page, NewsCardItem). Pour atteindre un volume de migration plus
visible, il faudra élargir le scope à d'autres usages de badges hors les
5 sites originaux (cf. zones admin avec local `Badge` à API `cls`).

---

## 4. Liste des orphans détaillée

Tous les orphans ont été créés via le **même gros commit `d491c8c`** du
2026-05-02 (« T10-A — supprimer useNews orphelin home »), qui était en fait
un import massif de fichiers (≈ 30+ pages, lib, composants) plutôt qu'un
ménage. Le contexte temporel est cohérent : ces composants vivent en
dormance dans le repo depuis cette date (~11 jours au moment de l'audit).

### `src/components/home/FormationCard.tsx`

- **Créé le** 2026-05-02 (commit `d491c8c`)
- **Hypothèse** : extrait du prototype `docs/prototypes/home-v3.tsx`
  (qui contient une `CurrentFormationCard` inline). En prod, remplacé par
  `FormationCardOverlay.tsx` (utilisé dans `(app)/page.tsx`, `DemarcheCard`,
  `ThemeDetail`). Décision design d'utiliser l'overlay sur image plutôt
  qu'une carte autonome avec badges.
- **Collision de nom** : `src/app/(app)/formation/page.tsx:39` redéclare
  localement `function FormationCard(...)` avec une signature différente.
  L'orphan partage le nom mais pas l'API.

### `src/components/home/GlobalProgressBars.tsx`

- **Créé le** 2026-05-02 (commit `d491c8c`)
- **Hypothèse** : extrait du prototype (`docs/prototypes/home-v3.tsx`
  contient un `GlobalProgressBars` inline). Affichait les barres de
  progression par axe. La home actuelle (`(app)/page.tsx`) ne montre pas
  de barres de progression — elle utilise un layout par "section" avec
  cartes overlay. Composant abandonné.

### `src/components/home/NewsSection.tsx`

- **Créé le** 2026-05-02 (commit `d491c8c`)
- **Hypothèse** : section "News" extraite du prototype. En prod, la home
  utilise une approche carrousel de `NewsCardItem` directement dans
  `(app)/page.tsx` (cf. lignes 254-294 du fichier), sans wrapper `NewsSection`.

### `src/components/home/TrainingCard.tsx`

- **Créé le** 2026-05-02 (commit `d491c8c`)
- **Hypothèse** : carte "formation en cours / à reprendre" du prototype.
  Remplacée en prod par `FormationCardOverlay` qui fait le même job avec
  une UX différente (image fond + overlay au lieu d'une carte plate).

### `src/components/news/QuizActuModal.tsx`

- **Créé le** 2026-05-02 (commit `871f895` — "T9B-4-fix — carrousel news
  remonté sous Quiz du jour")
- **Hypothèse** : modal "quiz d'actualité" prévu côté news. Jamais branché.
  Le seul quiz du jour utilisé en prod est `DailyQuizModal` (importé une
  fois dans `(app)/page.tsx`). Hypothèse non vérifiable sans demander :
  POC abandonné ou en attente d'activation ?

### `src/components/quiz/QuizModal.tsx`

- **Créé le** 2026-05-02 (commit `d491c8c`)
- **Hypothèse** : modal de quiz générique. `DailyQuizModal` (home) et le
  player de séquence (`SequencePlayer`) gèrent leurs quiz en interne.
  Aucune entrée n'appelle ce modal. Hypothèse : POC abandonné en faveur
  d'implémentations spécialisées.

### `src/components/ui/ThemeCard.tsx`

- **Créé le** 2026-05-02 (commit `d491c8c`)
- **Hypothèse** : carte "thème" pour une page d'index thèmes. En prod,
  la navigation par thème se fait via `(app)/sante/page.tsx`,
  `(app)/patient/page.tsx` etc., qui appellent directement `ThemeDetail`
  sans passer par une carte de sélection. Le composant `ThemeCard` n'a
  jamais été branché, **mais le type `Theme` (et `ThemeContent`) qu'il
  exporte sont utilisés par 3 fichiers actifs** :
  - `src/components/shared/ThemeDetail.tsx:7`
  - `src/app/(app)/patient/page.tsx:7`
  - `src/app/(app)/sante/page.tsx:8`
  → **Le fichier doit être conservé** (ou les types déplacés ailleurs).

---

## 5. Recommandations

### 5.1 Cas particulier : `Badge` (orphan transitif)

Le composant `src/components/ui/Badge.tsx` n'est ni complètement orphan ni
complètement actif :

| Métrique | Valeur | Détail |
|---|---|---|
| Imports `@/components/ui/Badge` | 2 | `ThemeCard.tsx` (orphan), `FormationCard.tsx` (orphan) |
| JSX `<Badge>` ciblant ce module | 2 | Idem (les 2 fichiers orphans) |
| JSX `<Badge>` ciblant une fonction locale | 8 | `src/app/admin/news/[id]/page.tsx` redéfinit `function Badge({ cls, children })` ligne 319 |

→ Le Badge du design system est **transitivement orphan** (importé
uniquement par du code mort).

**Recommandation** :
- Ne pas supprimer le composant (c'est la fondation du design system).
- L'étape 2 doit **migrer en premier les 3 sites actifs** identifiés
  (ThemeDetail, formation/page, NewsCardItem) pour donner au Badge un
  vrai chemin de rendu.
- Considérer la fonction `Badge` locale de `admin/news/[id]/page.tsx`
  comme une 4ᵉ cible de migration (8 occurrences au même endroit, gros
  ROI). Migrer cela suppose d'ajouter au Badge une prop `className`
  passthrough ou des variants couleur supplémentaires.

### 5.2 Composants à garder en orphan

| Composant | Pourquoi le garder |
|---|---|
| `src/components/ui/ThemeCard.tsx` | Le type `Theme` est importé par 3 fichiers actifs. **Garder le fichier ; supprimer éventuellement le composant et garder uniquement les types** (ou les déplacer dans `src/types/`). |
| `src/components/home/FormationCard.tsx` | **Vient d'être migré par PR #265 comme "reference pattern" pour le Badge.** Statut "à valider avec Julie" : on garde comme référence ou on supprime parce que la PR #265 elle-même a contribué à mettre la décision sur la table ? Voir §5.4. |

### 5.3 Composants candidats à suppression

Dette pure, pas de raison technique de garder.

| Composant | Raison |
|---|---|
| `src/components/home/GlobalProgressBars.tsx` | Approche abandonnée (pas de barres de progression dans la home actuelle) |
| `src/components/home/NewsSection.tsx` | Doublonne le rendu inline news dans `(app)/page.tsx` |
| `src/components/home/TrainingCard.tsx` | Remplacé fonctionnellement par `FormationCardOverlay` |
| `src/components/quiz/QuizModal.tsx` | Doublon de `DailyQuizModal` / quiz du séquence player |
| `src/components/news/QuizActuModal.tsx` | Doublon de `DailyQuizModal`. À confirmer s'il s'agit d'un POC en attente d'activation. |

**Volume à supprimer** : ~5 fichiers (~1 500 lignes TSX, ordre de grandeur).

### 5.4 Composants ambigus — à valider avec Julie

Pas d'ambiguïté technique au sens de "détection dynamique" — le repo
n'utilise ni `React.lazy`, ni `next/dynamic`, ni map de composants par
string. Les ambiguïtés sont **organisationnelles** :

1. **`FormationCard.tsx` après PR #265** — La PR a explicitement migré ce
   fichier comme "pattern de référence". Doit-on :
   - (a) Conserver comme catalogue de référence (mais alors documenter
     formellement le statut "non rendu — référence design system seulement"
     en tête de fichier),
   - (b) Supprimer (la PR a tout de même servi à valider la méthodo
     `<Badge variant="...">`, le pattern existe en `git log`),
   - (c) Brancher le composant quelque part (ex. revoir la décision design
     "pas de carte CP violette" qui a conduit à privilégier
     `FormationCardOverlay`).

2. **`QuizActuModal.tsx`** — Nom suggère un modal de quiz d'actualité
   distinct de `DailyQuizModal`. Question : prévu pour une fonctionnalité
   à venir ou doublon abandonné ?

3. **`ThemeCard.tsx` composant** — Le type `Theme` est utilisé, mais le
   composant `ThemeCard` lui-même ne l'est pas. Soit on supprime le
   composant en gardant le fichier pour les types, soit on déplace les
   types dans `src/types/` et on supprime le fichier entier.

### 5.5 Ordre de bataille proposé

1. **Étape 2 design system** : étendre Badge et migrer les **3 sites actifs**
   uniquement. Bonus : migrer la fonction `Badge` locale de
   `admin/news/[id]/page.tsx`.
2. **Ticket "cleanup orphans"** (post-étape 2) : supprimer les 5 fichiers
   sans valeur (§5.3), traiter `ThemeCard` (déplacer le type ou
   simplifier), et décider du sort de `FormationCard.tsx`.
3. **Aucun changement à entreprendre sur les zones POC** (`audio-enriched/`,
   `admin/timeline-editor/`) — toutes leurs composantes sont actives entre
   elles ; le rendu en production se fait via les pages POC (`admin/poc/...`,
   `admin/timelines/...`).

---

## Annexe — Méthodologie & sanity checks

### Méthode

Script `bash` qui pour chaque `.tsx` du périmètre :
1. Extrait les noms de composants exportés (`export default function X`,
   `export function X`, `export const X`).
2. Pour chaque nom, compte :
   - `grep -rE "import.*\bNAME\b.*from" src/` (hors fichier source)
   - Sépare les lignes contenant `import type` ou `import { type` →
     comptés comme "imports type"
   - `grep -rE "<NAME\b" src/` (hors fichier source) → "rendus JSX"

### Limites & corrections appliquées

- **Imports multi-lignes** : `grep` ligne-à-ligne rate les imports
  multi-lignes où le nom du composant est sur une ligne distincte de
  `import` et `from`. 3 composants détectés à tort comme
  `RENDERED_NO_IMPORT` (`SatisfactionAggregatesTable`, `VerbatimCard`,
  `SiretCabinetForm`) ont été re-vérifiés manuellement : tous **actifs**,
  reclassés 🟢.
- **Fonction locale homonyme** : 8 occurrences `<Badge>` dans
  `admin/news/[id]/page.tsx` réfèrent à un `function Badge` local, pas au
  composant du design system. Conséquence détaillée en §5.1.
- **Détection dynamique** : `grep -r "React.lazy\|next/dynamic\|loadable"
  src/` → 0 résultat. Aucun composant ne peut être chargé dynamiquement
  par un mécanisme que mon audit aurait raté.

### Sanity checks effectués

**3 composants ACTIVE vérifiés manuellement** :
- `BottomNav` → importé/rendu dans `(app)/layout.tsx:1,35` ✅
- `Confetti` → importé/rendu dans `quiz/QuizModal.tsx` ET
  `home/DailyQuizModal.tsx` ✅
- `FormationCardOverlay` → importé/rendu dans `(app)/page.tsx`,
  `home/DemarcheCard.tsx`, `shared/ThemeDetail.tsx` ✅

**3 composants ORPHAN vérifiés manuellement** :
- `TrainingCard` → `grep -rwn TrainingCard src/` = 0 hit hors fichier source ;
  pas de référence dans `tests/`, `scripts/`, `docs/` (sauf le prototype) ✅
- `QuizModal` → `grep -rwn QuizModal src/` = 0 hit hors fichier source ;
  seul quiz modal utilisé = `DailyQuizModal` ✅
- `NewsSection` → `grep -rwn NewsSection src/` = 0 hit hors fichier source ;
  pas de référence string non plus ✅

### État du repo

- `npm install` → succès (460 paquets)
- `npm run build` → `✓ Compiled successfully`. Le type-check passe. Le job
  s'arrête ensuite en sortie 1 sur des erreurs **SSG** (`cookies()` dans
  routes API, variables Supabase absentes faute de `.env.local`). C'est la
  **même condition pré-existante** documentée dans la PR #265 — non liée à
  cet audit (qui ne modifie aucun code).
- Aucune modification de code faite dans cet audit. L'état du repo est
  strictement identique à `main` à la création de la branche
  `claude/audit-orphan-components`, à l'exception du présent document.
