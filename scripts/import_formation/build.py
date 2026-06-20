#!/usr/bin/env python3
"""
build.py — Parseur + générateur SQL pour l'import d'une formation DentalLearn V3.

Lit deux fichiers source (questions .txt + plan .json), applique toutes les
règles décrites dans IMPORT_FORMATION_SQL_DENTALLEARN_PROCEDURE.md, valide le
résultat (validate.py), puis GÉNÈRE des fichiers SQL. Il NE TOUCHE JAMAIS la
base : l'application du SQL se fait ensuite via le MCP Supabase (commande
/import-formation).

Usage :
    python scripts/import_formation/build.py \
        --questions questions_<slug>.txt \
        --plan _plan_summary.json \
        --formation-id <UUID> \
        --mode <refonte|create> \
        --out /tmp/import_<slug> \
        [--purge-watch-logs] [--title "Titre choisi"] [--lot-size 16]

Sorties dans <out> :
    questions.json    — le contenu parsé (séquences + questions), pour relecture
    setup.sql         — structure : (UPDATE +) DELETE + INSERT des séquences
    commit_q1.sql …   — lots de ~16 questions (INSERT ... SELECT ... JOIN)

Si la validation échoue, AUCUN fichier SQL n'est généré et le script sort en
erreur (code 1) avec un rapport en français.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import string
import sys
import unicodedata

# validate.py vit dans le même dossier : import local robuste quel que soit le cwd.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate import validate  # noqa: E402


LETTERS = string.ascii_uppercase

# Barème par défaut (points, temps_secondes) par type — cf. procédure §5.4.
# `points` peut être écrasé par un champ POINTS du fichier source.
BAREME = {
    "mcq": (10, 60),
    "mcq_image": (10, 60),
    "true_false": (10, 45),
    "checkbox": (15, 60),
    "highlight": (10, 45),
    "ordering": (15, 90),
    "matching": (20, 90),
    "fill_blank": (20, 60),
    "case_study": (None, 120),  # points = somme des sous-questions conservées
}

# Feedback standard porté par la LIGNE case_study (le détail est dans les sous-q).
CASE_STUDY_FEEDBACK = "Cas clinique — voir les explications détaillées de chaque sous-question."

# Détection du marqueur (CORRECTE) / (CORRECT), insensible à la casse/accent.
_MARK_RE = re.compile(r"\(\s*correcte?\s*\)", re.IGNORECASE)
# Marqueur de blanc dans un texte à trous : [BLANC_1], [BLANC 1], [BLANC1]…
_BLANK_RE = re.compile(r"\[BLANC[_ ]?(\d+)\]", re.IGNORECASE)
# Ligne « [BLANC_n] : mot (CORRECTE) » (dialecte Banque de mots).
_BLANK_ANSWER_RE = re.compile(r"^\s*\[BLANC[_ ]?(\d+)\]\s*:\s*(.+)$", re.IGNORECASE)

# En-tête de séquence : ===SEQUENCE=== (un éventuel numéro est récupéré).
_SEQ_HDR_RE = re.compile(r"^=+\s*s[ée]quence", re.IGNORECASE)
# En-tête de (sous-)question : --- QUESTION n --- / --- SOUS-QUESTION n ---.
_QBLOCK_RE = re.compile(r"^-+\s*question\s+(\d+)", re.IGNORECASE)
_SUBQBLOCK_RE = re.compile(r"^-+\s*sous[-\s]?question\s+(\d+)", re.IGNORECASE)

# Champs d'un bloc. Les clés sont strictes pour ne pas avaler une ligne d'option.
_FIELD_RE = re.compile(
    r"^\s*(TYPE|[EÉ]NONC[EÉ]|POINTS|OPTIONS|FEEDBACK|SC[EÉ]NARIO|CONTEXTE)\s*:\s?(.*)$",
    re.IGNORECASE,
)

# Séparateurs « gauche → droite » acceptés pour le type matching.
_ARROW_RE = re.compile(r"\s*(?:→|->|=>|⇒)\s*")


# --------------------------------------------------------------------------- #
# Utilitaires texte / SQL
# --------------------------------------------------------------------------- #
def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def sql_quote(value) -> str:
    """Rend une chaîne sous forme de littéral SQL : 'texte' avec ' doublées."""
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def json_sql(obj) -> str:
    """Sérialise un objet en JSON puis en littéral SQL (à caster ::jsonb)."""
    # ensure_ascii=False : on garde les accents lisibles ; les guillemets internes
    # du JSON sont déjà échappés par json.dumps. Seules les apostrophes sont
    # ensuite doublées pour le littéral SQL.
    return sql_quote(json.dumps(obj, ensure_ascii=False))


