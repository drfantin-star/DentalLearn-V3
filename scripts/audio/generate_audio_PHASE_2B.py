# generate_audio.py — Phase 2B POC-T2
# Script générique pour générer l'audio + la timeline JSON de n'importe quelle
# séquence DentalLearn.
#
# USAGE :
#   python3 generate_audio.py dialogues/sequence_00_intro.txt
#   python3 generate_audio.py dialogues/sequence_01_definitions.txt
#
# FORMAT DU FICHIER TEXTE :
#   Chaque réplique commence par "Sophie:" ou "Martin:" sur une nouvelle ligne.
#   Les audio tags ElevenLabs v3 sont supportés : [excited], [curious], etc.
#   Les lignes vides et les lignes commençant par # sont ignorées.
#
# MODE TIMESTAMPS (POC visualisation audio enrichie) :
#   Bascule via la constante WITH_TIMESTAMPS ci-dessous.
#     - True  → endpoint convert_with_timestamps + écriture du .timeline.json
#     - False → comportement legacy strict (= ancien generate_audio.py)
#   En mode True, la limite par chunk passe à 1900 car. (vs 4500 en legacy).
#
# SORTIE :
#   - sequence_XX.mp3                                (toujours)
#   - sequence_XX.timeline.json                      (uniquement si WITH_TIMESTAMPS=True)
#
# POST-GÉNÉRATION (manuel pour le POC) :
#   Compléter dans le .timeline.json :
#     - source_id  → UUID de la sequence Supabase (table sequences)
#     - audio_url  → URL publique après upload Storage
#   Voir scripts/audio/README.md pour la procédure complète.

import base64
import json
import os
import sys
import time
from datetime import datetime, timezone

from elevenlabs.client import ElevenLabs

# --- CONFIGURATION ---
API_KEY = "REMPLACER_PAR_TA_CLE"  # Clé locale uniquement, jamais committée

# Voice IDs — modifie si tu changes de voix
VOICES = {
    "Sophie": "t8BrjWUT5Z23DLLBzbuY",
    "Martin": "ohItIVrXTBI80RrUECOD",
}

# Mapping voice_id → speaker normalisé pour la Timeline v1.0 (lowercase)
VOICE_ID_TO_SPEAKER = {
    "t8BrjWUT5Z23DLLBzbuY": "sophie",
    "ohItIVrXTBI80RrUECOD": "martin",
}

# Vitesse (1.0 = normal, 1.1 = légèrement plus rapide, max 1.2)
SPEED = 1.1

# Limite de caractères par requête API
# Legacy : MAX_CHARS = 4500 (marge sous limite 5000 du convert)
# With timestamps : convert_with_timestamps a une limite plus stricte ~2000 car.
MAX_CHARS_NO_TIMESTAMPS = 4500
MAX_CHARS_WITH_TIMESTAMPS = 1900
MAX_CHARS = MAX_CHARS_NO_TIMESTAMPS  # conservé pour compat descendante

# Bascule POC visualisation audio enrichie
WITH_TIMESTAMPS = True

# Nombre de tentatives en cas d'erreur réseau
MAX_RETRIES = 3
RETRY_DELAY = 10  # secondes entre chaque tentative

SCHEMA_VERSION = "1.0"
GENERATOR_TAG = "auto_python_pipeline"


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
    """Génère l'audio d'un chunk avec retry automatique (mode legacy, sans timestamps)."""
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


# --- PIPELINE WITH-TIMESTAMPS (Phase 2B) ---
# Les noms de champs SDK sont figés sur la structure réelle observée en Phase 2A
# (cf. scripts/audio/test_response_raw_REFERENCE.json) — tout est snake_case et
# stable. Pas de fallback de naming.

