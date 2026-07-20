'use client'

import React from 'react';
import type { Bilan, Tooth, Site } from '@/lib/perio/types';
import { MAX_TEETH, MAND_TEETH } from '@/lib/perio/types';
import { sitePA, ppSeverity } from '@/lib/perio/calc';
import { type EntryMode, type CellPos, MODE_LABELS, cellId, nextCell } from '@/lib/perio/path';

// ── Grille de sondage parodontal ──
// Ordre des sites : quadrants 1/4 (côté droit) = D·C·M ; quadrants 2/3 = M·C·D
const siteLabels = (tooth: string): [string, string, string] => {
  const q = tooth[0];
  return q === '1' || q === '4' ? ['d', 'c', 'm'] : ['m', 'c', 'd'];
};

type FaceKey = 'b' | 'l';

interface Props {
  bilan: Bilan;
  mode: EntryMode;
  onMode: (m: EntryMode) => void;
  onChange: (teeth: Record<string, Tooth>) => void;
}

const sevBg: Record<string, string> = {
  ok: 'bg-white', warn: 'bg-amber-100 text-amber-900', high: 'bg-red-100 text-red-800 font-semibold',
};

function NumCell({ value, disabled, onSet, onAdvance, onQuick, onFocusCell, active, id, max = 15 }: {
  value: number | null; disabled?: boolean; onSet: (v: number | null) => void;
  onAdvance: () => void; onQuick: (key: string) => boolean; onFocusCell: () => void;
  active?: boolean; id: string; max?: number;
}) {
  const sev = ppSeverity(value);
  return (
    <input
      id={id}
      type="text" inputMode="numeric" disabled={disabled}
      value={value === null ? '' : String(value)}
      onFocus={onFocusCell}
      onKeyDown={e => {
        const k = e.key.toLowerCase();
        if (k === 's' || k === 'p' || k === 'm' || k === 'f') { e.preventDefault(); onQuick(k); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); onSet(Math.min(max, (value ?? 0) + 1)); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onSet(Math.max(0, (value ?? 0) - 1)); }
        if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onSet(null); }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); onAdvance(); }
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          if (onQuick(e.key)) return; // chiffre consommé par M/F en attente
          onSet(Number(e.key));
          onAdvance();
        }
      }}
      onChange={() => {}}
      className={`w-6 h-6 text-center text-[11px] border-0 outline-none focus:ring-2 focus:ring-pink-500 rounded-sm tabular-nums ${
        active ? 'ring-2 ring-pink-400' : ''
      } ${disabled ? 'bg-slate-100' : sev ? sevBg[sev] : 'bg-white'}`}
    />
  );
}

function DotCell({ on, color, disabled, onToggle }: {
  on: boolean; color: 'red' | 'sky'; disabled?: boolean; onToggle: () => void;
}) {
  return (
    <button
      disabled={disabled} onClick={onToggle} tabIndex={-1}
      className={`w-6 h-6 flex items-center justify-center ${disabled ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full transition-colors ${
        on ? (color === 'red' ? 'bg-red-500' : 'bg-sky-500') : 'bg-slate-200'
      }`} />
    </button>
  );
}

function CycleCell({ value, options, disabled, onSet, labels }: {
  value: number | string | null; options: (number | string)[]; disabled?: boolean;
  onSet: (v: number | string | null) => void; labels?: Record<string, string>;
}) {
  const next = () => {
    if (value === null) return onSet(options[0]);
    const i = options.indexOf(value);
    onSet(i === options.length - 1 ? null : options[i + 1]);
  };
  const display = value === null ? '·' : labels?.[String(value)] ?? String(value);
  const active = value !== null && value !== 0;
  return (
    <button
      disabled={disabled} onClick={next} tabIndex={-1}
      className={`w-full h-6 text-[11px] text-center ${
        disabled ? 'bg-slate-100 text-slate-300'
        : active ? 'bg-pink-50 text-pink-700 font-semibold hover:bg-pink-100' : 'text-slate-400 hover:bg-slate-50'
      }`}
    >{display}</button>
  );
}

