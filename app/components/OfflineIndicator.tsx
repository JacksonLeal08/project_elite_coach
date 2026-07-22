'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [showRestored, setShowRestored] = useState<boolean>(false);

  useEffect(() => {
    // Definir estado inicial
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300 pointer-events-none">
      {isOffline ? (
        <div className="bg-amber-950/90 border border-amber-500/50 text-amber-200 px-4 py-2 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md flex items-center gap-2.5 text-xs font-medium">
          <WifiOff className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          <span>Você está offline. Exibindo dados salvos em cache.</span>
        </div>
      ) : showRestored ? (
        <div className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-2 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md flex items-center gap-2.5 text-xs font-medium">
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Conexão reestabelecida. Dados sincronizados!</span>
        </div>
      ) : null}
    </div>
  );
}
