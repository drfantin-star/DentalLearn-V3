/**
 * AntibioGuide — moteur de décision (pur, sans React, sans persistance).
 * Reproduit les règles HAS 2026 (tableaux 1 à 15) et HAS 2024 (endocardite).
 * La maquette validée le 15/10/2026 (maquette_antibioguide_v1.html) fait foi
 * pour le comportement attendu.
 */
import { C2, CELL_CHILD_FIRST, CUR, CURRX, EI_EXTRA_NOTE, FAM, LAB, PROFILE, RX } from './data';
import type { AntibioState, Cats, Cell, ChildLine, Ped, Scheme } from './types';

export type PillClass = 'R' | 'N' | 'C' | 'CI';
export interface Pill { cls: PillClass; text: string }
export interface Note { kind: 'tip' | 'alert' | 'note'; text: string }

/** Ligne pédiatrique calculée à partir du poids (calcul transparent). */
export interface DrugLine {
  name: string;
  /** Ex. « 1 150 mg/j, en 3 prises, durant 5 jours ». */
  value: string;
  /** Ex. « 23 kg × 50 mg/kg/j = 1 150 mg/j (plafond HAS : 2 000 mg/j) ». */
  calc: string;
  perDose?: string;
  capped: boolean;
  capText?: string;
  warn?: string;
}

/** Un groupe de schémas : 1re intention, alternatives, 2e intention. */
export interface RxGroup {
  title: string;
  /** Adulte : texte (gras entre **…**, pastille [hors AMM]). Enfant : lignes calculées. */
  items: Array<string | DrugLine[]>;
}

export interface RxBlock {
  kind: 'rx';
  title: string;
  removed: string[];
  groups: RxGroup[];
  childTip?: string;
  extraNote?: string;
  src: string;
  childMissing?: boolean;
}

export interface Exception { active: boolean; label: string; effect: string }

export interface Result {
  kind: 'pro' | 'cur';
  what: string;
  big: string;
  cls: PillClass;
  sub?: string;
  why?: string;
  /** Détail par catégorie (mode prophylaxie). */
  rows: Array<[string, Pill]>;
  multiNote?: string;
  /** Statut tableau 13 (mode curatif). */
  curStatus?: { pill?: Pill; rule?: string; exceptions?: Exception[] };
  notes: Note[];
  rx: Array<RxBlock | Note>;
  recall: string[];
  src: string;
}

export const initialState = (): AntibioState => ({
  child: false, kg: 20, checks: new Set(), mode: 'pro', fam: 'chir', act: 1, curFam: 'endo', cur: 1,
  ext: false, nolocal: false, osExposed: false,
});

export function cats(checks: Set<string>): Cats {
  const has = (g: string) => (PROFILE.find((p) => p.id === g)?.items ?? []).some((i) => checks.has(i.id));
  return { ria: has('ria'), onm: has('onm'), ei: has('ei'), peni: checks.has('peni'), ceph: checks.has('ceph'), qt: checks.has('qt') };
}

export function categoryLine(s: AntibioState): string {
  const c = cats(s.checks);
  const l: string[] = [];
  if (c.ria) l.push('risque infectieux augmenté');
  if (c.onm) l.push("haut risque d'ostéonécrose");
  if (c.ei) l.push("haut risque d'endocardite");
  return (l.length ? l.join(' + ') : 'population générale') + (c.peni ? ' · allergie aux pénicillines' : '') + (s.child ? ` · enfant ${s.kg} kg` : '');
}

/* ---------- Calcul pédiatrique transparent ---------- */
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

