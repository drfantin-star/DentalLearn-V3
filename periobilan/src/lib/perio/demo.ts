// Cas de démonstration : parodontite généralisée stade III grade C, fumeur
import type { PatientFile } from './types';
import { emptyPatientFile, ALL_TEETH } from './types';

// motif déterministe de poches par dent (molaires plus atteintes)
const ppPattern: Record<string, [number, number, number]> = {
  '17': [5, 4, 4], '16': [6, 7, 5], '26': [5, 6, 6], '27': [4, 5, 4],
  '47': [5, 4, 5], '46': [6, 5, 7], '36': [5, 6, 5], '37': [4, 4, 5],
  '11': [4, 3, 3], '21': [3, 3, 4], '31': [4, 4, 3], '41': [3, 4, 4],
};

export function demoFile(): PatientFile {
  const f = emptyPatientFile('2026-07-18');
  f.patient = {
    nom: 'EXEMPLE', prenom: 'Martine', naissance: '1974-03-12',
    profession: 'Enseignante', praticien: 'Dr J. Fantin', correspondant: 'Dr P. Martin',
  };
  const b = f.bilans[0];
  b.anamnese = {
    doleances: 'Saignements au brossage depuis 6 mois, mauvaise haleine.',
    motivations: 'Conserver ses dents, gêne esthétique secteur antérieur.',
    symptomes: 'Saignements, mobilité ressentie sur 16 et 46.',
    antecedents: 'HTA traitée. Mère appareillée à 55 ans.',
    examens: 'Bilan rétro-alvéolaire complet du 10/07/2026.',
    specificites: 'Phénotype fin, tartre sous-gingival généralisé, bruxisme nocturne.',
    microbiologie: 'Non réalisée.',
  };
  b.risk = {
    sante: 2, tabac: 6, tabacDetail: '10/jour depuis 25 ans',
    alveolyse: 40, age: 52, commentaires: 'Contrôle de plaque insuffisant.',
  };
  ['18', '28', '48', '38', '15'].forEach(t => { b.teeth[t].absent = true; });

  ALL_TEETH.forEach((t, ti) => {
    const tooth = b.teeth[t];
    if (tooth.absent) return;
    const base = ppPattern[t] ?? [3, 2, 3];
    tooth.b.forEach((s, i) => {
      s.pp = base[i];
      s.gr = base[i] >= 6 ? 2 : base[i] >= 5 ? 1 : 0;
      s.bop = base[i] >= 5 || (ti + i) % 4 === 0;
      s.ip = (ti + i) % 3 !== 2;
    });
    tooth.l.forEach((s, i) => {
      const v = Math.max(2, base[i] - 1);
      s.pp = v;
      s.gr = 0;
      s.bop = v >= 5;
      s.ip = (ti + i) % 2 === 0;
    });
  });
  b.teeth['16'].mobility = 2; b.teeth['46'].mobility = 2; b.teeth['26'].mobility = 1;
  b.teeth['16'].furcation = 2; b.teeth['46'].furcation = 1;
  b.teeth['16'].pronostic = 'R'; b.teeth['46'].pronostic = 'R'; b.teeth['26'].pronostic = 'B';
  return f;
}
