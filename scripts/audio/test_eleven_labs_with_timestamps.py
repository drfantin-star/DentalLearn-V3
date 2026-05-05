"""
Test isolé de l'endpoint ElevenLabs `text_to_dialogue.convert_with_timestamps`.

Phase 2A du Ticket POC-T2 — vérifier en réel le format de réponse du SDK
avant d'attaquer la modification du pipeline complet (Phase 2B).

Usage (à exécuter localement, dans le dossier qui contient `generate_audio.py`) :
    cd ~/Desktop/DentalLearn-Audio
    python3 test_eleven_labs_with_timestamps.py

Produit 3 fichiers à côté du script :
    - test_response_raw.json      dump complet de l'objet de réponse SDK
    - test_response_audio.mp3     audio décodé (validation auditive Dr Fantin)
    - test_response_summary.txt   résumé lisible des champs observés

La clé API est lue via `from generate_audio import API_KEY` — le test doit donc
être colocalisé avec le `generate_audio.py` actuel.
"""

import base64
import json
import os
import sys
from pathlib import Path

# Charge la clé API depuis le script de production existant (colocation requise).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from generate_audio import API_KEY  # type: ignore  # noqa: E402
except ImportError as exc:
    print("❌ Impossible d'importer API_KEY depuis generate_audio.py.")
    print("   → Place ce fichier dans le même dossier que generate_audio.py.")
    print(f"   Détail : {exc}")
    sys.exit(1)

from elevenlabs.client import ElevenLabs  # noqa: E402


SCRIPT_DIR = Path(__file__).parent
RAW_PATH = SCRIPT_DIR / "test_response_raw.json"
AUDIO_PATH = SCRIPT_DIR / "test_response_audio.mp3"
SUMMARY_PATH = SCRIPT_DIR / "test_response_summary.txt"

SOPHIE_VOICE_ID = "t8BrjWUT5Z23DLLBzbuY"
MARTIN_VOICE_ID = "ohItIVrXTBI80RrUECOD"

TEST_DIALOGUE = [
    {"text": "Bonjour Martin, on parle aujourd'hui du syndrome de la dent fêlée.",
     "voice_id": SOPHIE_VOICE_ID},
    {"text": "Oui Sophie, c'est un diagnostic clinique souvent difficile à poser.",
     "voice_id": MARTIN_VOICE_ID},
    {"text": "La douleur à la mastication est le signe d'appel le plus fréquent.",
     "voice_id": SOPHIE_VOICE_ID},
    {"text": "Et le test de morsure complète bien l'examen.",
     "voice_id": MARTIN_VOICE_ID},
]

SPEED = 1.1


def to_serialisable(obj):
    """Tente de convertir l'objet de réponse SDK en structure JSON-sérialisable."""
    for attr in ("model_dump", "dict"):
        if hasattr(obj, attr):
            try:
                return getattr(obj, attr)()
            except Exception:
                pass
    if hasattr(obj, "__dict__") and obj.__dict__:
        return obj.__dict__
    return obj


def get_attr(obj, *names):
    """Premier attribut/clé existant parmi `names` (snake_case puis camelCase)."""
    for name in names:
        if hasattr(obj, name):
            return getattr(obj, name), name
        if isinstance(obj, dict) and name in obj:
            return obj[name], name
    return None, None


def check(label, condition):
    status = "✅" if condition else "❌"
    print(f"  {status} {label}")
    return bool(condition)


def alignment_fields(obj):
    chars, chars_attr = get_attr(obj, "characters")
    starts, starts_attr = get_attr(
        obj, "character_start_times_seconds", "characterStartTimesSeconds"
    )
    ends, ends_attr = get_attr(
        obj, "character_end_times_seconds", "characterEndTimesSeconds"
    )
    return chars, starts, ends, (chars_attr, starts_attr, ends_attr)


def reconstruct_words(chars, starts, ends):
    words = []
    cur_chars, cur_start, prev_end = [], None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch in (" ", "\n", "\t"):
            if cur_chars:
                words.append({"text": "".join(cur_chars),
                              "start": cur_start, "end": prev_end})
                cur_chars, cur_start = [], None
        else:
            if not cur_chars:
                cur_start = s
            cur_chars.append(ch)
            prev_end = e
    if cur_chars:
        words.append({"text": "".join(cur_chars),
                      "start": cur_start, "end": prev_end})
    return words


