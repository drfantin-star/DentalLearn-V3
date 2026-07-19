import React from 'react';
import type { Bilan } from '@/lib/perio/types';
import { computeStats, type BilanStats } from '@/lib/perio/calc';

// ── Évolution entre bilans successifs ──

const INDICATORS: { key: keyof BilanStats; label: string; unit: string; goodDown: boolean }[] = [
  { key: 'ppMoy', label: 'PP moyenne', unit: 'mm', goodDown: true },
  { key: 'ppMax', label: 'PP max', unit: 'mm', goodDown: true },
  { key: 'paMoy', label: 'PA moyenne', unit: 'mm', goodDown: true },
  { key: 'bopPct', label: '% BOP', unit: '%', goodDown: true },
  { key: 'ipPct', label: 'Indice de plaque', unit: '%', goodDown: true },
  { key: 'sitesPPgt4', label: 'Sites PP > 4 mm', unit: '', goodDown: true },
  { key: 'cumulPoches', label: 'Cumul poches', unit: 'mm', goodDown: true },
  { key: 'mobilitesSum', label: 'Mobilités (Σ)', unit: '', goodDown: true },
  { key: 'prp', label: 'Risque PRP', unit: '%', goodDown: true },
];

function MiniBars({ values, unit }: { values: number[]; unit: string }) {
  const max = Math.max(...values, 0.001);
  return (
    <div className="flex items-end gap-1 h-9">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5" title={`Bilan ${i + 1} : ${v}${unit}`}>
          <div
            className={`w-5 rounded-t-[3px] ${i === values.length - 1 ? 'bg-pink-500' : 'bg-pink-200'}`}
            style={{ height: `${Math.max(2, (v / max) * 30)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function Evolution({ bilans }: { bilans: Bilan[] }) {
  const stats = bilans.map(computeStats);
  const charted = stats.map((s, i) => ({ s, i })).filter(x => x.s.nSites > 0);

  if (charted.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        L'évolution s'affiche dès qu'au moins deux bilans ont un sondage renseigné.
        Ajoute un bilan de réévaluation avec le bouton <b>+ Bilan</b> en haut de page.
      </div>
    );
  }

  const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200 text-left">
            <th className="px-4 py-2.5 text-slate-500 text-xs uppercase tracking-wide font-semibold">Indicateur</th>
            {charted.map(({ i }) => (
              <th key={i} className="px-3 py-2.5 text-right">
                <span className="block text-slate-700 font-bold">Bilan {i + 1}</span>
                <span className="block text-[10px] text-slate-400 font-normal">{fmtDate(bilans[i].date)}</span>
              </th>
            ))}
            <th className="px-3 py-2.5 text-slate-500 text-xs uppercase tracking-wide font-semibold">Δ dernier</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {INDICATORS.map(ind => {
            const vals = charted.map(({ s }) => s[ind.key] as number);
            const delta = Math.round((vals[vals.length - 1] - vals[vals.length - 2]) * 10) / 10;
            const better = ind.goodDown ? delta < 0 : delta > 0;
            return (
              <tr key={ind.key} className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-600">{ind.label}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`px-3 py-2 text-right tabular-nums ${i === vals.length - 1 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                    {v}{ind.unit && <span className="text-[10px] text-slate-400"> {ind.unit}</span>}
                  </td>
                ))}
                <td className={`px-3 py-2 tabular-nums font-semibold ${
                  delta === 0 ? 'text-slate-400' : better ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {delta !== 0 && Math.abs(delta)}
                </td>
                <td className="px-4 py-1"><MiniBars values={vals} unit={ind.unit} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 text-[10px] text-slate-400">
        ▼ vert = amélioration (tous ces indicateurs doivent baisser) · barres : un rectangle par bilan, le dernier en rose vif.
      </p>
    </div>
  );
}
