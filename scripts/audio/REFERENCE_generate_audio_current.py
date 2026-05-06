# generate_audio.py
# Script générique pour générer l'audio de n'importe quelle séquence DentalLearn
#
# USAGE :
#   python3 generate_audio.py dialogues/sequence_00_intro.txt
#   python3 generate_audio.py dialogues/sequence_01_definitions.txt
#
# FORMAT DU FICHIER TEXTE :
#   Chaque réplique commence par "Sophie:" ou "Martin:" sur une nouvelle ligne.
#   Les audio tags ElevenLabs v3 sont supportés : [excited], [curious], etc.
#   Les lignes vides et les lignes commençant par # sont ignorées.

import os
import sys
import time
from elevenlabs.client import ElevenLabs

# --- CONFIGURATION ---
API_KEY = "REMPLACER_PAR_TA_CLE"  # Clé locale uniquement, jamais committée

# Voice IDs — modifie si tu changes de voix
VOICES = {
    "Sophie": "t8BrjWUT5Z23DLLBzbuY",
    "Martin": "ohItIVrXTBI80RrUECOD",
}

# Vitesse (1.0 = normal, 1.1 = légèrement plus rapide, max 1.2)
SPEED = 1.1

# Limite de caractères par requête API
MAX_CHARS = 4500  # Marge sous la limite de 5000

# Nombre de tentatives en cas d'erreur réseau
MAX_RETRIES = 3
RETRY_DELAY = 10  # secondes entre chaque tentative


# --- LECTURE DU FICHIER DIALOGUE ---
def parse_dialogue(filepath):
    """Lit un fichier texte et retourne la liste des répliques."""
    inputs = []
    current_speaker = None
    current_text = ""

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            # Ignorer lignes vides et commentaires
            if not line or line.startswith("#"):
                if current_speaker and current_text:
                    inputs.append({
                        "text": current_text.strip(),
                        "voice_id": VOICES[current_speaker],
                        "speaker": current_speaker,
                    })
                    current_text = ""
                    current_speaker = None
                continue

            # Détecter un changement de speaker
            speaker_found = False
            for name in VOICES:
                if line.startswith(f"{name}:"):
                    if current_speaker and current_text:
                        inputs.append({
                            "text": current_text.strip(),
                            "voice_id": VOICES[current_speaker],
                            "speaker": current_speaker,
                        })
                    current_speaker = name
                    current_text = line[len(f"{name}:"):].strip()
                    speaker_found = True
                    break

            if not speaker_found and current_speaker:
                current_text += " " + line

    # Dernière réplique
    if current_speaker and current_text:
        inputs.append({
            "text": current_text.strip(),
            "voice_id": VOICES[current_speaker],
            "speaker": current_speaker,
        })

    return inputs


def split_into_chunks(inputs, max_chars):
    """Découpe les répliques en groupes qui respectent la limite de caractères."""
    chunks = []
    current_chunk = []
    current_chars = 0

    for item in inputs:
        item_chars = len(item["text"])

        if current_chars + item_chars > max_chars and current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
            current_chars = 0

        current_chunk.append(item)
        current_chars += item_chars

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def generate_chunk(client, chunk, chunk_index, total_chunks):
    """Génère l'audio d'un chunk avec retry automatique."""
    chars = sum(len(item["text"]) for item in chunk)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if total_chunks > 1:
                print(f"   → Partie {chunk_index + 1}/{total_chunks} ({chars} car.)...", end="")
                if attempt > 1:
                    print(f" (tentative {attempt}/{MAX_RETRIES})", end="")
                print()

            audio = client.text_to_dialogue.convert(
                inputs=chunk,
                settings={"speed": SPEED},
            )

            audio_data = b""
            for audio_chunk in audio:
                audio_data += audio_chunk

            if total_chunks > 1:
                print(f"   ✅ Partie {chunk_index + 1} OK")
            return audio_data

        except Exception as e:
            error_msg = str(e)
            if attempt < MAX_RETRIES:
                print(f"\n   ⚠️  Erreur réseau partie {chunk_index + 1}: {error_msg[:80]}...")
                print(f"   ⏳ Nouvelle tentative dans {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
            else:
                print(f"\n   ❌ Échec partie {chunk_index + 1} après {MAX_RETRIES} tentatives")
                raise


# --- MAIN ---
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage : python3 generate_audio.py <fichier_dialogue.txt>")
        print("Exemple : python3 generate_audio.py dialogues/sequence_00_intro.txt")
        sys.exit(1)

    input_file = sys.argv[1]

    if not os.path.exists(input_file):
        print(f"❌ Fichier introuvable : {input_file}")
        sys.exit(1)

    output_file = os.path.splitext(input_file)[0] + ".mp3"

    # Parser le dialogue
    print(f"📖 Lecture de : {input_file}")
    inputs = parse_dialogue(input_file)
    total_chars = sum(len(item["text"]) for item in inputs)
    print(f"   → {len(inputs)} répliques détectées ({total_chars} caractères)")

    # Aperçu
    for i, item in enumerate(inputs):
        preview = item["text"][:60] + "..." if len(item["text"]) > 60 else item["text"]
        print(f"   {i+1}. {item['speaker']}: {preview}")

    # Découper si nécessaire
    chunks = split_into_chunks(inputs, MAX_CHARS)

    # Préparer les inputs pour l'API (retirer le champ "speaker")
    for chunk in chunks:
        for item in chunk:
            del item["speaker"]

    print(f"\n🎙️  Génération en cours (speed={SPEED})...")
    if len(chunks) > 1:
        print(f"   → Dialogue découpé en {len(chunks)} parties (limite API 5000 car.)")

    client = ElevenLabs(api_key=API_KEY)
    all_audio = b""

    for i, chunk in enumerate(chunks):
        chunk_audio = generate_chunk(client, chunk, i, len(chunks))
        all_audio += chunk_audio

        # Pause entre les parties pour éviter le rate limiting
        if i < len(chunks) - 1:
            time.sleep(2)

    # Sauvegarder
    with open(output_file, "wb") as f:
        f.write(all_audio)

    print(f"\n✅ Audio généré : {output_file}")
    print(f"📁 Chemin complet : {os.path.abspath(output_file)}")
