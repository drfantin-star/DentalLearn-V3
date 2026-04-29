// Construction des prompts Sonnet pour synthesize_articles.
//
// Module pur : pas d'effet de bord (BDD, fetch). Compose les strings
// `system` et `user` à partir d'un article candidat et des listes de
// référence (taxonomy + formations.category + category_editorial constantes).
//
// Règles strictes appliquées via le SYSTEM_PROMPT (cf spec_news_podcast_pipeline_v1_3.md
// §6.4 + arbitrages produit du Ticket 5) :
//   - Interdiction d'inventer une donnée (écrire "non renseigné dans le
//     texte source" si absente).
//   - Tous les tags `specialite`, `themes`, `niveau_preuve`,
//     `category_editorial`, `formation_category_match` proviennent
//     strictement des listes fournies.
//   - Format JSON strict (sans Markdown, sans texte parasite).
//   - Format options STRICT : array plat [{id, text, correct}]
//     PAS is_correct, PAS {choices: [...]} — aligné runtime DentalLearn
//     (cf finding F2 corrigé du Ticket 5).
//   - Types de questions autorisés : mcq (4 options, 1 correct),
//     true_false (2 options, 1 correct), checkbox (5-6 options, 2-4 correct).
//     PAS case_study, PAS fill_blank, etc.
//   - Distribution recommandée : 2 mcq + 1 true_false + (option) 1 checkbox.
//   - Un seul `feedback` par question (pas feedback_correct vs
//     feedback_incorrect distincts) ; sera dupliqué côté code en
//     feedback_correct === feedback_incorrect (règle v1.3).
//   - Source obligatoire dans chaque feedback : auteurs + journal + année + DOI.
//   - Difficulty 1..3 ; points calculés côté code (mapping A8) — NE PAS
//     inclure le champ points dans la sortie Sonnet.

import type { SelectedArticle, TaxonomyLists } from "./types.ts";
import {
  CATEGORY_EDITORIAL_VALUES,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
  QUESTION_TYPES_ALLOWED,
} from "./types.ts";

