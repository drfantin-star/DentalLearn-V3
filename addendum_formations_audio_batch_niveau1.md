# Addendum — Wrapper batch audio formations (Niveau 1)
## Pipeline bonus indépendant du pipeline News

**Document parent** : `spec_news_podcast_pipeline_v1_3.md` (Ticket 11)
**Date** : 26 avril 2026
**Statut** : Spec validée, prête pour implémentation
**Indépendance** : aucune dépendance avec les tickets News (1 à 10). Réalisable en parallèle.

---

## 1. Contexte

Dr Fantin produit des formations Dentalschool selon le workflow documenté dans `SYNTHESE_FONCTIONNALITES_DENTALLEARN_V3.md` §3 et `TEMPLATE_NOTEBOOKLM_DENTALLEARN_v2.md` :

```
Articles formateur → NotebookLM → Plan 15 séquences → Scripts dialogue Sophie/Martin
                                                       ↓
                                               generate_audio.py (séquence par séquence)
                                                       ↓
                                                  15 MP3
                                                       ↓
                                            Upload bucket Supabase "formations"
                                                       ↓
                                             SQL import sequences + questions
```

**Frottement actuel** : la génération audio se fait **séquence par séquence** en CLI manuelle, soit 15 commandes terminal par formation (avec attente de fin de chaque génération avant de lancer la suivante). Pour les futures formations Axe 3 et Axe 4 (13 formations à créer d'ici fin 2026), c'est chronophage et source d'oublis.

---

## 2. Objectif Niveau 1

Un **wrapper Python en ligne de commande** qui :
- Prend en entrée un dossier contenant les 15 (ou n) scripts `.txt` validés d'une formation
- Lance `generate_audio.py` séquentiellement pour chaque script
- Affiche la progression en temps réel
- Gère les erreurs et reprises (skip si MP3 déjà existant et option `--force`)
- Produit un log détaillé en fin d'exécution
- Aucune modification de `generate_audio.py` lui-même

Ce qui n'est **PAS** dans le Niveau 1 (réservé Niveau 2 ultérieur) :
- Interface admin web
- Upload automatique vers Supabase Storage
- Mise à jour automatique de `sequences.course_media_url`
- Gestion multi-formations en parallèle
- Notifications

---

## 3. Spécification détaillée

### 3.1 Localisation du script
- Dossier : `~/Desktop/DentalLearn-Audio/`
- Nouveau fichier : `batch_generate.py`
- Le wrapper appelle `generate_audio.py` du même dossier (subprocess)

### 3.2 Sécurisation préalable de la clé API
**Avant tout** : sortir la clé `API_KEY` ligne 19 de `generate_audio.py` vers une variable d'environnement.

```python
# Dans generate_audio.py — modification minimale ligne 19
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("ELEVENLABS_API_KEY")
if not API_KEY:
    raise RuntimeError("ELEVENLABS_API_KEY manquante. Ajoute-la dans ~/.dentalearn-audio.env ou .env local.")
```

Créer `~/Desktop/DentalLearn-Audio/.env` (gitignored) :
```bash
ELEVENLABS_API_KEY=sk_eca663a67b158206515b4aaa69816889f392fbe2f2aab2fd
```

Installer la dépendance : `pip3 install python-dotenv`.

### 3.3 Interface CLI du wrapper

```bash
python3 batch_generate.py <dossier_formation> [options]

Options:
  --pattern PATTERN   Glob des fichiers à traiter (défaut: "sequence_*.txt")
  --force             Re-génère même si le MP3 existe déjà
  --dry-run           Liste ce qui serait fait sans générer
  --order asc|num     Tri ascii ou numérique des séquences (défaut: num)
  --pause-sec N       Pause entre 2 séquences en secondes (défaut: 5)
  --log-file PATH     Chemin du log JSON (défaut: <dossier>/batch_log_YYYYMMDD-HHMMSS.json)
```

**Exemples d'usage** :

```bash
# Cas typique : générer toutes les séquences d'une formation
cd ~/Desktop/DentalLearn-Audio
python3 batch_generate.py dialogues/communication

# Re-génération forcée (override des MP3 existants)
python3 batch_generate.py dialogues/felures --force

# Tester sans générer
python3 batch_generate.py dialogues/eclaircissements --dry-run

# Pattern personnalisé (ex : seulement les séquences de S5 à S10)
python3 batch_generate.py dialogues/felures --pattern "sequence_0[5-9]_*.txt sequence_10_*.txt"
```

### 3.4 Comportement attendu

**Au démarrage** :
- Liste les `.txt` matchant le pattern
- Pour chacun, vérifie si le `.mp3` existe déjà
- Affiche un récapitulatif :

```
📂 Dossier : dialogues/communication
🔍 14 fichiers texte trouvés
✅  6 déjà générés (sequence_00 à sequence_05)
🆕  8 à générer (sequence_06 à sequence_13)
⏱️  Estimation : ~12 min total

Continuer ? [O/n]
```

**Pendant la génération** :
- Pour chaque séquence, output stylé :

```
[3/8] 🎙️  sequence_06_techniques.txt (842 caractères)
   → Appel generate_audio.py...
   → Partie 1/1 OK
   ✅ sequence_06_techniques.mp3 généré (47s)
   ⏱️  Pause 5s avant la prochaine séquence...
```

**En cas d'erreur** :
- Catch l'erreur, log détaillé, propose de continuer ou stopper
- Si l'utilisateur choisit "continuer", saute la séquence en erreur et la marque dans le log final

**À la fin** :
- Récapitulatif global

```
═══════════════════════════════════
📊 Récapitulatif batch
═══════════════════════════════════
✅ Réussies     : 7
❌ Échouées      : 1 (sequence_09_temporisation.txt — timeout API)
⏭️  Sautées      : 0
⏱️  Durée totale : 8 min 42 s
💰 Caractères   : 9 847 (≈ 0,49 € ElevenLabs Creator)

📄 Log détaillé : dialogues/communication/batch_log_20260426-143012.json
```

### 3.5 Format du log JSON

```json
{
  "started_at": "2026-04-26T14:30:12",
  "ended_at": "2026-04-26T14:38:54",
  "duration_seconds": 522,
  "folder": "dialogues/communication",
  "total_chars": 9847,
  "estimated_cost_eur": 0.49,
  "sequences": [
    {
      "file": "sequence_06_techniques.txt",
      "status": "success",
      "chars": 842,
      "duration_seconds": 47,
      "mp3_path": "sequence_06_techniques.mp3"
    },
    {
      "file": "sequence_09_temporisation.txt",
      "status": "error",
      "chars": 1052,
      "error": "ConnectionError: HTTPSConnectionPool timeout"
    }
  ]
}
```

### 3.6 Gestion des erreurs et reprises

- Aucune retry interne (les retries sont gérés par `generate_audio.py` lui-même, 3 tentatives × 10s)
- Si une séquence échoue : prompt utilisateur "continuer / stopper / réessayer cette séquence ?"
- Si l'utilisateur stoppe : le log JSON est quand même écrit avec l'état partiel

### 3.7 Code structurel suggéré

```python
# batch_generate.py — squelette indicatif

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ELEVENLABS_COST_PER_1000_CHARS_EUR = 0.05  # ordre de grandeur Creator plan

def parse_args():
    p = argparse.ArgumentParser(...)
    p.add_argument("folder")
    p.add_argument("--pattern", default="sequence_*.txt")
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--order", choices=["asc","num"], default="num")
    p.add_argument("--pause-sec", type=int, default=5)
    p.add_argument("--log-file", default=None)
    return p.parse_args()

def list_sequences(folder, pattern, order):
    files = sorted(Path(folder).glob(pattern))
    if order == "num":
        # tri numérique sur sequence_NN_*
        files.sort(key=lambda f: int(re.search(r"sequence_(\d+)", f.name).group(1)) if re.search(r"sequence_(\d+)", f.name) else 9999)
    return files

def needs_generation(txt_path, force):
    mp3_path = txt_path.with_suffix(".mp3")
    return force or not mp3_path.exists()

def confirm_or_exit(prompt):
    rep = input(prompt + " [O/n] ").strip().lower()
    if rep == "n":
        sys.exit(0)

def generate_one(txt_path):
    start = time.time()
    result = subprocess.run(
        ["python3", "generate_audio.py", str(txt_path)],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).parent),
    )
    duration = int(time.time() - start)
    if result.returncode != 0:
        return {"status": "error", "duration_seconds": duration, "error": result.stderr.strip()[:300]}
    return {"status": "success", "duration_seconds": duration, "mp3_path": str(txt_path.with_suffix(".mp3"))}

def main():
    args = parse_args()
    folder = Path(args.folder).resolve()
    if not folder.is_dir():
        sys.exit(f"❌ Dossier introuvable : {folder}")
    sequences = list_sequences(folder, args.pattern, args.order)
    to_do = [s for s in sequences if needs_generation(s, args.force)]
    already = [s for s in sequences if s not in to_do]

    print(f"📂 Dossier : {folder}")
    print(f"🔍 {len(sequences)} fichiers texte trouvés")
    print(f"✅ {len(already)} déjà générés")
    print(f"🆕 {len(to_do)} à générer")
    if args.dry_run:
        for s in to_do:
            print(f"   • {s.name}")
        sys.exit(0)
    if not to_do:
        sys.exit("Rien à faire.")
    confirm_or_exit("Continuer ?")

    log = {
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "folder": str(folder),
        "sequences": [],
    }
    total_chars = 0

    for i, seq in enumerate(to_do, 1):
        chars = seq.read_text(encoding="utf-8").__len__()
        total_chars += chars
        print(f"\n[{i}/{len(to_do)}] 🎙️  {seq.name} ({chars} car.)")
        result = generate_one(seq)
        result["file"] = seq.name
        result["chars"] = chars
        log["sequences"].append(result)
        if result["status"] == "success":
            print(f"   ✅ Généré en {result['duration_seconds']}s")
        else:
            print(f"   ❌ Erreur : {result['error']}")
            confirm_or_exit("Continuer malgré tout ?")
        if i < len(to_do):
            print(f"   ⏱️  Pause {args.pause_sec}s...")
            time.sleep(args.pause_sec)

    log["ended_at"] = datetime.now().isoformat(timespec="seconds")
    log["total_chars"] = total_chars
    log["estimated_cost_eur"] = round(total_chars / 1000 * ELEVENLABS_COST_PER_1000_CHARS_EUR, 2)

    log_path = Path(args.log_file) if args.log_file else folder / f"batch_log_{datetime.now():%Y%m%d-%H%M%S}.json"
    log_path.write_text(json.dumps(log, indent=2, ensure_ascii=False), encoding="utf-8")

    success = sum(1 for s in log["sequences"] if s["status"] == "success")
    errors = sum(1 for s in log["sequences"] if s["status"] == "error")
    print(f"\n═══ Récapitulatif ═══")
    print(f"✅ Réussies : {success}")
    print(f"❌ Échouées : {errors}")
    print(f"💰 ~{log['estimated_cost_eur']} € ElevenLabs")
    print(f"📄 Log : {log_path}")

if __name__ == "__main__":
    main()
```

---

## 4. Critères d'acceptation Ticket 11

- [ ] `batch_generate.py` créé dans `~/Desktop/DentalLearn-Audio/`
- [ ] `generate_audio.py` modifié pour lire la clé API depuis `.env` (impact compatibilité : test que les anciens usages CLI individuels fonctionnent toujours)
- [ ] `.env` créé avec `ELEVENLABS_API_KEY` et ajouté à `.gitignore`
- [ ] Dépendance `python-dotenv` installée
- [ ] Test sur le dossier existant `dialogues/felures/` : passe en mode `--dry-run`, retourne la liste correcte
- [ ] Test reprise : si un MP3 existe déjà, il est skippé (sauf `--force`)
- [ ] Test erreur : si on coupe le réseau pendant un appel, le log JSON contient bien l'erreur et permet de reprendre
- [ ] README mis à jour dans le dossier `DentalLearn-Audio/` avec la commande type
- [ ] Test E2E sur une formation entière (15 séquences) : complète sans intervention en moins de 15 min

---

## 5. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Casser le `generate_audio.py` actuel pendant la modif clé API | Tester l'usage CLI individuel après modif. Garder un fallback `os.getenv("ELEVENLABS_API_KEY", LEGACY_KEY)` pendant 1 semaine si paranoïa. |
| Rate limit ElevenLabs sur batch long | Pause configurable entre séquences (défaut 5s, ajustable). |
| Coût caché si batch lancé par erreur sur grosse formation | Mode `--dry-run` obligatoire à recommander dans la doc. Estimation coût affichée avant lancement. |
| Le batch crashe au milieu | Log JSON écrit à chaque séquence, pas seulement à la fin → état partiel récupérable. |

---

## 6. Évolutions Niveau 2 (hors scope ce ticket)

À titre indicatif, le Niveau 2 ajouterait :
- Interface admin web `/admin/formations/{id}/audio-batch`
- Upload des `.txt` directement depuis l'UI
- Génération côté serveur (Edge Function ou worker)
- Upload automatique vers Supabase Storage `formations/{formation-slug}/sequence_NN.mp3`
- Mise à jour automatique `sequences.course_media_url`
- Notifications email à Dr Fantin une fois la formation complète audio
- Statistiques cumulées (caractères générés, coût mensuel)

À évaluer si tu te retrouves à produire >2 formations par mois.

---

*Fin de l'addendum. Ticket 11 indépendant, prêt à être attaqué en parallèle des tickets News.*
