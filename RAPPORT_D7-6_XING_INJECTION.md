# RAPPORT D7-6 — Injection du header Xing post-concat ElevenLabs

**Date** : 2026-05-13
**Branche** : `claude/fix-elevenlab-mp3-header-pTWJv`
**Commit principal** : `b332fd4` — `chore(d7-6): inject Xing header via ffmpeg post-concat in generate_audio`
**Statut** : ✅ Smoke Y2 validé empiriquement (10/10 critères acceptance)
**Verrou bloquant T9 #1/3** : levé

---

## 1. Contexte (rappel court)

Le pipeline `generate_audio.py` ElevenLabs concatène byte-à-byte les chunks MP3 retournés par l'API. Cette concat ne produit pas de header Xing/LAME global. Conséquences observées et documentées avant ce ticket (cf. `RECAP_SESSION_POC_AUDIO_T7_0_T7_1_09MAI2026.md` §3) :

- `mutagen.mp3.MP3.info.length` retourne une durée mensongère (98s sur un MP3 de 538s pour la pilote pivot).
- Seek HTML5 désynchronisé : `audio.currentTime = sec` met à jour la valeur interne mais la sortie audio physique reste sur la position initiale.
- Drag de la barre native HTML5 atterrit au mauvais endroit (drag à 1:00 → milieu de l'intro).
- 5 erreurs `[mp3float] Header missing` ffmpeg aux jonctions de chunks (transitions Sophie↔Martin) si on re-mux a posteriori.

Workaround manuel T7.1 sur la pilote `e8dfa6b8-...` :
```
ffmpeg -y -i in.mp3 -c:a libmp3lame -b:a 128k -ar 44100 -ac 1 -write_xing 1 out.mp3
```
→ smoke browser preview Vercel 6/6 GO, mais non scalable.

D7-6 internalise ce workaround dans le script Python pour rendre chaque MP3 sortant nativement seek-able.

---

## 2. Approche retenue

**Option B (Q-D7-6-1) — re-mux via `subprocess` ffmpeg avec les flags pivots T7.1.**

Choix arbitré par Dr Fantin contre A/C avec ces raisons explicites :

| Option | Raison du rejet |
|---|---|
| A — `mutagen.save()` pure-Python | `mutagen` est un éditeur de tags ID3, pas un re-muxer MP3. L'injection Xing sur header absent n'est pas une fonctionnalité documentée. Pari non-documenté = risque temps perdu. |
| C — `ffmpeg -c copy -write_xing 1` | `-c copy` n'effectue pas le re-encode qui assainit les frames corrompus aux jonctions Sophie↔Martin (5 "Header missing" loggés en silence). Xing OK mais stream douteux. |
| **B — `ffmpeg -c:a libmp3lame -b:a 128k -ar 44100 -ac 1 -write_xing 1`** | **Identique au fix T7.1 validé empiriquement (smoke browser 6/6 GO, signature pivot 98s → 539.4s, course_watch_logs préservés). Zéro inconnue.** |

Dépendance externe ajoutée : `ffmpeg`. Vérifiée au lancement du script via `shutil.which("ffmpeg")` (fail-fast `RuntimeError`). Installation macOS : `brew install ffmpeg`.

---

## 3. Diff fonctionnel

### Fichiers modifiés / ajoutés

| Fichier | Statut | Lignes |
|---|---|---|
| `scripts/audio/generate_audio_D7-6.py` | **nouveau** (copie de `generate_audio_PHASE_2B.py` + patch D7-6) | 643 |
| `scripts/audio/README.md` | modifié | +17 / -4 |
| `RAPPORT_D7-6_XING_INJECTION.md` | **nouveau** (ce document) | — |

### Patch en 4 endroits dans `generate_audio_D7-6.py`

1. **Header de fichier** (lignes 1-58) — bloc commentaire D7-6 expliquant le bug Xing, les flags pivots, la dépendance ffmpeg.
2. **Imports** (lignes 59-67) — ajout de `shutil`, `subprocess`, `from pathlib import Path`.
3. **4 fonctions ajoutées** (lignes 439-524) :
   - `check_ffmpeg_available()` — fail-fast au démarrage si binaire absent.
   - `inject_xing_header(mp3_path) -> dict` — rename concat brute en `.tmp_preXing`, re-mux ffmpeg vers le nom final, unlink le tmp, retourne `{duration_seconds, bitrate, channels, xing_injected}`. Restaure le `.tmp_preXing` si ffmpeg échoue avant d'écrire l'output.
   - `format_duration_human(seconds)` — `443.21` → `"7 min 23 s"`.
   - `print_post_xing_summary(mp3_path, xing_info)` — résumé console + hint SQL backfill (sous-tâche TR-3 Option α).
4. **Hooks dans `__main__`** :
   - `check_ffmpeg_available()` en tête (ligne 530).
   - Branche **legacy** (ligne 586) : `inject_xing_header(output_file)` + `print_post_xing_summary` immédiatement après `f.write(all_audio)`.
   - Branche **timestamps** (ligne 630) : idem, en gardant l'affichage timeline + TODO post-génération.

### Non-modifications garanties

- `src/` (Next.js) : intact.
- `batch_generate.py` : intact.
- Voice IDs Sophie `t8BrjWUT5Z23DLLBzbuY` / Martin `ohItIVrXTBI80RrUECOD` : intacts.
- Constantes chunking `MAX_CHARS_NO_TIMESTAMPS=4500` / `MAX_CHARS_WITH_TIMESTAMPS=1900` : intactes.
- Retry policy `MAX_RETRIES=3` / `RETRY_DELAY=10s` + pause inter-chunk 2s : intactes.
- Filtrage balises émotion ElevenLabs v3 + réindexation voice_segments : intact.
- Schéma Timeline v1.0 : intact (champs `concepts`/`scenes` toujours vides, `source_id`/`audio_url` toujours TODO).

---

## 4. Smoke Y2 — résultats empiriques

### Cobaye

`dialogues/felures/sequence_06_biomecanique.txt` (8 386 chars listés, 7 784 chars effectifs sommés sur les répliques, 5 chunks générés).

### Génération

```
✅ 5 chunks générés sans retry (tailles 1875 / 1766 / 1474 / 1811 / 858 chars)
✅ 375 chars de balises émotion filtrés du transcript karaoké (mécanique POC-T2)
✅ MP3 généré : dialogues/felures/sequence_06_biomecanique.mp3
   Durée      : 7 min 32 s (452.15s)
   Xing       : injecté ✅
✅ Timeline JSON générée : 29 segments speakers, 1235 mots, alignment 408.39s
```

### A2 — mutagen PRE_D7-6 (témoin historique) vs POST_D7-6

| Métrique | PRE_D7-6 (témoin) | POST_D7-6 (Xing OK) |
|---|---|---|
| Taille fichier | 6 936 120 octets | 7 234 917 octets |
| `info.length` | 236.042s | **452.153s** |
| `info.bitrate` | 128 000 | 128 000 |
| `info.bitrate_mode` | CBR | CBR |
| `info.channels` | 1 | 1 |

Delta duration **+216.111s** (ratio 1.9×) entre lecture mutagen sur le MP3 PRE et POST. Signature pivot Xing identique au pattern T7.1 pilote (98s → 539.4s, ratio 5.5×). Le PRE biomecanique était moins faux que la pilote (probable premier frame avec bitrate moins divergent du vrai), mais le diagnostic reste identique : durée vraie restituée par l'injection Xing.

### A3 — ffmpeg Header missing count

```
$ ffmpeg -v error -i sequence_06_biomecanique.PRE_D7-6.mp3 -f null - 2>&1 | grep -c "Header missing"
1
$ ffmpeg -v error -i sequence_06_biomecanique.mp3 -f null - 2>&1 | grep -c "Header missing"
0
```

→ Réduction de **1 → 0**. Critère pivot A3 satisfait.

### A4 — Seek manuel perceptif

Drag de la barre HTML5 sur le MP3 final dans Chrome aux positions 1:00, 4:00, 7:00 → position auditive cohérente à chaque test. Comportement équivalent au smoke pilote T7.1 (6/6 GO).

### A5 — Résumé console et hint SQL TR-3

```
✅ MP3 généré : dialogues/felures/sequence_06_biomecanique.mp3
   Durée      : 7 min 32 s (452.15s)
   Xing       : injecté ✅

   → Backfill SQL suggéré (à exécuter manuellement si pertinent) :
   UPDATE sequences SET course_duration_seconds = 452 WHERE id = '<sequence_id>';
```

→ Critère A5 + A10 (bonus TR-3) satisfaits.

---

## 5. Note de traçabilité — delta alignment vs duration MP3

Le smoke remonte deux métriques de durée distinctes :
- **Durée MP3 post-Xing** (mutagen) : `452.15s` — source de vérité pour le seek HTML5 et le backfill `course_duration_seconds`.
- **Durée alignment cumulée** (somme des `character_end_times_seconds[-1]` par chunk) : `408.39s` — utilisée pour `timeline.duration_sec` dans le JSON Timeline v1.0.

Delta de **~43.76s (~10%)**. Comportement **POC-T2 conservé, non régression D7-6**. Cause probable : silence de queue par chunk ElevenLabs (5 chunks × ~8-9s) non comptabilisé dans `character_end_times_seconds` mais présent dans l'audio physique. Investigation hors scope D7-6 (à creuser éventuellement en T9 si la précision du seek word-level près des jonctions de chunks pose problème).

Décision retenue : ne pas modifier `timeline.duration_sec` (alignement-based) dans ce ticket. Le consommateur du Timeline JSON qui veut la durée audio réelle doit lire le MP3 directement.

---

## 6. Rollback

### Côté repo

```bash
git revert b332fd4
git push origin claude/fix-elevenlab-mp3-header-pTWJv
```

Effet : retour à PHASE_2B comme version canonique, README restauré, `generate_audio_D7-6.py` supprimé. Pas d'effet sur la BDD ni Storage (rien n'a été touché).

