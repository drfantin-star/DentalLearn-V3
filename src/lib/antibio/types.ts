/**
 * AntibioGuide — types du moteur (HAS 2026 + HAS 2024 endocardite).
 * Données et moteur purs : aucune dépendance React, aucune persistance.
 */

/** Verdict d'une cellule des tableaux 1 à 10 (antibioprophylaxie). */
export type AbpVerdict = 'N' | 'R' | 'CI';

/** Cellule des tableaux 1 à 10 : verdict + grade HAS + astérisque (bénéfice/risque au cas par cas). */
export interface Cell {
  v: AbpVerdict;
  g: string;
  /** Astérisque HAS : « le rapport bénéfice/risque devra être pris en compte au cas par cas ». */
  s?: boolean;
  /** Tableau 3, pose d'implant : « non recommandée en systématique ** ». */
  impl?: boolean;
}

/** Verdict selon la recommandation endocardite HAS 2024. */
export type EiVerdict = 'ABP' | 'N' | 'CI' | 'COND' | 'NL';

export interface EiCell {
  v: EiVerdict;
  note?: string;
}

/** Schéma post-opératoire particulier (tableaux 11-12). */
export type SpecialScheme = 'perop' | 'souillee';

export interface Act {
  l: string;
  pg: Cell;
  ria: Cell;
  onm: Cell;
  /** NB : acte contre-indiqué chez les patients traités pour une pathologie maligne ('m') ou avec irradiation ≥ 40 Gy ('mi'). */
  nb?: 'm' | 'mi';
  /** Acte chirurgical exposant l'os (pré-coche le schéma pré- et post-opératoire ONM). */
  os?: boolean;
  /** Anesthésie intraligamentaire / ostéo-centrale : 2e intention uniquement. */
  deux?: boolean;
  sp?: SpecialScheme;
  ei?: EiCell;
}

export interface Family {
  id: string;
  label: string;
  /** Numéro du tableau HAS 2026. */
  t: number;
  acts: Act[];
}

/** Tableau 13 : N = non recommandée, R = recommandée, S = non recommandée* (conditionnelle). */
export type CurVerdict = 'N' | 'R' | 'S';

export type CurGroup = 'A' | 'PERI' | 'MPN' | 'P34' | 'SIN' | 'OST';

export interface CurItem {
  l: string;
  v: CurVerdict;
  g: string;
  grp?: CurGroup;
  when?: string;
  periimpl?: boolean;
  alv?: boolean;
  cell?: boolean;
}

export interface CurFamily {
  id: string;
  label: string;
  items: CurItem[];
}

/** Posologie pédiatrique : dose = poids × k, plafonnée à max. */
export interface Ped {
  d: string;
  /** mg/kg (ou fourchette). */
  k: number | [number, number];
  per: 'prise' | 'jour';
  /** Plafond HAS en mg (null = non précisé par la HAS). */
  max: number | null;
  /** Nombre de prises par jour (per = 'jour'). */
  n?: number;
  /** Suite du libellé (durée…). */
  s?: string;
}

export type AdultLine = string;
export type ChildLine = Ped[] | string;

export interface AdultScheme {
  first: AdultLine[];
  alt: AdultLine[];
  second?: AdultLine[] | 'A';
}

export interface ChildScheme {
  first: ChildLine[];
  alt: ChildLine[];
  second?: ChildLine[] | 'C2';
}

export interface Scheme {
  title?: string;
  src?: string | null;
  amm?: string;
  adult: AdultScheme;
  child: ChildScheme | null;
  /** Doses adultes de référence (schéma endocardite enfant, sans plafond HAS). */
  adultRef?: Record<string, number>;
}

export interface ProfileItem {
  id: string;
  label: string;
  hint?: string;
}

export interface ProfileGroup {
  id: 'ria' | 'onm' | 'ei' | 'pg' | 'all';
  title: string;
  src: string;
  info?: string;
  items: ProfileItem[];
}

/** État saisi par le praticien. Vit uniquement en mémoire React. */
export interface AntibioState {
  child: boolean;
  kg: number;
  checks: Set<string>;
  mode: 'pro' | 'cur';
  fam: string;
  act: number;
  curFam: string;
  cur: number;
  /** Signes d'extension locale, régionale ou systémique. */
  ext: boolean;
  /** Geste local impossible. */
  nolocal: boolean;
  /** Acte chirurgical exposant l'os (patient à haut risque d'ONM). */
  osExposed: boolean;
}

export interface Cats {
  ria: boolean;
  onm: boolean;
  ei: boolean;
  peni: boolean;
  ceph: boolean;
  qt: boolean;
}
