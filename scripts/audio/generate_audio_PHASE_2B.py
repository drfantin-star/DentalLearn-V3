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


# --- HELPERS WITH-TIMESTAMPS (Phase 2B) ---

def _get(obj, *names):
    """Premier attribut/clé existant parmi `names` — gère snake_case vs camelCase."""
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)
            if value is not None:
                return value
        if isinstance(obj, dict) and name in obj and obj[name] is not None:
            return obj[name]
    return None


def _alignment_to_dict(alignment_obj):
    """Convertit un objet alignment SDK en dict {characters, character_start_times_seconds, character_end_times_seconds}."""
    chars = _get(alignment_obj, "characters")
    starts = _get(alignment_obj, "character_start_times_seconds", "characterStartTimesSeconds")
    ends = _get(alignment_obj, "character_end_times_seconds", "characterEndTimesSeconds")
    if chars is None or starts is None or ends is None:
        raise RuntimeError(
            "Alignment incomplet : characters/starts/ends manquants. "
            "Inspecter la réponse SDK ElevenLabs (cf. test_response_raw.json Phase 2A)."
        )
    if not (len(chars) == len(starts) == len(ends)):
        raise RuntimeError(
            f"Longueurs alignment incohérentes : chars={len(chars)} "
            f"starts={len(starts)} ends={len(ends)}"
        )
    return {
        "characters": list(chars),
        "character_start_times_seconds": [float(t) for t in starts],
        "character_end_times_seconds": [float(t) for t in ends],
    }


def _voice_segments_to_list(voice_segments_obj):
    """
    Normalise le champ voice_segments SDK en liste de dicts
    {voice_id, start_sec, end_sec, text?}.
    Gère les variations de naming snake_case/camelCase (start_time_seconds vs startTimeSeconds, etc).
    """
    if voice_segments_obj is None:
        return []
    normalized = []
    for seg in voice_segments_obj:
        voice_id = _get(seg, "voice_id", "voiceId")
        start = _get(seg, "start_time_seconds", "startTimeSeconds", "start_sec", "start")
        end = _get(seg, "end_time_seconds", "endTimeSeconds", "end_sec", "end")
        text = _get(seg, "text")
        if voice_id is None or start is None or end is None:
            raise RuntimeError(
                "voice_segment incomplet (voice_id/start/end manquant). "
                "Champs disponibles : "
                f"{sorted(seg.__dict__.keys()) if hasattr(seg, '__dict__') else list(seg.keys()) if isinstance(seg, dict) else 'inconnu'}"
            )
        normalized.append({
            "voice_id": voice_id,
            "start_sec": float(start),
            "end_sec": float(end),
            "text": text if text is not None else "",
        })
    return normalized


def generate_chunk_with_timestamps(client, chunk, chunk_index, total_chunks):
    """
    Variante de generate_chunk qui retourne (audio_bytes, alignment_dict, voice_segments_list).

    Adaptations Phase 2A :
      - Lit `audio_base_64` (typo SDK observée, fallback sur `audio_base64` / `audioBase64`)
      - Privilégie `normalized_alignment` à `alignment` (plus propre)
      - Récupère `voice_segments[]` pour la segmentation Sophie/Martin
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

            audio_b64 = _get(response, "audio_base_64", "audio_base64", "audioBase64")
            if audio_b64 is None:
                raise RuntimeError(
                    "Audio base64 introuvable dans la réponse SDK. "
                    "Attributs essayés : audio_base_64, audio_base64, audioBase64."
                )
            audio_bytes = base64.b64decode(audio_b64)

            alignment_obj = _get(response, "normalized_alignment", "normalizedAlignment")
            if alignment_obj is None:
                alignment_obj = _get(response, "alignment")
            if alignment_obj is None:
                raise RuntimeError(
                    "Alignment introuvable (ni normalized_alignment ni alignment)."
                )
            alignment_dict = _alignment_to_dict(alignment_obj)

            voice_segments_obj = _get(response, "voice_segments", "voiceSegments")
            voice_segments = _voice_segments_to_list(voice_segments_obj)
            if not voice_segments:
                raise RuntimeError(
                    "voice_segments manquant ou vide dans la réponse SDK. "
                    "Phase 2A avait validé sa présence — comportement SDK changé ?"
                )

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


def chunk_duration_from_alignment(alignment):
    """Durée d'un chunk = dernier character_end_times_seconds."""
    ends = alignment["character_end_times_seconds"]
    return float(ends[-1]) if ends else 0.0