export function childLine(p: Ped, kg: number, adultRef?: number): DrugLine {
  const range = Array.isArray(p.k);
  const k1 = range ? (p.k as [number, number])[0] : (p.k as number);
  const k2 = range ? (p.k as [number, number])[1] : (p.k as number);
  const unit = p.per === 'jour' ? 'mg/kg/j' : 'mg/kg';
  const suffix = p.per === 'jour' ? '/j' : '';
  const raw1 = kg * k1, raw2 = kg * k2;
  let v1 = raw1, v2 = raw2, capped = false, capText: string | undefined;
  if (p.max) {
    if (v1 > p.max) { v1 = p.max; capped = true; }
    if (v2 > p.max) { v2 = p.max; capped = true; }
    capText = `plafond HAS : ${fmt(p.max)} mg${suffix}`;
  }
  const val = range ? `${fmt(v1)} à ${fmt(v2)}` : fmt(v1);
  const calc = `${kg} kg × ${range ? `${k1}–${k2}` : k1} ${unit} = ${range ? `${fmt(raw1)}–${fmt(raw2)}` : fmt(raw1)} mg${suffix}`;
  let perDose: string | undefined;
  if (p.per === 'jour' && p.n && p.n > 1) {
    perDose = `soit ${range ? `${fmt(v1 / p.n)}–${fmt(v2 / p.n)}` : fmt(v1 / p.n)} mg par prise × ${p.n} prises/j`;
  }
  let warn: string | undefined;
  if (!p.max && adultRef && raw1 > adultRef) {
    warn = `La reco 2024 ne précise pas de plafond pédiatrique ; le résultat dépasse la dose adulte (${fmt(adultRef)} mg). À vérifier.`;
  }
  const value = `${val} mg${suffix}${p.per === 'jour' && p.n ? `, en ${p.n} prise${p.n > 1 ? 's' : ''}` : ''}${p.s ? `, ${p.s}` : ''}`;
  return { name: p.d, value, calc, perDose, capped, capText, warn };
}

/* ---------- Filtre allergie / contre-indication ---------- */
function filt<T extends string | Ped[]>(lines: T[] | undefined, c: Cats, removed: string[]): T[] {
  if (!lines) return [];
  const out: T[] = [];
  for (const l of lines) {
    const txt = Array.isArray(l) ? l.map((p) => p.d).join(' ') : String(l);
    let drop: string | null = null;
    if (c.qt && /azithromycine/i.test(txt)) drop = "azithromycine : contre-indication formelle en cas d'allongement du QT (HAS 2024)";
    if (c.ceph && /c[ée]f(azoline|triaxone|podoxime|uroxime)/i.test(txt)) drop = 'céphalosporines : contre-indication déclarée';
    if (drop) { if (!removed.includes(drop)) removed.push(drop); } else out.push(l);
  }
  return out;
}

function scheme(rx: Scheme, s: AntibioState, extraNote?: string): RxBlock {
  const c = cats(s.checks);
  const ch = s.child;
  if (ch && !rx.child) {
    return { kind: 'rx', title: 'Prescription', removed: [], groups: [], src: '', childMissing: true };
  }
  const d = ch ? rx.child! : rx.adult;
  let second: ChildLine[] | string[] | undefined;
  if (d.second === 'A') second = CURRX.A.adult.second as string[];
  else if (d.second === 'C2') second = C2;
  else second = d.second as ChildLine[] | string[] | undefined;

  const removed: string[] = [];
  const first = filt(d.first as Array<string | Ped[]>, c, removed);
  const alt = filt(d.alt as Array<string | Ped[]>, c, removed);
  second = filt(second as Array<string | Ped[]> | undefined, c, removed);

  const toItems = (lines: Array<string | Ped[]>): Array<string | DrugLine[]> =>
    lines.map((l) => (Array.isArray(l) ? l.map((p) => childLine(p, s.kg, rx.adultRef?.[p.d])) : l));

  const firstT = '1re intention';
  const altT = 'Alternative (allergie avérée, anaphylaxie probable, contre-indication ou rupture de stock), par ordre de préférence';
  const groups: RxGroup[] = [];
  const g1 = { title: firstT, items: toItems(first) };
  const g2 = { title: altT, items: toItems(alt) };
  if (c.peni) {
    if (g2.items.length) groups.push(g2);
    if (g1.items.length) groups.push({ ...g1, title: `${firstT} (non utilisable : allergie déclarée)` });
  } else {
    if (g1.items.length) groups.push(g1);
    if (g2.items.length) groups.push(g2);
  }
  if (second && second.length) groups.push({ title: "2e intention, en cas d'échec", items: toItems(second) });

  const childTip = ch
    ? `Calcul automatique à partir du poids saisi (${s.kg} kg). Vérifiez la dose et la forme galénique. Avant 6 ans : pas de comprimés ni de gélules à avaler. Si 3 prises par jour ne sont pas possibles, répartir en 2 prises.`
    : undefined;
  const src = `${rx.src || `Tableau ${ch ? '15' : '14'} (grade AE)`}. ${rx.amm || `Prescription hors AMM sous la seule responsabilité du prescripteur, qui en informe le patient${ch ? ' et son représentant légal' : ''}.`}`;
  return { kind: 'rx', title: rx.title || 'Prescription', removed, groups, childTip, extraNote, src };
}