def main():
    total_chars = sum(len(item["text"]) for item in TEST_DIALOGUE)
    print(f"📖 Test dialogue : {len(TEST_DIALOGUE)} répliques, {total_chars} caractères")
    print("   Endpoint : client.text_to_dialogue.convert_with_timestamps")
    print(f"   Settings : speed={SPEED}")
    print()

    client = ElevenLabs(api_key=API_KEY)

    print("🎙️  Appel API en cours…")
    response = client.text_to_dialogue.convert_with_timestamps(
        inputs=TEST_DIALOGUE,
        settings={"speed": SPEED},
    )
    print("   ↳ Réponse reçue.")
    print()

    # --- Dump brut ---
    raw = to_serialisable(response)
    with open(RAW_PATH, "w", encoding="utf-8") as f:
        json.dump(raw, f, indent=2, ensure_ascii=False, default=str)
    print(f"💾 {RAW_PATH.name} écrit ({RAW_PATH.stat().st_size} octets)")

    # --- Audio décodé ---
    audio_b64, audio_attr = get_attr(response, "audio_base64", "audioBase64")
    if audio_b64 is None:
        print("❌ Impossible de localiser audio_base64 / audioBase64 dans la réponse.")
        print("   → Inspecter test_response_raw.json pour trouver le champ audio.")
        sys.exit(2)
    audio_bytes = base64.b64decode(audio_b64)
    AUDIO_PATH.write_bytes(audio_bytes)
    print(f"🔊 {AUDIO_PATH.name} écrit ({len(audio_bytes)} octets) — attribut SDK : `{audio_attr}`")
    print()

    # --- Vérifications programmatiques ---
    print("🔍 Vérifications programmatiques :")
    check(f"audio présent (attribut `{audio_attr}`)", True)

    alignment, alignment_attr = get_attr(response, "alignment")
    has_alignment = check("response.alignment présent", alignment is not None)

    norm_alignment, norm_attr = get_attr(
        response, "normalized_alignment", "normalizedAlignment"
    )
    has_norm = check(
        f"response.normalized_alignment présent (attribut SDK : `{norm_attr or '—'}`)",
        norm_alignment is not None,
    )

    # On préfère normalized_alignment si présent (généralement plus propre)
    chosen = norm_alignment if norm_alignment is not None else alignment
    chosen_label = norm_attr if norm_alignment is not None else alignment_attr
    if chosen is None:
        print("❌ Aucun alignment exploitable trouvé — STOP.")
        sys.exit(3)

    chars, starts, ends, attrs = alignment_fields(chosen)
    check(f"`{chosen_label}.characters` présent (attr={attrs[0]})",
          chars is not None)
    check(
        f"`{chosen_label}.character_start_times_seconds` présent (attr={attrs[1]})",
        starts is not None,
    )
    check(
        f"`{chosen_label}.character_end_times_seconds` présent (attr={attrs[2]})",
        ends is not None,
    )

    if not (chars and starts and ends):
        print("❌ Tableaux d'alignment vides ou absents — STOP.")
        sys.exit(4)
    if not (len(chars) == len(starts) == len(ends)):
        print(f"❌ Longueurs incohérentes : characters={len(chars)}, "
              f"starts={len(starts)}, ends={len(ends)} — STOP.")
        sys.exit(5)

    duration_sec = float(ends[-1])
    print()
    print(f"⏱  Durée audio mesurée (dernier end_time) : {duration_sec:.3f} s")

    # Détection naming convention
    naming = "snake_case" if attrs[1] and "_" in attrs[1] else "camelCase / autre"
    print(f"🔤 Convention naming observée sur les champs alignment : {naming}")

    # --- Reconstruction des mots pour échantillonnage ---
    words = reconstruct_words(chars, starts, ends)
    samples = []
    if words:
        samples.append(("premier mot", words[0]))
    if len(words) >= 3:
        samples.append(("mot du milieu", words[len(words) // 2]))
    if len(words) >= 2 and words[-1] is not words[0]:
        samples.append(("dernier mot", words[-1]))
    # 2 mots arbitraires supplémentaires si possible
    if len(words) >= 5:
        samples.append((f"mot #{len(words)//4}", words[len(words) // 4]))
        samples.append((f"mot #{(len(words)*3)//4}", words[(len(words) * 3) // 4]))

    # --- Résumé lisible ---
    lines = [
        "=== Test ElevenLabs convert_with_timestamps — résumé ===",
        "",
        f"Type de la réponse : {type(response).__name__} "
        f"({type(response).__module__})",
        "",
        "Attributs publics de la réponse (dir) :",
    ]
    for name in sorted(dir(response)):
        if not name.startswith("_"):
            lines.append(f"  - {name}")

    lines += [
        "",
        f"Audio : attribut `{audio_attr}` — {len(audio_bytes)} octets décodés.",
        "",
        f"Alignment retenu pour reconstruction des mots : `{chosen_label}`",
        f"  characters : attr `{attrs[0]}`",
        f"  starts     : attr `{attrs[1]}`",
        f"  ends       : attr `{attrs[2]}`",
        f"Présence de `alignment`            : {has_alignment} "
        f"(attr SDK : `{alignment_attr or 'N/A'}`)",
        f"Présence de `normalized_alignment` : {has_norm} "
        f"(attr SDK : `{norm_attr or 'N/A'}`)",
        f"Convention naming                  : {naming}",
        "",
        f"Nombre de caractères alignés : {len(chars)}",
        f"Nombre de mots reconstitués  : {len(words)}",
        f"Durée audio totale (depuis alignment) : {duration_sec:.3f} s",
        "",
        "Échantillons de mots (pour validation auditive Dr Fantin) :",
    ]
    for label, w in samples:
        lines.append(
            f"  - {label}: '{w['text']}' → "
            f"start_sec={w['start']:.3f}  end_sec={w['end']:.3f}"
        )

    SUMMARY_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"📝 {SUMMARY_PATH.name} écrit.")
    print()

    # --- Coût indicatif ---
    print(
        f"💶 Coût estimé : {total_chars} caractères envoyés. "
        f"À tarif Multilingual v2 (~1 crédit/car.) ≈ {total_chars} crédits "
        f"(~{total_chars * 0.00018:.4f} €). "
        "À confirmer sur le dashboard ElevenLabs après run."
    )
    print()
    print("✅ Test terminé. Reporter les ✅/❌ ci-dessus dans "
          "POC_T2_PHASE_A_OBSERVATIONS.md, puis ouvrir test_response_audio.mp3 "
          "pour la validation auditive (5 mots tirés au hasard du résumé).")


if __name__ == "__main__":
    main()
