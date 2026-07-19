import React from 'react';
import type { Bilan } from '@/lib/perio/types';
import type { BilanStats } from '@/lib/perio/calc';

// ── Facteurs de risque + radar « Numérisation » ──

const AXES = [
  { key: 'sante', label: 'Santé' },
  { key: 'tabac', label: 'Tabac' },
  { key: 'abs', label: 'Dents abs.' },
  { key: 'os', label: 'Os / âge' },
  { key: 'pp', label: 'Poches' },
  { key: 'bop', label: 'BOP' },
] as const;

function Radar({ scores, objectif }: { scores: Record<string, number>; objectif: Record<string, number> }) {
  const cx = 130, cy = 120, R = 88;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const r = (v / 10) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  const cur = AXES.map(a => scores[a.key] ?? 0);
  const obj = AXES.map(a => objectif[a.key] ?? 0);
  return (
    <svg viewBox="0 0 260 250" className="w-full max-w-[300px]" role="img" aria-label="Radar des facteurs de risque">
      {[2, 4, 6, 8, 10].map(g => (
        <polygon key={g} points={poly([g, g, g, g, g, g])} fill="none" stroke="#E2E8F0" strokeWidth={1} />
      ))}
      {AXES.map((a, i) => {
        const [x, y] = pt(i, 10);
        const [lx, ly] = pt(i, 12.6);
        return (
          <g key={a.key}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E8F0" strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500" fontSize={10}>
              {a.label}
            </text>
            <text x={lx} y={ly + 11} textAnchor="middle" dominantBaseline="middle" className="fill-slate-800" fontSize={10} fontWeight={700}>
              {Math.round((scores[a.key] ?? 0) * 10) / 10}
            </text>
          </g>
        );
      })}
      <polygon points={poly(obj)} fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 3" />
      <polygon points={poly(cur)} fill="#EC4899" fillOpacity={0.18} stroke="#EC4899" strokeWidth={2} strokeLinejoin="round" />
      {cur.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r={3} fill="#EC4899" stroke="#fff" strokeWidth={1.5} />;
      })}
    </svg>
  );
}

function ScoreScale({ value, onSet, marks, disabled, auto }: {
  value: number; onSet?: (v: number) => void; marks?: { v: number; label: string }[];
  disabled?: boolean; auto?: string;
}) {
  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i} disabled={disabled}
            onClick={() => onSet?.(i)}
            className={`flex-1 h-6 rounded text-[10px] tabular-nums transition-colors ${
              i === Math.round(value)
                ? 'bg-pink-500 text-white font-bold'
                : i <= value ? 'bg-pink-100 text-pink-400' : 'bg-slate-100 text-slate-400'
            } ${disabled ? 'cursor-default' : 'hover:bg-pink-200'}`}
          >{i}</button>
        ))}
      </div>
      {marks && (
        <div className="flex gap-1 mt-0.5">
          {marks.map(m => (
            <span key={m.v} className="text-[9px] text-slate-400" style={{ flexBasis: `${(m.v + 1) * 9}%` }}>{m.label}</span>
          ))}
        </div>
      )}
      {auto && <p className="text-[10px] text-slate-400 mt-0.5">{auto}</p>}
    </div>
  );
}

