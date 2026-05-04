# POC-T2 — Phase 2A — Observations

Document à compléter **après** exécution de `test_eleven_labs_with_timestamps.py`
sur la machine locale Dr Fantin (le sandbox Claude n'a pas accès à
`~/Desktop/DentalLearn-Audio/` ni à la clé API).

- **Date du run** : ___________
- **Version SDK ElevenLabs** : `python3 -c "import elevenlabs; print(elevenlabs.__version__)"` → ___________
- **Coût réel constaté (dashboard ElevenLabs après run)** : ___________

---

## 1. Validations programmatiques (à recopier depuis la console)

Coller ici les ✅/❌ affichés par `test_eleven_labs_with_timestamps.py` :

- [ ] SDK renvoie bien un attribut `audio_base64` / `audioBase64` :  ___ (attr observé : `___`)
- [ ] SDK renvoie bien `alignment` :  ___
- [ ] `alignment` contient bien `characters[]`, `character_start_times_seconds[]`, `character_end_times_seconds[]` :  ___
- [ ] Présence de `normalized_alignment` (généralement plus propre que `alignment`) :  ___ (attr observé : `___`)
- [ ] Convention naming utilisable telle quelle dans le code Python :  ___ (snake_case ou camelCase ?)
- [ ] Longueurs `characters` / `starts` / `ends` cohérentes (mêmes longueurs) :  ___
- Durée audio totale mesurée depuis l'alignment : ___ s
- Nombre de caractères alignés / mots reconstitués : ___ / ___

> **Attribut alignment retenu** (priorité `normalized_alignment` si présent) : ____

---

## 2. Validation auditive (Dr Fantin)

Ouvrir `test_response_audio.mp3` dans un player capable de seek précis (Audacity, VLC en mode A→B…).

### 2.1 Audio global

- [ ] L'audio sonne-t-il correct sur les 4 répliques (Sophie / Martin / Sophie / Martin) ?  ___
- Remarques éventuelles : ___________

### 2.2 Précision des timestamps (5 mots tirés au hasard)

Pour chaque mot listé dans `test_response_summary.txt`, naviguer à `start_sec`
et vérifier que le mot commence bien là à <100 ms près.

| # | Mot                | start_sec attendu | Décalage estimé | OK <100 ms ? |
|---|--------------------|-------------------|-----------------|--------------|
| 1 | __________________ | _____ s           | _____ ms        | ☐            |
| 2 | __________________ | _____ s           | _____ ms        | ☐            |
| 3 | __________________ | _____ s           | _____ ms        | ☐            |
| 4 | __________________ | _____ s           | _____ ms        | ☐            |
| 5 | __________________ | _____ s           | _____ ms        | ☐            |

Score : ___ / 5 mots <100 ms.

---

## 3. Anomalies / surprises

- ___________

---

## 4. Recommandation pour Phase 2B

> Cocher une case et justifier en 1-2 lignes.

- [ ] **GO** — Le format de réponse est conforme à la spec §3.2. Adaptations
      éventuelles à appliquer en Phase 2B :
      ___________
- [ ] **GO avec adaptations majeures** — Le format diffère mais reste
      exploitable. Adaptations à prévoir :
      ___________
- [ ] **NO-GO** — Endpoint inutilisable / précision insuffisante. Bascule sur
      le fallback Whisper (spec §13.2 P5).
      Raison :
      ___________

Validation Dr Fantin : ___________ (signature / date)
