// ============================================================================
// COPIE ADAPTEE de supabase/functions/synthesize_articles/prompts.ts
// Date de la copie : 2026-07-23 (chantier regeneration depuis texte integral).
//
// ⚠️ DETTE DE DRIFT ASSUMEE (decision D4 du brief) : ce module DUPLIQUE le
// prompt de l'Edge Function synthesize_articles cote Next.js. L'Edge Function ne
// doit PAS etre modifiee par ce chantier, et le prompt n'est PAS factorise. Si
// l'Edge Function evolue (regle d'autoportance des enonces, listes de tags,
// format quiz), cette copie NE SUIVRA PAS automatiquement — ce commentaire est
// le seul filet. A garder synchronise a la main.
//
// Differences VOLONTAIRES par rapport a la version Edge :
//   1. Ancrage SYSTEM_PROMPT : « a partir du TEXTE INTEGRAL » au lieu de
//      « a partir de l'abstract ».
//   2. Label de section user prompt : « texte integral: » au lieu de
//      « abstract: ».
//   3. Pas de troncature a 6000 caracteres : le plafond est celui de la route
//      (60 000). Aucun MAX_ABSTRACT_LENGTH reintroduit ici.
//   4. Enrichissement qualite (arbitrage 5B) : consignes de puisage exploitant
//      les sections Resultats / Discussion / Conclusion absentes d'un abstract.
//
// Recopie A L'IDENTIQUE (a ne pas alleger) : autoportance des enonces,
// vocabulaire ferme des tags, format quiz strict, source obligatoire dans le
// feedback, difficulty, longueur display_title, format JSON strict.
// ============================================================================

import {
  CATEGORY_EDITORIAL_VALUES,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
  QUESTION_TYPES_ALLOWED,
  type TaxonomyLists,
} from './regenerate-fulltext-validators'

