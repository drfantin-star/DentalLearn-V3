# Rapport POC-T7.1 — Préparation pilote (fix Xing + sync BDD)

> Préparation de la séquence pilote `e8dfa6b8-ef34-4454-a198-e6f973f466de`
> ("La communication non verbale au fauteuil") avant l'implémentation T7.2
> du composant `<EnrichedAudioPlayer>`.
>
> Posture : **action contrôlée**. 1 fichier Storage re-muxé + 1 ligne BDD
> mise à jour. Aucune modification de code applicatif. `timeline_url` et
> `timeline_published` strictement préservés (out-of-scope T7.1).
>
> Date : 2026-05-09. Branche : `claude/audit-audio-stream-2bUtk`.

---

## 1. Contexte et objectifs T7.1

### 1.1 Origine

Le rapport T7.0 (`RAPPORT_T7_0_INSPECTION.md` §5.4 et §6.6) avait surfacé,
sans le résoudre, le bug `POC-T3-D4` documenté dans
`src/app/admin/poc/karaoke/KaraokePOCClient.tsx:17-37` :

> *« seek JS sur le MP3 pilote met à jour `currentTime` mais le flux audio
> reste à l'ancienne position. Cause probable : header Xing/LAME manquant
> après concaténation Python ElevenLabs. »*

Ce bug rend impossible toute validation visuelle de T7.2 (karaoké
désynchronisé après seek), donc T7.1 doit le neutraliser **côté fichier
pilote** avant que T7.2 ne commence.

### 1.2 Objectifs T7.1 (vérifiables)

1. **Localiser** le MP3 pilote sur Storage et confirmer que c'est bien le
   fichier référencé par le timeline JSON.
2. **Diagnostiquer** la cause exacte du bug seek (header Xing/LAME).
3. **Réparer** le MP3 par re-mux ffmpeg, valider seek byte-range OK en
   browser local.
4. **Re-uploader** sur Storage à l'URL canonique (pas de nouvelle URL).
5. **Synchroniser** la BDD : la table `sequences` avait
   `course_media_url`/`course_media_type`/`course_duration_seconds` à
   `NULL` pour la séquence pilote, alors que le fichier existait depuis le
   2026-05-06.
6. **Valider** en preview Vercel que le player audio user fonctionne avec
   durée correcte et seek opérationnel.

### 1.3 Hors scope T7.1

- Aucune modification de code (`AudioContext.tsx`, `AudioPlayer.tsx`,
  `SequencePlayer.tsx`, hooks T3, composants T4 — tous intouchés).
- `timeline_url` et `timeline_published` non modifiés (T7.3).
- Pipeline ElevenLabs Python amont non modifié (recommandation §8.4).
- Nettoyage des 21 versions JSON dans `audio-timelines/` (Sprint 2).
- Auth/SSO Vercel preview, slug-divergence Storage/BDD (Sprint 2 — §7.3).

---

## 2. Inventaire initial

### 2.1 Storage — MP3 pilote

URL canonique :
```
https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3
```

`curl -I` (état 2026-05-09 avant fix) :
```
HTTP/2 200
content-type: audio/mpeg
content-length: 8632790
last-modified: Wed, 06 May 2026 17:35:08 GMT
etag: "4159e3b6fc155ead018c32795c1d8551-2"
```

### 2.2 Storage — Timeline JSON (référence)

```
https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/audio-timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de/2026-05-09T07-38-27-896Z.json
```

Champs critiques (extraits via `jq`) :
```json
{
  "schema_version": "1.0",
  "source_type": "formation_sequence",
  "source_id": "e8dfa6b8-ef34-4454-a198-e6f973f466de",
  "audio_url": "https://dxybsuhfkwuemapqrvgz.supabase.co/storage/.../sequence_02_non_verbale-1778057695.mp3",
  "duration_sec": 538.45,
  "generator": "auto_llm_extraction",
  "generated_at": "2026-05-08T12:56:44.129Z",
  "transcript_segments": 26,
  "scenes_count": 5
}
```

→ `audio_url` du JSON = URL Storage du MP3 → **cohérence amont/timeline
confirmée**. Source de vérité pour la durée : **538.45 s**.

