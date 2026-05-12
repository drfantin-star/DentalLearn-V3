# scripts/audio — POC-T2 staging

Ces fichiers sont destinés à être copiés dans `~/Desktop/DentalLearn-Audio/`
sur la machine locale Dr Fantin. Le script Python de production
`generate_audio.py` vit hors repo (cf. ticket POC-T2) ; ce dossier sert
uniquement de **zone de staging versionnée** pour les livrables POC.

> **Version canonique à utiliser côté Mac (post D7-6) : `generate_audio_D7-6.py`.**
> Elle remplace `generate_audio_PHASE_2B.py` (conservée pour traçabilité), avec
> en plus l'injection du header Xing post-concat (ffmpeg libmp3lame `-write_xing 1`)
> qui résout le bug de durée mensongère + désync seek HTML5. Cf. `RAPPORT_D7-6_XING_INJECTION.md`.

## Contenu

| Fichier | Rôle | Phase |
|---|---|---|
| `test_eleven_labs_with_timestamps.py` | Script de test isolé — valide en réel le format de réponse de `client.text_to_dialogue.convert_with_timestamps`. | 2A |
| `POC_T2_PHASE_A_OBSERVATIONS.md` | Observations Phase 2A (rempli, GO formel Dr Fantin du 5 mai 2026). | 2A |
| `REFERENCE_generate_audio_current.py` | Snapshot anonymisé (clé API en placeholder) du `generate_audio.py` local Dr Fantin avant Phase 2B. Sert de référence pour vérifier la compatibilité descendante. | 2B |
| `generate_audio_PHASE_2B.py` | Version POC-T2 avec mode `WITH_TIMESTAMPS=True` qui produit `.mp3` + `.timeline.json`. Compat descendante stricte avec le legacy si `WITH_TIMESTAMPS=False`. **Conservé pour traçabilité, ne pas copier en Mac.** | 2B |
| `POC_T2_PHASE_B_RECAP.md` | Template de récap à compléter par Dr Fantin après run sur **Communication et Écoute Active S2**. | 2B |
| `generate_audio_D7-6.py` | **Version canonique courante.** Identique à PHASE_2B + injection du header Xing post-concat via `ffmpeg -c:a libmp3lame -b:a 128k -ar 44100 -ac 1 -write_xing 1` (flags pivots T7.1). Dépendance externe ajoutée : `ffmpeg` (`brew install ffmpeg` sur macOS). | D7-6 |

> **Hors scope ici** : le `generate_audio.py` actuel (avec clé API en clair)
> n'est **pas** committé. Il vit chez Dr Fantin.

---

## Phase 2A — exécution (DÉJÀ FAITE, mergée via PR #241)

```bash
cp scripts/audio/test_eleven_labs_with_timestamps.py ~/Desktop/DentalLearn-Audio/
cp scripts/audio/POC_T2_PHASE_A_OBSERVATIONS.md      ~/Desktop/DentalLearn-Audio/
cd ~/Desktop/DentalLearn-Audio
python3 test_eleven_labs_with_timestamps.py
```

Résultat acquis :
- `audio_base_64` (avec underscore) confirmé comme attribut SDK
- `normalized_alignment` présent et préféré à `alignment`
- `voice_segments[]` livré par l'API → simplifie la segmentation Sophie/Martin

---

## Phase 2B — modification de `generate_audio.py`

### Procédure de remplacement (Dr Fantin)

> Depuis D7-6, c'est `generate_audio_D7-6.py` qui doit être copié — il
> remplace `generate_audio_PHASE_2B.py` côté Mac.

```bash
# 1. Backup obligatoire de l'existant
cp ~/Desktop/DentalLearn-Audio/generate_audio.py \
   ~/Desktop/DentalLearn-Audio/generate_audio.py.backup_$(date +%Y%m%d_%H%M%S)

# 2. Copie de la version canonique courante (D7-6) en remplacement
cp scripts/audio/generate_audio_D7-6.py \
   ~/Desktop/DentalLearn-Audio/generate_audio.py

# 3. Réinjection de la clé API
#    Éditer ~/Desktop/DentalLearn-Audio/generate_audio.py au niveau du
#    bloc CONFIGURATION (constante API_KEY) :
#    API_KEY = "REMPLACER_PAR_TA_CLE"   →   API_KEY = "<la vraie clé locale>"

# 4. Pré-requis D7-6 (à vérifier une seule fois sur la machine)
which ffmpeg || brew install ffmpeg
```

