'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface UnidadRow {
  id: string; nombre: string; tipo: string; descripcion: string | null; activa: boolean;
}

const TIPOS = [
  { value: 'agricultura', label: 'Agricultura' },
  { value: 'ganaderia',   label: 'Ganadería' },
  { value: 'tambo',       label: 'Tambo' },
  { value: 'apicultura',  label: 'Apicultura' },
  { value: 'forestal',    label: 'Forestal' },
  { value: 'otro',        label: 'Otro' },
] as const;

interface Props {
  empresaId: string; unidadEditando: UnidadRow | null;
  onSuccess: () => void; onCancel: () => void;
}

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function UnidadForm({ empresaId, unidadEditando, onSuccess, onCancel }: Props) {
  const [nombre,      setNombre]     = useState('');
  const [tipo,        setTipo]       = useState<string>('agricultura');
  const [descripcion, setDescripcion] = useState('');
  const [activa,      setActiva]     = useState(true);
  const [error,  setError]  = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (unidadEditando) {
      setNombre(unidadEditando.nombre); setTipo(unidadEditando.tipo);
      setDescripcion(unidadEditando.descripcion ?? ''); setActiva(unidadEditando.activa);
    } else {
      setNombre(''); setTipo('agricultura'); setDescripcion(''); setActiva(true);
    }
    setError('');
  }, [unidadEditando]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    setLoading(true); setError('');

    const payload = { empresa_id: empresaId, nombre: nombre.trim(), tipo, descripcion: descripcion.trim() || null, activa };
    let err;
    if (unidadEditando) {
      ({ error: err } = await createClient().from('unidades_negocio').update(payload).eq('id', unidadEditando.id));
    } else {
      ({ error: err } = await createClient().from('unidades_negocio').insert(payload));
    }

    setLoading(false);
    if (err) { setError(err.message); return; }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre</label>
          <input type="text" placeholder="Ej: Agricultura Empresa X" value={nombre}
            onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={loading} className={field}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Descripción <span className="text-zinc-400 font-normal">(opcional)</span></label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
          placeholder="Descripción breve…" disabled={loading}
          className={`${field} resize-none`} />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)}
          disabled={loading} className="w-4 h-4 rounded border-zinc-300 accent-[#006836]" />
        <span className="text-sm text-zinc-600 group-hover:text-zinc-800 transition-colors">Unidad activa</span>
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading || !nombre.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
          <Check className="w-4 h-4" />
          {loading ? 'Guardando...' : unidadEditando ? 'Guardar cambios' : 'Crear unidad'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
