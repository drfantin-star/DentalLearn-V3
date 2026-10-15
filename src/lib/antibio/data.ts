/**
 * AntibioGuide — données HAS recopiées des tableaux sources.
 *
 * Sources :
 *  - HAS, « Prescription des antibiotiques en pratique bucco-dentaire »,
 *    fiche de synthèse adoptée par le Collège le 16 juillet 2026 (tableaux 1 à 15).
 *  - HAS, « Prise en charge bucco-dentaire des patients à risque d'endocardite
 *    infectieuse », octobre 2024 (§1, §2, §3, §4, §5.2, §6).
 *
 * Toute valeur ici a été vérifiée visuellement contre les pages PDF, puis par
 * une relecture indépendante (15/10/2026). Ne pas « corriger » une valeur sans
 * la source HAS sous les yeux.
 */
import type { Act, Cell, CurFamily, Family, Ped, ProfileGroup, Scheme } from './types';

const N = (g: string): Cell => ({ v: 'N', g });
const R = (g: string, s?: boolean): Cell => ({ v: 'R', g, s: !!s });
const CI = (g: string): Cell => ({ v: 'CI', g });

/* ===================== Profil patient ===================== */
export const PROFILE: ProfileGroup[] = [
  {
    id: 'ria',
    title: 'Risque infectieux augmenté',
    src: 'HAS 2026, §2.1',
    items: [
      { id: 'chimio', label: 'Chimiothérapie aplasiante en cours' },
      { id: 'immuno', label: 'Immunosuppresseur, immunomodulateur ou biothérapie en cours', hint: 'risque à évaluer au cas par cas selon la molécule' },
      { id: 'cortico', label: "Corticoïdes ≥ 10 mg/j d'équivalent prednisolone depuis plus de 2 semaines" },
      { id: 'greffe', label: "Traitement anti-rejet (greffe d'organe solide, allogreffe de CSH)" },
      { id: 'vih', label: 'VIH avec CD4 < 200/mm³' },
      { id: 'neutro', label: 'Neutropénie < 500/mm³' },
      { id: 'dici', label: 'Déficit immunitaire congénital ou du complément' },
      { id: 'asplenie', label: 'Asplénie depuis moins de 5 ans' },
      { id: 'diab', label: 'Diabète avec HbA1c ≥ 9 %', hint: 'HbA1c de moins de 3 mois ; si ≥ 9 %, orienter vers le médecin traitant sans retarder les soins nécessaires' },
      { id: 'ir', label: 'Insuffisance rénale sévère (DFG < 30) ou dialyse' },
      { id: 'ihc', label: 'Insuffisance hépatocellulaire sévère (TP ≤ 50 %)' },
      { id: 'drepano', label: 'Syndrome drépanocytaire majeur', hint: 'risque à évaluer avec le praticien référent' },
    ],
  },
  {
    id: 'onm',
    title: "Haut risque d'ostéonécrose des mâchoires",
    src: 'HAS 2026, §2.2',
    items: [
      { id: 'rt', label: 'Radiothérapie cervico-faciale ≥ 40 Gy sur les mâchoires (en cours ou passée)' },
      { id: 'deno', label: 'Dénosumab ou biosimilaire, dernière injection < 6 mois' },
      { id: 'bpmal', label: 'Bisphosphonates pour une pathologie maligne (en cours ou passés)' },
      { id: 'antiang', label: 'Anti-angiogéniques pour une pathologie maligne' },
      { id: 'bpben', label: 'Bisphosphonates pour une pathologie bénigne pendant 5 ans cumulés ou plus' },
    ],
  },
  {
    id: 'ei',
    title: "Haut risque d'endocardite infectieuse",
    src: 'HAS 2024, §1',
    info: "Risque intermédiaire (valvulopathie : fuite ou rétrécissement d'une valve, cardiomyopathie hypertrophique obstructive, cardiopathie congénitale non classée à haut risque, stimulateur avec sonde intracardiaque) : ne pas cocher. La HAS 2024 ne prévoit ni contre-indication ni antibioprophylaxie pour ces patients (grade A), seulement un bain de bouche à la chlorhexidine 1 min avant tout geste.",
    items: [
      { id: 'eiatcd', label: "Antécédent d'endocardite infectieuse" },
      { id: 'valve', label: 'Prothèse valvulaire ou matériel de réparation valvulaire (chirurgical ou percutané : TAVI, clip…)' },
      { id: 'cardio', label: 'Cardiopathie congénitale cyanogène complexe, ou réparée par matériel prothétique (< 6 mois, ou à vie si shunt résiduel)' },
      { id: 'lvad', label: "Pompe d'assistance ventriculaire" },
    ],
  },
  {
    id: 'pg',
    title: 'Assimilés à la population générale (pour information)',
    src: 'HAS 2026, §2.3',
    info: "Ces situations ne changent pas la catégorie : rémission d'une pathologie maligne, prothèse articulaire, allogreffe de cellules souches sans traitement anti-rejet, dénutrition, tabac, diabète avec HbA1c < 9 %, obésité, grossesse, âge. Idem pour l'ostéonécrose : bisphosphonates pour pathologie bénigne pendant moins de 5 ans cumulés, dénosumab dont la dernière injection date de plus de 6 mois.",
    items: [],
  },
  {
    id: 'all',
    title: 'Allergie',
    src: '',
    items: [
      { id: 'peni', label: 'Allergie avérée ou anaphylaxie probable aux pénicillines' },
      { id: 'ceph', label: 'Contre-indication aux céphalosporines / β-lactamines', hint: "utile pour la sinusite maxillaire d'origine dentaire" },
      { id: 'qt', label: "Allongement de l'intervalle QT (traité ou connu)", hint: "contre-indique l'azithromycine dans la reco endocardite" },
    ],
  },
];

