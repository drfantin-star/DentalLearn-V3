// Vérification du moteur de calcul contre les formules Excel iPerioMind
import { emptyBilan, ALL_TEETH } from './src/lib/perio/types';
import { computeStats, prpFromScores } from './src/lib/perio/calc';

const b = emptyBilan('test', '2026-07-18');

// Scénario : parodontite modérée
// 26 dents présentes (18,28 absentes... on retire 18, 28, 48, 38, 46 → 5 absentes)
['18', '28', '48', '38', '46'].forEach(t => { b.teeth[t].absent = true; });

// Remplir toutes les dents présentes : PP=3 partout, GR=0, pas de BOP/plaque
for (const t of ALL_TEETH) {
  const tooth = b.teeth[t];
  if (tooth.absent) continue;
  for (const s of [...tooth.b, ...tooth.l]) { s.pp = 3; s.gr = 0; }
}
// Poches ciblées sur 16 : sites vestibulaires 6,7,5 avec BOP + GR 2
b.teeth['16'].b.forEach((s, i) => { s.pp = [6, 7, 5][i]; s.bop = true; s.gr = 2; });
// 26 : 5,4,4 lingual, BOP sur 2 sites
b.teeth['26'].l[0].pp = 5; b.teeth['26'].l[0].bop = true;
b.teeth['26'].l[1].pp = 4; b.teeth['26'].l[1].bop = true;
b.teeth['26'].l[2].pp = 4;
// Plaque sur 12 sites
let ipSet = 0;
outer: for (const t of ALL_TEETH) {
  const tooth = b.teeth[t];
  if (tooth.absent) continue;
  for (const s of tooth.b) { s.ip = true; ipSet++; if (ipSet >= 12) break outer; }
}
// Mobilités : 16 → 2, 26 → 1
b.teeth['16'].mobility = 2; b.teeth['26'].mobility = 1;
// Risque : santé 2, tabac 4, alvéolyse 40% à 50 ans
b.risk.sante = 2; b.risk.tabac = 4; b.risk.alveolyse = 40; b.risk.age = 50;

const s = computeStats(b);

// ── Attendus calculés à la main selon les formules Excel ──
// 27 dents dans ALL_TEETH? Non : 32 dents, 5 absentes → 27 présentes → 162 sites
const expected = {
  nSites: 27 * 6,
  absentCount: 5,
  ppMax: 7,
  bopCount: 5,
  sitesPPgt4: 4,          // 6,7,5 + le 5 de la 26
  sitesPAgt3: 6,          // PA: 16b = 8,9,7 ; 26l = 5,4,4 → tous >3
  cumulPoches: (6-3)+(7-3)+(5-3) + (5-3)+(4-3)+(4-3), // 9 + 4 = 13
  mobilitesSum: 3,
  poSurAge: 0.8,
};

let fails = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'OK ' : 'FAIL'} ${name}: got=${got} want=${want}`);
};

check('nSites', s.nSites, expected.nSites);
check('absentCount', s.absentCount, expected.absentCount);
check('ppMax', s.ppMax, expected.ppMax);
check('bopCount', s.bopCount, expected.bopCount);
check('sitesPPgt4', s.sitesPPgt4, expected.sitesPPgt4);
check('sitesPAgt3', s.sitesPAgt3, expected.sitesPAgt3);
check('cumulPoches', s.cumulPoches, expected.cumulPoches);
check('mobilitesSum', s.mobilitesSum, expected.mobilitesSum);
check('poSurAge', s.poSurAge, expected.poSurAge);

// ppMoy = (162 sites : 156×3 + 6+7+5+5+4+4 = 468+31−(3×6=18... recompute) )
// PP tous à 3 sauf 16b(6,7,5) et 26l(5,4,4) → somme = 162*3 − 3*6 + (6+7+5+5+4+4) = 486−18+31 = 499
check('ppMoy', s.ppMoy, Math.round(499 / 162 * 10) / 10);
// PA somme = PP somme + GR somme (GR=2 sur les 3 sites 16b) = 499 + 6 = 505
check('paMoy', s.paMoy, Math.round(505 / 162 * 10) / 10);
check('paMax', s.paMax, 9);
check('bopPct', s.bopPct, Math.round(5 / 162 * 1000) / 10);
check('ipPct', s.ipPct, Math.round(12 / 162 * 1000) / 10);
check('pctPAgt3', s.pctPAgt3, Math.round(6 / 162 * 1000) / 10);

// Scores /10 : santé 2, tabac 4, abs 5, os = 0.8×8 = 6.4, pp = %PP>4 = 1.9, bop = 3.09×0.32 ≈ 1
check('score os', s.scores.os, 6.4);
check('score abs', s.scores.abs, 5);
check('score pp', s.scores.pp, Math.round(4 / 162 * 1000) / 10);
check('score bop', s.scores.bop, Math.round(Math.round(5 / 162 * 1000) / 10 * 0.32 * 10) / 10);

// PRP formule Excel : (Σ min(0, score−10) + 60)/60×100
const sc = [2, 4, 5, 6.4, s.scores.pp, s.scores.bop];
const sumNeg = sc.reduce((a, x) => a + Math.min(0, x - 10), 0);
check('prp', s.prp, Math.round(((sumNeg + 60) / 60) * 1000) / 10);

// Classification : %PA>3 = 3,7% < 30 → LOCALISÉE ; PAmax 9 ≥ 5 → III ; abs 5 > 4 → ➜IV
// PO/âge 0,8 ≤ 1 → grade B ; %BOP 3,1 < 20 → non active
check('localisation', s.classification.localisation, 'LOCALISÉE');
check('stade', s.classification.stade, 'III');
check('stadeIV', s.classification.stadeIV, true);
check('grade', s.classification.grade, 'B'); // PO/âge = 0,8 → B (0,25–1)
check('active', s.classification.active, false);

// PRP bornes : tous scores à 10 → 100% ; tous à 0 → 0%
check('prp max', prpFromScores([10,10,10,10,10,10]), 100);
check('prp min', prpFromScores([0,0,0,0,0,0]), 0);

console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUS LES TESTS PASSENT');
process.exit(fails ? 1 : 0);