export default function RiskPanel({ bilan, stats, onChange }: {
  bilan: Bilan; stats: BilanStats; onChange: (r: Bilan['risk']) => void;
}) {
  const r = bilan.risk;
  const set = (patch: Partial<Bilan['risk']>) => onChange({ ...r, ...patch });
  const s = stats.scores;
  const objScores = { ...s, pp: 2, bop: 2 };

  return (
    <div className="grid lg:grid-cols-[1fr,340px] gap-6">
      <div className="space-y-5">
        {/* Santé */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700">État général / Génétique</h4>
            <span className="text-[11px] text-slate-400">0 = OK · 10 = KO</span>
          </div>
          <ScoreScale value={r.sante} onSet={v => set({ sante: v })} />
        </div>

        {/* Tabac */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700">Tabac</h4>
            <div className="flex flex-wrap gap-1">
              {([['Non-fumeur', 0], ['Ancien fumeur', 2], ['< 10/j', 5], ['< 20/j', 8], ['> 20/j', 10]] as const).map(([lab, v]) => (
                <button key={lab} onClick={() => set({ tabac: v })}
                  className={`px-2 py-0.5 rounded-full text-[10px] border ${
                    r.tabac === v ? 'bg-pink-500 border-pink-500 text-white' : 'border-slate-200 text-slate-500 hover:border-pink-300'
                  }`}>{lab}</button>
              ))}
            </div>
          </div>
          <ScoreScale value={r.tabac} onSet={v => set({ tabac: v })} />
          <input
            value={r.tabacDetail} onChange={e => set({ tabacDetail: e.target.value })}
            placeholder="… /jour depuis … ans"
            className="mt-2 w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-pink-400"
          />
        </div>

        {/* Dents absentes (auto) */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700">Dents absentes</h4>
            <span className="text-[11px] text-slate-400">automatique depuis le sondage</span>
          </div>
          <ScoreScale value={s.abs} disabled auto={`${stats.absentCount} dent(s) marquée(s) absente(s) dans la grille de sondage`} />
        </div>

        {/* Alvéolyse */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-baseline justify-between mb-1">
            <h4 className="text-sm font-semibold text-slate-700">Alvéolyse maxi</h4>
            <span className="text-[11px] text-slate-400">à saisir depuis tes radios — seul le score se calcule</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <label className="text-xs text-slate-500 flex items-center gap-1">
              <input type="number" min={0} max={100} value={r.alveolyse ?? ''}
                onChange={e => set({ alveolyse: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-right outline-none focus:border-pink-400" /> %
            </label>
            <label className="text-xs text-slate-500 flex items-center gap-1">
              âge <input type="number" min={10} max={110} value={r.age ?? ''}
                onChange={e => set({ age: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-right outline-none focus:border-pink-400" /> ans
            </label>
            <span className="text-xs text-slate-600 font-medium ml-auto">
              PO/âge = {stats.poSurAge ?? '—'}
            </span>
          </div>
          <ScoreScale value={s.os} disabled auto="score = PO/âge × 8 (plafonné à 10)" />
        </div>

        {/* Poches + BOP (auto) */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700">Poches profondes</h4>
              <span className="text-[11px] text-slate-400">automatique depuis le sondage</span>
            </div>
            <ScoreScale value={s.pp} disabled auto={`${stats.pctPPgt4}% des sites avec PP > 4 mm`} />
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700">Inflammation (BOP)</h4>
              <span className="text-[11px] text-slate-400">automatique depuis le sondage</span>
            </div>
            <ScoreScale value={s.bop} disabled auto={`%BOP ${stats.bopPct}% × 0,32`} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-1">Commentaires</h4>
          <textarea
            value={r.commentaires} onChange={e => set({ commentaires: e.target.value })}
            rows={2} className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-pink-400 resize-y"
          />
        </div>
      </div>

      {/* Radar + PRP */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 h-fit lg:sticky lg:top-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-1">Profil de risque /10</h4>
        <Radar scores={s as unknown as Record<string, number>} objectif={objScores as unknown as Record<string, number>} />
        <div className="mt-3 space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="font-semibold text-pink-600">Risque parodontal (PRP)</span>
              <span className="font-bold text-pink-600 tabular-nums">{stats.prp}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400" style={{ width: `${stats.prp}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-500">Objectif après traitement</span>
              <span className="font-semibold text-slate-600 tabular-nums">{stats.objectif}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-slate-400" style={{ width: `${stats.objectif}%` }} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-snug">
            Trait plein rose : profil actuel · pointillé gris : objectif (poches et inflammation ramenées à 2/10).
            PRP = moyenne des 6 facteurs × 10.
          </p>
        </div>
      </div>
    </div>
  );
}