def deterministic_shuffle(seq, seed_text: str):
    """Mélange reproductible (même entrée → même sortie) seedé par un texte."""
    seed = int(hashlib.md5(seed_text.encode("utf-8")).hexdigest(), 16)
    out = list(seq)
    random.Random(seed).shuffle(out)
    return out


def split_sentences(text: str):
    """Découpe grossièrement un scénario en phrases (pour patient/chief_complaint)."""
    text = " ".join(text.split())
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


# --------------------------------------------------------------------------- #
# Normalisation des types de source
# --------------------------------------------------------------------------- #
def normalize_type(raw):
    """Convertit un libellé de type source (FR) vers le question_type natif."""
    if raw is None:
        return None
    t = strip_accents(raw).lower().strip()
    if not t:
        return None
    # L'ordre compte : tester les libellés spécifiques avant les génériques.
    if "cas clinique" in t or "case study" in t or t == "cas":
        return "case_study"
    if "qcm" in t and "image" in t:
        return "mcq_image"
    if "image" in t and ("photo" in t or "qcm" in t):
        return "mcq_image"
    if "texte a trous" in t or "trous" in t or "fill" in t or "completer" in t or "a completer" in t:
        return "fill_blank"
    if "association" in t or "associer" in t or "appariement" in t or "matching" in t:
        return "matching"
    if "ordonnancement" in t or "ordering" in t or "remettre dans l" in t or t == "ordre":
        return "ordering"
    if "barrer" in t or "intrus" in t or "highlight" in t:
        return "highlight"
    if "cocher" in t or "choix multiple" in t or "reponses multiples" in t or "checkbox" in t:
        return "checkbox"
    if "vrai" in t or "faux" in t:
        return "true_false"
    if "qcm" in t or "choix unique" in t or "reponse unique" in t:
        return "mcq"
    return None


# --------------------------------------------------------------------------- #
# Parsing des blocs
# --------------------------------------------------------------------------- #
def parse_block_fields(raw_lines):
    """Transforme les lignes d'un bloc en dict de champs canoniques."""
    fields = {}
    current = None
    for line in raw_lines:
        m = _FIELD_RE.match(line)
        if m:
            key = strip_accents(m.group(1)).lower()
            if key == "type":
                current = "type"
            elif key in ("scenario", "contexte"):
                current = "enonce"  # scénario/contexte = énoncé du bloc
            elif key.startswith("enonc"):
                current = "enonce"
            elif key == "points":
                current = "points"
            elif key == "options":
                current = "options"
            elif key == "feedback":
                current = "feedback"
            rest = m.group(2)
            fields.setdefault(current, [])
            if rest.strip():
                fields[current].append(rest)
        elif current is not None:
            fields[current].append(line.rstrip("\n"))
    # Concatène en texte par champ.
    return {k: "\n".join(v).strip() for k, v in fields.items()}


def option_lines(fields):
    """Lignes d'option non vides du champ OPTIONS."""
    raw = fields.get("options", "")
    return [ln.strip() for ln in raw.splitlines() if ln.strip()]


def parse_points(fields, default):
    raw = fields.get("points", "")
    m = re.search(r"-?\d+", raw or "")
    return int(m.group(0)) if m else default


def split_marker(line):
    """Retourne (texte_nettoyé, marqué_correcte?) en retirant le marqueur."""
    marked = bool(_MARK_RE.search(line))
    clean = _MARK_RE.sub("", line).strip()
    return clean, marked