/* ===================== Antibioprophylaxie par acte (tableaux 1 à 10) ===================== */
const EI_TRAUMA = '« Tous les actes thérapeutiques en lien avec la traumatologie dentaire et alvéolaire » : sous antibioprophylaxie.';
const EI_MEMBRANE = 'Autorisée sous antibioprophylaxie sans membrane de régénération osseuse ; contre-indiquée avec membrane.';

export const FAM: Family[] = [
  { id: 'endo', label: 'Endodontie', t: 1, acts: [
    { l: 'Pulpotomie de dent temporaire', pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'ABP', note: 'Enfant : pulpotomie des dents temporaires autorisée sous antibioprophylaxie.' } },
    { l: 'Traitement endodontique de dent temporaire', pg: N('AE'), ria: R('AE', true), onm: N('AE'), ei: { v: 'CI', note: 'Pulpectomie des dents temporaires : contre-indiquée.' } },
    { l: 'Coiffage pulpaire et pulpotomie thérapeutique de dent permanente', pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'COND', note: 'Coiffage pulpaire sur dent permanente mature : contre-indiqué. Pulpotomie sur dent permanente mature (adulte), coiffage ou pulpotomie sur dent permanente immature (enfant) : autorisés sous antibioprophylaxie.' } },
    { l: "Traitement endodontique et pulpotomie d'urgence, dent permanente à pulpe vitale", pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'ABP' } },
    { l: 'Traitement endodontique, dent permanente à pulpe non vitale', pg: N('B'), ria: R('AE'), onm: N('AE'), ei: { v: 'ABP' } },
    { l: 'Reprise de traitement endodontique, dent permanente', pg: N('B'), ria: R('AE'), onm: N('AE'), ei: { v: 'ABP' } },
    { l: 'Chirurgie endodontique péri-apicale ou péri-radiculaire', os: true, pg: N('B'), ria: R('AE'), onm: R('AE', true), nb: 'mi', ei: { v: 'COND', note: EI_MEMBRANE } },
  ] },
  { id: 'paro', label: 'Parodontologie', t: 2, acts: [
    { l: 'Sondage parodontal', pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'ABP' } },
    { l: 'Détartrage, surfaçage radiculaire', pg: N('AE'), ria: R('AE', true), onm: N('AE'), ei: { v: 'ABP' } },
    { l: "Chirurgie d'assainissement parodontal", os: true, pg: N('AE'), ria: R('AE', true), onm: R('AE', true), ei: { v: 'COND', note: 'Autorisée sous antibioprophylaxie sans membrane ; contre-indiquée avec membrane.' } },
    { l: 'Élongation coronaire', os: true, pg: N('AE'), ria: R('AE', true), onm: R('AE', true), ei: { v: 'ABP' } },
    { l: 'Amputation radiculaire', os: true, pg: N('AE'), ria: R('AE', true), onm: R('AE', true), nb: 'mi', ei: { v: 'NL' } },
    { l: 'Chirurgie plastique parodontale (lambeau, greffe gingivale)', pg: N('AE'), ria: R('AE', true), onm: R('AE', true), nb: 'mi', ei: { v: 'NL', note: 'Seule la gingivectomie est citée (sous antibioprophylaxie).' } },
    { l: 'Chirurgie reconstructrice ou régénératrice, biomatériaux', os: true, pg: N('B'), ria: R('AE', true), onm: R('AE', true), nb: 'mi', ei: { v: 'COND', note: 'Membrane de régénération osseuse : contre-indiquée. Comblement sans membrane : autorisé sous antibioprophylaxie.' } },
  ] },
  { id: 'impl', label: 'Implantologie', t: 3, acts: [
    { l: "Pose d'implant(s)", os: true, pg: { v: 'N', g: 'B', impl: true }, ria: R('AE', true), onm: R('AE', true), nb: 'm', ei: { v: 'COND', note: "Autorisée sous antibioprophylaxie, sans membrane, en l'absence de maladie parodontale, avec une hygiène satisfaisante (+ éducation thérapeutique, contrôle glycémique, arrêt du tabac). Sinon contre-indiquée." } },
    { l: 'Augmentation osseuse pré- ou per-implantaire (greffe osseuse)', os: true, pg: R('C'), ria: R('AE', true), onm: R('AE', true), nb: 'mi', ei: { v: 'COND', note: 'Autorisée sous antibioprophylaxie sans membrane ; contre-indiquée avec membrane.' } },
    { l: 'Élévation sinusienne pré- ou per-implantaire', os: true, pg: R('AE'), ria: R('AE', true), onm: R('AE', true), nb: 'mi', ei: { v: 'COND', note: 'Autorisée sous antibioprophylaxie sans membrane ; contre-indiquée avec membrane.' } },
    { l: 'Chirurgie plastique péri-implantaire', pg: N('AE'), ria: R('AE', true), onm: R('AE', true), ei: { v: 'ABP' } },
    { l: "Dégagement d'implant", pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'ABP', note: 'Mise en place de piliers de cicatrisation sur implants enfouis : sous antibioprophylaxie.' } },
    { l: 'Chirurgie des péri-implantites (lambeau, comblement, greffe, membrane)', os: true, pg: N('AE'), ria: R('AE', true), onm: R('AE', true), nb: 'm', ei: { v: 'CI', note: "Tout traitement de la péri-implantite est contre-indiqué. Il est recommandé de déposer l'implant, sous antibioprophylaxie." } },
  ] },
  { id: 'chir', label: 'Chirurgie orale', t: 4, acts: [
    { l: 'Avulsion de dent temporaire ou permanente (sur arcade, racines, alvéolectomie, séparation)', os: true, pg: N('A'), ria: R('AE'), onm: R('C'), ei: { v: 'ABP' } },
    { l: 'Avulsion de dent incluse, ectopique ou en désinclusion', os: true, pg: R('A'), ria: R('AE'), onm: R('AE', true), ei: { v: 'ABP' } },
    { l: 'Autotransplantation dentaire', os: true, pg: R('AE'), ria: R('AE', true), onm: R('AE', true), nb: 'mi', ei: { v: 'ABP', note: 'Avulsion et réimplantation sont toutes deux listées sous antibioprophylaxie (HAS 2024, §2.2).' } },
    { l: 'Chirurgie osseuse pré-prothétique (tori, ostéotomie tubérositaire)', os: true, pg: N('AE'), ria: R('AE', true), onm: R('AE', true), ei: { v: 'NL' } },
    { l: 'Chirurgie pré-orthodontique de dent incluse ou enclavée', os: true, pg: N('AE'), ria: R('AE'), onm: R('AE', true), nb: 'mi', ei: { v: 'ABP', note: 'Dégagement orthodontique de dent incluse.' } },
    { l: 'Freinectomie', pg: N('AE'), ria: R('AE'), onm: N('AE'), ei: { v: 'ABP' } },
    { l: 'Biopsie ou exérèse de lésion bénigne des tissus mous', pg: N('AE'), ria: R('AE'), onm: N('AE'), ei: { v: 'ABP' } },
    { l: 'Biopsie ou exérèse de lésion osseuse bénigne des mâchoires', os: true, pg: N('AE'), ria: R('AE'), onm: R('AE'), ei: { v: 'ABP', note: 'Sans membrane de régénération osseuse.' } },
  ] },
  { id: 'perop', label: 'Incident per-opératoire', t: 5, acts: [
    { l: 'Communication bucco-sinusienne', pg: R('AE'), ria: R('AE'), onm: R('AE'), sp: 'perop' },
    { l: "Accident d'exposition à l'hypochlorite de sodium", pg: R('AE'), ria: R('AE'), onm: R('AE'), sp: 'perop' },
    { l: 'Emphysème cervico-facial', pg: R('AE'), ria: R('AE'), onm: R('AE'), sp: 'perop' },
  ] },
  { id: 'trauma', label: 'Traumatologie', t: 6, acts: [
    { l: 'Réimplantation de dent permanente expulsée', pg: N('C'), ria: R('AE', true), onm: CI('AE'), ei: { v: 'ABP' } },
    { l: 'Repositionnement de dent luxée, intruse ou extruse (± fracture alvéolaire)', os: true, pg: N('AE'), ria: R('AE'), onm: R('AE'), ei: { v: 'ABP' } },
    { l: 'Fracture coronaire, corono-radiculaire ou radiculaire', pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'ABP', note: EI_TRAUMA } },
    { l: 'Plaie de tissus mous', pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'ABP', note: EI_TRAUMA } },
    { l: 'Plaie fortement souillée', pg: R('AE'), ria: R('AE'), onm: R('AE'), sp: 'souillee' },
    { l: 'Plaie par morsure de mammifère', pg: R('AE'), ria: R('AE'), onm: R('AE'), sp: 'souillee' },
  ] },
  { id: 'odf', label: 'Orthodontie', t: 7, acts: [
    { l: 'Pose et dépose de dispositif collé ou scellé supragingival', pg: N('AE'), ria: N('AE'), onm: { v: 'N', g: 'AE', s: true }, ei: { v: 'N' } },
    { l: "Pose de matériel d'ancrage orthodontique (mini-vis, plaque)", os: true, pg: N('AE'), ria: R('AE'), onm: CI('AE'), ei: { v: 'ABP' } },
  ] },
  { id: 'proth', label: 'Prothèse', t: 8, acts: [
    { l: 'Soin prothétique, à risque ou non de saignement', pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'N', note: 'Préparation prothétique : acte non invasif.' } },
    { l: "Prise d'empreintes", pg: N('C'), ria: N('C'), onm: N('C'), ei: { v: 'N' } },
  ] },
  { id: 'anest', label: 'Anesthésie', t: 9, acts: [
    { l: 'Anesthésie para-apicale ou loco-régionale', pg: N('C'), ria: N('AE'), onm: N('AE'), ei: { v: 'COND', note: "Site non inflammatoire : pas d'antibioprophylaxie. Site inflammatoire : antibioprophylaxie." } },
    { l: 'Anesthésie intraligamentaire', pg: N('AE'), ria: N('AE'), onm: R('AE', true), deux: true, ei: { v: 'ABP', note: 'En 2e intention uniquement.' } },
    { l: 'Anesthésie ostéo-centrale', pg: N('AE'), ria: N('AE'), onm: R('AE', true), deux: true, nb: 'mi', ei: { v: 'ABP', note: 'En 2e intention uniquement.' } },
  ] },
  { id: 'autres', label: 'Autres actes', t: 10, acts: [
    { l: 'Acte de prévention non sanglant', pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'N', note: "Acte non invasif (la reco 2024 réserve l'antibioprophylaxie aux actes invasifs)." } },
    { l: "Mise en place d'une digue", pg: N('AE'), ria: N('AE'), onm: N('AE'), ei: { v: 'COND', note: "Gencive non inflammatoire : pas d'antibioprophylaxie. Gencive inflammatoire : antibioprophylaxie." } },
    { l: 'Soin restaurateur sans atteinte pulpaire', pg: N('C'), ria: N('C'), onm: N('C'), ei: { v: 'N' } },
    { l: 'Radiographie dentaire', pg: N('C'), ria: N('C'), onm: N('C'), ei: { v: 'N' } },
    { l: 'Dépose de fil de suture', pg: N('C'), ria: N('C'), onm: N('C'), ei: { v: 'N' } },
  ] },
];