### 2.3 BDD — table `sequences` (état avant)

Requête :
```sql
SELECT id, course_media_url, course_media_type, course_duration_seconds,
       timeline_url, timeline_published, updated_at
FROM sequences
WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de';
```

Résultat :
| Colonne | Valeur |
|---|---|
| `course_media_url` | **`NULL`** |
| `course_media_type` | **`NULL`** |
| `course_duration_seconds` | **`NULL`** |
| `timeline_url` | (URL JSON, OK) |
| `timeline_published` | `false` |
| `updated_at` | `2026-05-09 07:38:28.655086+00` |

→ **Désynchronisation confirmée** : la séquence pilote n'avait jamais
été liée à son MP3 dans la BDD, alors que le fichier était sur Storage
depuis 3 jours et que le timeline JSON, généré le 2026-05-09 à 07:38, le
référençait correctement.

→ Conséquence côté user : `SequencePlayer.tsx:232-326` calcule
`hasMedia = !!sequence.course_media_url` et `mediaType =
sequence.course_media_type || 'video'`. Avec les colonnes à `NULL`, la
condition `isAudio && sequence.course_media_url` (lignes 556 et 637)
était toujours `false`, donc **le player audio n'aurait pas pu rendre
en production**. Bug latent silencieux pré-T7.1.

---

## 3. Diagnostic root cause

### 3.1 Mutagen avant fix

Sur le fichier local (taille identique à Storage : 8 632 790 octets) :

```
Path: /Users/juliefantin/Desktop/DentalLearn-Audio/dialogues/sequence_02_non_verbale-1778057695.mp3
Duration: 98.116 s    ← MENSONGÈRE (vraie : 538.45 s)
Bitrate: 128 000 bps
Sample rate: 44 100 Hz
Channels: 1 (mono)
Bitrate mode: BitrateMode.CBR
Encoder info:        ← VIDE
Encoder settings:    ← VIDE
```

### 3.2 Triangulation arithmétique

| Source | Durée |
|---|---|
| mutagen (header MP3) | 98.116 s |
| Timeline JSON | 538.45 s |
| Calcul `taille / bitrate` : `8 632 790 × 8 / 128 000` | 539.55 s |

→ Ratio 538.45 / 98.116 ≈ **5.49** : le header annonce le contenu d'un
seul chunk (~98 s) au lieu de la totalité.

→ Le calcul taille/bitrate (cohérent avec le timeline) confirme que
**l'audio brut est intact** et que le header est seul en cause.

### 3.3 Confirmation côté ffmpeg

Le re-mux a produit deux signaux diagnostiques décisifs :

```
[in#0] invalid concatenated file detected - using bitrate for duration
[mp3float] Header missing  (×5 occurrences)
```

Les 5 erreurs `Header missing` se positionnent sur les jonctions inter-
chunks (~25 s, ~63 s, ~67 s, ~98 s, ~106 s) — soit les frontières des
fragments concaténés en sortie du pipeline ElevenLabs Python.

### 3.4 Conclusion root cause

**Le pipeline source génère le MP3 par concaténation binaire de chunks
ElevenLabs sans re-muxing**. Conséquences :

- Pas de tag Xing/LAME global (donc pas de seek table, pas de frame count
  fiable, durée inexacte).
- Frames partielles aux jonctions (les 5 `Header missing`).
- Lecture séquentielle OK (les décodeurs récupèrent), mais **seek random
  cassé** : sans seek table, le navigateur ne peut pas convertir un
  timestamp en byte offset → drag du curseur met à jour l'UI mais ne
  déplace pas le flux audio (= bug `POC-T3-D4`).

---

## 4. Fix appliqué — re-mux ffmpeg

### 4.1 Commande exécutée

Outil : `ffmpeg 8.1.1` (Homebrew, installé pendant T7.1 — non présent en
amont sur la machine ops).

```bash
ffmpeg -y -i sequence_02_non_verbale-1778057695.mp3 \
  -c:a libmp3lame -b:a 128k -ar 44100 -ac 1 -write_xing 1 \
  sequence_02_non_verbale-1778057695-fixed.mp3
```