// ---------------------------------------------------------------------------
// SYSTEM PROMPT (constante figée, langage neutre)
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = [
  "Tu es rédacteur scientifique et concepteur pédagogique pour Dentalschool,",
  "plateforme de formation continue des chirurgiens-dentistes francophones.",
  "À partir de l'abstract d'un article scientifique, tu produis un objet JSON",
  "strict conforme au schéma fourni dans le user prompt, contenant :",
  "  1. Une fiche synthèse en français (summary_fr, method, key_figures,",
  "     evidence_level, clinical_impact, caveats).",
  "  2. Un tagging 3 dimensions (specialite, themes, niveau_preuve) +",
  "     keywords_libres + tagging éditorial v1.3 (category_editorial,",
  "     formation_category_match) + display_title (≤60 caractères).",
  "  3. Un quiz pédagogique de 3 à 4 questions au format JSONB compatible",
  "     avec la table public.questions de DentalLearn.",
  "",
  "RÈGLES STRICTES (à respecter sans exception) :",
  "",
  "[Anti-invention]",
  "- Interdiction d'inventer ou d'extrapoler une donnée scientifique. Si une",
  "  donnée est absente du texte source, écris « non renseigné dans le texte",
  "  source » dans le champ correspondant.",
  "- Exception : pour les options de question, tu DOIS produire des",
  "  distracteurs (mauvaises réponses) plausibles et réalistes inspirés des",
  "  erreurs cliniques courantes — pas inventer de données chiffrées qui ne",
  "  sont pas dans la source.",
  "",
  "[Vocabulaire fermé — tags]",
  "- Les valeurs de specialite, themes, niveau_preuve, category_editorial,",
  "  formation_category_match doivent provenir EXCLUSIVEMENT des listes",
  "  fournies dans le user prompt. Aucune création de slug nouveau.",
  "- specialite : exactement 1 slug.",
  "- themes : 1 à 3 slugs.",
  "- niveau_preuve : exactement 1 slug.",
  "- category_editorial : exactement 1 valeur parmi les 4 fournies.",
  "- formation_category_match : 1 slug parmi la liste fournie SI la",
  "  spécialité correspond à une formation Dentalschool, sinon null.",
  "",
  "[Quiz — types autorisés et distribution]",
  `- Types autorisés UNIQUEMENT : ${QUESTION_TYPES_ALLOWED.join(", ")}.`,
  "  Aucun autre type (case_study, fill_blank, matching, etc.) ne doit",
  "  apparaître. Si l'abstract ne se prête pas à un type, choisis-en un autre.",
  `- Nombre de questions : ${QUESTION_COUNT_MIN} à ${QUESTION_COUNT_MAX}.`,
  "- Distribution recommandée :",
  "    • 2 questions de type mcq (4 options, 1 correcte)",
  "    • 1 question de type true_false (2 options, 1 correcte)",
  "    • 0 ou 1 question de type checkbox (5-6 options, 2 à 4 correctes)",
  "      uniquement si l'abstract liste plusieurs facteurs / interventions /",
  "      contre-indications justifiant une question multi-réponses.",
  "",
  "[Quiz — format options STRICT]",
  "- Le champ options DOIT être un ARRAY PLAT d'objets, jamais un objet",
  "  enveloppe. Forme exigée :",
  '    [{ "id": "A", "text": "...", "correct": false }, ...]',
  "  PAS { choices: [...] }, PAS is_correct (utiliser le champ « correct »).",
  "- Les ids sont des lettres majuscules consécutives :",
  "    • mcq        : ids A, B, C, D (exactement 4 options)",
  "    • true_false : ids A, B (exactement 2 options, text « Vrai » / « Faux »)",
  "    • checkbox   : ids A, B, C, D, E (et F si besoin), 5 à 6 options",
  "- Pour mcq/true_false : exactement 1 option avec correct=true.",
  "- Pour checkbox : entre 2 et 4 options avec correct=true.",
  "",
  "[Quiz — feedback unique + source]",
  "- Un seul champ « feedback » par question (string non vide). Il sera",
  "  dupliqué côté code en feedback_correct === feedback_incorrect (règle v1.3).",
  "- Le feedback doit OBLIGATOIREMENT citer la source : auteurs + journal +",
  "  année + DOI (ou URL canonique si DOI absent). Format conseillé :",
  '    « Selon Auteurs et al. (Journal, Année, doi:10.xxxx/yyy), [explication] »',
  "- En complément, le champ « source » (séparé) doit reprendre la même",
  "  citation au format compact :",
  '    « Auteurs - Journal - Année - DOI »',
  "  Ce champ sert au contrôle qualité côté code (vérifie qu'une citation",
  "  existe). Il est obligatoire et non vide.",
  "- Toute mauvaise réponse illustre une erreur réelle plausible, pas un",
  "  piège artificiel.",
  "",
  "[Quiz — difficulty]",
  "- Champ difficulty : entier 1 (facile), 2 (moyen) ou 3 (difficile).",
  "- Privilégie 1 et 2 pour le pool quiz quotidien (l'utilisateur final est",
  "  un praticien en révision, pas un étudiant en examen).",
  "- NE PAS inclure les champs « points » ni « recommended_time_seconds » :",
  "  ils sont calculés automatiquement côté code à partir de difficulty et",
  "  question_type.",
  "",
  "[Affichage]",
  "- display_title : titre court percutant en français, ≤ 70 caractères.",
  "  Pas de point final. Pas de jargon abscons. Doit donner envie de cliquer.",
  "",
  "[Format JSON]",
  "- Réponds UNIQUEMENT avec un objet JSON valide.",
  "- Sans texte avant ni après. Sans bloc Markdown ```json. Sans commentaires.",
  "- Les chaînes contenant des guillemets doivent être échappées correctement.",
  "- Pas de virgule en fin de tableau / objet (JSON strict, pas JSON5).",
].join("\n");

// ---------------------------------------------------------------------------
// USER PROMPT — assembleur
// ---------------------------------------------------------------------------

/**
 * Construit le user prompt pour Sonnet à partir d'un article candidat et des
 * listes de référence chargées en début de run.
 *
 * Le prompt suit l'ordre :
 *   1. Données article (title, journal, year, authors, doi, abstract).
 *   2. Listes de référence avec une notice par liste.
 *   3. Schéma JSON cible reproduit littéralement.
 *
 * Tronque l'abstract à 6000 caractères (au-delà : abstract probablement
 * concaténé avec autre chose et la qualité Sonnet décroît). Aucun article
 * de la base actuelle (504 abstracts ingérés au Ticket 4) n'atteint ce
 * volume — le tronquage est un garde-fou.
 */
