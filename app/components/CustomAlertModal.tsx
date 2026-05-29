import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import { AlertCircle, CheckCircle, Info, HelpCircle } from 'lucide-react';

interface CustomAlertModalProps {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  title: string;
  message?: string;
  recordName?: string;
  currentUser?: User | null;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function CustomAlertModal({
  isOpen,
  type,
  title,
  message,
  recordName,
  currentUser,
  onClose,
  onConfirm,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
}: CustomAlertModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      const playSyntheticSound = () => {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContext) return;
          const ctx = new AudioContext();
          
          // First note (warm mid)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(550, ctx.currentTime);
          gain1.gain.setValueAtTime(0.06, ctx.currentTime);
          gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          
          // Second note (bright high, delayed)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(780, ctx.currentTime + 0.08);
          gain2.gain.setValueAtTime(0, ctx.currentTime);
          gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.08);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          
          osc1.start();
          osc1.stop(ctx.currentTime + 0.09);
          
          osc2.start(ctx.currentTime + 0.08);
          osc2.stop(ctx.currentTime + 0.26);
        } catch (e) {
          console.warn("Failed to play synthetic sound:", e);
        }
      };

      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.3;
        audio.play().catch((err) => {
          playSyntheticSound();
        });
      } catch (e) {
        playSyntheticSound();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Header gradient decoration based on modal type
  const getHeaderGradient = () => {
    switch (type) {
      case 'success':
        return 'from-green-500 to-emerald-400';
      case 'error':
        return 'from-red-600 to-rose-500';
      case 'warning':
      case 'confirm':
        return 'from-amber-500 to-yellow-400';
      case 'info':
      default:
        return 'from-primary to-primary-dim';
    }
  };

  // Icon based on type
  const getIcon = () => {
    const iconClass = "w-6 h-6 shrink-0";
    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-emerald-400`} />;
      case 'error':
        return <AlertCircle className={`${iconClass} text-red-400`} />;
      case 'warning':
        return <AlertCircle className={`${iconClass} text-amber-400`} />;
      case 'confirm':
        return <HelpCircle className={`${iconClass} text-yellow-400`} />;
      case 'info':
      default:
        return <Info className={`${iconClass} text-primary`} />;
    }
  };

  // Customized text for delete confirmations or generic messages
  const getBodyContent = () => {
    if (type === 'confirm' && recordName) {
      return (
        <p className="text-zinc-300 text-xs leading-relaxed">
          Olá <span className="font-bold text-white">{currentUser?.name || 'Treinador'}</span>, você está prestes a excluir/remover o registro <span className="font-bold text-[#d4af37]">{recordName}</span>.
          <br /><br />
          <span className="text-red-400 font-bold">⚠️ Esta ação é permanente e não poderá ser desfeita.</span> Tem certeza que deseja continuar?
        </p>
      );
    }
    return <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-line">{message}</p>;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden"
        >
          {/* Top colored indicator bar */}
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${getHeaderGradient()}`} />
          
          <div className="flex gap-3 items-start mb-4">
            {getIcon()}
            <h3 className="text-base font-heading font-bold text-white pt-0.5 leading-tight">{title}</h3>
          </div>

          <div className="mb-6">
            {getBodyContent()}
          </div>

          <div className="flex justify-end gap-2 text-xs">
            {onConfirm ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-surface border border-surface-highest text-zinc-400 font-bold uppercase tracking-wider text-[10px] rounded hover:text-white transition-colors"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`px-4 py-2 font-bold uppercase tracking-wider text-[10px] rounded transition-colors ${
                    type === 'confirm'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                      : 'bg-primary text-black hover:bg-primary-dim'
                  }`}
                >
                  {confirmText}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-primary text-black font-bold uppercase tracking-wider text-[10px] rounded hover:bg-primary-dim transition-colors"
              >
                OK
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
