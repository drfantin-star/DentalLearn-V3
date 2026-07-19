// ── Moteur de calcul — reproduction fidèle des formules iPerioMind ──
import type { Bilan, Site } from './types';
import { ALL_TEETH } from './types';

export interface RiskScores {
  sante: number; tabac: number; abs: number; os: number; pp: number; bop: number;
}

export interface Classification {
  localisation: 'LOCALISÉE' | 'GÉNÉRALISÉE' | null;
  stade: 'II' | 'III' | null;
  stadeIV: boolean;      // ➜ IV si dents absentes > 4
  grade: 'A' | 'B' | 'C' | null;
  active: boolean | null; // %BOP ≥ 20
}

export interface BilanStats {
  nSites: number;
  absentCount: number;
  ppMax: number; ppMoy: number;
  paMax: number; paMoy: number;
  bopCount: number; bopPct: number;
  ipCount: number; ipPct: number;
  sitesPPgt4: number; pctPPgt4: number;   // lésions long terme
  sitesPAgt3: number; pctPAgt3: number;   // % PA > 3 mm
  cumulPoches: number;                     // Σ (PP−3) pour PP>3, en mm
  mobilitesSum: number;
  poSurAge: number | null;                 // alvéolyse% / âge
  scores: RiskScores;                      // chaque facteur /10
  prp: number;                             // % risque parodontal
  objectif: number;                        // % après traitement (PP→2, BOP→2)
  classification: Classification;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const clamp10 = (x: number) => Math.max(0, Math.min(10, x));

/** PA d'un site = récession + profondeur de poche (formule Excel : PA = GR + PP) */
export const sitePA = (s: Site): number | null =>
  s.pp === null ? null : (s.gr ?? 0) + s.pp;

/** PRP = (Σ min(0, score−10) + 60) / 60 × 100  (formule Excel X19/W19/W20) */
export const prpFromScores = (scores: number[]): number => {
  const sumNeg = scores.reduce((acc, s) => acc + Math.min(0, clamp10(s) - 10), 0);
  return round1(((sumNeg + 60) / 60) * 100);
};

export function computeStats(bilan: Bilan): BilanStats {
  const sites: Site[] = [];
  let absentCount = 0;
  let mobilitesSum = 0;

  for (const t of ALL_TEETH) {
    const tooth = bilan.teeth[t];
    if (!tooth) continue;
    if (tooth.absent) { absentCount++; continue; }
    mobilitesSum += tooth.mobility ?? 0;
    sites.push(...tooth.b, ...tooth.l);
  }

  // Un site "compté" = site dont la PP est renseignée (équivalent DCOUNT Excel)
  const charted = sites.filter(s => s.pp !== null);
  const n = charted.length;

  const pps = charted.map(s => s.pp as number);
  const pas = charted.map(s => sitePA(s) as number);

  const bopCount = charted.filter(s => s.bop).length;
  const ipCount = charted.filter(s => s.ip).length;
  const sitesPPgt4 = charted.filter(s => (s.pp as number) > 4).length;
  const sitesPAgt3 = charted.filter(s => (sitePA(s) as number) > 3).length;
  const cumulPoches = charted.reduce((acc, s) => acc + Math.max(0, (s.pp as number) - 3), 0);

  const ppMax = n ? Math.max(...pps) : 0;
  const ppMoy = n ? round1(pps.reduce((a, b) => a + b, 0) / n) : 0;
  const paMax = n ? Math.max(...pas) : 0;
  const paMoy = n ? round1(pas.reduce((a, b) => a + b, 0) / n) : 0;

  const bopPct = n ? round1((bopCount / n) * 100) : 0;
  const ipPct = n ? round1((ipCount / n) * 100) : 0;
  const pctPPgt4 = n ? round1((sitesPPgt4 / n) * 100) : 0;
  const pctPAgt3 = n ? round1((sitesPAgt3 / n) * 100) : 0;

  const { alveolyse, age } = bilan.risk;
  const poSurAge = alveolyse !== null && age !== null && age > 0
    ? Math.round((alveolyse / age) * 100) / 100
    : null;

  // ── Scores de risque /10 (colonne "Numérisation" de l'Excel) ──
  const scores: RiskScores = {
    sante: clamp10(bilan.risk.sante),
    tabac: clamp10(bilan.risk.tabac),
    abs: clamp10(absentCount),                       // V15 = nb dents absentes
    os: poSurAge !== null ? clamp10(round1(poSurAge * 8)) : 0, // V16 = PO/âge × 8
    pp: clamp10(round1(pctPPgt4)),                   // W17 = % sites PP>4mm
    bop: clamp10(round1(bopPct * 0.32)),             // W18 = %BOP × 0,32
  };

  const prp = n || alveolyse !== null
    ? prpFromScores([scores.sante, scores.tabac, scores.abs, scores.os, scores.pp, scores.bop])
    : 0;

  // Objectif thérapeutique : mêmes facteurs, PP → 2 et BOP → 2 (cibles post-traitement)
  const objectif = n || alveolyse !== null
    ? prpFromScores([scores.sante, scores.tabac, scores.abs, scores.os, 2, 2])
    : 0;

  // ── Classification (formules E56/I56/J56/L56/O56) ──
  const classification: Classification = n === 0
    ? { localisation: null, stade: null, stadeIV: false, grade: null, active: null }
    : {
        localisation: pctPAgt3 < 30 ? 'LOCALISÉE' : 'GÉNÉRALISÉE',
        stade: paMax < 5 ? 'II' : 'III',
        stadeIV: absentCount > 4,
        // Grade selon classification 2018 (perte osseuse % / âge) : A < 0,25 · B 0,25–1 · C > 1
        grade: poSurAge !== null ? (poSurAge < 0.25 ? 'A' : poSurAge > 1 ? 'C' : 'B') : null,
        active: bopPct >= 20,
      };

  return {
    nSites: n, absentCount, ppMax, ppMoy, paMax, paMoy,
    bopCount, bopPct, ipCount, ipPct,
    sitesPPgt4, pctPPgt4, sitesPAgt3, pctPAgt3,
    cumulPoches, mobilitesSum, poSurAge,
    scores, prp, objectif, classification,
  };
}

/** Couleur d'état d'une profondeur de poche (repères cliniques usuels) */
export const ppSeverity = (pp: number | null): 'ok' | 'warn' | 'high' | null => {
  if (pp === null) return null;
  if (pp <= 3) return 'ok';
  if (pp <= 5) return 'warn';
  return 'high';
};
