'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface CampoRow {
  id: string;
  nombre: string;
  hectareas_totales: number | null;
  lotes_count?: number;
}

interface Props {
  empresaId: string;
  campoEditando: CampoRow | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CampoForm({ empresaId, campoEditando, onSuccess, onCancel }: Props) {
  const [nombre, setNombre] = useState('');
  const [hectareas, setHectareas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNombre(campoEditando?.nombre ?? '');
    setHectareas(campoEditando?.hectareas_totales?.toString() ?? '');
    setError(null);
  }, [campoEditando]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      nombre: nombre.trim(),
      hectareas_totales: hectareas !== '' ? parseFloat(hectareas) : null,
    };

    const { error: dbError } = campoEditando
      ? await supabase.from('campos').update(payload).eq('id', campoEditando.id)
      : await supabase.from('campos').insert({ ...payload, empresa_id: empresaId });

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      if (!campoEditando) { setNombre(''); setHectareas(''); }
      onSuccess();
    }
  }

  const esEdicion = campoEditando !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del campo</label>
          <input
            type="text"
            placeholder="Ej: El Porvenir"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            disabled={loading}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Hectáreas totales</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Ej: 350"
            value={hectareas}
            onChange={(e) => setHectareas(e.target.value)}
            disabled={loading}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !nombre.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors"
        >
          <Check className="w-4 h-4" />
          {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear campo'}
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
