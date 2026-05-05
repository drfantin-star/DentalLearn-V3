# scripts/audio — Phase 2A POC-T2 staging

Ces fichiers sont destinés à être copiés dans `~/Desktop/DentalLearn-Audio/`
sur la machine locale Dr Fantin. Le script Python de production
`generate_audio.py` vit hors repo (cf. ticket POC-T2) ; ce dossier sert
uniquement de **zone de staging versionnée** pour les livrables Phase 2A.

## Contenu

| Fichier | Rôle |
|---|---|
| `test_eleven_labs_with_timestamps.py` | Script de test isolé Phase 2A — valide en réel le format de réponse de `client.text_to_dialogue.convert_with_timestamps`. |
| `POC_T2_PHASE_A_OBSERVATIONS.md` | Template d'observations à compléter après le run. |

> **Hors scope ici** : le `generate_audio.py` actuel n'est **pas** committé.
> Il contient la clé API en clair et doit rester hors repo.

## Procédure d'exécution (Dr Fantin)

```bash
# 1. Copier le script de test à côté du generate_audio.py local
cp scripts/audio/test_eleven_labs_with_timestamps.py ~/Desktop/DentalLearn-Audio/
cp scripts/audio/POC_T2_PHASE_A_OBSERVATIONS.md      ~/Desktop/DentalLearn-Audio/

# 2. Lancer le test (~50 mots, coût négligeable)
cd ~/Desktop/DentalLearn-Audio
python3 test_eleven_labs_with_timestamps.py

# 3. Le script produit 3 fichiers :
#    - test_response_raw.json       → dump complet de la réponse SDK
#    - test_response_audio.mp3      → audio décodé (validation auditive)
#    - test_response_summary.txt    → résumé lisible (mots échantillonnés)

# 4. Compléter POC_T2_PHASE_A_OBSERVATIONS.md :
#    - Recopier les ✅/❌ console (section 1)
#    - Écouter test_response_audio.mp3 et noter les écarts (section 2)
#    - Décider GO / NO-GO (section 4)
```

## Point d'arrêt obligatoire

À l'issue de Phase 2A, on **stoppe**. Phase 2B (modification effective de
`generate_audio.py`) n'est lancée qu'après validation explicite Dr Fantin sur
ce document d'observations. Cf. §10 ticket 2 de
`spec_poc_visualisation_audio_v1_0`.

## Sécurité

- Ne **jamais** committer `generate_audio.py` ni les fichiers de dump dans le
  repo (la clé API y figure en clair côté local, et les dumps peuvent contenir
  l'audio + transcription).
- Si une clé API a été exposée (chat, screenshot, log…), la révoquer
  immédiatement depuis le dashboard ElevenLabs et regénérer.