// ---------------------------------------------------------------------------
// SYSTEM PROMPT (constante figee, langage neutre)
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = [
  "Tu es rédacteur scientifique et concepteur pédagogique pour Dentalschool,",
  "plateforme de formation continue des chirurgiens-dentistes francophones.",
  "À partir du TEXTE INTÉGRAL d'un article scientifique, tu produis un objet JSON",
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
  "- Tout chiffre que tu cites doit exister LITTÉRALEMENT dans le texte fourni.",
  "- Exception : pour les options de question, tu DOIS produire des",
  "  distracteurs (mauvaises réponses) plausibles et réalistes inspirés des",
  "  erreurs cliniques courantes — pas inventer de données chiffrées qui ne",
  "  sont pas dans la source.",
  "",
  "[Puisage dans le texte intégral]",
  "- key_figures : privilégie les valeurs chiffrées de la section RÉSULTATS",
  "  (effectifs, intervalles de confiance, p-values, tailles d'effet) plutôt",
  "  que celles reprises dans le résumé.",
  "- clinical_impact : appuie-toi sur les sections DISCUSSION et CONCLUSION.",
  "- caveats : reprends les LIMITES EXPLICITEMENT DÉCLARÉES par les auteurs",
  "  dans la Discussion. N'en invente pas si les auteurs n'en déclarent pas ;",
  "  écris alors « non renseigné dans le texte source ».",
  "",
  "[Vocabulaire fermé — tags]",
  "- Les valeurs de specialite, themes, niveau_preuve, category_editorial,",
  "  formation_category_match doivent provenir EXCLUSIVEMENT des listes",
  "  fournies dans le user prompt. Aucune création de slug nouveau.",
  "- Tu DOIS recopier chaque slug EXACTEMENT tel qu'il figure dans la liste",
  "  (forme complète, caractère pour caractère). Jamais de forme abrégée,",
  "  partielle ou paraphrasée — ex. « numerique » au lieu de",
  "  « dentisterie-numerique ».",
  "- Si aucun slug ne correspond parfaitement, choisis le ou les plus proches",
  "  de la liste fournie. Tout slug absent des listes invalide la synthèse.",
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
  "  apparaître. Si le texte ne se prête pas à un type, choisis-en un autre.",
  `- Nombre de questions : ${QUESTION_COUNT_MIN} à ${QUESTION_COUNT_MAX}.`,
  "- Distribution recommandée :",
  "    • 2 questions de type mcq (4 options, 1 correcte)",
  "    • 1 question de type true_false (2 options, 1 correcte)",
  "    • 0 ou 1 question de type checkbox (5-6 options, 2 à 4 correctes)",
  "      uniquement si le texte liste plusieurs facteurs / interventions /",
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
  "[Quiz — énoncés autoportants]",
  "- Chaque question_text doit être AUTOPORTANT : compréhensible et",
  "  répondable sans aucune référence à l'existence d'une étude, d'un",
  "  article ou d'auteurs. Une carte source (titre de la synthèse + bouton",
  "  « Voir l'article ») est déjà affichée au-dessus de la question côté",
  "  application ; l'énoncé ne doit donc jamais y renvoyer.",
  "- Formules INTERDITES dans question_text (et toute variante renvoyant à",
  "  la source ou à ses auteurs) : « cette étude », « cet article »,",
  "  « les auteurs », « selon l'étude », « dans cette publication »,",
  "  « cette recherche », « cet essai », « l'essai », « ce travail »,",
  "  « ces travaux », « la présente étude », « cette analyse »,",
  "  « cette revue », « cette méta-analyse ».",
  "- INTERDIT aussi d'injecter le titre de l'article dans l'énoncé : il est",
  "  déjà affiché au-dessus et porte souvent la conclusion (risque de",
  "  divulgation de la réponse).",
  "- Méthode : ancre l'énoncé sur le contexte clinique ou scientifique",
  "  précis qui rend la réponse déterminée — population, matériau,",
  "  protocole, molécule, échéance temporelle, conditions expérimentales.",
  "  La donnée chiffrée reste dans les options et le feedback.",
  "- RÈGLE DE REPLI (importante) : si une question ne peut exister qu'en",
  "  référence à l'étude elle-même (transférabilité des conclusions,",
  "  limites méthodologiques, design, effectifs de la cohorte), alors NE LA",
  "  POSE PAS : choisis un autre angle dans la matière disponible. Il est",
  "  strictement préférable de poser une question différente que de",
  "  produire un énoncé vague pour contourner l'interdiction. Un énoncé",
  "  flou et non répondable est un défaut PLUS GRAVE qu'une référence à",
  "  l'étude.",
  "- Cette contrainte ne concerne QUE question_text. La citation de la",
  "  source (auteurs, journal, année, DOI) reste OBLIGATOIRE dans le champ",
  "  « feedback » et dans le champ « source » (inchangés).",
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
  "- display_title : titre court percutant en français, idéalement",
  "  60 caractères, pas plus de 80 (sera tronqué côté code à 70 si nécessaire).",
  "  Pas de point final. Pas de jargon abscons. Doit donner envie de cliquer.",
  "",
  "[Format JSON]",
  "- Réponds UNIQUEMENT avec un objet JSON valide.",
  "- Sans texte avant ni après. Sans bloc Markdown ```json. Sans commentaires.",
  "- Les chaînes contenant des guillemets doivent être échappées correctement.",
  "- Pas de virgule en fin de tableau / objet (JSON strict, pas JSON5).",
].join("\n")

// ---------------------------------------------------------------------------
// USER PROMPT — assembleur
// ---------------------------------------------------------------------------

export interface FullTextArticle {
  title: string
  journal: string | null
  published_at: string | null
  authors: string[] | null
  doi: string | null
  url: string | null
  /** Texte intégral collé par l'admin (déjà borné par la route à 60 000 chars). */
  full_text: string
}