def strip_label(text):
    """Retire un préfixe d'étiquette : 'A)', 'A.', 'A -', '-', '*', '1)'…"""
    text = re.sub(r"^\s*([A-Za-z]|\d+)\s*[\)\.\-:]\s+", "", text)
    text = re.sub(r"^\s*[-*•]\s+", "", text)
    return text.strip()


# --------------------------------------------------------------------------- #
# Construction des options par type
# --------------------------------------------------------------------------- #
def build_simple_options(lines, invert=False):
    """mcq / mcq_image / checkbox / highlight / true_false (choix simples)."""
    opts = []
    for i, line in enumerate(lines):
        clean, marked = split_marker(line)
        clean = strip_label(clean)
        correct = (not marked) if invert else marked
        opts.append({"id": LETTERS[i], "text": clean, "correct": correct})
    return opts


def build_true_false(lines):
    """true_false : toujours [{A:Vrai}, {B:Faux}] ; le correct vient du marqueur."""
    correct_letter = None
    for line in lines:
        clean, marked = split_marker(line)
        low = strip_accents(clean).lower()
        if marked:
            if "vrai" in low:
                correct_letter = "A"
            elif "faux" in low:
                correct_letter = "B"
    return [
        {"id": "A", "text": "Vrai", "correct": correct_letter == "A"},
        {"id": "B", "text": "Faux", "correct": correct_letter == "B"},
    ]


def build_ordering(lines, seed_text):
    """ordering : la source est dans le bon ordre ; on fixe correctPosition puis on mélange."""
    opts = []
    for idx, line in enumerate(lines, start=1):
        clean, _ = split_marker(line)
        m = re.match(r"^\s*(\d+)", clean)
        pos = int(m.group(1)) if m else idx
        # On conserve le texte tel quel (avec son préfixe « n - »), comme en base.
        opts.append({"id": str(pos), "text": clean.strip(), "correctPosition": pos})
    return deterministic_shuffle(opts, "ordering|" + seed_text)


def build_matching(lines):
    """matching : 3 tableaux de longueur égale ; correctAnswers au format i-LETTRE."""
    pairs, options, answers = [], [], []
    for i, line in enumerate(lines):
        clean, _ = split_marker(line)
        clean = strip_label(clean)
        parts = _ARROW_RE.split(clean, maxsplit=1)
        left = parts[0].strip()
        right = parts[1].strip() if len(parts) > 1 else ""
        letter = LETTERS[i]
        pairs.append({"left": left, "rightId": letter})
        options.append({"id": letter, "text": right})
        answers.append(f"{i + 1}-{letter}")
    return {"pairs": pairs, "options": options, "correctAnswers": answers}


