// ── Modèle de données PérioBilan (d'après iPerioMind, Dr R. Barre) ──

export interface Site {
  gr: number | null;   // récession gingivale (mm)
  pp: number | null;   // profondeur de poche (mm)
  bop: boolean;        // saignement au sondage
  ip: boolean;         // plaque présente
}

export interface Tooth {
  absent: boolean;
  b: [Site, Site, Site]; // vestibulaire : 3 sites (disto / centro / mésial)
  l: [Site, Site, Site]; // palatin-lingual : 3 sites
  mobility: number | null;   // 0-3
  furcation: number | null;  // 0-3
  pronostic: string | null;  // 'B' | 'R' | 'M'
}

export interface Anamnese {
  doleances: string;
  motivations: string;
  symptomes: string;
  antecedents: string;
  examens: string;
  specificites: string;
  microbiologie: string;
}

export interface RiskInput {
  sante: number;          // 0-10 (OK → KO)
  tabac: number;          // 0-10 (NF/AF/<10/<20/>20)
  tabacDetail: string;    // "x/jour depuis y"
  alveolyse: number | null; // % alvéolyse maxi
  age: number | null;       // âge du patient
  commentaires: string;
}

export interface Bilan {
  id: string;
  date: string;       // ISO
  anamnese: Anamnese;
  risk: RiskInput;
  teeth: Record<string, Tooth>; // clé = n° FDI ("18"…"48")
}

export interface PatientInfo {
  nom: string;
  prenom: string;
  naissance: string;
  profession: string;
  praticien: string;
  correspondant: string;
}

export interface PatientFile {
  version: 1;
  patient: PatientInfo;
  bilans: Bilan[];
}

// Ordre d'affichage FDI
export const MAX_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
export const MAND_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];
export const ALL_TEETH = [...MAX_TEETH, ...MAND_TEETH];

export const emptySite = (): Site => ({ gr: null, pp: null, bop: false, ip: false });

export const emptyTooth = (): Tooth => ({
  absent: false,
  b: [emptySite(), emptySite(), emptySite()],
  l: [emptySite(), emptySite(), emptySite()],
  mobility: null,
  furcation: null,
  pronostic: null,
});

export const emptyAnamnese = (): Anamnese => ({
  doleances: '', motivations: '', symptomes: '', antecedents: '',
  examens: '', specificites: '', microbiologie: '',
});

export const emptyRisk = (): RiskInput => ({
  sante: 0, tabac: 0, tabacDetail: '', alveolyse: null, age: null, commentaires: '',
});

export const emptyBilan = (id: string, date?: string): Bilan => {
  const teeth: Record<string, Tooth> = {};
  ALL_TEETH.forEach(t => { teeth[t] = emptyTooth(); });
  return { id, date: date ?? '', anamnese: emptyAnamnese(), risk: emptyRisk(), teeth };
};

export const emptyPatientFile = (date?: string): PatientFile => ({
  version: 1,
  patient: { nom: '', prenom: '', naissance: '', profession: '', praticien: '', correspondant: '' },
  bilans: [emptyBilan('b1', date)],
});