/* ===================== Antibiothérapie curative (tableau 13) ===================== */
export const CUR: CurFamily[] = [
  { id: 'endo', label: 'Endodontie', items: [
    { l: 'Pulpite', v: 'N', g: 'C' },
    { l: 'Parodontite apicale aiguë / abcès apical aigu', v: 'S', g: 'B', grp: 'A' },
    { l: 'Parodontite apicale chronique / abcès apical chronique', v: 'N', g: 'C' },
    { l: 'Flambée infectieuse (flare-up)', v: 'S', g: 'AE', grp: 'A' },
  ] },
  { id: 'paro', label: 'Parodontologie', items: [
    { l: 'Gingivite', v: 'N', g: 'B' },
    { l: 'Parodontite (hors cas ci-dessous)', v: 'N', g: 'A' },
    { l: 'Parodontite stade III/IV avec inadéquation biofilm/destruction et ratio % perte osseuse/âge > 1', v: 'R', g: 'AE', grp: 'P34', when: "Après la dernière séance d'instrumentation sous-gingivale." },
    { l: 'Poches parodontales résiduelles', v: 'N', g: 'AE' },
    { l: 'Abcès parodontal', v: 'S', g: 'AE', grp: 'A' },
    { l: 'Abcès endo-parodontal', v: 'S', g: 'AE', grp: 'A' },
    { l: 'Maladie parodontale nécrosante sans atteinte systémique', v: 'S', g: 'C', grp: 'MPN' },
    { l: 'Maladie parodontale nécrosante avec atteinte systémique (adénopathie, fièvre…)', v: 'R', g: 'C', grp: 'MPN' },
  ] },
  { id: 'impl', label: 'Implantologie', items: [
    { l: 'Mucosite péri-implantaire', v: 'N', g: 'B' },
    { l: 'Péri-implantite', v: 'S', g: 'C', grp: 'A', periimpl: true },
    { l: 'Infection de greffe osseuse ou gingivale', v: 'R', g: 'AE', grp: 'A' },
  ] },
  { id: 'chir', label: 'Chirurgie orale', items: [
    { l: "Péricoronarite (inflammation d'origine péricoronaire)", v: 'N', g: 'C' },
    { l: 'Infection péricoronaire avec extension locale, régionale ou systémique', v: 'R', g: 'C', grp: 'PERI' },
    { l: 'Alvéolite sèche', v: 'N', g: 'C' },
    { l: 'Alvéolite suppurée', v: 'S', g: 'AE', grp: 'A', alv: true },
    { l: 'Ostéite', v: 'R', g: 'AE', grp: 'OST' },
    { l: 'Ostéomyélite', v: 'R', g: 'AE', grp: 'OST' },
    { l: "Sinusite maxillaire aiguë d'origine dentaire", v: 'R', g: 'C', grp: 'SIN' },
    { l: 'Sialadénite bactérienne', v: 'R', g: 'C', grp: 'A' },
  ] },
  { id: 'cell', label: 'Cellulite', items: [
    { l: "Cellulite cervico-faciale (dermohypodermite) avec signes d'extension", v: 'R', g: 'B', grp: 'A', cell: true },
  ] },
  { id: 'onm', label: 'Ostéonécrose', items: [
    { l: "Ostéonécrose des mâchoires sans signe d'infection", v: 'N', g: 'C' },
    { l: "Ostéonécrose des mâchoires avec signes d'extension", v: 'R', g: 'C', grp: 'OST' },
  ] },
];

