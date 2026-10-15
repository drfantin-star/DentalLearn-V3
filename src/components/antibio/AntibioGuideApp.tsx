'use client'

/**
 * AntibioGuide · reco HAS — aide à la prescription antibiotique en pratique
 * bucco-dentaire. Porté depuis la maquette validée (maquette_antibioguide_v1.html).
 *
 * Aucune donnée n'est enregistrée ni transmise : tout vit dans le state React.
 * Ce n'est pas un dispositif médical (mention permanente en tête de page).
 */

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { CUR, FAM, HORS_AMM, PROFILE, SOURCES } from '@/lib/antibio/data';
import { categoryLine, cats, evaluate, initialState, type DrugLine, type Note, type PillClass, type Result, type RxBlock } from '@/lib/antibio/engine';
import type { AntibioState } from '@/lib/antibio/types';

/* ---------- Styles par verdict ---------- */
const V: Record<PillClass, { bg: string; fg: string; border: string }> = {
  R: { bg: 'bg-teal-50', fg: 'text-teal-800', border: 'border-teal-700' },
  N: { bg: 'bg-slate-100', fg: 'text-slate-600', border: 'border-slate-500' },
  C: { bg: 'bg-amber-50', fg: 'text-amber-800', border: 'border-amber-700' },
  CI: { bg: 'bg-red-50', fg: 'text-red-800', border: 'border-red-700' },
};

