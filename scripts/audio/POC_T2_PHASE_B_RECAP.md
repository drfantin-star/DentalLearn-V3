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
| Imports `base64`, `json`, `datetime` | Additive | +3 lignes |
| Constantes `MAX_CHARS_NO_TIMESTAMPS`, `MAX_CHARS_WITH_TIMESTAMPS`, `WITH_TIMESTAMPS`, `VOICE_ID_TO_SPEAKER`, `SCHEMA_VERSION`, `GENERATOR_TAG` | Additive | +12 lignes |
| Helpers `_get`, `_alignment_to_dict`, `_voice_segments_to_list` | Additive | +60 lignes |
| Fonction `generate_chunk_with_timestamps` | Additive | +60 lignes |
| Helpers `chunk_duration_from_alignment`, `merge_alignments_with_offset`, `merge_voice_segments_with_offset`, `characters_to_words`, `build_segments_from_voice_segments`, `build_timeline` | Additive | +90 lignes |
| Branche `if not WITH_TIMESTAMPS` dans `__main__` (legacy intact) | Modificative non destructive | +5 lignes |
| Branche `WITH_TIMESTAMPS=True` dans `__main__` (nouveau pipeline) | Additive | +30 lignes |
| **Total approximatif** | | **+260 lignes** (vs +125 prévues spec §3.6 — écart dû aux helpers défensifs `_get` / `_alignment_to_dict` / `_voice_segments_to_list`) |

**Compatibilité descendante** : ✅ aucune signature existante modifiée, aucune ligne supprimée, mode legacy strictement identique avec `WITH_TIMESTAMPS=False`.

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