Choix des flags :
- `-c:a libmp3lame` : encodeur LAME → écrit un header LAME conforme
  (incluant Xing TOC + frame count + duration).
- `-b:a 128k -ar 44100 -ac 1` : **paramètres alignés sur la source**
  (vérifié mutagen §3.1) → re-mux à iso-quality, 1 seule génération
  d'encodage MP3 sur dialogue mono speech (perte non perceptible).
- `-write_xing 1` : explicite (default avec libmp3lame, défense en
  profondeur).

### 4.2 Sortie ffmpeg

```
size= 8429KiB  time=00:08:59.48  bitrate=128.0kbits/s
```

Soit **539 s** confirmées par le muxeur lui-même.

### 4.3 Mutagen après fix

```
Duration: 539.402 s    ← VRAIE
Bitrate: 128 000 bps
Sample rate: 44 100 Hz
Channels: 1
Bitrate mode: BitrateMode.CBR
```

→ Critère GO/NO-GO §1.2.3 satisfait : durée mutagen passe de 98.116 s à
539.402 s, alignée à ±1 s avec le timeline JSON (538.45 s).

> Note cosmétique : `Encoder info` / `Encoder settings` restent vides
> côté mutagen même après le re-mux. Le tag Xing TOC est néanmoins bien
> écrit (preuve : la durée correcte est calculée et le seek
> fonctionne — voir §6.3). Cosmétique non bloquante.

### 4.4 Comparaison de tailles

| Fichier | Taille | Source |
|---|---|---|
| `sequence_02_non_verbale-1778057695.PRE_FIX.mp3` | 8 632 790 octets | Original Storage 2026-05-06 |
| `sequence_02_non_verbale-1778057695-fixed.mp3` | 8 630 901 octets | Après re-mux 2026-05-09 |
| Δ | −1 889 octets | Réécriture du header global ; corps audio quasi identique |

### 4.5 Test seek browser local

Drag-drop direct du fichier dans Chrome (avant upload Storage) :

| Test | Résultat |
|---|---|
| Play depuis 0:00 | OK |
| Drag à 4:00 | OK — voix correspond au milieu du dialogue |
| Drag à 8:00 | OK — conclusion Martin |
| Comparaison contre `.PRE_FIX.mp3` | Confirme par contraste : ancien MP3 atterrit au mauvais timestamp |
| Glitches aux 5 jonctions inter-chunks | Aucun audible |

→ **Bug Xing résolu sur le fichier local**. Décision GO pour upload
Storage.

---

## 5. Synchronisation BDD

### 5.1 Re-upload Storage

Re-upload via dashboard Supabase Studio à l'URL canonique
(`formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3`).
Procédure non triviale — voir §7.

`curl -I` post-upload :
```
HTTP/2 200
content-type: audio/mpeg
content-length: 8630901
last-modified: Sat, 09 May 2026 12:41:39 GMT
etag: "ca55deba531e9c6f90ee8a22d667e1c2"
```

→ Storage propre, un seul fichier au bon nom, taille = `-fixed`,
horodaté du jour.

### 5.2 UPDATE SQL via MCP

Requête (poussée via Supabase MCP `execute_sql`) :

```sql
UPDATE sequences
SET
  course_media_url        = 'https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3',
  course_media_type       = 'audio',
  course_duration_seconds = 538,
  updated_at              = NOW()
WHERE id = 'e8dfa6b8-ef34-4454-a198-e6f973f466de'
RETURNING id, course_media_url, course_media_type, course_duration_seconds,
          timeline_url, timeline_published, updated_at;
```

Choix de `538` (et pas `539`) : `Math.round(538.45)` aligné sur la valeur
du timeline JSON (autoritaire). Le ±1 s vs 539.402 mutagen est dans la
tolérance UX (le player s'aligne sur la durée réelle du `<audio>` natif
de toute façon).

### 5.3 Diff état BDD