def build_fill_blank(enonce, lines, seed_text):
    """fill_blank : gère les 3 dialectes. Retourne (texte_nettoyé, options)."""
    text = enonce

    # « Banque de mots : … » : extraite où qu'elle soit (ligne propre OU en
    # milieu d'énoncé) puis retirée du texte. Dialecte 3 (Overlays).
    banque = None
    kept_lines = []
    for ln in text.splitlines():
        m = re.search(r"banque\s+de\s+mots\s*:", ln, re.IGNORECASE)
        if m:
            banque = [w.strip() for w in ln[m.end():].split(",") if w.strip()]
            before = ln[: m.start()].rstrip()
            if before:
                kept_lines.append(before)
        else:
            kept_lines.append(ln)
    text = "\n".join(kept_lines).strip()

    blanks_by_num = {}
    word_bank = None

    # Lignes d'option au format « [BLANC_n] : mot » → corrects explicites par blanc.
    blank_answer_lines = [ln for ln in lines if _BLANK_ANSWER_RE.match(ln)]

    if blank_answer_lines:
        # Dialecte « Banque de mots » : corrects lus depuis « [BLANC_n] : mot ».
        for ln in blank_answer_lines:
            m = _BLANK_ANSWER_RE.match(ln)
            num = int(m.group(1))
            word, _ = split_marker(m.group(2))
            blanks_by_num[num] = word.strip()
        # wordBank = banque (corrects + distracteurs) si fournie, sinon les corrects.
        word_bank = banque if banque is not None else list(blanks_by_num.values())
    else:
        # Corrects par marqueur (dialecte 1) ou liste virgulée (dialecte 2).
        ordered_correct = []
        all_words = []
        any_marker = False
        for ln in lines:
            clean, marked = split_marker(ln)
            clean = strip_label(clean).strip()
            if not clean:
                continue
            all_words.append(clean)
            if marked:
                any_marker = True
                ordered_correct.append(clean)
        if any_marker:
            word_bank = banque if banque is not None else all_words
        else:
            # Dialecte 2 : items séparés par virgules, corrects en positions paires.
            items = []
            for ln in lines:
                items.extend([x.strip() for x in ln.split(",") if x.strip()])
            ordered_correct = [it for idx, it in enumerate(items, start=1) if idx % 2 == 0]
            word_bank = banque if banque is not None else items
        # Les corrects (dans l'ordre) sont mappés aux blancs (dans l'ordre).
        nums = sorted(set(int(n) for n in _BLANK_RE.findall(text)))
        for i, num in enumerate(nums):
            blanks_by_num[num] = ordered_correct[i] if i < len(ordered_correct) else ""

    # Remplacement [BLANC_n] → (blanc n) dans le texte (tous dialectes).
    text = _BLANK_RE.sub(lambda m: f"(blanc {m.group(1)})", text)

    nums = sorted(blanks_by_num) if blanks_by_num else sorted(
        set(int(n) for n in _BLANK_RE.findall(enonce))
    )
    blanks = []
    for position, num in enumerate(nums, start=1):
        blanks.append({
            "id": str(num),
            "position": position,
            "correctAnswer": blanks_by_num.get(num, ""),
            "alternatives": [],
        })

    word_bank = deterministic_shuffle(word_bank or [], "wordbank|" + seed_text)
    return text.strip(), {"blanks": blanks, "wordBank": word_bank}


# --------------------------------------------------------------------------- #
# Cas clinique : conservation / promotion des sous-questions
# --------------------------------------------------------------------------- #
def _subq_choices(fields, sub_type):
    """Choix d'une sous-question conservée (pas d'inversion, même pour highlight)."""
    lines = option_lines(fields)
    if sub_type == "true_false":
        return build_true_false(lines)
    return build_simple_options(lines, invert=False)


