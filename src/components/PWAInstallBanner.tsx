'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Bell, Compass } from 'lucide-react';

type BannerMode = 'safari' | 'chrome' | null;

export default function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<BannerMode>(null);

  useEffect(() => {
    const bannerMode = checkShouldShowBanner();
    if (bannerMode) {
      setMode(bannerMode);
      setShowBanner(true);
      setTimeout(() => setIsVisible(true), 100);
    }
  }, []);

  const checkShouldShowBanner = (): BannerMode => {
    if (typeof window === 'undefined') return null;

    // Vérifier si c'est iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return null;

    // Vérifier si déjà en mode standalone (PWA installée)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return null;

    // Vérifier si l'utilisateur a déjà fermé le banner récemment
    const dismissedAt = localStorage.getItem('pwa_banner_dismissed');
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return null;
    }

    // Détecter si c'est Chrome sur iOS (CriOS dans le user agent)
    const isChrome = /CriOS/.test(navigator.userAgent);
    if (isChrome) return 'chrome';

    // Détecter si c'est Safari
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
    if (isSafari) return 'safari';

    // Autres navigateurs iOS (Firefox, Edge, etc.)
    return 'chrome'; // Même message que Chrome
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_banner_dismissed', new Date().toISOString());
    setTimeout(() => setShowBanner(false), 300);
  };

  const copyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      alert('Lien copié ! Collez-le dans Safari.');
    } catch {
      // Fallback pour iOS
      const textArea = document.createElement('textarea');
      textArea.value = window.location.origin;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Lien copié ! Collez-le dans Safari.');
    }
  };

  if (!showBanner || !mode) return null;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-40 transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-primary to-accent px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-lg">📱</span>
            </div>
            <span className="text-white font-semibold">Installer DentalLearn</span>
          </div>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenu */}
        <div className="px-4 py-4">
          {/* Avantage principal */}
          <div className="flex items-center gap-2 mb-3 text-sm">
            <Bell className="w-4 h-4 text-accent" />
            <span className="text-gray-700">
              <strong>Recevez les notifications</strong> de rappel quotidien
            </span>
          </div>

          {mode === 'chrome' ? (
            /* ========== MODE CHROME/AUTRES NAVIGATEURS iOS ========== */
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Safari requis</strong> pour installer l&apos;app sur iPhone
              </p>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Compass className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-sm text-gray-700">
                  Ouvrez <strong>Safari</strong> et allez sur dental-learn-v3.vercel.app
                </p>
              </div>

              <button
                onClick={copyUrlToClipboard}
                className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium rounded-lg text-sm transition-colors"
              >
                📋 Copier le lien
              </button>
            </div>
          ) : (
            /* ========== MODE SAFARI ========== */
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-500 font-medium mb-2">Comment installer :</p>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Share className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-gray-700">
                  Appuyez sur <strong>Partager</strong> <span className="text-xs">(icône en bas)</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PlusSquare className="w-4 h-4 text-accent" />
                </div>
                <p className="text-sm text-gray-700">
                  Puis <strong>&quot;Sur l&apos;écran d&apos;accueil&quot;</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