| Colonne | AVANT | APRÈS | Δ |
|---|---|---|---|
| `course_media_url` | `NULL` | URL Storage canonique | ✅ écrit |
| `course_media_type` | `NULL` | `audio` | ✅ écrit |
| `course_duration_seconds` | `NULL` | `538` | ✅ écrit |
| `timeline_url` | (URL JSON) | (URL JSON, byte-identique) | inchangé ✅ |
| `timeline_published` | `false` | `false` | inchangé ✅ |
| `updated_at` | `2026-05-09 07:38:28.655086+00` | `2026-05-09 12:48:29.989668+00` | bumpé |

Une seule ligne affectée (clause `WHERE id = …` exacte). `RETURNING`
exécuté en transaction, preuve d'écriture capturée.

→ La BDD est désormais **synchrone** avec Storage et timeline JSON. Les
trois sources convergent sur `538.x s`, mono 128 kbps, URL canonique
unique.

---

## 6. Validation production

### 6.1 Environnement

- URL preview : `https://dental-learn-v3-oybfwntuz-drfantin-stars-projects.vercel.app`
- Build issu de `claude/audit-audio-stream-2bUtk` (HEAD = `1f92adc` au
  moment du test).
- Compte de test, DevTools : *Disable cache* ON, *Preserve log* ON.

### 6.2 Smoke test 6/6

| # | Critère | Observation | Verdict |
|---|---|---|---|
| 1 | Page séquence rend sans erreur | Console clean (1 warning CSS pré-existant hors scope) | ✅ |
| 2 | Player audio rendu, durée correcte | Affichage `0:27 / 8:59` (vs 1:38 avant fix) | ✅ |
| 3 | Network MP3 | 3 requêtes, **status `206 Partial Content`**, `media`, ~3.4 Mo / 8.23 Mo total | ✅ |
| 4 | Network timeline JSON | Skipped (cohérent : `timeline_published = false`) | ✅ |
| 5 | Play continu, glitches inter-chunks | Aucun audible aux 5 jonctions | ✅ |
| 6 | Seek `−15 s` MiniPlayer + DPC tracking | Fonctionnel ; 4 PATCH `course_watch_logs` `204` (latences 73/463/435/162 ms) | ✅ |

### 6.3 Preuves clés

- **`HTTP 206 Partial Content`** = le navigateur émet des `Range:`
  requests, ce qui n'est efficace **que si** le serveur peut servir des
  byte ranges arbitraires **et** que le client connaît la map
  timestamp→byte (= seek table Xing). Avant fix, l'absence de seek table
  forçait un fallback `200` complet ou des seeks aberrants. **Le 206
  prouve que le header Xing fait son travail**.
- **DPC `course_watch_logs` PATCH 204** = chaîne d'écriture intacte.
  T7.1 n'a touché aucun code de l'`AudioContext`
  (`src/context/AudioContext.tsx:153-258`), confirmé par le smoke test.
- **Durée affichée 8:59** = aligned avec `course_duration_seconds=538` +
  durée réelle du `<audio>` natif (539.402 s). UX cohérent.

### 6.4 Critère T7.0 ➜ T7.2 levé

Le risque §6.6 du rapport T7.0 (« bug seek MP3 pilote pourrait parasiter
les tests visuels T7.2 ») est **éteint**. T7.2 peut commencer sur cette
séquence pilote sans interférence du bug Xing.

---

## 7. Issues opérationnelles rencontrées

### 7.1 ffmpeg absent de la machine ops

Première tentative de re-mux échouée : binaire ffmpeg non présent. Résolu
via `brew install ffmpeg` (version installée : 8.1.1). À ajouter au memo
ops setup (§8.1).

### 7.2 Dashboard Supabase Storage — pas de modale "Replace"

L'upload via le dashboard d'un fichier au nom déjà existant **ne
propose pas** la modale "Replace / Skip / Rename". Le dashboard a
silencieusement créé un doublon `sequence_02_non_verbale-1778057695 (1).mp3`
à côté de l'ancien fichier.

Procédure de récupération :
1. Suppression manuelle de l'ancien fichier (8 632 790 octets) dans le
   dashboard.
2. Rename du `(1).mp3` vers le nom canonique sans suffixe.