/* ---------- Pastilles ---------- */
const pill = (cls: PillClass, text: string): Pill => ({ cls, text });
function vPill(o: Cell): Pill {
  if (o.v === 'CI') return pill('CI', `${LAB.CI} · ${o.g}`);
  if (o.v === 'R') return pill(o.s ? 'C' : 'R', `${LAB.R}${o.s ? '*' : ''} · grade ${o.g}`);
  return pill('N', `${LAB.N}${o.s ? '*' : ''} · grade ${o.g}`);
}
const EI_PILL: Record<string, Pill> = {
  ABP: pill('R', 'Antibioprophylaxie'),
  N: pill('N', "Pas d'antibioprophylaxie"),
  CI: pill('CI', 'Contre-indiqué'),
  COND: pill('C', 'Selon la situation'),
  NL: pill('C', 'Non listé'),
};

/* ---------- Mode antibioprophylaxie ---------- */
export function evaluatePro(s: AntibioState): Result {
  const c = cats(s.checks);
  const f = FAM.find((x) => x.id === s.fam) ?? FAM[0];
  const a = f.acts[s.act] ?? f.acts[0];
  const rows: Array<[string, Pill]> = [];
  let worst = 0, star = false, cond = false; // 0 N, 1 R, 2 CI
  const rank = (v: Cell['v']) => (v === 'CI' ? 2 : v === 'R' ? 1 : 0);
  const consider = (lbl: string, o: Cell) => { rows.push([lbl, vPill(o)]); worst = Math.max(worst, rank(o.v)); if (o.s && o.v !== 'N') star = true; };

  // La reco 2026 exclut les patients à risque d'EI : la reco 2024 remplace la colonne population générale
  const eiGoverns = c.ei && !!a.ei;
  if (!c.ria && !c.onm && !eiGoverns) consider('Population générale', a.pg);
  if (c.ria) consider('Risque infectieux augmenté', a.ria);
  if (c.onm) consider("Haut risque d'ostéonécrose", a.onm);

  const notes: Note[] = [];
  let eiNote: Note | null = null;
  if (c.ei) {
    if (a.ei) {
      rows.push(["Haut risque d'endocardite (HAS 2024)", EI_PILL[a.ei.v]]);
      const r = ({ ABP: 1, N: 0, CI: 2 } as Record<string, number>)[a.ei.v];
      if (r !== undefined) worst = Math.max(worst, r); else cond = true;
      if (a.ei.v === 'NL') eiNote = { kind: 'tip', text: `Acte non cité nommément dans la recommandation endocardite 2024.${a.ei.note ? ` ${a.ei.note}` : ''} À évaluer avec le cardiologue.` };
      else if (a.ei.note) eiNote = { kind: a.ei.v === 'CI' ? 'alert' : 'tip', text: a.ei.note };
    } else {
      rows.push(["Haut risque d'endocardite", pill('R', 'voir reco 2026')]);
    }
  }

  let cls: PillClass, big: string;
  if (worst === 2) { cls = 'CI'; big = 'Acte contre-indiqué'; }
  else if (worst === 1) { cls = star ? 'C' : 'R'; big = star ? 'Antibioprophylaxie recommandée*' : 'Antibioprophylaxie recommandée'; }
  else if (cond) { cls = 'C'; big = 'Selon la situation clinique'; }
  else { cls = 'N'; big = "Pas d'antibioprophylaxie"; }
  if (a.pg.impl && !c.ria && !c.onm && !c.ei) { cls = 'C'; big = "Pas d'antibioprophylaxie systématique"; }

  const sub = worst === 1 && star
    ? "* Si l'acte est maintenu après évaluation bénéfice/risque au cas par cas (alternative moins invasive, décision partagée)."
    : undefined;

  if (a.pg.impl && !c.ria && !c.onm && !c.ei) notes.push({ kind: 'tip', text: "** Antibioprophylaxie possible selon le profil (antécédents de complications d'ostéo-intégration, os peu vascularisé) et la complexité de l'intervention : plus de 3 implants, avulsion-implantation immédiate, durée supérieure à 1 h 30 (grade AE)." });
  if (c.onm && a.nb) notes.push({ kind: 'alert', text: `NB : acte contre-indiqué chez les patients traités pour une pathologie maligne${a.nb === 'mi' ? ' ou avec irradiation ≥ 40 Gy' : ''}.` });
  if (a.deux) notes.push({ kind: 'tip', text: 'Anesthésie intraligamentaire et ostéo-centrale : en 2e intention uniquement.' });
  if (eiNote) notes.push(eiNote);

  // schémas
  const rx: Array<RxBlock | Note> = [];
  if (worst === 1 || (cls === 'C' && cond)) {
    const nonEiRec = !c.ria && !c.onm ? (!eiGoverns && a.pg.v === 'R') : (c.ria && a.ria.v === 'R') || (c.onm && a.onm.v === 'R');
    const eiRx = eiGoverns && (a.ei!.v === 'ABP' || a.ei!.v === 'COND');
    if (nonEiRec) {
      if (a.sp === 'perop') rx.push(scheme(RX.perop, s));
      else if (a.sp === 'souillee') rx.push(scheme(RX.souillee, s));
      else if (c.onm && a.onm.v === 'R' && s.osExposed) rx.push(scheme(RX.onmos, s));
      else if (!eiRx) rx.push(scheme(RX.std, s)); // si l'EI s'applique, son schéma remplace la prise unique standard
    }
    if (eiRx && rx.length) rx.unshift({ kind: 'alert', text: "Deux indications d'antibioprophylaxie se cumulent. Une seule prise de 2 g d'amoxicilline avant l'acte couvre les deux risques (ne pas doubler), puis poursuivre le schéma post-opératoire indiqué ci-dessous." });
    if (eiRx) rx.push(scheme(RX.ei, s, EI_EXTRA_NOTE));
  }

  const multiNote = rows.length > 2 || c.ei ? "Plusieurs catégories : l'outil retient la plus protectrice pour le titre." : undefined;

  const recall = [
    'Bain de bouche antiseptique avant tout geste : chlorhexidine 0,1 à 0,2 % ou povidone iodée 10 %.',
    ...(worst === 1 ? ["En cas d'oubli ou d'acte en urgence, l'antibioprophylaxie peut être prise jusqu'à 2 h après le geste."] : []),
    ...(c.ria || c.onm || c.ei ? ["Patient à risque : informer du risque infectieux ou d'ostéonécrose, envisager une alternative moins invasive, décider avec le patient, en lien avec le médecin référent."] : []),
  ];
  return {
    kind: 'pro', what: `Antibioprophylaxie · ${a.l}`, big, cls, sub, rows,
    multiNote: rows.length > 1 ? multiNote : undefined, notes, rx, recall,
    src: `HAS 2026, tableau ${f.t}${c.ei ? ' · HAS 2024, §2 à §6' : ''}.`,
  };
}