function Pill({ cls, text }: { cls: PillClass; text: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${V[cls].fg} ${V[cls].border}`}>
      {text}
    </span>
  );
}

function NoteBox({ note }: { note: Note }) {
  if (note.kind === 'alert') return <div className="text-sm border-l-[3px] border-red-700 bg-red-50 text-red-900 px-3 py-1.5 rounded-r">{note.text}</div>;
  if (note.kind === 'tip') return <div className="text-sm border-l-[3px] border-amber-600 bg-amber-50 text-amber-900 px-3 py-1.5 rounded-r">{note.text}</div>;
  return <div className="text-sm text-slate-500">{note.text}</div>;
}

/** Rend « **gras** » et la balise [hors AMM] d'une ligne adulte. */
function RichLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[hors AMM\])/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p === HORS_AMM) return <span key={i} className="inline-block text-[11px] font-bold text-amber-700 border border-amber-700 rounded px-1 mx-1 align-middle">hors AMM</span>;
        if (p.startsWith('**') && p.endsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </span>
  );
}

function Drug({ d }: { d: DrugLine }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-slate-800">{d.name} · {d.value}</span>
      <div className="font-mono text-[13px] bg-slate-100 rounded px-2 py-1 text-slate-700 overflow-x-auto">
        {d.calc}
        {d.capped ? <span className="text-amber-700"> → plafonné à {d.capText?.replace('plafond HAS : ', '')}</span> : d.capText ? <span className="text-slate-500"> ({d.capText})</span> : null}
        {d.perDose && <><br />{d.perDose}</>}
      </div>
      {d.warn && <NoteBox note={{ kind: 'tip', text: d.warn }} />}
    </div>
  );
}

function RxBlockView({ b }: { b: RxBlock }) {
  if (b.childMissing) {
    return (
      <Section title="Prescription">
        <p className="text-sm text-slate-500">Cette situation ne figure pas dans le tableau pédiatrique de la HAS (tableau 15).</p>
      </Section>
    );
  }
  return (
    <Section title={b.title}>
      {b.removed.length > 0 && <NoteBox note={{ kind: 'alert', text: `Retiré du schéma selon les cases cochées : ${b.removed.join(' · ')}.` }} />}
      {b.groups.map((g, gi) => (
        <div key={gi}>
          <p className="font-bold text-slate-800 mb-1.5">{g.title}</p>
          <div className="flex flex-col gap-1.5">
            {g.items.map((it, ii) => (
              <div key={ii} className="border border-slate-200 rounded-lg px-3 py-2 text-[15px]">
                {typeof it === 'string' ? <RichLine text={it} /> : (
                  <div className="flex flex-col gap-2.5">{it.map((d, di) => <Drug key={di} d={d} />)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {b.childTip && <NoteBox note={{ kind: 'tip', text: b.childTip }} />}
      {b.extraNote && <NoteBox note={{ kind: 'note', text: b.extraNote }} />}
      <p className="text-[13px] text-slate-500">{b.src}</p>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3.5 border-b border-slate-200 last:border-b-0 flex flex-col gap-2.5">
      <h3 className="text-[13px] uppercase tracking-wider text-slate-500 font-bold m-0">{title}</h3>
      {children}
    </div>
  );
}

/* ---------- Résultat ---------- */
function ResultCard({ r }: { r: Result }) {
  return (
    <div id="antibio-result" className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-live="polite">
      <div className={`px-4 py-4 flex flex-col gap-1.5 border-b border-slate-200 ${V[r.cls].bg}`}>
        <span className="text-[13px] uppercase tracking-wider text-slate-500 font-bold">{r.what}</span>
        <span className={`text-2xl font-black leading-tight ${V[r.cls].fg}`} style={{ textWrap: 'balance' } as React.CSSProperties}>{r.big}</span>
        {r.sub && <span className="text-[15px] text-slate-700">{r.sub}</span>}
        {r.why && <span className="text-[15px] text-slate-700">{r.why}</span>}
      </div>

      {r.kind === 'pro' && (
        <Section title={r.rows.length > 1 ? 'Détail par catégorie' : 'Recommandation HAS'}>
          <table className="w-full text-[15px] border-collapse">
            <tbody>
              {r.rows.map(([label, p], i) => (
                <tr key={i}>
                  <td className="py-1.5 border-t border-slate-200 align-top">{label}</td>
                  <td className="py-1.5 border-t border-slate-200 text-right align-top"><Pill cls={p.cls} text={p.text} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.multiNote && <p className="text-sm text-slate-500">{r.multiNote}</p>}
        </Section>
      )}

      {r.kind === 'cur' && r.curStatus && (
        <Section title="Recommandation HAS">
          {r.curStatus.pill && <div><Pill cls={r.curStatus.pill.cls} text={r.curStatus.pill.text} /></div>}
          {r.curStatus.rule && (
            <>
              <p className="text-[15px]"><b>Règle générale :</b> {r.curStatus.rule.replace('Règle générale : ', '')}</p>
              <p className="text-[15px] font-bold">Exceptions prévues par la HAS (astérisque du tableau 13, grade AE) :</p>
              <ul className="list-none m-0 p-0 flex flex-col gap-1 text-[15px]">
                {r.curStatus.exceptions!.map((e, i) => (
                  <li key={i} className="flex gap-2 items-baseline">
                    <span className={e.active ? 'text-teal-700 font-bold' : 'text-slate-400'}>{e.active ? '✓' : '–'}</span>
                    <span>{e.label} → antibiothérapie {e.effect}{e.active && <b> (s&apos;applique ici)</b>}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      {r.notes.length > 0 && (
        <div className="px-4 py-3.5 border-b border-slate-200 flex flex-col gap-2.5">
          {r.notes.map((n, i) => <NoteBox key={i} note={n} />)}
        </div>
      )}

      {r.rx.map((b, i) => (b.kind === 'rx' ? <RxBlockView key={i} b={b} /> : (
        <div key={i} className="px-4 py-3.5 border-b border-slate-200"><NoteBox note={b} /></div>
      )))}

      <Section title="À retenir">
        <ul className="m-0 pl-5 text-[15px] flex flex-col gap-1 list-disc">
          {r.recall.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
        <p className="text-[13px] text-slate-500">Source : {r.src}</p>
      </Section>
    </div>
  );
}

/* ---------- Composants de saisie ---------- */
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex border border-slate-300 rounded-full overflow-hidden self-start" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={`px-4 py-2 text-[15px] font-semibold transition-colors ${value === v ? 'bg-teal-700 text-white' : 'bg-transparent text-slate-800 hover:bg-slate-100'}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Toggle({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex gap-2.5 items-start text-[15px] cursor-pointer">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-[17px] h-[17px] shrink-0 accent-teal-700" />
      <span>{children}</span>
    </label>
  );
}

const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3.5" aria-labelledby={`antibio-s${n}`}>
    <h2 id={`antibio-s${n}`} className="text-[19px] font-black m-0 flex gap-2.5 items-baseline">
      <span className="font-mono text-[13px] text-teal-700">{n}</span>{title}
    </h2>
    {children}
  </section>
);

/* ---------- App ---------- */
export default function AntibioGuideApp() {
  const [s, setS] = useState<AntibioState>(initialState);
  const patch = (p: Partial<AntibioState>) => setS((prev) => ({ ...prev, ...p }));
  const toggleCheck = (id: string, on: boolean) => setS((prev) => {
    const checks = new Set(prev.checks);
    if (on) checks.add(id); else checks.delete(id);
    // Cocher un critère ONM pré-coche « acte exposant l'os » pour l'acte chirurgical déjà sélectionné
    const isOnm = (PROFILE.find((g) => g.id === 'onm')?.items ?? []).some((i) => i.id === id);
    const curAct = FAM.find((f) => f.id === prev.fam)?.acts[prev.act];
    const osExposed = isOnm && on ? !!curAct?.os : prev.osExposed;
    return { ...prev, checks, osExposed };
  });

  const c = cats(s.checks);
  const result = useMemo(() => evaluate(s), [s]);
  const pro = s.mode === 'pro';
  const fams = pro ? FAM : CUR;
  const curFamId = pro ? s.fam : s.curFam;
  const fam = fams.find((f) => f.id === curFamId) ?? fams[0];
  const list: Array<{ l: string }> = pro ? (fam as typeof FAM[number]).acts : (fam as typeof CUR[number]).items;
  const sel = pro ? s.act : s.cur;

  const pickFam = (id: string) => {
    if (pro) {
      const f = FAM.find((x) => x.id === id)!;
      patch({ fam: id, act: 0, osExposed: !!f.acts[0].os });
    } else patch({ curFam: id, cur: 0 });
  };
  const pickItem = (i: number) => {
    if (pro) patch({ act: i, osExposed: !!(fam as typeof FAM[number]).acts[i].os });
    else patch({ cur: i });
  };

  return (
    <div className="min-h-screen bg-[#F3F6F5] text-slate-900" style={{ fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-[760px] mx-auto px-4 py-5 flex flex-col gap-4">
        <header className="flex flex-col gap-1.5">
          <p className="text-xs tracking-[0.12em] uppercase text-teal-700 font-bold m-0">Certily · Outil clinique</p>
          <h1 className="text-3xl font-black leading-tight m-0">AntibioGuide <span className="text-slate-500 font-semibold">· reco HAS</span></h1>
          <p className="text-slate-600 m-0 max-w-[62ch]">
            Antibioprophylaxie et antibiothérapie en pratique bucco-dentaire, d&apos;après les recommandations HAS (juillet 2026) et la recommandation HAS endocardite infectieuse (octobre 2024).
          </p>
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800">
            <b className="text-amber-800">Ceci n&apos;est pas un dispositif médical.</b> Cet outil reproduit les recommandations HAS pour en faciliter la consultation. Il ne remplace pas le jugement clinique. Vérifiez toujours la prescription (molécule, dose, contre-indications, interactions) avant de la rédiger. Aucune donnée n&apos;est enregistrée ni transmise.
          </div>
        </header>

        <Step n={1} title="Le patient">
          <div className="flex flex-wrap gap-3 items-center">
            <Seg label="Âge" value={s.child ? 'child' : 'adult'} options={[['adult', 'Adulte'], ['child', 'Enfant']]} onChange={(v) => patch({ child: v === 'child' })} />
            {s.child && (
              <label className="flex gap-2 items-center font-semibold text-[15px]">
                Poids
                <input id="antibio-kg" type="number" min={3} max={120} step={0.5} value={s.kg}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) patch({ kg: v }); }}
                  className="w-[90px] px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-mono text-[16px]" />
                kg
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {PROFILE.map((g) => {
              const n = g.items.filter((i) => s.checks.has(i.id)).length;
              return (
                <details key={g.id} className="border border-slate-200 rounded-lg px-3" open={n > 0}>
                  <summary className="cursor-pointer py-2.5 font-bold flex justify-between gap-2 list-none">
                    <span>{g.title}</span>
                    <span className="font-mono text-xs text-teal-700 font-medium">{n ? `${n} coché${n > 1 ? 's' : ''}` : ''}{g.src ? `${n ? ' · ' : ''}${g.src}` : ''}</span>
                  </summary>
                  <div className="flex flex-col gap-1.5 pb-3">
                    {g.items.map((i) => (
                      <Toggle key={i.id} id={`antibio-c-${i.id}`} checked={s.checks.has(i.id)} onChange={(on) => toggleCheck(i.id, on)}>
                        {i.label}{i.hint && <><br /><small className="text-slate-500">{i.hint}</small></>}
                      </Toggle>
                    ))}
                    {g.info && <p className="text-sm text-slate-600 m-0">{g.info}</p>}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="text-sm rounded-lg px-3 py-2 bg-teal-50">Catégorie : <b>{categoryLine(s)}</b></div>
        </Step>

        <Step n={2} title="La situation">
          <Seg label="Situation" value={s.mode} options={[['pro', 'Je vais réaliser un acte'], ['cur', 'Le patient a une infection']]} onChange={(v) => patch({ mode: v })} />
        </Step>

        <Step n={3} title={pro ? "L'acte prévu" : "L'infection"}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Spécialité">
            {fams.map((f) => (
              <button key={f.id} type="button" aria-pressed={f.id === fam.id} onClick={() => pickFam(f.id)}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${f.id === fam.id ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {pro && c.onm && (
            <Toggle id="antibio-t-os" checked={s.osExposed} onChange={(v) => patch({ osExposed: v })}>
              <b>Acte chirurgical exposant l&apos;os</b> → schéma pré- et post-opératoire 7 jours (haut risque d&apos;ostéonécrose) <small className="text-slate-500">· décochez si l&apos;os n&apos;est pas exposé</small>
            </Toggle>
          )}

          <div className="flex flex-col gap-1">
            {list.map((a, i) => (
              <button key={i} type="button" aria-pressed={i === sel} onClick={() => pickItem(i)}
                className={`text-left rounded-lg px-2.5 py-2 text-[15px] border ${i === sel ? 'border-teal-700 bg-teal-50 font-semibold' : 'border-transparent hover:bg-slate-50'}`}>
                {a.l}
              </button>
            ))}
          </div>

          {!pro && (
            <div className="flex flex-col gap-1.5">
              <Toggle id="antibio-t-ext" checked={s.ext} onChange={(v) => patch({ ext: v })}>Signes d&apos;extension : suppuration, tuméfaction, trismus, adénopathie ou fièvre</Toggle>
              <Toggle id="antibio-t-nol" checked={s.nolocal} onChange={(v) => patch({ nolocal: v })}>Le geste local (drainage, traitement de la cause) ne peut pas être réalisé</Toggle>
            </div>
          )}
        </Step>

        <ResultCard r={result} />

        <footer className="text-[13px] text-slate-500 flex flex-col gap-1.5">
          <p className="m-0">Sources : {SOURCES.has2026} · {SOURCES.has2024}. <a href="https://www.has-sante.fr" target="_blank" rel="noreferrer" className="text-teal-700 underline">has-sante.fr</a></p>
          <p className="m-0">Outil d&apos;aide à la consultation des recommandations, ne remplace pas le jugement clinique. Aucune donnée patient n&apos;est enregistrée.</p>
        </footer>
      </div>
    </div>
  );
}