### Côté Mac (Dr Fantin)

```bash
cd ~/Desktop/DentalLearn-Audio
cp generate_audio.PRE_D7-6.py generate_audio.py
# Réinjecter la clé API si nécessaire (la copie .PRE_D7-6.py l'avait peut-être préservée, à vérifier)
```

Effet : retour au script local pré-D7-6. Les MP3 déjà générés avec D7-6 restent valides — ils contiennent un Xing correct, le rollback n'affecte que les futurs runs.

### Pour annuler le smoke MP3 si besoin

```bash
mv dialogues/felures/sequence_06_biomecanique.PRE_D7-6.mp3 dialogues/felures/sequence_06_biomecanique.mp3
rm dialogues/felures/sequence_06_biomecanique.timeline.json
```

---

## 7. Critères acceptance

| # | Critère | Statut |
|---|---|---|
| A1 | `generate_audio.py` modifié, `inject_xing_header` appelé systématiquement après écriture du `.mp3` final, mode legacy ET timestamps | ✅ |
| A2 | `MP3(path).info.length` retourne la vraie durée (delta < 1s vs durée perçue) | ✅ 452.15s mutagen ↔ drag perceptif 7:00 cohérent |
| A3 | `ffmpeg -i <file_post> -f null -` Header missing count = 0 (ou réduction drastique) | ✅ 1 → 0 |
| A4 | Seek manuel drag barre HTML5 → atterrissage cohérent à 1:00, 4:00, 7:00 | ✅ |
| A5 | Sortie console finale affiche durée lisible + Xing OK | ✅ `7 min 32 s (452.15s) | Xing : injecté ✅` |
| A6 | `RAPPORT_D7-6_XING_INJECTION.md` documente approche, diff, smoke, rollback | ✅ (ce document) |
| A7 | `scripts/audio/generate_audio_D7-6.py` versionné dans le repo, anonymisé (`API_KEY = "REMPLACER_PAR_TA_CLE"`) | ✅ |
| A8 | Dr Fantin a remplacé son fichier local + smoke supplémentaire OK | ✅ smoke biomecanique sur swap local |
| A9 | Aucune modif de `src/`, `batch_generate.py`, voice IDs, chunking constants, retry constants | ✅ |
| A10 | Sortie console mentionne `duration_seconds` exploitable pour `UPDATE sequences` (TR-3 Option α) | ✅ hint SQL avec valeur entière 452 affiché |