def build_case_study(scenario, subq_blocks, seq_num, base_order, promote_orders):
    """
    Construit la ligne case_study + d'éventuelles questions promues.

    Retourne (case_row, promoted_rows).
    `promote_orders` est un itérateur d'ordres libres (5, 6, …) pour les promues.
    """
    sentences = split_sentences(scenario)
    patient = sentences[0] if sentences else scenario.strip()
    chief = sentences[1] if len(sentences) > 1 else ""
    context = {
        "patient": patient.strip(),
        "chief_complaint": chief.strip(),
        "history": " ".join(scenario.split()).strip(),
    }

    kept = []
    promoted_rows = []
    kept_id = 1

    for fields in subq_blocks:
        sub_type = normalize_type(fields.get("type"))
        lines = option_lines(fields)
        n_correct = sum(1 for ln in lines if split_marker(ln)[1])
        feedback = fields.get("feedback", "").strip()
        enonce = fields.get("enonce", "").strip()
        seed = f"{seq_num}|cs|{kept_id}|{enonce[:40]}"

        # Décision conserver / promouvoir (procédure §4).
        conserve = False
        if sub_type is None and n_correct <= 1:
            # Pas de TYPE + 1 correct = QCM simple conservé.
            sub_type = "mcq"
            conserve = True
        elif sub_type in ("mcq", "true_false", "highlight") and n_correct <= 1:
            conserve = True

        if conserve:
            pts = parse_points(fields, BAREME.get(sub_type, ("", 0))[0] or 10)
            kept.append({
                "id": f"Q{kept_id}",
                "text": enonce,
                "order": kept_id,
                "points": pts,
                "choices": _subq_choices(fields, sub_type),
                "feedback": feedback,
            })
            kept_id += 1
        else:
            # Promotion en question autonome (type natif), scénario préfixé.
            promo_type = sub_type or "checkbox"
            qtext = f"Cas clinique : {scenario.strip()}\n\n{enonce}"
            opts = _build_options_for_type(promo_type, enonce, lines, seed)
            if isinstance(opts, tuple):  # fill_blank renvoie (texte, options)
                # Pour une promue fill_blank, le texte nettoyé concerne l'énoncé seul.
                clean_enonce, opts = opts
                qtext = f"Cas clinique : {scenario.strip()}\n\n{clean_enonce}"
            default_pts, default_tm = BAREME.get(promo_type, (10, 60))
            promoted_rows.append({
                "sequence_number": seq_num,
                "question_order": next(promote_orders),
                "question_type": promo_type,
                "question_text": qtext,
                "options": opts,
                "feedback": feedback,
                "points": parse_points(fields, default_pts or 10),
                "recommended_time_seconds": default_tm,
                "difficulty": 1,
                "promoted": True,
            })

    case_row = {
        "sequence_number": seq_num,
        "question_order": base_order,
        "question_type": "case_study",
        "question_text": context["patient"],
        "options": {"context": context, "questions": kept},
        "feedback": CASE_STUDY_FEEDBACK,
        "points": sum(k["points"] for k in kept) or 10,
        "recommended_time_seconds": BAREME["case_study"][1],
        "difficulty": 1,
        "promoted": False,
    }
    return case_row, promoted_rows


def _build_options_for_type(qtype, enonce, lines, seed):
    """Aiguille vers le bon constructeur d'options selon le type natif."""
    if qtype in ("mcq", "mcq_image", "checkbox"):
        return build_simple_options(lines, invert=False)
    if qtype == "highlight":
        return build_simple_options(lines, invert=True)  # autonome : inversion
    if qtype == "true_false":
        return build_true_false(lines)
    if qtype == "ordering":
        return build_ordering(lines, seed)
    if qtype == "matching":
        return build_matching(lines)
    if qtype == "fill_blank":
        return build_fill_blank(enonce, lines, seed)  # tuple (texte, options)
    return build_simple_options(lines, invert=False)


# --------------------------------------------------------------------------- #
# Parsing complet du fichier questions
# --------------------------------------------------------------------------- #
def parse_questions_file(path):
    """Découpe le fichier en séquences puis en (sous-)blocs ; retourne la liste de questions."""
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()

    # 1) Découpage en sections de séquence.
    sections = []  # liste de (seq_num_explicite|None, [lignes])
    current = None
    auto_idx = 0
    for raw in lines:
        line = raw.rstrip("\n")
        if _SEQ_HDR_RE.match(line.strip()):
            m = re.search(r"\d+", line)
            seq_num = int(m.group(0)) if m else auto_idx
            sections.append((seq_num, []))
            current = sections[-1][1]
            auto_idx += 1
        elif current is not None:
            current.append(line)
        # Lignes avant la 1re séquence : ignorées (préambule éventuel).

    questions = []
    for seq_num, sec_lines in sections:
        questions.extend(parse_section(seq_num, sec_lines))
    return questions


