// ── Parcours de saisie du sondage : ordre d'auto-avancement du curseur ──
import type { Tooth } from './types';
import { MAX_TEETH, MAND_TEETH } from './types';

export type EntryMode = 'face' | 'dent' | 'colonne';

export const MODE_LABELS: Record<EntryMode, { label: string; hint: string }> = {
  face: {
    label: 'Par face (serpentin)',
    hint: 'Vestibulaire 18→28, retour palatin 28→18, puis mandibule. Le parcours des logiciels de charting.',
  },
  dent: {
    label: 'Dent par dent (V + P)',
    hint: 'Pour chaque dent : 3 sites vestibulaires puis 3 sites palatins/linguaux, puis dent suivante.',
  },
  colonne: {
    label: 'Dent complète (vertical)',
    hint: 'Pour chaque dent : GR puis PP en vestibulaire, puis GR et PP en palatin/lingual, puis dent suivante.',
  },
};

export interface CellPos { t: string; f: 'b' | 'l'; i: number; field: 'gr' | 'pp' }

export const cellId = (p: CellPos) => `cell-${p.field}-${p.f}-${p.t}-${p.i}`;

// liste (dent, site) dans l'ordre d'affichage gauche→droite d'une arcade
const flat = (list: string[]) => list.flatMap(t => [0, 1, 2].map(i => ({ t, i })));

// ordre anatomique distal→mésial dans une dent (quadrants 2/3 affichés m,c,d)
const anat = (t: string): number[] => (t[0] === '2' || t[0] === '3' ? [2, 1, 0] : [0, 1, 2]);

/** Construit la séquence complète des cellules pour un mode donné (dents absentes exclues). */
export function buildPath(teeth: Record<string, Tooth>, mode: EntryMode, field: 'gr' | 'pp'): CellPos[] {
  const present = (t: string) => !teeth[t]?.absent;

  if (mode === 'face') {
    const maxF = flat(MAX_TEETH).filter(x => present(x.t));
    const mandF = flat(MAND_TEETH).filter(x => present(x.t));
    return [
      ...maxF.map(x => ({ ...x, f: 'b' as const, field })),
      ...[...maxF].reverse().map(x => ({ ...x, f: 'l' as const, field })),
      ...mandF.map(x => ({ ...x, f: 'b' as const, field })),
      ...[...mandF].reverse().map(x => ({ ...x, f: 'l' as const, field })),
    ];
  }

  if (mode === 'dent') {
    const seq: CellPos[] = [];
    for (const list of [MAX_TEETH, MAND_TEETH])
      for (const t of list) {
        if (!present(t)) continue;
        for (const f of ['b', 'l'] as const)
          for (const i of anat(t)) seq.push({ t, f, i, field });
      }
    return seq;
  }

  // colonne : PP puis GR au sein de la dent (ordre des lignes affichées) — la séquence inclut les deux champs
  const seq: CellPos[] = [];
  for (const list of [MAX_TEETH, MAND_TEETH])
    for (const t of list) {
      if (!present(t)) continue;
      for (const f of ['b', 'l'] as const) {
        for (const i of anat(t)) seq.push({ t, f, i, field: 'pp' });
        for (const i of anat(t)) seq.push({ t, f, i, field: 'gr' });
      }
    }
  return seq;
}

const findIdx = (seq: CellPos[], mode: EntryMode, cur: CellPos) =>
  seq.findIndex(p =>
    p.t === cur.t && p.f === cur.f && p.i === cur.i && (mode !== 'colonne' ? true : p.field === cur.field),
  );

/** Cellule suivante après `cur` selon le mode. */
export function nextCell(teeth: Record<string, Tooth>, mode: EntryMode, cur: CellPos): CellPos | null {
  const seq = buildPath(teeth, mode, cur.field);
  const idx = findIdx(seq, mode, cur);
  if (idx === -1 || idx === seq.length - 1) return null;
  return seq[idx + 1];
}

/** Cellule précédente (= le site que l'on vient de saisir quand le curseur a avancé). */
export function prevCell(teeth: Record<string, Tooth>, mode: EntryMode, cur: CellPos): CellPos | null {
  const seq = buildPath(teeth, mode, cur.field);
  const idx = findIdx(seq, mode, cur);
  if (idx <= 0) return null;
  return seq[idx - 1];
}