function FaceRows({ teeth, list, face, faceLabel, update, advance, quick, active, onFocusCell }: {
  teeth: Record<string, Tooth>; list: string[]; face: FaceKey; faceLabel: string;
  update: (t: string, fn: (tooth: Tooth) => void) => void;
  advance: (pos: CellPos) => void;
  quick: (pos: CellPos, key: string) => boolean;
  active: CellPos | null;
  onFocusCell: (pos: CellPos) => void;
}) {
  const isActiveSite = (t: string, i: number) => !!active && active.t === t && active.f === face && active.i === i;
  const isActiveTooth = (t: string) => !!active && active.t === t;
  const rows: { key: keyof Site | 'pa'; label: string; hint: string }[] = [
    { key: 'pp', label: 'PP', hint: 'Profondeur de poche (mm)' },
    { key: 'bop', label: 'BOP', hint: 'Saignement au sondage (raccourci S)' },
    { key: 'ip', label: 'PL', hint: 'Plaque (raccourci P)' },
    { key: 'gr', label: 'GR', hint: 'Récession gingivale (mm)' },
    { key: 'pa', label: 'PA', hint: 'Perte d’attache = GR + PP (calculée)' },
  ];
  return (
    <>
      {rows.map(row => (
        <tr key={face + row.key} className={row.key === 'pa' ? 'bg-slate-50/70 border-b-2 border-slate-200' : 'border-b border-slate-100'}>
          <td className="sticky left-0 bg-white pl-2 pr-2 text-[10px] font-medium text-slate-500 whitespace-nowrap" title={row.hint}>
            <span className="text-slate-400">{faceLabel}</span> {row.label}
          </td>
          {list.map(t => {
            const tooth = teeth[t];
            const dis = tooth.absent;
            return tooth[face].map((site, i) => (
              <td key={t + i} className={`p-0 border-l ${i === 0 ? 'border-l-slate-300' : 'border-l-slate-100'}`}>
                {row.key === 'pa' ? (
                  <div className={`w-6 h-5 text-[10px] flex items-center justify-center tabular-nums ${
                    dis ? 'bg-slate-100' : (sitePA(site) ?? 0) > 3 ? 'text-red-600 font-semibold' : 'text-slate-400'
                  }`}>
                    {dis || site.pp === null ? '' : sitePA(site)}
                  </div>
                ) : row.key === 'bop' ? (
                  <div className={isActiveSite(t, i) ? 'ring-2 ring-pink-400 rounded-sm' : ''}>
                    <DotCell on={site.bop} color="red" disabled={dis}
                      onToggle={() => update(t, th => { th[face][i].bop = !th[face][i].bop; })} />
                  </div>
                ) : row.key === 'ip' ? (
                  <div className={isActiveSite(t, i) ? 'ring-2 ring-pink-400 rounded-sm' : ''}>
                    <DotCell on={site.ip} color="sky" disabled={dis}
                      onToggle={() => update(t, th => { th[face][i].ip = !th[face][i].ip; })} />
                  </div>
                ) : (
                  <NumCell value={site[row.key as 'gr' | 'pp']} disabled={dis}
                    active={isActiveSite(t, i)}
                    id={cellId({ t, f: face, i, field: row.key as 'gr' | 'pp' })}
                    onFocusCell={() => onFocusCell({ t, f: face, i, field: row.key as 'gr' | 'pp' })}
                    onAdvance={() => advance({ t, f: face, i, field: row.key as 'gr' | 'pp' })}
                    onQuick={k => quick({ t, f: face, i, field: row.key as 'gr' | 'pp' }, k)}
                    onSet={v => update(t, th => { th[face][i][row.key as 'gr' | 'pp'] = v; })} />
                )}
              </td>
            ));
          })}
        </tr>
      ))}
    </>
  );
}

