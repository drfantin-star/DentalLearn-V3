"""
validate.py — Validateur de l'import d'une formation DentalLearn V3.

Importé par build.py. Contrôle la cohérence des séquences (issues du plan) et
des questions (issues du fichier .txt) AVANT toute génération de SQL.

Règle d'or : zéro erreur, sinon build.py refuse de générer les fichiers SQL.

La fonction publique est `validate(sequences, questions)` :
  - `sequences` : liste de dicts produite par build.py à partir du plan,
                  chacun ayant les clés `seq_num`, `seq_title`, `bloc`
                  (bloc final, déjà coercé en max(1, bloc)), `is_intro`,
                  `learning_objectives`.
  - `questions` : liste de dicts produite par le parseur, chacun ayant les clés
                  `sequence_number`, `question_order`, `question_type`,
                  `question_text`, `options`, `feedback`, `promoted`.

Retourne un dict : { "errors": [...], "warnings": [...], "stats": {...} }.
Tous les messages sont en français.
"""

from __future__ import annotations

import re


# Marqueur qui ne doit JAMAIS subsister dans un texte fill_blank après parsing.
_BLANC_PREFIX = "[BLANC"
# Mention « Banque de mots » : doit avoir été retirée de l'énoncé fill_blank.
_BANQUE_RE = re.compile(r"banque\s+de\s+mots", re.IGNORECASE)
# Format attendu d'une entrée correctAnswers de matching : « i-LETTRE ».
_MATCHING_ANSWER_RE = re.compile(r"^\d+-[A-Z]$")


def _count_correct(options):
    """Nombre d'options marquées correct:true dans une liste d'options simples."""
    if not isinstance(options, list):
        return 0
    return sum(1 for o in options if isinstance(o, dict) and o.get("correct") is True)


def _validate_sequences(sequences, errors, warnings):
    """Contrôles structurels sur les séquences dérivées du plan."""
    if not sequences:
        errors.append("Plan : aucune séquence trouvée.")
        return

    nums = [s["seq_num"] for s in sequences]
    n = len(sequences)

    # seq_num couvre 0..N-1 sans trou ni doublon.
    expected = set(range(n))
    found = set(nums)
    if len(nums) != len(found):
        doublons = sorted({x for x in nums if nums.count(x) > 1})
        errors.append(f"Plan : seq_num en doublon : {doublons}.")
    if found != expected:
        manquants = sorted(expected - found)
        en_trop = sorted(found - expected)
        if manquants:
            errors.append(f"Plan : seq_num manquants (attendu 0..{n - 1}) : {manquants}.")
        if en_trop:
            errors.append(f"Plan : seq_num hors plage 0..{n - 1} : {en_trop}.")

    for s in sequences:
        sn = s["seq_num"]
        # Titre non vide.
        if not str(s.get("seq_title", "")).strip():
            errors.append(f"Séquence {sn} : titre vide.")
        # bloc_number final dans [1,4].
        bloc = s.get("bloc")
        if not isinstance(bloc, int) or not (1 <= bloc <= 4):
            errors.append(f"Séquence {sn} : bloc_number final hors [1,4] ({bloc!r}).")
        # learning_objectives est un tableau (éventuellement vide).
        if not isinstance(s.get("learning_objectives"), list):
            errors.append(f"Séquence {sn} : learning_objectives n'est pas un tableau.")
        # is_intro=true uniquement sur S0.
        is_intro = bool(s.get("is_intro"))
        if sn == 0 and not is_intro:
            warnings.append("Séquence 0 : is_intro=false (attendu true pour l'intro).")
        if sn != 0 and is_intro:
            errors.append(f"Séquence {sn} : is_intro=true alors que seul S0 doit l'être.")