/* ---------- Mode antibiothérapie curative ---------- */
export function evaluateCur(s: AntibioState): Result {
  const c = cats(s.checks);
  const f = CUR.find((x) => x.id === s.curFam) ?? CUR[0];
  const it = f.items[s.cur] ?? f.items[0];
  let cls: PillClass, big: string, why = '';
  if (it.v === 'R') { cls = 'R'; big = 'Antibiothérapie recommandée'; if (it.when) why = it.when; }
  else if (it.v === 'N') { cls = 'N'; big = "Pas d'antibiothérapie"; }
  else if (c.ei || c.ria) { cls = 'R'; big = 'Antibiothérapie recommandée, en complément du geste local'; why = "Exception HAS : patient à haut risque d'endocardite ou à risque infectieux augmenté."; }
  else if (s.ext) { cls = 'R'; big = 'Antibiothérapie recommandée, en complément du geste local'; why = "Exception HAS : présence de signes d'extension locale, régionale ou systémique."; }
  else if (s.nolocal) { cls = 'C'; big = 'Antibiothérapie possible'; why = 'Exception HAS : le geste local ne peut pas être réalisé.'; }
  else { cls = 'N'; big = "Pas d'antibiothérapie"; why = 'Geste local seul. Antibiothérapie si patient à risque, signes d\'extension, ou geste local impossible.'; }

  const notes: Note[] = [];
  if (it.periimpl && c.ei) {
    cls = 'CI'; big = 'Traitement de la péri-implantite contre-indiqué';
    notes.push({ kind: 'alert', text: "Patient à haut risque d'endocardite : tout traitement de la péri-implantite est contre-indiqué. Il est recommandé de déposer l'implant, sous antibioprophylaxie (HAS 2024)." });
  }
  if (it.alv) notes.push({ kind: 'tip', text: "Alvéolite suppurée : la suppuration locale ne suffit pas, à elle seule, à poser l'indication." });
  if (it.grp === 'OST') notes.push({ kind: 'tip', text: "Un prélèvement osseux pour analyse microbiologique est conseillé avant de débuter, pour adapter la prescription à l'antibiogramme." });

  const curStatus: Result['curStatus'] = {};
  if (it.v === 'S') {
    const risk = c.ei || c.ria;
    curStatus.rule = `Règle générale : antibiothérapie non recommandée (grade ${it.g}), le geste local suffit.`;
    curStatus.exceptions = [
      { active: risk, label: "Patient à haut risque d'endocardite ou à risque infectieux augmenté", effect: 'recommandée' },
      { active: s.ext, label: "Signes d'extension locale, régionale ou systémique", effect: 'recommandée' },
      { active: s.nolocal, label: 'Geste local impossible', effect: 'possible' },
    ];
  } else {
    curStatus.pill = it.v === 'R' ? pill('R', `Recommandée · grade ${it.g}`) : pill('N', `Non recommandée · grade ${it.g}`);
  }

  const rx: Array<RxBlock | Note> = [];
  if ((cls === 'R' || cls === 'C') && it.grp) {
    let r: Scheme = CURRX[it.grp];
    if (s.child && it.cell && r.child) r = { ...r, child: { ...r.child, first: CELL_CHILD_FIRST } };
    rx.push(scheme({ ...r, title: 'Prescription', src: null }, s));
  }

  const recall = [
    "L'antibiotique complète un geste local (incision, débridement, détartrage/surfaçage, pulpectomie, avulsion) et ne le remplace pas.",
    ...(cls !== 'N' && cls !== 'CI' ? ['Réévaluer à 48–72 h (consultation, téléconsultation ou, à défaut, téléphone).'] : []),
    "Pas d'antibiotique systématique avec un anti-inflammatoire. Pas d'antibiothérapie locale.",
    "Informer du danger de l'automédication antibiotique.",
  ];
  return {
    kind: 'cur', what: `Antibiothérapie curative · ${it.l}`, big, cls, why: why || undefined, rows: [], curStatus, notes, rx, recall,
    src: `HAS 2026, tableau 13${cls === 'R' || cls === 'C' ? (s.child ? ' et tableau 15' : ' et tableau 14') : ''}.`,
  };
}

export const evaluate = (s: AntibioState): Result => (s.mode === 'pro' ? evaluatePro(s) : evaluateCur(s));