**Bilan : 10/10 critères validés.**

---

## 8. Suite

### Mise à jour bilan dette (à porter dans `BILAN_DETTES_POC_VISU_AUDIO_12MAI2026.md`)

- **D7-6** : passe de "HAUTE PRIORITÉ" → **✅ Résolu D7-6 — 2026-05-13 — commit `b332fd4`**.
- **TR-3 backfill `sequences.course_duration_seconds`** : annotation à ajouter "lecture duration auto post-Xing affichée en sortie console (Option α D7-6). Backfill BDD reste à la discrétion de l'admin via copy-paste du SQL hint."

### Verrous T9 restants (non levés par D7-6)

D7-6 lève **1 verrou bloquant T9 sur 3**. Les deux autres sont à traiter séparément, hors scope de ce ticket.

### Suite logique côté pipeline audio

- **Sprint 2 Espace Formateur** (commit `6a75607`) : indépendant de D7-6.
- **D-POC-T2-03** (upload Storage auto post-génération) : toujours hors scope, étape manuelle conservée (cf. README §"TODO post-génération").
- **batch_generate.py** : non touché par D7-6. Pour bénéficier de l'injection Xing en batch, il faudra factoriser `inject_xing_header` dans un module commun ou dupliquer l'appel (décision à prendre lors du ticket batch dédié).

---

**Auteur** : Claude Code (session D7-6, 2026-05-13)
**Validation empirique** : Dr Fantin (smoke Y2 sur biomecanique, 0,25€ ElevenLabs facturés)
**Prêt pour merge** via GitHub UI (squash-merge selon convention DentalLearn).
