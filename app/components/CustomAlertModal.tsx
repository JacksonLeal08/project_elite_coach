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
  const [isDisintegrating, setIsDisintegrating] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setIsDisintegrating(false);
    }
  }, [isOpen]);

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

  // Thanos Snap Sound Synthesis
  const synthesizeThanosSnap = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // 1. SNAP (Click)
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(1200, now);
      snapOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
      
      snapGain.gain.setValueAtTime(0.25, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      snapOsc.connect(snapGain);
      snapGain.connect(ctx.destination);
      snapOsc.start(now);
      snapOsc.stop(now + 0.09);

      // 2. ASH WIND (Disintegration noise)
      const bufferSize = ctx.sampleRate * 1.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 1.4);
      filter.Q.setValueAtTime(4, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.12, now + 0.1);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      noiseNode.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noiseNode.start(now);
      noiseNode.stop(now + 1.5);
    } catch (error) {
      console.warn("Failed to play synthesized sound:", error);
    }
  };

  const playThanosSound = () => {
    try {
      const audio = new Audio('/snap.mp3');
      audio.volume = 0.4;
      audio.play().catch(() => {
        synthesizeThanosSnap();
      });
    } catch (e) {
      synthesizeThanosSnap();
    }
  };

  // Particles Canvas Effect
  React.useEffect(() => {
    if (!isDisintegrating || !canvasRef.current || !cardRef.current) return;
    const canvas = canvasRef.current;
    const card = cardRef.current;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = card.getBoundingClientRect();
    const particleCount = 450;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
      delay: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const px = rect.left + Math.random() * rect.width;
      const py = rect.top + Math.random() * rect.height;
      
      const vx = (Math.random() * 1.5) + 0.5;
      const vy = -(Math.random() * 1.5 + 0.5);
      const size = Math.random() * 3 + 0.8;
      
      const isGold = Math.random() > 0.6;
      const color = isGold 
        ? (Math.random() > 0.5 ? '#d4af37' : '#f3e5ab')
        : (Math.random() > 0.5 ? '#9ca3af' : '#4b5563');

      const normY = (rect.bottom - py) / rect.height;
      const delay = normY * 350 + Math.random() * 150;

      particles.push({
        x: px,
        y: py,
        vx,
        vy,
        size,
        color,
        alpha: 1,
        decay: Math.random() * 0.012 + 0.008,
        delay
      });
    }

    let startTime = performance.now();
    let animationFrameId: number;

    const render = (time: number) => {
      const elapsed = time - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let activeParticles = 0;
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (elapsed < p.delay) {
          activeParticles++;
          continue;
        }
        
        if (p.alpha > 0) {
          p.x += p.vx;
          p.y += p.vy;
          
          p.vx += (Math.random() - 0.3) * 0.05;
          p.vy += (Math.random() - 0.5) * 0.02;
          
          p.alpha -= p.decay;
          
          if (p.alpha > 0) {
            activeParticles++;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
      
      if (activeParticles > 0 && elapsed < 1600) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDisintegrating]);

  const handleConfirm = () => {
    if (isDisintegrating) return;
    if (type === 'confirm') {
      setIsDisintegrating(true);
      playThanosSound();
      setTimeout(() => {
        if (onConfirm) onConfirm();
        onClose();
      }, 1500);
    } else {
      if (onConfirm) onConfirm();
      onClose();
    }
  };

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
        {isDisintegrating && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-[101]"
          />
        )}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={isDisintegrating ? {
            opacity: 0,
            scale: 0.85,
            x: [0, -3, 3, -3, 3, 5, 8, 15],
            y: [0, 2, -2, 2, -2, -5, -8, -12],
            filter: "blur(6px) grayscale(80%)",
            transition: { duration: 1.5, ease: "easeOut" }
          } : {
            opacity: 1,
            scale: 1,
            y: 0,
            x: 0,
            filter: "blur(0px) grayscale(0%)"
          }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`bg-surface-container border border-surface-highest rounded-xl p-6 max-w-sm w-full shadow-2xl relative ${
            isDisintegrating ? 'overflow-visible' : 'overflow-hidden'
          }`}
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
                  disabled={isDisintegrating}
                  className="px-4 py-2 bg-surface border border-surface-highest text-zinc-400 font-bold uppercase tracking-wider text-[10px] rounded hover:text-white transition-colors disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isDisintegrating}
                  className={`px-4 py-2 font-bold uppercase tracking-wider text-[10px] rounded transition-colors disabled:opacity-50 ${
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
                disabled={isDisintegrating}
                className="px-5 py-2 bg-primary text-black font-bold uppercase tracking-wider text-[10px] rounded hover:bg-primary-dim transition-colors disabled:opacity-50"
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