function ArchTable({ title, list, teeth, update, upperFaceLabel, advance, quick, active, onFocusCell }: {
  title: string; list: string[]; teeth: Record<string, Tooth>;
  update: (t: string, fn: (tooth: Tooth) => void) => void;
  upperFaceLabel: string; // 'P' palatin ou 'L' lingual
  advance: (pos: CellPos) => void;
  quick: (pos: CellPos, key: string) => boolean;
  active: CellPos | null;
  onFocusCell: (pos: CellPos) => void;
}) {
  const activeTooth = active?.t;
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-3 mb-1">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
        <span className="text-[11px] text-slate-400">clic sur le n° de dent = absente · V vestibulaire · {upperFaceLabel === 'P' ? 'P palatin' : 'L lingual'}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="sticky left-0 bg-white w-16" />
              {list.map(t => (
                <th key={t} colSpan={3} className="border-l border-l-slate-300 p-0">
                  <button
                    onClick={() => update(t, th => { th.absent = !th.absent; })}
                    className={`w-full py-1 text-xs font-bold ${
                      teeth[t].absent ? 'bg-slate-200 text-slate-400 line-through' : 'text-slate-700 hover:bg-pink-50'
                    }`}
                    title="Cliquer pour marquer absente / présente"
                  >{t}</button>
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200">
              <th className="sticky left-0 bg-white" />
              {list.map(t => siteLabels(t).map((s, i) => (
                <th key={t + i} className={`text-[9px] font-normal text-slate-400 border-l ${i === 0 ? 'border-l-slate-300' : 'border-l-slate-100'}`}>{s}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            <FaceRows teeth={teeth} list={list} face="b" faceLabel="V" update={update} advance={advance} quick={quick} active={active} onFocusCell={onFocusCell} />
            <FaceRows teeth={teeth} list={list} face="l" faceLabel={upperFaceLabel} update={update} advance={advance} quick={quick} active={active} onFocusCell={onFocusCell} />
            {/* lignes dent entière */}
            {([
              ['mobility', 'Mobilité', [0, 1, 2, 3] as (number | string)[], undefined],
              ['furcation', 'Furcation', [0, 1, 2, 3] as (number | string)[], undefined],
              ['pronostic', 'Pronostic', ['B', 'R', 'M'] as (number | string)[], { B: 'B', R: 'R', M: 'M' }],
            ] as const).map(([key, label, opts, labels]) => (
              <tr key={key} className="border-b border-slate-100">
                <td className="sticky left-0 bg-white pl-2 pr-2 text-[10px] font-medium text-slate-500 whitespace-nowrap"
                    title={key === 'pronostic' ? 'B bon · R réservé · M mauvais' : '0 à 3'}>
                  {label}
                </td>
                {list.map(t => (
                  <td key={t} colSpan={3} className={`p-0 border-l border-l-slate-300 ${
                    activeTooth === t && (key === 'mobility' || key === 'furcation') ? 'ring-2 ring-inset ring-pink-300' : ''
                  }`}>
                    <CycleCell
                      value={teeth[t][key as 'mobility' | 'furcation' | 'pronostic'] as number | string | null}
                      options={opts as (number | string)[]} labels={labels as Record<string, string> | undefined}
                      disabled={teeth[t].absent}
                      onSet={v => update(t, th => { (th as unknown as Record<string, unknown>)[key] = v; })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const LEXIQUE: [string, string][] = [
  ['PP', "Profondeur de poche (mm) — distance du rebord gingival au fond de la poche"],
  ['GR', "Récession gingivale (mm) — racine exposée sous le rebord"],
  ['PA', "Perte d'attache (mm) = GR + PP — calculée automatiquement"],
  ['BOP', "Bleeding On Probing — saignement au sondage (pastille rouge, raccourci S)"],
  ['PL', "Plaque présente sur le site (pastille bleue, raccourci P)"],
  ['d · c · m', "Sites distal, central, mésial de chaque face"],
  ['V / P / L', "Faces vestibulaire, palatine (maxillaire), linguale (mandibule)"],
  ['Mobilité', "0 physiologique · 1 < 1 mm · 2 > 1 mm · 3 axiale (raccourci M puis chiffre)"],
  ['Furcation', "0 aucune · 1 débutante · 2 partielle · 3 traversante (raccourci F puis chiffre)"],
  ['Pronostic', "B bon · R réservé · M mauvais"],
  ['%BOP', "% de sites qui saignent — parodontite active si ≥ 20 %"],
  ['PO/âge', "% d'alvéolyse ÷ âge (classification 2018) — grade A < 0,25 · B 0,25–1 · C > 1"],
  ['PRP', "Pourcentage de Risque Parodontal — moyenne des 6 facteurs de risque × 10"],
  ['FDI', "Numérotation internationale : 11-18 / 21-28 maxillaire, 31-38 / 41-48 mandibule"],
];

export default function Charting({ bilan, mode, onMode, onChange }: Props) {
  const pending = React.useRef<'m' | 'f' | null>(null);
  const [lexOpen, setLexOpen] = React.useState(false);
  const [flash, setFlash] = React.useState('');
  const flashTimer = React.useRef<number | undefined>(undefined);

  // « Site actif » = le site sur lequel S / P / M / F s'appliquent.
  // Il suit le dernier site où l'on a tapé un chiffre OU sur lequel on a cliqué.
  const [active, setActive] = React.useState<CellPos | null>(null);
  const activeRef = React.useRef<CellPos | null>(null);
  const suppressFocus = React.useRef(false); // ignore le focus déclenché par l'auto-avancement
  const setActiveBoth = (p: CellPos) => { activeRef.current = p; setActive(p); };

  const update = (t: string, fn: (tooth: Tooth) => void) => {
    const teeth = structuredClone(bilan.teeth);
    fn(teeth[t]);
    onChange(teeth);
  };

  // appelé quand un chiffre est saisi ou sur Entrée/Tab : le site quitté devient le site actif
  const advance = (pos: CellPos) => {
    pending.current = null;
    setActiveBoth(pos);
    const next = nextCell(bilan.teeth, mode, pos);
    if (!next) return;
    suppressFocus.current = true; // le focus programmatique ne doit pas redéfinir le site actif
    requestAnimationFrame(() => {
      const el = document.getElementById(cellId(next)) as HTMLInputElement | null;
      el?.focus();
      el?.select?.();
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };

  // focus d'une cellule : clic utilisateur → nouveau site actif ; focus programmatique → ignoré
  const onFocusCell = (pos: CellPos) => {
    if (suppressFocus.current) { suppressFocus.current = false; return; }
    pending.current = null;
    setActiveBoth(pos);
  };

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(''), 2200);
  };

  const siteName = (p: CellPos) => `${p.t} ${p.f === 'b' ? 'V' : 'P/L'}`;

  /** Raccourcis dictée, appliqués au SITE ACTIF. Retourne true si la touche est consommée. */
  const quick = (posFromCell: CellPos, key: string): boolean => {
    const target = activeRef.current ?? posFromCell;

    // chiffre : consommé seulement si M/F est en attente
    if (/^[0-9]$/.test(key)) {
      if (!pending.current) return false;
      const v = Math.min(3, Number(key));
      const prop = pending.current === 'm' ? 'mobility' : 'furcation';
      update(target.t, th => { (th as unknown as Record<string, unknown>)[prop] = v; });
      showFlash(`${pending.current === 'm' ? 'Mobilité' : 'Furcation'} ${target.t} = ${v}`);
      pending.current = null;
      return true;
    }

    if (key === 's' || key === 'p') {
      const prop = key === 's' ? 'bop' : 'ip';
      update(target.t, th => { th[target.f][target.i][prop] = !th[target.f][target.i][prop]; });
      showFlash(`${key === 's' ? 'Saignement' : 'Plaque'} ${siteName(target)}`);
      return true;
    }
    if (key === 'm' || key === 'f') {
      pending.current = key;
      showFlash(`${key === 'm' ? 'Mobilité' : 'Furcation'} ${target.t} : tape 0-3…`);
      return true;
    }
    return false;
  };

  return (
    <div>
      {/* choix du parcours de saisie */}
      <div className="mb-3 bg-white rounded-lg border border-slate-200 px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">Parcours de saisie :</span>
        {(Object.keys(MODE_LABELS) as EntryMode[]).map(m => (
          <button key={m} onClick={() => onMode(m)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              mode === m ? 'bg-pink-500 border-pink-500 text-white font-semibold' : 'border-slate-200 text-slate-500 hover:border-pink-300'
            }`}>{MODE_LABELS[m].label}</button>
        ))}
        <button onClick={() => setLexOpen(o => !o)}
          className={`ml-auto px-2.5 py-1 rounded-full text-xs border ${lexOpen ? 'bg-slate-700 border-slate-700 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
          {lexOpen ? 'Fermer le lexique' : '📖 Lexique'}
        </button>
        <span className="text-[11px] text-slate-400 basis-full">{MODE_LABELS[mode].hint}</span>
      </div>

      {lexOpen && (
        <div className="mb-3 bg-white rounded-lg border border-slate-200 p-4">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {LEXIQUE.map(([term, def]) => (
              <div key={term} className="flex gap-2 text-xs">
                <span className="font-bold text-pink-600 w-16 shrink-0">{term}</span>
                <span className="text-slate-600">{def}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* glossaire permanent des abréviations de la grille */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1.5 text-[11px] text-slate-500 bg-white rounded-lg border border-slate-200 px-3 py-1.5">
        <span><b className="text-pink-600">PP</b> profondeur de poche (mm)</span>
        <span><b className="text-pink-600">BOP</b> saignement au sondage</span>
        <span><b className="text-pink-600">PL</b> plaque</span>
        <span><b className="text-pink-600">GR</b> récession gingivale (mm)</span>
        <span><b className="text-pink-600">PA</b> perte d'attache = GR + PP (calculée)</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-1.5 text-[11px] text-slate-500">
        <span><b className="text-slate-700">Dictée au clavier :</b> tape la poche → le curseur avance · le <b className="text-pink-600">site actif</b> (encadré rose) est celui que tu viens de saisir ou de cliquer · <b>S</b> saignement · <b>P</b> plaque · <b>M</b>+chiffre mobilité · <b>F</b>+chiffre furcation s'appliquent à ce site · Entrée passe sans saisir · ↑↓ poches &gt; 9 mm · Suppr vide</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> BOP (S)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Plaque (P)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 border border-amber-300 inline-block rounded-sm" /> PP 4–5</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-300 inline-block rounded-sm" /> PP ≥ 6</span>
        {active && <span className="px-2 py-0.5 rounded bg-pink-100 text-pink-700 font-medium">Site actif : {active.t} {active.f === 'b' ? 'V' : 'P/L'}</span>}
        {flash && <span className="ml-auto px-2 py-0.5 rounded bg-pink-500 text-white font-semibold">{flash}</span>}
      </div>
      <ArchTable title="Maxillaire" list={MAX_TEETH} teeth={bilan.teeth} update={update} upperFaceLabel="P" advance={advance} quick={quick} active={active} onFocusCell={onFocusCell} />
      <ArchTable title="Mandibule" list={MAND_TEETH} teeth={bilan.teeth} update={update} upperFaceLabel="L" advance={advance} quick={quick} active={active} onFocusCell={onFocusCell} />
    </div>
  );
}