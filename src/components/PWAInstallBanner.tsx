'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Bell, Compass, Download } from 'lucide-react';
import {
  subscribeInstallPrompt,
  triggerInstallPrompt,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa/installPrompt';

type BannerMode = 'safari' | 'chrome' | 'android' | null;

export default function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<BannerMode>(null);
  // Event natif Android capturé (potentiellement avant le montage via le module
  // de capture précoce). null = repli (webview, SW non enregistré, déjà installé).
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const bannerMode = checkShouldShowBanner();
    if (bannerMode) {
      setMode(bannerMode);
      setShowBanner(true);
      setTimeout(() => setIsVisible(true), 100);
    }
  }, []);

  // Android : on s'abonne à l'event `beforeinstallprompt` (capturé tôt par le
  // module) et on masque le banner dès que l'app est installée.
  useEffect(() => {
    const unsubscribe = subscribeInstallPrompt(setDeferredPrompt);
    const onInstalled = () => hideBanner();
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const checkShouldShowBanner = (): BannerMode => {
    if (typeof window === 'undefined') return null;

    // Vérifier si déjà en mode standalone (PWA installée) — couvre iOS & Android
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return null;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    if (!isIOS && !isAndroid) return null;

    // Vérifier si l'utilisateur a déjà fermé le banner récemment.
    // Exception assumée : seul write/read localStorage du composant, pour le
    // "ne plus afficher 7j". La branche Android n'ajoute aucun storage.
    const dismissedAt = localStorage.getItem('pwa_banner_dismissed');
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return null;
    }

    // Android : install native via beforeinstallprompt (ou repli).
    if (isAndroid) return 'android';

    // Détecter si c'est Chrome sur iOS (CriOS dans le user agent)
    const isChrome = /CriOS/.test(ua);
    if (isChrome) return 'chrome';

    // Détecter si c'est Safari
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    if (isSafari) return 'safari';

    // Autres navigateurs iOS (Firefox, Edge, etc.)
    return 'chrome'; // Même message que Chrome
  };

  // Masque le banner sans enregistrer de dismiss (install réussie / appinstalled).
  const hideBanner = () => {
    setIsVisible(false);
    setTimeout(() => setShowBanner(false), 300);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_banner_dismissed', new Date().toISOString());
    setTimeout(() => setShowBanner(false), 300);
  };

  const handleInstall = async () => {
    const outcome = await triggerInstallPrompt();
    if (outcome === 'accepted') hideBanner();
  };

  const copyUrlToClipboard = async (target: string) => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      alert(`Lien copié ! Colle-le dans ${target}.`);
    } catch {
      // Fallback (clipboard API indisponible / contexte non sécurisé)
      const textArea = document.createElement('textarea');
      textArea.value = window.location.origin;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Lien copié ! Colle-le dans ${target}.`);
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
          <div className="mb-3 text-sm space-y-1">
            <p className="flex items-center gap-2 text-gray-700">
              <span className="text-base">📲</span>
              <strong>Retrouve DentalLearn sur ton écran d&apos;accueil</strong>
            </p>
            <p className="flex items-center gap-2 text-gray-700">
              <Bell className="w-4 h-4 text-accent" />
              et reçois tes rappels quotidiens
            </p>
          </div>

          {mode === 'android' ? (
            /* ========== MODE ANDROID (Chrome) ========== */
            deferredPrompt ? (
              /* Install native 1 tap via beforeinstallprompt */
              <button
                onClick={handleInstall}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Installer DentalLearn
              </button>
            ) : (
              /* Repli : webview (Gmail/Insta) ou SW non enregistré */
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Ouvre dans Chrome</strong> pour installer l&apos;app sur ton téléphone
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Compass className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-sm text-gray-700">
                    Ouvre <strong>Chrome</strong> et va sur app.dentalschool.fr
                  </p>
                </div>

                <button
                  onClick={() => copyUrlToClipboard('Chrome')}
                  className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium rounded-lg text-sm transition-colors"
                >
                  📋 Copier le lien
                </button>
              </div>
            )
          ) : mode === 'chrome' ? (
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
                  Ouvre <strong>Safari</strong> et va sur app.dentalschool.fr
                </p>
              </div>

              <button
                onClick={() => copyUrlToClipboard('Safari')}
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
                  Appuie sur <strong>Partager</strong> <span className="text-xs">(icône en bas)</span>
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