def generate_chunk_with_timestamps(client, chunk, chunk_index, total_chunks):
    """
    Variante de generate_chunk qui retourne (audio_bytes, alignment_dict, voice_segments_list).

    alignment_dict      : {characters, character_start_times_seconds, character_end_times_seconds}
    voice_segments_list : [{voice_id, start_time_seconds, end_time_seconds,
                            character_start_index, character_end_index}, ...]
    """
    chars = sum(len(item["text"]) for item in chunk)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if total_chunks > 1:
                print(f"   → Partie {chunk_index + 1}/{total_chunks} ({chars} car.)...", end="")
                if attempt > 1:
                    print(f" (tentative {attempt}/{MAX_RETRIES})", end="")
                print()

            response = client.text_to_dialogue.convert_with_timestamps(
                inputs=chunk,
                settings={"speed": SPEED},
            )

            audio_bytes = base64.b64decode(response.audio_base_64)
            alignment = response.normalized_alignment
            alignment_dict = {
                "characters": list(alignment.characters),
                "character_start_times_seconds": [float(t) for t in alignment.character_start_times_seconds],
                "character_end_times_seconds": [float(t) for t in alignment.character_end_times_seconds],
            }
            voice_segments = [
                {
                    "voice_id": seg.voice_id,
                    "start_time_seconds": float(seg.start_time_seconds),
                    "end_time_seconds": float(seg.end_time_seconds),
                    "character_start_index": int(seg.character_start_index),
                    "character_end_index": int(seg.character_end_index),
                }
                for seg in response.voice_segments
            ]

            if total_chunks > 1:
                print(f"   ✅ Partie {chunk_index + 1} OK")
            return audio_bytes, alignment_dict, voice_segments

        except Exception as e:
            error_msg = str(e)
            if attempt < MAX_RETRIES:
                print(f"\n   ⚠️  Erreur réseau partie {chunk_index + 1}: {error_msg[:80]}...")
                print(f"   ⏳ Nouvelle tentative dans {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
            else:
                print(f"\n   ❌ Échec partie {chunk_index + 1} après {MAX_RETRIES} tentatives")
                raise


def merge_chunk_results(chunk_alignments, chunk_voice_segments):
    """
    Concatène alignments + voice_segments de tous les chunks en offsetant à la fois
    les timestamps (cumulative duration) et les indices caractères (cumulative count).

    Retourne (merged_chars, merged_starts, merged_ends, merged_voice_segments, total_duration_sec)
    où chaque voice_segment porte des indices et timestamps déjà offsetés (utilisables
    directement comme slices sur merged_chars/starts/ends).
    """
    merged_chars = []
    merged_starts = []
    merged_ends = []
    merged_voice_segments = []

    time_offset = 0.0
    char_offset = 0

    for alignment, voice_segments in zip(chunk_alignments, chunk_voice_segments):
        merged_chars.extend(alignment["characters"])
        merged_starts.extend(t + time_offset for t in alignment["character_start_times_seconds"])
        merged_ends.extend(t + time_offset for t in alignment["character_end_times_seconds"])

        for seg in voice_segments:
            merged_voice_segments.append({
                "voice_id": seg["voice_id"],
                "start_sec": seg["start_time_seconds"] + time_offset,
                "end_sec": seg["end_time_seconds"] + time_offset,
                "char_start": seg["character_start_index"] + char_offset,
                "char_end": seg["character_end_index"] + char_offset,
            })

        chunk_duration = alignment["character_end_times_seconds"][-1] if alignment["character_end_times_seconds"] else 0.0
        time_offset += chunk_duration
        char_offset += len(alignment["characters"])

    return merged_chars, merged_starts, merged_ends, merged_voice_segments, time_offset


def characters_to_words(chars, starts, ends):
    """
    Regroupe une tranche de caractères en mots par split sur espace / saut de ligne / tab.
    Retourne [{text, start_sec, end_sec}, ...].
    """
    words = []
    cur_chars = []
    cur_start = None
    prev_end = None

    for ch, s, e in zip(chars, starts, ends):
        if ch in (" ", "\n", "\t"):
            if cur_chars:
                words.append({
                    "text": "".join(cur_chars),
                    "start_sec": float(cur_start),
                    "end_sec": float(prev_end),
                })
                cur_chars = []
                cur_start = None
        else:
            if not cur_chars:
                cur_start = s
            cur_chars.append(ch)
            prev_end = e

    if cur_chars:
        words.append({
            "text": "".join(cur_chars),
            "start_sec": float(cur_start),
            "end_sec": float(prev_end),
        })
    return words


def build_segments(merged_voice_segments, merged_chars, merged_starts, merged_ends):
    """
    Reconstruit les segments transcript de la Timeline v1.0.

    Pour chaque voice_segment, on slice merged_chars/starts/ends sur
    [char_start:char_end] (indices déterministes fournis par l'API ElevenLabs).
    """
    segments = []
    for seg in merged_voice_segments:
        speaker = VOICE_ID_TO_SPEAKER.get(seg["voice_id"])
        if speaker is None:
            raise RuntimeError(
                f"voice_id inconnu : {seg['voice_id']}. "
                "Mettre à jour VOICE_ID_TO_SPEAKER dans generate_audio.py."
            )
        cs, ce = seg["char_start"], seg["char_end"]
        slice_chars = merged_chars[cs:ce]
        slice_starts = merged_starts[cs:ce]
        slice_ends = merged_ends[cs:ce]
        words = characters_to_words(slice_chars, slice_starts, slice_ends)
        segments.append({
            "start_sec": float(seg["start_sec"]),
            "end_sec": float(seg["end_sec"]),
            "speaker": speaker,
            "text": "".join(slice_chars).strip(),
            "words": words,
        })
    return segments


def build_timeline(segments, duration_sec):
    """Construit le dict Timeline v1.0 conforme spec §2.1."""
    return {
        "schema_version": SCHEMA_VERSION,
        "source_type": "formation_sequence",
        "source_id": "TODO_REMPLIR_MANUELLEMENT_AVANT_UPLOAD",
        "audio_url": "TODO_REMPLIR_APRES_UPLOAD_SUPABASE",
        "duration_sec": float(duration_sec),
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generator": GENERATOR_TAG,
        "transcript": {
            "segments": segments,
        },
        "concepts": [],
        "scenes": [],
    }


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
    timeline_file = os.path.splitext(input_file)[0] + ".timeline.json"

    # Parser le dialogue
    print(f"📖 Lecture de : {input_file}")
    inputs = parse_dialogue(input_file)
    total_chars = sum(len(item["text"]) for item in inputs)
    print(f"   → {len(inputs)} répliques détectées ({total_chars} caractères)")

    # Aperçu
    for i, item in enumerate(inputs):
        preview = item["text"][:60] + "..." if len(item["text"]) > 60 else item["text"]
        print(f"   {i+1}. {item['speaker']}: {preview}")

    # Découper selon le mode
    chunk_limit = MAX_CHARS_WITH_TIMESTAMPS if WITH_TIMESTAMPS else MAX_CHARS_NO_TIMESTAMPS
    chunks = split_into_chunks(inputs, chunk_limit)

    # Préparer les inputs pour l'API (retirer le champ "speaker")
    for chunk in chunks:
        for item in chunk:
            del item["speaker"]

    mode_label = "with-timestamps" if WITH_TIMESTAMPS else "legacy"
    print(f"\n🎙️  Génération en cours (speed={SPEED}, mode={mode_label})...")
    if len(chunks) > 1:
        print(f"   → Dialogue découpé en {len(chunks)} parties (limite {chunk_limit} car.)")

    client = ElevenLabs(api_key=API_KEY)

    if not WITH_TIMESTAMPS:
        # ----- MODE LEGACY (comportement strict de l'ancien generate_audio.py) -----
        all_audio = b""
        for i, chunk in enumerate(chunks):
            chunk_audio = generate_chunk(client, chunk, i, len(chunks))
            all_audio += chunk_audio
            if i < len(chunks) - 1:
                time.sleep(2)

        with open(output_file, "wb") as f:
            f.write(all_audio)

        print(f"\n✅ Audio généré : {output_file}")
        print(f"📁 Chemin complet : {os.path.abspath(output_file)}")
        sys.exit(0)

    # ----- MODE WITH-TIMESTAMPS (Phase 2B POC) -----
    all_audio = b""
    chunk_alignments = []
    chunk_voice_segments = []

    for i, chunk in enumerate(chunks):
        audio_bytes, alignment, voice_segments = generate_chunk_with_timestamps(
            client, chunk, i, len(chunks)
        )
        all_audio += audio_bytes
        chunk_alignments.append(alignment)
        chunk_voice_segments.append(voice_segments)
        if i < len(chunks) - 1:
            time.sleep(2)

    merged_chars, merged_starts, merged_ends, merged_voice_segments, duration_sec = \
        merge_chunk_results(chunk_alignments, chunk_voice_segments)
    segments = build_segments(merged_voice_segments, merged_chars, merged_starts, merged_ends)
    total_words = sum(len(s["words"]) for s in segments)

    timeline = build_timeline(segments, duration_sec)

    # Sauvegarder MP3 + timeline
    with open(output_file, "wb") as f:
        f.write(all_audio)
    with open(timeline_file, "w", encoding="utf-8") as f:
        json.dump(timeline, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Audio généré         : {output_file}")
    print(f"✅ Timeline JSON générée : {timeline_file}")
    print(f"   → {len(segments)} segments speakers, {total_words} mots, {duration_sec:.2f} s")
    print(f"📁 Chemin audio    : {os.path.abspath(output_file)}")
    print(f"📁 Chemin timeline : {os.path.abspath(timeline_file)}")
    print()
    print("⚠️  TODO post-génération (manuel pour le POC) :")
    print("    1. Uploader le .mp3 dans Supabase Storage (bucket audio existant)")
    print("    2. Récupérer l'URL publique → renseigner timeline.audio_url")
    print("    3. Récupérer l'UUID de la sequence Supabase → renseigner timeline.source_id")
    print("    4. Uploader le .timeline.json dans Storage (bucket audio-timelines)")
    print("    5. Renseigner sequences.timeline_url + timeline_published=true en BDD")
