'use client';

import { useMemo } from 'react';

interface RadarCPProps {
  ordreInscriptionDate: string | null;
  actionsParAxe: {
    axe1: number;
    axe2: number;
    axe3: number;
    axe4: number;
  };
}

export default function RadarCP({ ordreInscriptionDate, actionsParAxe }: RadarCPProps) {

  // Calcul de la période de certification
  const periode = useMemo(() => {
    const ordreDate = ordreInscriptionDate ? new Date(ordreInscriptionDate) : null;
    const seuil2023 = new Date('2023-01-01');

    if (!ordreDate || ordreDate < seuil2023) {
      // Inscrit avant 2023 → dérogation 9 ans (2023-2032)
      return {
        debut: new Date('2023-01-01'),
        fin: new Date('2032-12-31'),
        dureeAns: 9,
        isDerogation: true
      };
    } else {
      // Inscrit après 2023 → 6 ans à partir de l'inscription
      const fin = new Date(ordreDate);
      fin.setFullYear(fin.getFullYear() + 6);
      return {
        debut: ordreDate,
        fin: fin,
        dureeAns: 6,
        isDerogation: false
      };
    }
  }, [ordreInscriptionDate]);

  // Calcul du temps restant
  const tempsRestant = useMemo(() => {
    const now = new Date();
    const diffMs = periode.fin.getTime() - now.getTime();
    const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffMois = Math.ceil(diffJours / 30);
    const diffAns = Math.floor(diffMois / 12);
    const moisRestants = diffMois % 12;

    return {
      jours: diffJours,
      mois: diffMois,
      ans: diffAns,
      moisRestants,
      pourcentageEcoule: Math.min(100, Math.max(0,
        ((now.getTime() - periode.debut.getTime()) /
        (periode.fin.getTime() - periode.debut.getTime())) * 100
      ))
    };
  }, [periode]);

  // Objectif : 2 actions minimum par axe
  const OBJECTIF_PAR_AXE = 2;

  const axes = [
    { id: 'axe1', label: 'Compétences', color: '#8B5CF6', icon: '📚', count: actionsParAxe.axe1 },
    { id: 'axe2', label: 'Qualité pratiques', color: '#0F7B6C', icon: '📋', count: actionsParAxe.axe2 },
    { id: 'axe3', label: 'Relation patient', color: '#F59E0B', icon: '🤝', count: actionsParAxe.axe3 },
    { id: 'axe4', label: 'Santé praticien', color: '#EC4899', icon: '❤️', count: actionsParAxe.axe4 },
  ];

  const totalActions = Object.values(actionsParAxe).reduce((a, b) => a + b, 0);
  const totalObjectif = OBJECTIF_PAR_AXE * 4; // 8 actions minimum

  return (
    <div style={{ background: '#242424', border: '0.5px solid #333', borderRadius: '16px', overflow: 'hidden' }}>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] px-4 py-3">
        <h3 className="text-white font-bold text-sm">Certification Périodique</h3>
        <p className="text-white/70 text-xs">
          {periode.isDerogation ? 'Premier cycle (dérogation 9 ans)' : 'Cycle standard (6 ans)'}
        </p>
      </div>

      <div className="p-4 space-y-4">

        {/* Barre de progression temporelle */}
        <div>
          <div className="flex justify-between text-xs text-[#6b7280] mb-1.5">
            <span>{periode.debut.getFullYear()}</span>
            <span className="font-semibold text-[#a3a3a3]">
              {tempsRestant.ans > 0
                ? `${tempsRestant.ans} an${tempsRestant.ans > 1 ? 's' : ''}${tempsRestant.moisRestants > 0 ? ` et ${tempsRestant.moisRestants} mois` : ''} restants`
                : `${tempsRestant.mois} mois restants`}
            </span>
            <span>{periode.fin.getFullYear()}</span>
          </div>
          <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] rounded-full transition-all duration-500"
              style={{ width: `${tempsRestant.pourcentageEcoule}%` }}
            />
          </div>
        </div>

        {/* Liste compacte axes */}
        <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #333' }}>
          {axes.map((axe, index) => {
            const isComplete = axe.count >= OBJECTIF_PAR_AXE
            const dots = Array.from({ length: OBJECTIF_PAR_AXE }, (_, i) => i < axe.count)
            const pastilleBg: Record<string, string> = {
              axe1: '#EEF2FF',
              axe2: '#F0FDFA',
              axe3: '#FFF7ED',
              axe4: '#FDF2F8',
            }
            return (
              <div
                key={axe.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${
                  index < axes.length - 1 ? 'border-b border-[#333]' : ''
                }`}
              >
                {/* Pastille */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: pastilleBg[axe.id] }}
                >
                  {axe.icon}
                </div>

                {/* Label */}
                <span className="flex-1 text-sm font-medium text-[#e5e5e5]">
                  {axe.label}
                </span>

                {/* Dots progression */}
                <div className="flex items-center gap-1.5">
                  {dots.map((filled, i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full transition-all"
                      style={filled
                        ? { background: axe.color }
                        : { border: `2px solid ${axe.color}`, opacity: 0.3 }
                      }
                    />
                  ))}
                </div>

                {/* Compteur */}
                <span
                  className="text-xs font-bold min-w-[32px] text-right"
                  style={{ color: isComplete ? '#16A34A' : axe.color }}
                >
                  {isComplete ? `${axe.count}/2 ✓` : `${axe.count}/2`}
                </span>
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-1">
          <span className="text-xs text-[#6b7280]">Total validées</span>
          <span className="text-sm font-bold text-[#e5e5e5]">
            {totalActions} / {totalObjectif} actions min.
          </span>
        </div>

        {/* Alerte si en retard */}
        {tempsRestant.pourcentageEcoule > 50 && totalActions < totalObjectif / 2 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              ⚠️ <strong>Attention :</strong> Plus de la moitié de la période est écoulée.
              Pensez à valider vos actions restantes.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
