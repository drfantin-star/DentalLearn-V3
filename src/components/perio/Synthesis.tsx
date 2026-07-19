'use client'

import React from 'react';
import type { BilanStats } from '@/lib/perio/calc';

// ── Synthèse : classification, indices, cascade physiopathologique ──

export function DiagBanner({ stats }: { stats: BilanStats }) {
  const c = stats.classification;
  if (!c.localisation) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Renseigne le sondage pour obtenir la classification automatique.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 text-white p-5">
      <p className="text-[11px] uppercase tracking-widest text-pink-100 mb-1">Diagnostic automatique</p>
      <p className="text-xl sm:text-2xl font-bold leading-tight">
        Parodontite {c.localisation.toLowerCase()} · Stade {c.stade}{c.stadeIV && <span title="Plus de 4 dents absentes"> ➜ IV</span>}
        {c.grade && <> · Grade {c.grade}</>}
      </p>
      <p className="text-sm text-pink-100 mt-1">
        {c.active ? 'Active (BOP ≥ 20 %)' : 'Non active (BOP < 20 %)'} · %PA&gt;3mm : {stats.pctPAgt3}% · PAmax : {stats.paMax} mm · PO/âge : {stats.poSurAge ?? '—'}
      </p>
    </div>
  );
}

function Tile({ label, value, unit, accent }: { label: string; value: React.ReactNode; unit?: string; accent?: 'warn' | 'high' }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-tight ${
        accent === 'high' ? 'text-red-600' : accent === 'warn' ? 'text-amber-600' : 'text-slate-800'
      }`}>
        {value}<span className="text-[11px] font-medium text-slate-400 ml-0.5">{unit}</span>
      </p>
    </div>
  );
}

export default function Synthesis({ stats }: { stats: BilanStats }) {
  const s = stats;
  return (
    <div className="space-y-5">
      <DiagBanner stats={s} />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <Tile label="Sites sondés" value={s.nSites} />
        <Tile label="Dents absentes" value={s.absentCount} />
        <Tile label="PP max" value={s.ppMax} unit="mm" accent={s.ppMax >= 6 ? 'high' : s.ppMax >= 4 ? 'warn' : undefined} />
        <Tile label="PP moy" value={s.ppMoy} unit="mm" />
        <Tile label="PA max" value={s.paMax} unit="mm" accent={s.paMax >= 5 ? 'high' : undefined} />
        <Tile label="PA moy" value={s.paMoy} unit="mm" />
        <Tile label="% BOP" value={s.bopPct} unit="%" accent={s.bopPct >= 20 ? 'high' : undefined} />
        <Tile label="Indice de plaque" value={s.ipPct} unit="%" accent={s.ipPct >= 25 ? 'warn' : undefined} />
        <Tile label="Sites PP > 4 mm" value={`${s.sitesPPgt4}`} unit={` · ${s.pctPPgt4}%`} accent={s.sitesPPgt4 > 0 ? 'warn' : undefined} />
        <Tile label="Sites PA > 3 mm" value={`${s.sitesPAgt3}`} unit={` · ${s.pctPAgt3}%`} />
        <Tile label="Cumul poches" value={s.cumulPoches} unit="mm" />
        <Tile label="Mobilités (Σ)" value={s.mobilitesSum} />
      </div>

      {/* Cascade physiopathologique */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Cascade physiopathologique</h4>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          {[
            { t: 'Accumulation microbes', st: 'Présent', v: s.ipPct, note: '% sites avec plaque' },
            { t: 'Inflammation', st: 'Court terme', v: s.bopPct, note: '% sites qui saignent' },
            { t: 'Lésions', st: 'Long terme', v: s.pctPPgt4, note: '% sites PP > 4 mm' },
          ].map((step, i) => (
            <React.Fragment key={step.t}>
              {i > 0 && <div className="self-center text-pink-400 text-xl px-1 rotate-90 sm:rotate-0">➜</div>}
              <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{step.st}</p>
                <p className="text-sm font-semibold text-slate-700">{step.t}</p>
                <p className="text-2xl font-bold text-pink-600 tabular-nums">{step.v}<span className="text-sm">%</span></p>
                <p className="text-[10px] text-slate-400">{step.note}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-semibold text-pink-600">Risque parodontal (PRP)</span>
            <span className="font-bold text-pink-600 tabular-nums">{s.prp}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400" style={{ width: `${s.prp}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-semibold text-slate-600">Objectif après traitement</span>
            <span className="font-bold text-slate-600 tabular-nums">{s.objectif}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-slate-400" style={{ width: `${s.objectif}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}