export function buildUserPrompt(
  article: SelectedArticle,
  lists: TaxonomyLists,
): string {
  const abstractLine = article.abstract && article.abstract.trim().length > 0
    ? truncate(article.abstract.trim(), 6000)
    : "(non renseigné dans la source)";

  const authorsLine = article.authors && article.authors.length > 0
    ? article.authors.join(", ")
    : "(non renseigné)";

  const yearLine = article.published_at
    ? extractYear(article.published_at)
    : "(non renseigné)";

  const doiLine = article.doi ? article.doi : "(non renseigné)";
  const journalLine = article.journal ?? "(non renseigné)";
  const urlLine = article.url ?? "(non renseigné)";

  const sections: string[] = [];

  // ----- Section 1 : article -----
  sections.push("## ARTICLE À ANALYSER");
  sections.push("");
  sections.push(`title: ${article.title}`);
  sections.push(`journal: ${journalLine}`);
  sections.push(`year: ${yearLine}`);
  sections.push(`authors: ${authorsLine}`);
  sections.push(`doi: ${doiLine}`);
  sections.push(`url: ${urlLine}`);
  sections.push("");
  sections.push("abstract:");
  sections.push(abstractLine);
  sections.push("");

  // ----- Section 2 : listes de référence -----
  sections.push("## LISTES DE RÉFÉRENCE (vocabulaire fermé)");
  sections.push("");
  sections.push("### specialite — choisir EXACTEMENT 1 slug parmi :");
  sections.push(formatList(lists.specialites));
  sections.push("");
  sections.push("### themes — choisir 1 à 3 slugs parmi :");
  sections.push(formatList(lists.themes));
  sections.push("");
  sections.push("### niveau_preuve — choisir EXACTEMENT 1 slug parmi :");
  sections.push(formatList(lists.niveaux_preuve));
  sections.push("");
  sections.push(
    "### category_editorial — choisir EXACTEMENT 1 valeur parmi :",
  );
  sections.push(formatList([...CATEGORY_EDITORIAL_VALUES]));
  sections.push("");
  sections.push(
    "### formation_category_match — choisir 1 slug SI correspondance avec une formation Dentalschool, sinon null. Liste des slugs disponibles :",
  );
  sections.push(formatList(lists.formation_categories));
  sections.push("");

  // ----- Section 3 : schéma JSON cible -----
  sections.push("## SCHÉMA JSON CIBLE (à respecter strictement)");
  sections.push("");
  sections.push("```");
  sections.push(SCHEMA_TEMPLATE);
  sections.push("```");
  sections.push("");
  sections.push(
    "Important : la sortie doit être un OBJET JSON valide, sans texte autour, sans bloc Markdown, sans commentaires.",
  );

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// SCHEMA template — reproduction littérale du JSON attendu
// ---------------------------------------------------------------------------
//
// Inclus tel quel dans le user prompt pour ancrer Sonnet sur la forme exacte
// des champs (ordre, types, optionalité). Les commentaires inline sont
// enlevés à l'envoi (Sonnet voit uniquement les valeurs placeholder).

const SCHEMA_TEMPLATE = [
  "{",
  '  "summary_fr": "<string FR, 200-400 mots, factuelle, sans invention>",',
  '  "method": "<string FR ou \\"non renseigné dans le texte source\\">",',
  '  "key_figures": ["<string contenant un chiffre clé>", "..."],',
  '  "evidence_level": "<string libre FR ; ex: méta-analyse, RCT, cohorte, recommandation HAS>",',
  '  "clinical_impact": "<string FR, impact pratique pour le praticien>",',
  '  "caveats": "<string FR, limites & précautions ou \\"non renseigné dans le texte source\\">",',
  '  "specialite": "<slug strict de la liste>",',
  '  "themes": ["<slug>", "..."],',
  '  "niveau_preuve": "<slug strict de la liste>",',
  '  "keywords_libres": ["<mot-clé libre>", "..."],',
  '  "category_editorial": "<reglementaire|scientifique|pratique|humour>",',
  '  "formation_category_match": "<slug ou null>",',
  '  "display_title": "<≤70 caractères, sans point final>",',
  '  "quiz": [',
  "    {",
  '      "question_type": "<mcq|true_false|checkbox>",',
  '      "question_text": "<énoncé FR>",',
  '      "options": [',
  '        { "id": "A", "text": "...", "correct": false },',
  '        { "id": "B", "text": "...", "correct": true }',
  "      ],",
  '      "feedback": "<explication FR citant Auteurs (Journal, Année, doi:...)>",',
  '      "difficulty": 1,',
  '      "source": "<Auteurs - Journal - Année - DOI>"',
  "    }",
  "  ]",
  "}",
].join("\n");

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Format compact d'une liste de slugs : `- slug1\n- slug2\n...`. */
function formatList(items: string[]): string {
  if (items.length === 0) return "(liste vide — anomalie de chargement)";
  return items.map((s) => `- ${s}`).join("\n");
}

/** Extrait l'année (4 chiffres) d'une date ISO ou retourne le brut tronqué. */
function extractYear(isoLike: string): string {
  const m = isoLike.match(/^(\d{4})/);
  return m ? m[1] : isoLike.slice(0, 10);
}

/** Tronque sans couper en plein milieu d'un mot (best effort). */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const safe = lastSpace > max - 200 ? slice.slice(0, lastSpace) : slice;
  return `${safe}…[abstract tronqué à ${max} chars]`;
}