/* ===================== Schémas de prescription ===================== */
const P = (d: string, k: number | [number, number], per: 'prise' | 'jour', max: number | null, n?: number, s?: string): Ped => ({ d, k, per, max, n, s });

/** Balise texte « hors AMM » : rendue en pastille par l'interface. */
export const HORS_AMM = '[hors AMM]';
export const PROL = ' (prolonger de 2 jours si symptômes persistants)';

const EI_NOTE = "Bain de bouche chlorhexidine 0,12 ou 0,20 % pendant 1 min avant le geste. Préciser sur l'ordonnance une dispensation à l'unité. Espacer d'au moins 3 semaines les séances nécessitant une antibioprophylaxie, sinon changer de classe.";

export const RX: Record<'std' | 'perop' | 'souillee' | 'onmos' | 'ei', Scheme> = {
  std: {
    title: 'Antibioprophylaxie pré-opératoire, prise unique',
    src: 'Tableaux 11 et 12 (grade AE, hors AMM)',
    adult: {
      first: ["**Amoxicilline 2 g** per os, 30 à 60 min avant l'acte", 'ou **Amoxicilline IV 2 g** au plus tôt 60 min avant, au plus tard avant l\'incision'],
      alt: ['**Clarithromycine 500 mg** per os', '**Azithromycine 500 mg** per os', '**Pristinamycine 1 g** per os', 'Voie injectable : **Céfazoline IV/IM 1 g**, **Ceftriaxone IV/IM 1 g** ou **Clindamycine IV 900 mg**'],
    },
    child: {
      first: [[P('Amoxicilline per os (30 à 60 min avant)', 50, 'prise', 2000)], [P('ou Amoxicilline IV', 50, 'prise', 2000)]],
      alt: [[P('Clarithromycine', 15, 'prise', 500)], [P('Azithromycine', 20, 'prise', 500)], [P('Pristinamycine', 25, 'prise', 1000)], [P('Céfazoline IV/IM', 50, 'prise', 1000)], [P('Ceftriaxone IV/IM', 50, 'prise', 1000)], [P('Clindamycine IV', 20, 'prise', 900)]],
    },
  },
  perop: {
    title: 'Antibioprophylaxie post-opératoire (incident per-opératoire)',
    src: 'Tableaux 11 et 12 (grade AE, hors AMM)',
    adult: {
      first: ['**Amoxicilline 1 g**, 2 fois par jour, durant 5 jours'],
      alt: ['**Clarithromycine 500 mg**, 2 fois par jour, durant 5 jours', '**Azithromycine 500 mg**, 1 fois par jour, durant 3 jours', '**Pristinamycine 1 g**, 2 fois par jour, durant 5 jours'],
    },
    child: {
      first: [[P('Amoxicilline', 50, 'jour', 2000, 3, 'durant 5 jours')]],
      alt: [[P('Clarithromycine', 15, 'jour', 1000, 2, 'durant 5 jours')], [P('Azithromycine', 20, 'jour', 500, 1, 'durant 3 jours')], [P('Pristinamycine', 50, 'jour', 2000, 3, 'durant 5 jours')]],
    },
  },
  souillee: {
    title: 'Antibioprophylaxie post-opératoire (plaie souillée ou morsure)',
    src: 'Tableaux 11 et 12 (grade AE, hors AMM)',
    adult: {
      first: ['**Amoxicilline + acide clavulanique 1 g + 125 mg**, 3 fois par jour, durant 5 jours'],
      alt: ['**Pristinamycine 1 g**, 3 fois par jour, durant 5 jours', '**Clindamycine 600 mg**, 3 fois par jour, durant 5 jours'],
    },
    child: {
      first: [[P('Amoxicilline + acide clavulanique (dose en amoxicilline)', 80, 'jour', 3000, 3, 'durant 5 jours')]],
      alt: [[P('Pristinamycine', 50, 'jour', 3000, 3, 'durant 5 jours')], [P('Clindamycine', 30, 'jour', 1800, 3, 'durant 5 jours')]],
    },
  },
  onmos: {
    title: "Antibioprophylaxie pré- et post-opératoire (acte exposant l'os, haut risque d'ONM)",
    src: 'Tableaux 11 et 12 (grade AE, hors AMM)',
    adult: {
      first: ['**Amoxicilline 2 g** 1 h avant, puis **500 mg**, 3 fois par jour, durant 7 jours'],
      alt: ['**Clarithromycine 500 mg** 1 h avant, puis 500 mg, 2 fois par jour, durant 7 jours', '**Azithromycine 500 mg** 1 h avant, puis 500 mg, 1 fois par jour, durant 2 jours', '**Pristinamycine 1 g** 1 h avant, puis 1 g, 2 fois par jour, durant 7 jours'],
    },
    child: {
      first: [[P('Amoxicilline, 1 h avant', 50, 'prise', 2000), P('puis Amoxicilline', 50, 'jour', 1500, 3, 'durant 7 jours')]],
      alt: [
        [P('Clarithromycine, 1 h avant', 15, 'prise', 500), P('puis Clarithromycine', 15, 'jour', 1000, 2, 'durant 7 jours')],
        [P('Azithromycine, 1 h avant', 20, 'prise', 500), P('puis Azithromycine', 20, 'jour', 500, 1, 'durant 2 jours')],
        [P('Pristinamycine, 1 h avant', 25, 'prise', 1000), P('puis Pristinamycine', 50, 'jour', 2000, 3, 'durant 7 jours')],
      ],
    },
  },
  /* Endocardite HAS 2024 §6.2 — pas de plafond pédiatrique précisé */
  ei: {
    title: "Antibioprophylaxie endocardite : prise unique dans l'heure qui précède l'acte",
    src: 'HAS 2024, §6.2',
    amm: "Amoxicilline, ampicilline et céfazoline disposent d'une AMM dans cette indication ; azithromycine et pristinamycine sont hors AMM (sous la responsabilité du prescripteur, qui en informe le patient).",
    adult: {
      first: ['**Amoxicilline 2 g** per os (grade A)', 'Voie IV : **Ampicilline 2 g IV/IM** ou **Céfazoline 1 g IV** (grade A)'],
      alt: ["**Azithromycine 500 mg** per os (grade B) · contre-indication formelle si allongement du QT", '**Pristinamycine 1 g** per os (grade AE, hors AMM) · contre-indiquée avant 6 ans', 'Voie IV : **Céfazoline 1 g IV** (grade A) · sauf allergie confirmée à la céfazoline ou au noyau β-lactame'],
    },
    child: {
      first: [[P('Amoxicilline per os', 50, 'prise', null)], [P('ou Ampicilline IV/IM', 50, 'prise', null)], [P('ou Céfazoline IV', 50, 'prise', null)]],
      alt: [[P('Azithromycine (CI si QT long)', 20, 'prise', null)], [P('Pristinamycine (hors AMM, CI < 6 ans)', 25, 'prise', null)], [P('Céfazoline IV', 50, 'prise', null)]],
    },
    adultRef: { 'Amoxicilline per os': 2000, 'ou Ampicilline IV/IM': 2000, 'ou Céfazoline IV': 1000, 'Azithromycine (CI si QT long)': 500, 'Pristinamycine (hors AMM, CI < 6 ans)': 1000, 'Céfazoline IV': 1000 },
  },
};

