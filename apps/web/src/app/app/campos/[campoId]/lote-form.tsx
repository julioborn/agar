'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface LoteRow {
  id: string;
  campo_id: string;
  nombre: string;
  hectareas: number;
}

interface Props {
  campoId: string;
  loteEditando: LoteRow | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function LoteForm({ campoId, loteEditando, onSuccess, onCancel }: Props) {
  const [nombre, setNombre] = useState('');
  const [hectareas, setHectareas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNombre(loteEditando?.nombre ?? '');
    setHectareas(loteEditando?.hectareas?.toString() ?? '');
    setError(null);
  }, [loteEditando]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !hectareas) return;

    const ha = parseFloat(hectareas);
    if (isNaN(ha) || ha <= 0) {
      setError('Las hectáreas deben ser un número positivo.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payload = { nombre: nombre.trim(), hectareas: ha };

    const { error: dbError } = loteEditando
      ? await supabase.from('lotes').update(payload).eq('id', loteEditando.id)
      : await supabase.from('lotes').insert({ ...payload, campo_id: campoId });

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      if (!loteEditando) { setNombre(''); setHectareas(''); }
      onSuccess();
    }
  }

  const esEdicion = loteEditando !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del lote</label>
          <input
            type="text"
            placeholder="Ej: Lote 1 Norte"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            disabled={loading}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Hectáreas</label>
          <input
            type="number"
            step="0.0001"
            min="0.0001"
            placeholder="Ej: 45.50"
            value={hectareas}
            onChange={(e) => setHectareas(e.target.value)}
            required
            disabled={loading}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !nombre.trim() || !hectareas}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors"
        >
          <Check className="w-4 h-4" />
          {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear lote'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
