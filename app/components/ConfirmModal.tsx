import React from 'react';
import { motion } from 'framer-motion';
import { User } from '../types';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userTarget: any;
  currentUser: User | null;
}

export default function ConfirmModal({ isOpen, onClose, onConfirm, userTarget, currentUser }: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        <h3 className="text-xl font-heading font-bold text-white mb-4">Confirmar Exclusão</h3>
        
        <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
          Olá <span className="font-bold text-white">{currentUser?.name || 'Treinador'}</span>, você está prestes a remover o registro <span className="font-bold text-red-400">{userTarget?.name || userTarget?.student || 'selecionado'}</span>. Esta ação não poderá ser desfeita. Tem certeza?
        </p>

        <div className="flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 bg-surface text-zinc-300 font-bold uppercase tracking-wider text-[11px] rounded hover:text-white transition-colors">Cancelar</button>
           <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/30 font-bold uppercase tracking-wider text-[11px] rounded hover:bg-red-500/20 transition-colors">Sim, Remover</button>
        </div>
      </motion.div>
    </div>
  );
}