def parse_section(seq_num, sec_lines):
    """Parse une section de séquence en liste de questions natives."""
    # 2) Découpage en blocs QUESTION / SOUS-QUESTION.
    blocks = []  # (kind, order, [lignes])  kind ∈ {"q","sub"}
    cur = None
    for line in sec_lines:
        mq = _QBLOCK_RE.match(line.strip())
        ms = _SUBQBLOCK_RE.match(line.strip())
        if mq:
            blocks.append(["q", int(mq.group(1)), []])
            cur = blocks[-1][2]
        elif ms:
            blocks.append(["sub", int(ms.group(1)), []])
            cur = blocks[-1][2]
        elif cur is not None:
            cur.append(line)

    # 3) Regroupe les sous-questions sous leur question-mère (un case_study).
    grouped = []  # (order, fields, [sub_fields])
    i = 0
    while i < len(blocks):
        kind, order, raw = blocks[i]
        if kind == "q":
            fields = parse_block_fields(raw)
            subs = []
            j = i + 1
            while j < len(blocks) and blocks[j][0] == "sub":
                subs.append(parse_block_fields(blocks[j][2]))
                j += 1
            grouped.append((order, fields, subs))
            i = j
        else:
            # Une sous-question orpheline (sans question-mère) : on l'ignore.
            i += 1

    base_orders = [g[0] for g in grouped]
    next_promo = (max(base_orders) + 1) if base_orders else 1
    promote_orders = iter(range(next_promo, next_promo + 10_000))

    out = []
    for order, fields, subs in grouped:
        qtype = normalize_type(fields.get("type"))
        enonce = fields.get("enonce", "").strip()
        feedback = fields.get("feedback", "").strip()
        lines = option_lines(fields)
        seed = f"{seq_num}|{order}|{enonce[:40]}"

        if qtype == "case_study" or subs:
            # Une question avec sous-blocs est un cas clinique même sans TYPE explicite.
            case_row, promoted = build_case_study(enonce, subs, seq_num, order, promote_orders)
            out.append(case_row)
            out.extend(promoted)
            continue

        if qtype is None:
            qtype = "mcq"  # défaut prudent pour une question simple sans TYPE

        opts = _build_options_for_type(qtype, enonce, lines, seed)
        text = enonce
        if qtype == "fill_blank":
            text, opts = opts  # (texte nettoyé, options)

        default_pts, default_tm = BAREME.get(qtype, (10, 60))
        out.append({
            "sequence_number": seq_num,
            "question_order": order,
            "question_type": qtype,
            "question_text": text,
            "options": opts,
            "feedback": feedback,
            "points": parse_points(fields, default_pts or 10),
            "recommended_time_seconds": default_tm,
            "difficulty": 1,
            "promoted": False,
        })
    return out


# --------------------------------------------------------------------------- #
# Plan → séquences
# --------------------------------------------------------------------------- #
def build_sequences(plan):
    """Construit la liste des séquences à insérer à partir du plan."""
    raw_seqs = plan.get("sequences") or []
    out = []
    for s in raw_seqs:
        seq_num = int(s.get("seq_num"))
        bloc_raw = s.get("bloc", 1)
        try:
            bloc_raw = int(bloc_raw)
        except (TypeError, ValueError):
            bloc_raw = 1
        bloc = max(1, bloc_raw)  # contrainte DB : bloc_number ∈ [1,4], jamais 0
        objectifs = s.get("objectifs") or []
        if not isinstance(objectifs, list):
            objectifs = [str(objectifs)]
        out.append({
            "seq_num": seq_num,
            "seq_title": (s.get("seq_title") or "").strip(),
            "bloc": bloc,
            "bloc_raw": bloc_raw,
            "is_intro": (seq_num == 0),  # is_intro=true uniquement sur S0
            "learning_objectives": objectifs,
        })
    out.sort(key=lambda x: x["seq_num"])
    return out