def _validate_question(q, errors):
    """Contrôles propres à une question selon son type."""
    sn = q.get("sequence_number")
    qo = q.get("question_order")
    qtype = q.get("question_type")
    loc = f"Séquence {sn} / question {qo} ({qtype})"
    options = q.get("options")

    # Feedback non vide, sauf pour la ligne case_study (feedback standard injecté
    # par build.py ; le détail est porté par chaque sous-question).
    if qtype != "case_study":
        if not str(q.get("feedback", "")).strip():
            errors.append(f"{loc} : feedback vide.")

    if qtype in ("mcq", "mcq_image", "true_false", "checkbox"):
        if _count_correct(options) < 1:
            errors.append(f"{loc} : aucune option correcte (≥ 1 requise).")

    elif qtype == "highlight":
        # Au moins un intrus, c.-à-d. au moins une option correct:false.
        if not isinstance(options, list):
            errors.append(f"{loc} : options highlight invalides.")
        else:
            intrus = sum(1 for o in options if isinstance(o, dict) and o.get("correct") is False)
            if intrus < 1:
                errors.append(f"{loc} : aucun intrus (≥ 1 option correct:false requise).")

    elif qtype == "ordering":
        if not isinstance(options, list) or not options:
            errors.append(f"{loc} : options ordering vides.")
        else:
            positions = sorted(o.get("correctPosition") for o in options if isinstance(o, dict))
            n = len(options)
            if positions != list(range(1, n + 1)):
                errors.append(
                    f"{loc} : positions ordering invalides {positions} "
                    f"(attendu {list(range(1, n + 1))})."
                )

    elif qtype == "matching":
        if not isinstance(options, dict):
            errors.append(f"{loc} : options matching invalides.")
        else:
            pairs = options.get("pairs")
            opts = options.get("options")
            answers = options.get("correctAnswers")
            if not (isinstance(pairs, list) and isinstance(opts, list) and isinstance(answers, list)):
                errors.append(f"{loc} : matching doit contenir pairs/options/correctAnswers (tableaux).")
            elif not (len(pairs) == len(opts) == len(answers)):
                errors.append(
                    f"{loc} : longueurs matching inégales "
                    f"(pairs={len(pairs)}, options={len(opts)}, correctAnswers={len(answers)})."
                )
            else:
                valid_ids = {o.get("id") for o in opts if isinstance(o, dict)}
                for i, a in enumerate(answers, start=1):
                    if not isinstance(a, str) or not _MATCHING_ANSWER_RE.match(a):
                        errors.append(f"{loc} : correctAnswers[{i}] = {a!r} hors format « i-LETTRE ».")
                        continue
                    idx, letter = a.split("-", 1)
                    if int(idx) != i:
                        errors.append(f"{loc} : correctAnswers[{i}] indexé {idx} (attendu {i}).")
                    if letter not in valid_ids:
                        errors.append(f"{loc} : correctAnswers[{i}] référence l'option inconnue {letter!r}.")

    elif qtype == "fill_blank":
        if not isinstance(options, dict):
            errors.append(f"{loc} : options fill_blank invalides.")
        else:
            blanks = options.get("blanks") or []
            word_bank = options.get("wordBank") or []
            # La mention « Banque de mots » ne doit plus apparaître dans l'énoncé.
            if _BANQUE_RE.search(q.get("question_text", "")):
                errors.append(f"{loc} : « Banque de mots » subsiste dans l'énoncé fill_blank.")
            if not blanks:
                errors.append(f"{loc} : aucun blanc défini.")
            for b in blanks:
                ca = (b.get("correctAnswer") if isinstance(b, dict) else None) or ""
                ca = str(ca).strip()
                bid = b.get("id") if isinstance(b, dict) else "?"
                if not ca:
                    errors.append(f"{loc} : blanc {bid} sans réponse correcte.")
                    continue
                if ca.startswith(_BLANC_PREFIX):
                    errors.append(f"{loc} : blanc {bid} garde le préfixe brut {ca!r}.")
                if ca not in word_bank:
                    errors.append(f"{loc} : réponse {ca!r} (blanc {bid}) absente du wordBank.")

    elif qtype == "case_study":
        if not isinstance(options, dict):
            errors.append(f"{loc} : options case_study invalides.")
        else:
            ctx = options.get("context") or {}
            if not str(ctx.get("patient", "")).strip():
                errors.append(f"{loc} : contexte case_study sans `patient`.")
            if not str(ctx.get("chief_complaint", "")).strip():
                errors.append(f"{loc} : contexte case_study sans `chief_complaint`.")
            subqs = options.get("questions") or []
            if not subqs:
                errors.append(f"{loc} : case_study sans sous-question conservée.")
            for sq in subqs:
                choices = sq.get("choices") if isinstance(sq, dict) else None
                sqid = sq.get("id") if isinstance(sq, dict) else "?"
                if _count_correct(choices) < 1:
                    errors.append(f"{loc} : sous-question {sqid} sans choix correct.")

    else:
        errors.append(f"{loc} : type de question inconnu {qtype!r}.")


def _validate_coherence(sequences, questions, errors, warnings, stats):
    """Cohérence plan ↔ questions et comptage global."""
    plan_nums = {s["seq_num"] for s in sequences}
    q_nums = {q["sequence_number"] for q in questions}

    # Chaque sequence_number présent dans les questions existe dans le plan.
    orphelins = sorted(q_nums - plan_nums)
    if orphelins:
        errors.append(f"Cohérence : questions rattachées à des séquences absentes du plan : {orphelins}.")

    # Chaque séquence du plan reçoit des questions.
    vides = sorted(plan_nums - q_nums)
    if vides:
        errors.append(f"Cohérence : séquences du plan sans question : {vides}.")

    # Comptage : total attendu = 4 × nb_séquences si 0 promotion.
    nb_seq = len(sequences)
    nb_q = len(questions)
    nb_promotions = sum(1 for q in questions if q.get("promoted"))
    attendu_sans_promotion = 4 * nb_seq

    stats.update({
        "nb_sequences": nb_seq,
        "nb_questions": nb_q,
        "nb_promotions": nb_promotions,
        "total_attendu_sans_promotion": attendu_sans_promotion,
    })

    if nb_promotions == 0:
        if nb_q != attendu_sans_promotion:
            warnings.append(
                f"Comptage : {nb_q} questions pour {nb_seq} séquences "
                f"(attendu {attendu_sans_promotion} = 4 × {nb_seq}, 0 promotion)."
            )
    else:
        warnings.append(
            f"Comptage : {nb_promotions} sous-question(s) de cas clinique promue(s) "
            f"en question autonome — total {nb_q} (base {attendu_sans_promotion} + promotions)."
        )

    # Détail des trous d'ordre par séquence (UNIQUE(sequence_id, question_order)).
    par_seq = {}
    for q in questions:
        par_seq.setdefault(q["sequence_number"], []).append(q["question_order"])
    for sn in sorted(par_seq):
        orders = sorted(par_seq[sn])
        if len(orders) != len(set(orders)):
            doublons = sorted({o for o in orders if orders.count(o) > 1})
            errors.append(f"Séquence {sn} : question_order en doublon : {doublons}.")
        attendu = list(range(1, len(orders) + 1))
        if orders != attendu:
            warnings.append(f"Séquence {sn} : ordres {orders} (attendu contigu {attendu}).")


def validate(sequences, questions):
    """Point d'entrée. Retourne { errors, warnings, stats }."""
    errors: list[str] = []
    warnings: list[str] = []
    stats: dict = {}

    _validate_sequences(sequences, errors, warnings)
    for q in questions:
        _validate_question(q, errors)
    _validate_coherence(sequences, questions, errors, warnings, stats)

    return {"errors": errors, "warnings": warnings, "stats": stats}