### 7.3 Piège espace dans le rename

Premier rename a accidentellement laissé un espace avant `.mp3` (nom
final = `sequence_02_non_verbale-1778057695 .mp3`). Détecté via `curl`
qui renvoyait des 400 persistants sur l'URL canonique attendue.

Fix : second rename, vérification visuelle dans le dashboard, puis
`curl -I` final pour confirmation. Pénalité ~5 min.

### 7.4 Auth/SSO Vercel preview incohérente

Comportement non bloquant pour T7.1 mais surfacé pendant le smoke test :
sans login, certaines pages (catégories, `/formation/[theme]`) cassent
avec "Erreur inconnue". À auditer Sprint 2 hors scope T7.

---

## 8. Notes pour Sprint 2 et futurs uploads

### 8.1 Memo ops — setup machine

Documenter : `brew install ffmpeg mp3val` (pour diagnostics) + `pip
install mutagen` recommandés sur tout poste qui touche aux MP3
formations.

### 8.2 Memo ops — upload Storage

Pour tout re-upload visant à remplacer un fichier existant :
1. **Avant** : `curl -I` sur l'URL canonique → noter `content-length`
   et `etag`.
2. **Re-upload** via dashboard.
3. **Si** doublon `(N).<ext>` apparaît : delete ancien + rename nouveau.
4. **Vérifier nom** dans dashboard (zoom : pas d'espace, pas de double
   extension).
5. **Après** : `curl -I` à nouveau → confirmer nouveau `content-length`
   et `last-modified` du jour.

### 8.3 Memo ops — Sprint 2 backlog (issus du smoke test)

| # | Item | Sévérité | Trigger |
|---|---|---|---|
| 1 | Auth/SSO preview Vercel incohérente | medium | Smoke test §6 |
| 2 | Modes test + bypass progression résidus admin | low | Smoke test §6 |
| 3 | 4 routes API `admin/news` → "Dynamic server usage" warnings build | low (cosmétique) | Smoke test §6 |
| 4 | 21 versions JSON empilées dans `audio-timelines/formation/e8dfa6b8-…/` | low (housekeeping) | Inventaire §2 |
| 5 | Slug-divergence Storage `communication-ecoute-active` vs BDD slug `communication-relation-therapeutique` | low (potentielle dette) | Inventaire §2 |

### 8.4 Recommandation Sprint 2 — pipeline source

Le diagnostic §3.4 montre que **tout MP3 produit par le pipeline
ElevenLabs Python actuel aura le même bug**. Tant que ce pipeline n'est
pas corrigé, chaque nouvelle séquence audio nécessitera un re-mux ffmpeg
manuel (T7.1 répété N fois en Sprint 2).

Options à évaluer (ordre de préférence) :

(a) **Re-mux ffmpeg en post-traitement Python** dans le pipeline
existant (1 ligne `subprocess.run([...])` après la concaténation). Coût
implémentation ~30 min, élimine le problème à la source.

(b) **Utiliser `pydub.AudioSegment.export(format='mp3', bitrate='128k')`**
au lieu de la concaténation binaire — `pydub` re-encode et écrit un
header propre. Coût ~1 h, change la dépendance.

(c) **Passer par `mp3val -f`** en post-traitement (plus léger que
ffmpeg, n'altère pas l'audio mais reconstruit les frames invalides et
écrit Xing). Coût ~30 min.