# --------------------------------------------------------------------------- #
# Génération SQL
# --------------------------------------------------------------------------- #
def gen_setup_sql(mode, fid, title, sequences, purge_watch_logs):
    """Génère setup.sql (structure de la formation)."""
    n = len(sequences)
    rows = []
    for s in sequences:
        rows.append(
            "  ({fid}, {sn}, {title}, {bloc}, {obj}::jsonb, {intro}, 3)".format(
                fid=sql_quote(fid),
                sn=s["seq_num"],
                title=sql_quote(s["seq_title"]),
                bloc=s["bloc"],
                obj=json_sql(s["learning_objectives"]),
                intro="true" if s["is_intro"] else "false",
            )
        )
    insert = (
        "INSERT INTO sequences\n"
        "  (formation_id, sequence_number, title, bloc_number, learning_objectives, "
        "is_intro, estimated_duration_minutes)\nVALUES\n"
        + ",\n".join(rows)
        + ";"
    )

    parts = ["BEGIN;"]
    if mode == "refonte":
        parts.append(
            "UPDATE formations\n"
            f"   SET title = {sql_quote(title)}, is_published = false,\n"
            f"       total_sequences = {n}, updated_at = now()\n"
            f" WHERE id = {sql_quote(fid)};"
        )
        if purge_watch_logs:
            parts.append(
                "-- Purge des logs DPC/audio (AUTORISÉE : comptes de test avant mise en ligne).\n"
                "DELETE FROM course_watch_logs\n"
                f" WHERE sequence_id IN (SELECT id FROM sequences WHERE formation_id = {sql_quote(fid)});"
            )
        else:
            parts.append(
                "-- course_watch_logs NON purgés. Si des logs existent, le DELETE des séquences\n"
                "-- ci-dessous échouera (FK NO ACTION). Pour des comptes de test, relancer\n"
                "-- build.py avec --purge-watch-logs APRÈS accord explicite de Julie."
            )
        parts.append(f"DELETE FROM sequences WHERE formation_id = {sql_quote(fid)};")
    else:
        parts.append(
            "-- Mode CREATE : la ligne formations a déjà été créée (RETURNING id).\n"
            "-- setup.sql ne fait QUE créer les séquences (pas d'UPDATE, pas de DELETE)."
        )
    parts.append(insert)
    parts.append("COMMIT;")
    return "\n\n".join(parts) + "\n"


def make_lots(questions, sequences, lot_size):
    """Regroupe les séquences en lots de ~lot_size questions (sans couper une séquence)."""
    by_seq = {}
    for q in questions:
        by_seq.setdefault(q["sequence_number"], []).append(q)
    ordered_nums = [s["seq_num"] for s in sequences if s["seq_num"] in by_seq]

    lots = []
    current = []
    count = 0
    for sn in ordered_nums:
        qs = sorted(by_seq[sn], key=lambda q: q["question_order"])
        if current and count + len(qs) > lot_size:
            lots.append(current)
            current = []
            count = 0
        current.extend(qs)
        count += len(qs)
    if current:
        lots.append(current)
    return lots


def gen_lot_sql(fid, lot):
    """Génère un lot d'INSERT questions (INSERT ... SELECT ... FROM VALUES JOIN)."""
    value_rows = []
    for q in lot:
        opt = q["options"]
        value_rows.append(
            "  ({sn}, {qo}, {qt}, {txt}, {opt}, {fb}, {pts}, {tm}, {df})".format(
                sn=q["sequence_number"],
                qo=q["question_order"],
                qt=sql_quote(q["question_type"]),
                txt=sql_quote(q["question_text"]),
                opt=json_sql(opt),
                fb=sql_quote(q["feedback"]),
                pts=q["points"],
                tm=q["recommended_time_seconds"],
                df=q["difficulty"],
            )
        )
    return (
        "BEGIN;\n\n"
        "INSERT INTO questions\n"
        "  (sequence_id, question_order, question_type, question_text, options,\n"
        "   feedback_correct, feedback_incorrect, image_url, points, "
        "recommended_time_seconds, difficulty)\n"
        "SELECT s.id, v.qo, v.qt, v.txt, v.opt::jsonb, v.fb, v.fb, NULL, v.pts, v.tm, v.df\n"
        "FROM (VALUES\n"
        + ",\n".join(value_rows)
        + "\n) AS v(sn, qo, qt, txt, opt, fb, pts, tm, df)\n"
        f"JOIN sequences s ON s.formation_id = {sql_quote(fid)} AND s.sequence_number = v.sn;\n\n"
        "COMMIT;\n"
    )


