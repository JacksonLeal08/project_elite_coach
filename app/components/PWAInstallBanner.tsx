'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, Sparkles, CheckCircle2 } from 'lucide-react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    // 1. Verificar se já está rodando como PWA Instalado
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Verificar se o usuário já dispensou o banner nos últimos 7 dias
    const dismissedTimestamp = localStorage.getItem('elite_coach_pwa_dismissed');
    if (dismissedTimestamp) {
      const daysDiff = (Date.now() - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60 * 24);
      if (daysDiff < 7) {
        return;
      }
    }

    // 3. Detectar se é dispositivo iOS / Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // 4. Capturar evento de instalação do Chrome / Android
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // No iOS, se não estiver em standalone, podemos exibir o banner explicativo após 2 segundos
    if (isIOSDevice && !isStandalone) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem('elite_coach_pwa_dismissed', Date.now().toString());
  };

  if (!showBanner || isInstalled) return null;

  return (
    <>
      {/* Banner Flutuante Inferior */}
      <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-8 md:w-96 z-[95] animate-in slide-in-from-bottom duration-300">
        <div className="bg-surface-container/95 backdrop-blur-md border-2 border-primary/40 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative flex flex-col gap-3">
          
          {/* Botão Fechar */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-surface-high transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 text-primary shadow-[0_0_12px_rgba(212,175,55,0.2)]">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>

            <div className="flex-1 pr-4">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Instalar Aplicativo</h4>
                <span className="text-[8px] bg-primary text-black font-bold px-1.5 py-0.2 rounded uppercase">App</span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-1 leading-snug">
                Instale o **Elite Coach** no seu celular para acessar seus treinos instantaneamente na academia, mesmo offline!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-primary to-primary-dim text-black font-extrabold uppercase tracking-wider text-[11px] rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              {isIOS ? 'Como Instalar no iPhone' : 'Instalar Agora'}
            </button>
            <button
              onClick={handleDismiss}
              className="py-2.5 px-3 bg-surface-high hover:bg-surface-highest text-zinc-400 hover:text-zinc-200 text-[10px] font-bold uppercase rounded-xl transition-colors shrink-0"
            >
              Depois
            </button>
          </div>
        </div>
      </div>

      {/* Modal Guia do iOS (Safari) */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container border-2 border-primary/40 rounded-2xl p-6 max-w-sm w-full space-y-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-surface-high transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto text-primary shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider">Instalar no iPhone</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Siga estes 2 passos simples no seu navegador **Safari** para adicionar o app à sua tela inicial:
              </p>
            </div>

            <div className="space-y-3 bg-surface-high/40 p-4 rounded-xl border border-surface-highest/40 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-xs border border-primary/30">
                  1
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    Toque em Compartilhar <Share className="w-4 h-4 text-primary inline" />
                  </p>
                  <p className="text-[11px] text-zinc-400">Na barra inferior do seu Safari do iPhone.</p>
                </div>
              </div>

              <div className="w-full h-[1px] bg-surface-highest/30" />

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-xs border border-primary/30">
                  2
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    "Adicionar à Tela de Início" <PlusSquare className="w-4 h-4 text-primary inline" />
                  </p>
                  <p className="text-[11px] text-zinc-400">Role o menu para baixo e selecione esta opção.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-3 bg-primary text-black font-extrabold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-primary-dim transition-colors shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" /> Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
