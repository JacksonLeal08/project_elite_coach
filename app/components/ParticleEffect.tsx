import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface ParticleEffectProps {
  onComplete: () => void;
}

export default function ParticleEffect({ onComplete }: ParticleEffectProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2500);
    return () => clearTimeout(t);
  }, [onComplete]);

  const particles = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
    y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
    size: Math.random() * 10 + 4,
    color: ['#d4af37', '#b5952f', '#00ff41'][Math.floor(Math.random() * 3)]
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 0, x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400 }}
          animate={{
            opacity: [1, 1, 0],
            scale: [0, 1.5, 0.5],
            x: p.x,
            y: p.y,
          }}
          transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
          className="absolute rounded-full shadow-[0_0_10px_currentColor]"
          style={{ width: p.size, height: p.size, backgroundColor: p.color, color: p.color }}
        />
      ))}
    </div>
  );
}
