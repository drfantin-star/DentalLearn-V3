# POC-T2 — Phase 2A — Observations

Document complété après exécution de `test_eleven_labs_with_timestamps.py`
sur la machine locale Dr Fantin.

- **Date du run** : 5 mai 2026
- **Coût réel constaté** : ~0,01 € (test 4 répliques / 244 caractères)

---

## 1. Validations programmatiques

- [x] SDK renvoie bien un attribut audio : ✅ (attribut observé : `audio_base_64`, ⚠️ avec underscore entre `base` et `64`, différent de `audio_base64` anticipé par la spec)
- [x] SDK renvoie bien `alignment` : ✅
- [x] `alignment` contient bien `characters[]`, `character_start_times_seconds[]`, `character_end_times_seconds[]` : ✅
- [x] Présence de `normalized_alignment` (généralement plus propre) : ✅ (présent — version recommandée à utiliser)
- [x] Convention naming utilisable telle quelle dans le code Python : ✅ snake_case
- [x] Champ bonus non documenté : `voice_segments[]` — segments par voice_id avec start/end déjà segmentés Sophie/Martin → simplifie `build_segments_from_dialogue`

> **Attribut alignment retenu** pour Phase 2B : `normalized_alignment`
> **Attribut audio retenu** : `audio_base_64`

---

## 2. Validation auditive (Dr Fantin)

### 2.1 Audio global
- [x] L'audio sonne correct sur les 4 répliques (Sophie / Martin / Sophie / Martin) : ✅

### 2.2 Précision des timestamps
Validation auditive globale : ✅ « ça a l'air bien calé » sur les 5 points testés.
Critère <100 ms validé subjectivement (le player utilisé n'expose pas la milliseconde mais aucun décalage perceptible n'a été constaté).

---

## 3. Anomalies / surprises

1. Le SDK retourne `audio_base_64` (avec underscore) et non `audio_base64` comme anticipé par la spec §3.2 — typo à corriger dans le code Python de Phase 2B.
2. Bonus inattendu : `voice_segments[]` est livré par l'API et donne directement la segmentation Sophie/Martin avec timecodes → on peut s'en servir au lieu de reconstruire les segments par parsing du dialogue d'entrée.
3. Présence simultanée de `alignment` et `normalized_alignment` — choix : utiliser `normalized_alignment` qui nettoie certains artefacts.

---

## 4. Recommandation pour Phase 2B

- [x] **GO** — Le format de réponse est conforme à la spec §3.2 dans son architecture. Adaptations à appliquer en Phase 2B :
  1. Utiliser `audio_base_64` (et non `audio_base64`) pour décoder l'audio
  2. Privilégier `normalized_alignment` à `alignment` dans `characters_to_words`
  3. Exploiter `voice_segments[]` du SDK pour reconstituer les segments Sophie/Martin (au lieu de la fonction `build_segments_from_dialogue` prévue dans la spec)
  4. Le reste du pipeline (chunking, merge avec offset, génération `.timeline.json`) reste conforme à la spec

Validation Dr Fantin : 5 mai 2026 — GO Phase 2B
