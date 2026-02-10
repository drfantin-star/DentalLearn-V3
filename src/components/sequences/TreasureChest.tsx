'use client';

import { useState } from 'react';
import confetti from 'canvas-confetti';

interface TreasureChestProps {
  pdfUrl?: string | null;
  onOpen?: () => void;
}

export default function TreasureChest({ pdfUrl, onOpen }: TreasureChestProps) {
  const [isOpened, setIsOpened] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleOpenChest = () => {
    if (isOpened || isAnimating) return;

    setIsAnimating(true);

    // Animation de tremblement avant ouverture
    setTimeout(() => {
      setIsOpened(true);

      // Confettis dores !
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF8C00', '#DAA520', '#F4A460']
      });

      // Deuxieme salve
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#FFA500', '#2D1B96', '#00D1C1']
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#FFA500', '#2D1B96', '#00D1C1']
        });
      }, 200);

      setIsAnimating(false);
      onOpen?.();
    }, 600);
  };

  const handleDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Coffre */}
      <button
        onClick={handleOpenChest}
        disabled={isOpened}
        className={`relative transition-all duration-300 ${
          isAnimating ? 'animate-wiggle' : ''
        } ${isOpened ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
      >
        <div className={`text-7xl transition-all duration-500 ${
          isOpened ? 'scale-110' : ''
        }`}>
          {isOpened ? '🎁' : '🎁'}
        </div>

        {/* Lueur doree */}
        {isOpened && (
          <div className="absolute inset-0 -z-10 animate-pulse">
            <div className="absolute inset-0 bg-yellow-400/30 blur-xl rounded-full" />
          </div>
        )}

        {/* Particules brillantes avant ouverture */}
        {!isOpened && (
          <div className="absolute -top-1 -right-1">
            <span className="text-xl animate-bounce">&#10024;</span>
          </div>
        )}
      </button>

      {/* Texte et CTA */}
      {!isOpened ? (
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800 mb-1">
            Tu as débloqué une récompense !
          </p>
          <button
            onClick={handleOpenChest}
            className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 mx-auto"
          >
            <span>&#128275;</span>
            <span>Ouvrir le coffre</span>
          </button>
        </div>
      ) : (
        <div className="text-center animate-fadeIn">
          <p className="text-lg font-bold text-gray-800 mb-1">
            &#127881; Bravo ! Voici ta fiche mémo
          </p>
          <p className="text-sm text-gray-500 mb-3">
            À garder précieusement !
          </p>
          {pdfUrl && (
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 mx-auto"
            >
              <span>&#128196;</span>
              <span>Télécharger ma fiche</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