/**
 * Construit le user prompt pour Sonnet à partir de l'article + du texte
 * intégral + des listes de référence.
 *
 * PAS de troncature du texte intégral ici (différence 3 vs Edge) : la borne est
 * appliquée par la route (60 000 chars). On envoie le texte tel quel.
 */
export function buildFullTextUserPrompt(
  article: FullTextArticle,
  lists: TaxonomyLists,
): string {
  const authorsLine = article.authors && article.authors.length > 0
    ? article.authors.join(", ")
    : "(non renseigné)"

  const yearLine = article.published_at
    ? extractYear(article.published_at)
    : "(non renseigné)"

  const doiLine = article.doi ? article.doi : "(non renseigné)"
  const journalLine = article.journal ?? "(non renseigné)"
  const urlLine = article.url ?? "(non renseigné)"

  const sections: string[] = []

  // ----- Section 1 : article -----
  sections.push("## ARTICLE À ANALYSER")
  sections.push("")
  sections.push(`title: ${article.title}`)
  sections.push(`journal: ${journalLine}`)
  sections.push(`year: ${yearLine}`)
  sections.push(`authors: ${authorsLine}`)
  sections.push(`doi: ${doiLine}`)
  sections.push(`url: ${urlLine}`)
  sections.push("")
  sections.push("texte intégral:")
  sections.push(article.full_text)
  sections.push("")

  // ----- Section 2 : listes de référence -----
  sections.push("## LISTES DE RÉFÉRENCE (vocabulaire fermé)")
  sections.push("")
  sections.push("### specialite — choisir EXACTEMENT 1 slug parmi :")
  sections.push(formatList(lists.specialites))
  sections.push("")
  sections.push("### themes — choisir 1 à 3 slugs parmi :")
  sections.push(formatList(lists.themes))
  sections.push("")
  sections.push("### niveau_preuve — choisir EXACTEMENT 1 slug parmi :")
  sections.push(formatList(lists.niveaux_preuve))
  sections.push("")
  sections.push("### category_editorial — choisir EXACTEMENT 1 valeur parmi :")
  sections.push(formatList([...CATEGORY_EDITORIAL_VALUES]))
  sections.push("")
  sections.push(
    "### formation_category_match — choisir 1 slug SI correspondance avec une formation Dentalschool, sinon null. Liste des slugs disponibles :",
  )
  sections.push(formatList(lists.formation_categories))
  sections.push("")

  // ----- Section 3 : schéma JSON cible -----
  sections.push("## SCHÉMA JSON CIBLE (à respecter strictement)")
  sections.push("")
  sections.push("```")
  sections.push(SCHEMA_TEMPLATE)
  sections.push("```")
  sections.push("")
  sections.push(
    "Important : la sortie doit être un OBJET JSON valide, sans texte autour, sans bloc Markdown, sans commentaires.",
  )

  return sections.join("\n")
}

// ---------------------------------------------------------------------------
// SCHEMA template — reproduction littérale du JSON attendu (identique Edge)
// ---------------------------------------------------------------------------

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
  '  "display_title": "<idéalement 60 chars, sans point final>",',
  '  "quiz": [',
  "    {",
  '      "question_type": "<mcq|true_false|checkbox>",',
  '      "question_text": "<énoncé FR AUTOPORTANT — sans référence à l\'étude, à l\'article ni aux auteurs>",',
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
].join("\n")

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Format compact d'une liste de slugs : `- slug1\n- slug2\n...`. */
function formatList(items: string[]): string {
  if (items.length === 0) return "(liste vide — anomalie de chargement)"
  return items.map((s) => `- ${s}`).join("\n")
}

/** Extrait l'année (4 chiffres) d'une date ISO ou retourne le brut tronqué. */
function extractYear(isoLike: string): string {
  const m = isoLike.match(/^(\d{4})/)
  return m ? m[1] : isoLike.slice(0, 10)
}