def merge_alignments_with_offset(chunk_alignments, chunk_durations_sec):
    """
    Concatène les alignments de tous les chunks en offsetant les timestamps
    par la durée cumulée des chunks précédents.
    """
    merged = {
        "characters": [],
        "character_start_times_seconds": [],
        "character_end_times_seconds": [],
    }
    cumulative_offset = 0.0
    for alignment, duration in zip(chunk_alignments, chunk_durations_sec):
        merged["characters"].extend(alignment["characters"])
        merged["character_start_times_seconds"].extend(
            t + cumulative_offset for t in alignment["character_start_times_seconds"]
        )
        merged["character_end_times_seconds"].extend(
            t + cumulative_offset for t in alignment["character_end_times_seconds"]
        )
        cumulative_offset += duration
    return merged


def merge_voice_segments_with_offset(chunk_voice_segments, chunk_durations_sec):
    """
    Concatène les voice_segments de tous les chunks en offsetant les timestamps.
    """
    merged = []
    cumulative_offset = 0.0
    for segments, duration in zip(chunk_voice_segments, chunk_durations_sec):
        for seg in segments:
            merged.append({
                "voice_id": seg["voice_id"],
                "start_sec": seg["start_sec"] + cumulative_offset,
                "end_sec": seg["end_sec"] + cumulative_offset,
                "text": seg["text"],
            })
        cumulative_offset += duration
    return merged


def characters_to_words(merged_alignment):
    """
    Regroupe les caractères en mots par split sur espace / saut de ligne / tab.
    Retourne [{text, start_sec, end_sec}, ...].
    """
    words = []
    cur_chars = []
    cur_start = None
    prev_end = None

    chars = merged_alignment["characters"]
    starts = merged_alignment["character_start_times_seconds"]
    ends = merged_alignment["character_end_times_seconds"]

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


def build_segments_from_voice_segments(merged_voice_segments, merged_words):
    """
    Reconstruit les segments transcript de la Timeline v1.0 depuis :
      - merged_voice_segments : segmentation Sophie/Martin déjà offsetée
      - merged_words          : mots avec timestamps déjà offsetés

    Pour chaque voice_segment, on prend les mots dont le start_sec tombe dans
    [seg.start_sec, seg.end_sec] (borne basse incluse, borne haute incluse pour
    tolérer les arrondis flottants).
    """
    segments = []
    for seg in merged_voice_segments:
        speaker = VOICE_ID_TO_SPEAKER.get(seg["voice_id"])
        if speaker is None:
            raise RuntimeError(
                f"voice_id inconnu : {seg['voice_id']}. "
                "Mettre à jour VOICE_ID_TO_SPEAKER dans generate_audio.py."
            )

        seg_words = [
            w for w in merged_words
            if w["start_sec"] >= seg["start_sec"] - 1e-3
            and w["start_sec"] <= seg["end_sec"] + 1e-3
        ]

        text = seg["text"].strip() if seg["text"] else " ".join(w["text"] for w in seg_words)

        segments.append({
            "start_sec": float(seg["start_sec"]),
            "end_sec": float(seg["end_sec"]),
            "speaker": speaker,
            "text": text,
            "words": seg_words,
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
    chunk_durations = []

    for i, chunk in enumerate(chunks):
        audio_bytes, alignment, voice_segments = generate_chunk_with_timestamps(
            client, chunk, i, len(chunks)
        )
        all_audio += audio_bytes
        chunk_alignments.append(alignment)
        chunk_voice_segments.append(voice_segments)
        chunk_durations.append(chunk_duration_from_alignment(alignment))
        if i < len(chunks) - 1:
            time.sleep(2)

    # Merge avec offsets cumulés
    merged_alignment = merge_alignments_with_offset(chunk_alignments, chunk_durations)
    merged_voice_segments = merge_voice_segments_with_offset(chunk_voice_segments, chunk_durations)
    merged_words = characters_to_words(merged_alignment)
    segments = build_segments_from_voice_segments(merged_voice_segments, merged_words)
    duration_sec = sum(chunk_durations)

    timeline = build_timeline(segments, duration_sec)

    # Sauvegarder MP3 + timeline
    with open(output_file, "wb") as f:
        f.write(all_audio)
    with open(timeline_file, "w", encoding="utf-8") as f:
        json.dump(timeline, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Audio généré         : {output_file}")
    print(f"✅ Timeline JSON générée : {timeline_file}")
    print(f"   → {len(segments)} segments speakers, {len(merged_words)} mots, {duration_sec:.2f} s")
    print(f"📁 Chemin audio    : {os.path.abspath(output_file)}")
    print(f"📁 Chemin timeline : {os.path.abspath(timeline_file)}")
    print()
    print("⚠️  TODO post-génération (manuel pour le POC) :")
    print("    1. Uploader le .mp3 dans Supabase Storage (bucket audio existant)")
    print("    2. Récupérer l'URL publique → renseigner timeline.audio_url")
    print("    3. Récupérer l'UUID de la sequence Supabase → renseigner timeline.source_id")
    print("    4. Uploader le .timeline.json dans Storage (bucket audio-timelines)")
    print("    5. Renseigner sequences.timeline_url + timeline_published=true en BDD")