export const EI_EXTRA_NOTE = EI_NOTE;

/** 2e intention enfant commune (tableau 15) — plafonds = doses adultes. */
export const C2: Ped[][] = [
  [P('Amoxicilline', 50, 'jour', 3000, 3, ''), P('+ Métronidazole', 30, 'jour', 1500, 3, 'durant 3 jours' + PROL + ', sans dépasser les doses adultes')],
  [P('Amoxicilline + acide clavulanique (dose en amoxicilline)', 80, 'jour', 3000, 3, 'durant 3 jours' + PROL)],
  [P('Si allergie aux pénicillines : Clarithromycine (hors AMM)', 15, 'jour', 1000, 2, ''), P('+ Métronidazole', 30, 'jour', 1500, 3, 'durant 3 jours' + PROL + ', sans dépasser les doses adultes')],
];

export const CURRX: Record<'A' | 'PERI' | 'MPN' | 'P34' | 'SIN' | 'OST', Scheme> = {
  A: {
    adult: {
      first: ['**Amoxicilline 1 g**, 3 fois par jour, durant 3 jours' + PROL],
      alt: [`**Clarithromycine 500 mg** ${HORS_AMM}, 2 fois par jour, durant 3 jours` + PROL, '**Azithromycine 500 mg**, 1 fois par jour, durant 3 jours', `**Pristinamycine 1 g** ${HORS_AMM}, 2 fois par jour, durant 3 jours` + PROL],
      second: ['**Amoxicilline + métronidazole 1 g + 500 mg**, 3 fois par jour, durant 3 jours' + PROL, '**Amoxicilline + acide clavulanique 1 g + 125 mg**, 3 fois par jour, durant 3 jours' + PROL, `Si allergie aux pénicillines : **Clarithromycine 500 mg × 2/j + Métronidazole 500 mg × 3/j** ${HORS_AMM}, durant 3 jours` + PROL],
    },
    child: {
      first: [[P('Amoxicilline', 50, 'jour', 3000, 3, 'durant 3 jours' + PROL)]],
      alt: [[P('Clarithromycine (hors AMM)', 15, 'jour', 1000, 2, 'durant 3 jours' + PROL)], [P('Azithromycine', 20, 'jour', 500, 1, 'durant 3 jours')], [P('Pristinamycine (hors AMM)', 50, 'jour', 2000, 3, 'durant 3 jours' + PROL)]],
      second: 'C2',
    },
  },
  PERI: {
    adult: { first: ['**Amoxicilline 1 g**, 3 fois par jour, durant 3 jours' + PROL], alt: ['**Métronidazole 500 mg**, 3 fois par jour, durant 3 jours' + PROL], second: 'A' },
    child: { first: [[P('Amoxicilline', 50, 'jour', 3000, 3, 'durant 3 jours' + PROL)]], alt: [[P('Métronidazole', 30, 'jour', 1500, 3, 'durant 3 jours' + PROL)]], second: 'C2' },
  },
  MPN: {
    adult: { first: ['**Métronidazole 500 mg**, 3 fois par jour, durant 3 jours' + PROL], alt: ['**Amoxicilline 1 g**, 3 fois par jour, durant 3 jours' + PROL], second: 'A' },
    child: { first: [[P('Métronidazole', 30, 'jour', 1500, 3, 'durant 3 jours' + PROL)]], alt: [[P('Amoxicilline', 50, 'jour', 3000, 3, 'durant 3 jours' + PROL)]], second: 'C2' },
  },
  P34: {
    adult: { first: ['**Amoxicilline + métronidazole 500 mg + 500 mg**, 3 fois par jour, durant 3 jours'], alt: ['**Métronidazole 500 mg**, 3 fois par jour, durant 3 jours', '**Azithromycine 500 mg**, 1 fois par jour, durant 3 jours'], second: ['Non applicable'] },
    child: null,
  },
  SIN: {
    adult: {
      first: ['**Amoxicilline + acide clavulanique 1 g + 125 mg**, 3 fois par jour, durant 7 jours'],
      alt: ['Allergie aux pénicillines sans contre-indication aux céphalosporines : **Cefpodoxime proxétil 200 mg**, 2 fois par jour, durant 5 jours, ou **Céfuroxime axétil 250 mg**, 2 fois par jour, durant 5 jours', 'Contre-indication aux β-lactamines : **Pristinamycine 1 g**, 2 fois par jour, durant 4 jours'],
      second: ['Avis spécialisé ORL'],
    },
    child: {
      first: [[P('Amoxicilline + acide clavulanique (dose en amoxicilline)', 80, 'jour', 3000, 3, 'durant 10 jours')]],
      alt: [[P('Allergie pénicillines sans CI céphalosporines : Cefpodoxime proxétil', 8, 'jour', 400, 2, 'durant 10 jours')], [P('Allergie aux β-lactamines : Sulfaméthoxazole', 30, 'jour', 800, 2, 'durant 10 jours'), P('+ Triméthoprime', 6, 'jour', 160, 2, '')]],
      second: ['Avis spécialisé ORL'],
    },
  },
  OST: {
    adult: {
      first: ["**Amoxicilline + acide clavulanique 1 g + 125 mg**, 3 fois par jour, durant au moins 14 jours et jusqu'à amendement des signes infectieux locaux"],
      alt: [`**Clarithromycine 500 mg × 2/j + Métronidazole 500 mg × 3/j** ${HORS_AMM}, au moins 14 jours et jusqu'à amendement des signes locaux`],
      second: ['Antibiothérapie adaptée aux résultats du prélèvement bactériologique osseux'],
    },
    child: {
      first: [[P('Amoxicilline + acide clavulanique (dose en amoxicilline)', 80, 'jour', 3000, 3, "au moins 14 jours, jusqu'à amendement des signes locaux")]],
      alt: [[P('Clarithromycine (hors AMM)', 15, 'jour', 1000, 2, 'au moins 14 jours'), P('+ Métronidazole', 30, 'jour', 1500, 3, 'sans dépasser les doses adultes')]],
      second: ['Antibiothérapie adaptée aux résultats du prélèvement bactériologique osseux'],
    },
  },
};

/** Cellulite cervico-faciale chez l'enfant : amoxicilline 80 à 100 mg/kg/j (tableau 15). */
export const CELL_CHILD_FIRST: Ped[][] = [[P('Amoxicilline', [80, 100], 'jour', 3000, 3, 'durant 3 jours' + PROL)]];

export const SOURCES = {
  has2026: "HAS, Prescription des antibiotiques en pratique bucco-dentaire, fiche de synthèse adoptée le 16 juillet 2026 (tableaux 1 à 15)",
  has2024: "HAS, Prise en charge bucco-dentaire des patients à risque d'endocardite infectieuse, octobre 2024",
};

/** Pastilles de verdict. */
export const LAB = {
  N: 'Non recommandée',
  R: 'Recommandée',
  CI: 'Acte contre-indiqué',
  C: 'Au cas par cas',
  ABP: 'Autorisé sous antibioprophylaxie',
  COND: 'Selon la situation',
  NL: 'Acte non listé',
} as const;

export type ActRef = Act;