# --------------------------------------------------------------------------- #
# Rapport
# --------------------------------------------------------------------------- #
def print_report(sequences, questions, result, lots, out_dir):
    print("\n=== Rapport d'import (build.py) ===\n")
    stats = result["stats"]
    print(f"Séquences (plan)      : {stats.get('nb_sequences')}")
    print(f"Questions générées    : {stats.get('nb_questions')}")
    print(f"Promotions cas clin.  : {stats.get('nb_promotions')}")
    print(f"Total attendu (4×N)   : {stats.get('total_attendu_sans_promotion')}")
    print(f"Lots de questions     : {len(lots)}")

    print("\nDétail par séquence :")
    by_seq = {}
    for q in questions:
        by_seq.setdefault(q["sequence_number"], []).append(q)
    for s in sequences:
        sn = s["seq_num"]
        qs = sorted(by_seq.get(sn, []), key=lambda q: q["question_order"])
        types = ", ".join(q["question_type"] for q in qs) or "—"
        flag = " (intro)" if s["is_intro"] else ""
        bloc_note = f" [bloc {s['bloc']}" + (f"←{s['bloc_raw']}]" if s["bloc_raw"] != s["bloc"] else "]")
        print(f"  S{sn}{flag}{bloc_note} : {len(qs)} q. → {types}")

    if result["warnings"]:
        print("\nAVERTISSEMENTS :")
        for w in result["warnings"]:
            print(f"  ⚠ {w}")

    if result["errors"]:
        print("\nERREURS (génération SQL bloquée) :")
        for e in result["errors"]:
            print(f"  ✗ {e}")
    else:
        print(f"\n✓ Validation OK. Fichiers générés dans : {out_dir}")


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(
        description="Parseur + générateur SQL d'import de formation DentalLearn V3."
    )
    ap.add_argument("--questions", required=True, help="Fichier questions_<slug>.txt")
    ap.add_argument("--plan", required=True, help="Fichier _plan_summary.json")
    ap.add_argument("--formation-id", required=True, help="UUID de la formation cible")
    ap.add_argument("--out", required=True, help="Dossier de sortie des fichiers SQL")
    ap.add_argument("--mode", choices=["refonte", "create"], default="refonte",
                    help="refonte (par défaut) ou create (formation nouvelle)")
    ap.add_argument("--title", default=None,
                    help="Titre à écrire (refonte). Défaut : titre du plan.")
    ap.add_argument("--purge-watch-logs", action="store_true",
                    help="Inclut la purge des course_watch_logs (refonte, comptes de test).")
    ap.add_argument("--lot-size", type=int, default=16,
                    help="Nombre cible de questions par lot SQL (défaut 16).")
    args = ap.parse_args()

    with open(args.plan, encoding="utf-8") as f:
        plan = json.load(f)

    sequences = build_sequences(plan)
    questions = parse_questions_file(args.questions)
    title = args.title or (plan.get("formation_title") or "").strip()

    result = validate(sequences, questions)
    lots = make_lots(questions, sequences, args.lot_size)

    if result["errors"]:
        print_report(sequences, questions, result, lots, args.out)
        print("\n✗ Échec de validation : aucun fichier SQL généré.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.out, exist_ok=True)

    # questions.json — contenu parsé, pour relecture humaine.
    with open(os.path.join(args.out, "questions.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "formation_id": args.formation_id,
                "mode": args.mode,
                "title": title,
                "sequences": sequences,
                "questions": questions,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    # setup.sql — structure de la formation.
    with open(os.path.join(args.out, "setup.sql"), "w", encoding="utf-8") as f:
        f.write(gen_setup_sql(args.mode, args.formation_id, title, sequences, args.purge_watch_logs))

    # commit_q*.sql — lots de questions.
    for i, lot in enumerate(lots, start=1):
        with open(os.path.join(args.out, f"commit_q{i}.sql"), "w", encoding="utf-8") as f:
            f.write(gen_lot_sql(args.formation_id, lot))

    print_report(sequences, questions, result, lots, args.out)
    print(
        f"\nFichiers : setup.sql + commit_q1.sql..commit_q{len(lots)}.sql + questions.json"
    )


if __name__ == "__main__":
    main()
