'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export const TIPOS_DEPOSITO = [
  { value: 'central',      label: 'Central' },
  { value: 'galpon_campo', label: 'Galpón de campo' },
] as const;

export interface DepositoRow {
  id: string;
  nombre: string;
  tipo: string;
  campo_id: string | null;
  campo?: { id: string; nombre: string } | null;
}

interface CampoOpcion { id: string; nombre: string }

interface Props {
  empresaId: string;
  campos: CampoOpcion[];
  depositoEditando: DepositoRow | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function DepositoForm({ empresaId, campos, depositoEditando, onSuccess, onCancel }: Props) {
  const [nombre, setNombre] = useState('');
  const [tipo,   setTipo]   = useState<string>('central');
  const [campoId, setCampoId] = useState('');
  const [error,  setError]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNombre(depositoEditando?.nombre ?? '');
    setTipo(depositoEditando?.tipo ?? 'central');
    setCampoId(depositoEditando?.campo_id ?? '');
    setError(null);
  }, [depositoEditando]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true); setError(null);

    const supabase = createClient();
    const payload = {
      nombre: nombre.trim(), tipo,
      campo_id: tipo === 'galpon_campo' && campoId ? campoId : null,
    };

    const { error: dbError } = depositoEditando
      ? await supabase.from('depositos').update(payload).eq('id', depositoEditando.id)
      : await supabase.from('depositos').insert({ ...payload, empresa_id: empresaId });

    setLoading(false);
    if (dbError) { setError(dbError.message); return; }
    if (!depositoEditando) { setNombre(''); setTipo('central'); setCampoId(''); }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del depósito</label>
          <input type="text" placeholder="Ej: Depósito Central" value={nombre}
            onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo</label>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); if (e.target.value !== 'galpon_campo') setCampoId(''); }}
            disabled={loading} className={field}>
            {TIPOS_DEPOSITO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {tipo === 'galpon_campo' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Campo asociado <span className="text-zinc-400 font-normal">(opcional)</span>
          </label>
          <select value={campoId} onChange={(e) => setCampoId(e.target.value)} disabled={loading} className={field}>
            <option value="">Sin campo asociado</option>
            {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading || !nombre.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
          <Check className="w-4 h-4" />
          {loading ? 'Guardando...' : depositoEditando ? 'Guardar cambios' : 'Crear depósito'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
