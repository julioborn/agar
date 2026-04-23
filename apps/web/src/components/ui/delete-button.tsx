'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onDelete: () => Promise<void>;
  confirmLabel?: string;
}

export default function DeleteButton({ onDelete, confirmLabel = '¿Confirmar?' }: Props) {
  const [estado, setEstado] = useState<'idle' | 'confirm' | 'loading'>('idle');

  async function handleClick() {
    if (estado === 'idle') {
      setEstado('confirm');
      // Auto-reset si el usuario no confirma en 3 segundos
      setTimeout(() => setEstado((s) => (s === 'confirm' ? 'idle' : s)), 3000);
    } else if (estado === 'confirm') {
      setEstado('loading');
      try {
        await onDelete();
      } finally {
        setEstado('idle');
      }
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={estado === 'loading'}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        estado === 'confirm'
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
      )}
    >
      <Trash2 className="w-3 h-3 shrink-0" />
      {estado === 'loading' ? 'Eliminando...' : estado === 'confirm' ? confirmLabel : 'Eliminar'}
    </button>
  );
}