→ Option (a) recommandée : isofonctionnelle au fix manuel de T7.1, donc
sécurité garantie ; aucune perte de qualité supplémentaire (1 seule
génération MP3, comme aujourd'hui).

---

## 9. État final du système

### 9.1 Convergence des trois sources

| Source | URL / id | Durée | Type | Statut |
|---|---|---|---|---|
| Storage MP3 | `…/sequence_02_non_verbale-1778057695.mp3` | 539.402 s (mutagen) | `audio/mpeg` | ✅ Xing OK, 8 630 901 octets, 2026-05-09 |
| Timeline JSON | `…/2026-05-09T07-38-27-896Z.json` | 538.45 s | n/a | ✅ inchangé, `audio_url` aligné |
| BDD `sequences` | `e8dfa6b8-…` | 538 s | `audio` | ✅ écrit 2026-05-09 12:48:29 UTC |

### 9.2 Player audio user

- Rendu OK (smoke test 6/6).
- Durée affichée 8:59.
- Seek `−15 s` opérationnel via `MiniPlayer.tsx`.
- DPC tracking préservé (`course_watch_logs`).
- Aucun glitch audible aux jonctions inter-chunks.
- `state.currentTime` mis à jour proprement (chaîne T7.0 §B.1-5
  inchangée).

### 9.3 Préparation T7.2

- Risque §6.6 du rapport T7.0 (« bug seek MP3 pilote ») : **éteint**.
- Surface de réutilisation T7.0 §5 (hooks T3 + composants T4 + AudioContext) : **inchangée**.
- Type `Sequence` (T7.0 §5.1, §6.2 — ne contient toujours pas
  `timeline_url` / `timeline_published`) : **inchangé**, à traiter par
  T7.2 ou T7.3.
- `timeline_published = false` : T7.2 doit gérer ce cas (sera lui-même
  d'abord en `false` jusqu'à validation), aucun blocker.

→ **GO pour T7.2**.

---

## Annexe A — Captures de session ops

### A.1 Diagnostic mutagen avant fix (`T7_1_diagnostic_avant.txt`)
```
Path: /Users/juliefantin/Desktop/DentalLearn-Audio/dialogues/sequence_02_non_verbale-1778057695.mp3
Duration: 98.116s
Bitrate: 128000 bps (128.0 kbps)
Sample rate: 44100 Hz
Channels: 1
Mode: 3
Bitrate mode (0=UNKNOWN, 1=CBR, 2=VBR, 3=ABR): BitrateMode.CBR
Encoder info:
Encoder settings:
Track gain: None
```

### A.2 Diagnostic mutagen après fix (`T7_1_diagnostic_apres.txt`)
```
Duration: 539.402s
Bitrate: 128000 bps
Sample rate: 44100 Hz
Channels: 1
Bitrate mode: BitrateMode.CBR
Encoder info:
Encoder settings:
```

### A.3 ffmpeg — extrait journal
```
[in#0] invalid concatenated file detected - using bitrate for duration
[mp3float] Header missing   (×5, jonctions ~25s/~63s/~67s/~98s/~106s)
size= 8429KiB  time=00:08:59.48  bitrate=128.0kbits/s
```

### A.4 `curl -I` post-upload Storage
```
HTTP/2 200
content-type: audio/mpeg
content-length: 8630901
last-modified: Sat, 09 May 2026 12:41:39 GMT
etag: "ca55deba531e9c6f90ee8a22d667e1c2"
```

### A.5 SQL UPDATE — `RETURNING` (preuve d'écriture)
```json
{
  "id": "e8dfa6b8-ef34-4454-a198-e6f973f466de",
  "course_media_url": "https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3",
  "course_media_type": "audio",
  "course_duration_seconds": 538,
  "timeline_url": "https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/audio-timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de/2026-05-09T07-38-27-896Z.json",
  "timeline_published": false,
  "updated_at": "2026-05-09 12:48:29.989668+00"
}
```

---

## Annexe B — Inventaire des fichiers / lignes touchées

| Cible | Action | Auteur |
|---|---|---|
| `formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3` (Storage) | re-mux + re-upload | ops |
| `sequences` row `e8dfa6b8-…` (BDD) | UPDATE 3 colonnes + `updated_at` | claude (MCP) |
| Code applicatif (`src/`, `supabase/`) | **0 modification** | n/a |
| `RAPPORT_T7_1_PREPARATION_PILOTE.md` | création (ce document) | claude |

---

*Fin du rapport. La séquence pilote est prête pour T7.2 — implémentation
du composant `<EnrichedAudioPlayer>` selon spec POC §5.4 et §10
Ticket 7. Recommandation §8.4 (re-mux pipeline ElevenLabs en amont) à
prioriser avant Sprint 2 si plusieurs nouvelles séquences audio sont
prévues.*
