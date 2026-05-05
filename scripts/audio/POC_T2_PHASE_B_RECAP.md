# POC-T2 — Phase 2B — Récap

Document à compléter par Dr Fantin **après** exécution de `generate_audio.py`
(version Phase 2B, `WITH_TIMESTAMPS=True`) sur la séquence pilote
**Communication et Écoute Active S2**.

- **Date du run** :
- **Séquence testée** : Communication et Écoute Active S2
- **Nombre de répliques (input)** :
- **Nombre de caractères total** :
- **Nombre de chunks générés** :
- **Coût réel constaté** : ~ €

---

## 1. Modifications appliquées

Comparaison avec `REFERENCE_generate_audio_current.py` (snapshot du fichier local avant Phase 2B) :

| Modification | Nature | Impact |
|---|---|---|
| Imports `base64`, `json`, `re`, `datetime` | Additive | +4 lignes |
| Constantes `MAX_CHARS_NO_TIMESTAMPS`, `MAX_CHARS_WITH_TIMESTAMPS`, `WITH_TIMESTAMPS`, `VOICE_ID_TO_SPEAKER`, `SCHEMA_VERSION`, `GENERATOR_TAG`, `EMOTION_TAG_PATTERN` | Additive | +14 lignes |
| Fonction `generate_chunk_with_timestamps` (accès direct aux champs SDK figés) | Additive | +50 lignes |
| Helpers `merge_chunk_results`, `strip_emotion_tags_from_alignment`, `characters_to_words`, `build_segments`, `build_timeline` | Additive | +130 lignes |
| Branche `if not WITH_TIMESTAMPS` dans `__main__` (legacy intact) | Modificative non destructive | +5 lignes |
| Branche `WITH_TIMESTAMPS=True` dans `__main__` (nouveau pipeline + appel `strip_emotion_tags_from_alignment`) | Additive | +35 lignes |
| Commentaires d'en-tête (mode timestamps + procédure post-génération + patch balises émotion) | Additive | +27 lignes |
| **Total approximatif** | | **+200 lignes** (vs +125 prévues spec §3.6 — écart résiduel dû au patch balises émotion v3 + mapping `VOICE_ID_TO_SPEAKER` + procédure post-génération imprimée) |

### Décision de design : pas de helpers défensifs

La spec §3.2 indiquait « À confirmer en testant l'API réelle : la structure exacte de l'objet response (camelCase vs snake_case, présence du champ normalized_alignment) ».

La Phase 2A (cf. `test_response_raw_REFERENCE.json`) a livré la **structure réelle figée** :
- Tout est en `snake_case`
- `audio_base_64` (avec underscore) — confirmé
- `normalized_alignment` présent et identique à `alignment` sur le test 4 répliques
- `voice_segments[]` avec `voice_id`, `start_time_seconds`, `end_time_seconds`, **`character_start_index`**, **`character_end_index`**, `dialogue_input_index`

→ Le code de Phase 2B accède aux champs **directement par leur nom réel** (pas de fallback `_get` snake/camelCase). Si le SDK ElevenLabs change ses noms en upgrade, le script échouera explicitement avec `AttributeError` — comportement souhaité, on saura immédiatement qu'il faut mettre à jour.

→ Bonus exploité : `character_start_index` / `character_end_index` permettent de **slicer** la liste `merged_chars` directement par segment voice (au lieu de filtrer par timestamp avec tolérance flottante). Plus déterministe.

### Décision de design : patch balises émotion ElevenLabs v3 (5 mai 2026)

**Scénario A confirmé par test isolé Dr Fantin** : ElevenLabs vocalise les balises (`[concerned]`, `[serious]`, ...) pour influencer le ton, **mais les inclut dans `normalized_alignment.characters[]` et dans `voice_segments[].character_start_index/character_end_index`**. Sans patch, le karaoké afficherait `[concerned]` à l'écran.

→ Nouvelle fonction `strip_emotion_tags_from_alignment(merged_chars, merged_starts, merged_ends, merged_voice_segments)` appelée **après `merge_chunk_results` et avant `build_segments`** :

1. Identifie les ranges via `EMOTION_TAG_PATTERN = re.compile(r'\[[a-zA-Z_]+\]')` sur le texte mergé reconstitué
2. Filtre `chars` / `starts` / `ends` (audio inchangé — seuls les caractères et timestamps des balises sont retirés ; `start_sec`/`end_sec` des `voice_segments` ne bougent pas)
3. Réindexe `char_start` / `char_end` des `voice_segments` sur la liste filtrée via une table `old_to_new` (count cumulé des positions conservées)
4. Préserve les espaces autour des balises → `"Martin. [concerned] Je"` devient `"Martin.  Je"` (double espace, OK car `characters_to_words` split sur whitespace, le mot vide est ignoré)

**Tests inline (script de validation lancé sur cette branche)** : 4 cas passent — pas de balise (identité), balise au milieu d'un seul segment, balise dans le 1er de 2 segments avec réindexation correcte, split double-espace propre dans `characters_to_words`.

**Compatibilité descendante** : ✅ aucune signature existante modifiée, aucune ligne supprimée, mode legacy strictement identique avec `WITH_TIMESTAMPS=False`. Le patch balises émotion est inactif si aucune balise n'est présente dans le texte (cas testé).

---

## 2. Sortie produite

- [ ] `.mp3` produit : taille = ___ Ko, durée = ___ s
- [ ] `.timeline.json` produit : taille = ___ Ko
- [ ] JSON parse OK (`python3 -c "import json; json.load(open('xxx.timeline.json'))"`)
- [ ] Clés racine présentes : `schema_version`, `source_type`, `source_id`, `audio_url`, `duration_sec`, `generated_at`, `generator`, `transcript`, `concepts`, `scenes`
- [ ] `transcript.segments` contient ___ segments
- [ ] Total mots dans `transcript.segments[].words` : ___
- [ ] `duration_sec` cohérent avec la durée réelle du `.mp3` (écart < 1 s) : ✅ / ❌
- [ ] Speakers observés : `sophie` ___ segments, `martin` ___ segments

---

## 3. Validation auditive — précision timestamps

**Méthode** : tirer 10 mots au hasard dans `transcript.segments[].words[]`,
les écouter dans le `.mp3` à `start_sec` et noter l'écart subjectif.

```bash
python3 -c "
import json, random
d = json.load(open('communication_ecoute_active_s2.timeline.json'))
all_words = [w for s in d['transcript']['segments'] for w in s['words']]
for w in random.sample(all_words, 10):
    print(f\"{w['start_sec']:.2f}s → {w['text']}\")
"
```

| # | start_sec | Mot | Écart auditif (<100ms / 100-300ms / >300ms) | Notes |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

**Score** : ___/10 mots à <100 ms (critère d'acceptation = 10/10)

---

## 4. Anomalies / surprises

_(à remplir si quoi que ce soit s'est mal passé ou est inattendu)_

1.
2.
3.

---

## 5. Décision GO / NO-GO Ticket T3

- [ ] **GO T3** — Phase 2B validée, on enchaîne sur l'intégration front (composant `<KaraokeTranscript>`)
- [ ] **NO-GO** — issues à corriger avant T3, détailler ci-dessus

Validation Dr Fantin : __________ — __________
