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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{periode.debut.getFullYear()}</span>
            <span className="font-medium text-gray-700">
              {tempsRestant.ans > 0
                ? `${tempsRestant.ans} an${tempsRestant.ans > 1 ? 's' : ''} ${tempsRestant.moisRestants > 0 ? `et ${tempsRestant.moisRestants} mois` : ''} restants`
                : `${tempsRestant.mois} mois restants`
              }
            </span>
            <span>{periode.fin.getFullYear()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] rounded-full transition-all duration-500"
              style={{ width: `${tempsRestant.pourcentageEcoule}%` }}
            />
          </div>
        </div>

        {/* Compteurs par axe */}
        <div className="grid grid-cols-2 gap-2">
          {axes.map((axe) => {
            const isComplete = axe.count >= OBJECTIF_PAR_AXE;
            return (
              <div
                key={axe.id}
                className={`rounded-xl p-3 border ${
                  isComplete
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{axe.icon}</span>
                  <span className="text-xs font-medium text-gray-700 truncate">
                    {axe.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-xl font-bold"
                    style={{ color: isComplete ? '#16A34A' : axe.color }}
                  >
                    {axe.count}
                  </span>
                  <span className="text-xs text-gray-400">/ {OBJECTIF_PAR_AXE}</span>
                  {isComplete && <span className="text-green-500 text-sm ml-1">✓</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Total actions validées</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900">{totalActions}</span>
            <span className="text-xs text-gray-400">/ {totalObjectif} min.</span>
          </div>
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
  );
}