### Bascule du mode

Dans le fichier, ligne `WITH_TIMESTAMPS = True` :
- `True`  (défaut Phase 2B) : endpoint `convert_with_timestamps`, produit `.mp3` + `.timeline.json`, limite chunk **1900 car**.
- `False` : comportement legacy strict (= ancien `generate_audio.py`), produit uniquement `.mp3`, limite chunk **4500 car**. Aucun changement comportemental vs avant Phase 2B.

### Test recommandé sur S2

```bash
cd ~/Desktop/DentalLearn-Audio
python3 generate_audio.py dialogues/communication_ecoute_active_s2.txt
```

Sortie attendue :
- `dialogues/communication_ecoute_active_s2.mp3`
- `dialogues/communication_ecoute_active_s2.timeline.json`

### Vérifications post-run

```bash
# 1. JSON valide + clés attendues
python3 -c "import json; d=json.load(open('dialogues/communication_ecoute_active_s2.timeline.json')); print(sorted(d.keys())); print('segments:', len(d['transcript']['segments'])); print('duration:', d['duration_sec'])"

# 2. 10 mots tirés au hasard pour la validation auditive (<100 ms d'écart)
python3 -c "
import json, random
d = json.load(open('dialogues/communication_ecoute_active_s2.timeline.json'))
all_words = [w for s in d['transcript']['segments'] for w in s['words']]
for w in random.sample(all_words, min(10, len(all_words))):
    print(f\"{w['start_sec']:.2f}s → {w['text']}\")
"
```

Puis ouvrir le `.mp3` dans un lecteur capable de seek à la seconde près et vérifier l'écart sur les 10 mots tirés.

---

## Format Timeline v1.0 produit

Conforme spec §2.1 de `spec_poc_visualisation_audio_v1_0` :

```json
{
  "schema_version": "1.0",
  "source_type": "formation_sequence",
  "source_id": "TODO_REMPLIR_MANUELLEMENT_AVANT_UPLOAD",
  "audio_url": "TODO_REMPLIR_APRES_UPLOAD_SUPABASE",
  "duration_sec": 612.34,
  "generated_at": "2026-05-05T14:30:00Z",
  "generator": "auto_python_pipeline",
  "transcript": {
    "segments": [
      {
        "start_sec": 0.0,
        "end_sec": 6.8,
        "speaker": "sophie",
        "text": "Bonjour Martin, on parle aujourd'hui...",
        "words": [
          { "text": "Bonjour", "start_sec": 0.0, "end_sec": 0.4 },
          { "text": "Martin,", "start_sec": 0.5, "end_sec": 0.9 }
        ]
      }
    ]
  },
  "concepts": [],
  "scenes": []
}
```

Champs `concepts` et `scenes` sont volontairement vides côté pipeline Python — ils seront remplis par l'agent LLM (ticket T5) ou par l'éditeur admin (ticket T6).

---

## TODO post-génération (manuel pour le POC)

Le script ne touche pas Supabase. Après chaque génération, **étapes manuelles** :

1. Uploader le `.mp3` dans le bucket Storage `audio` (existant)
2. Récupérer l'URL publique → remplacer `audio_url` dans le `.timeline.json`
3. Récupérer l'UUID de la `sequence` Supabase → remplacer `source_id`
4. Uploader le `.timeline.json` dans le bucket Storage `audio-timelines` (créé par PR #240)
5. UPDATE en BDD : `sequences.timeline_url = <URL>` + `timeline_published = true` (colonnes créées par PR #240)

Cette automatisation viendra dans T7 (ticket d'intégration).

---

## Sécurité

- Ne **jamais** committer `generate_audio.py` (la version locale qui contient la clé), ni les fichiers de dump (`test_response_*`).
- Le `REFERENCE_generate_audio_current.py` du repo est **anonymisé** (clé = placeholder).
- Si une clé API a été exposée (chat, screenshot, log…), la révoquer immédiatement depuis le dashboard ElevenLabs.
