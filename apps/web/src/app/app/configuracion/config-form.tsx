'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  empresaId: string;
  initialPrecio: number;
  initialTipo: string;
}

const TIPOS_COMBUSTIBLE = [
  { value: 'gasoil',  label: 'Gasoil' },
  { value: 'nafta',   label: 'Nafta' },
  { value: 'gnc',     label: 'GNC (m³)' },
];

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function ConfigForm({ empresaId, initialPrecio, initialTipo }: Props) {
  const [precio, setPrecio] = useState(initialPrecio > 0 ? String(initialPrecio) : '');
  const [tipo,   setTipo]   = useState(initialTipo);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!precio || Number(precio) <= 0) { setError('Ingresá un precio válido.'); return; }
    setSaving(true); setError(null);

    const { error: err } = await createClient()
      .from('configuracion_empresa')
      .upsert({
        empresa_id: empresaId,
        precio_combustible: Number(precio),
        tipo_combustible: tipo,
      }, { onConflict: 'empresa_id' });

    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo de combustible</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={saving} className={field}>
          {TIPOS_COMBUSTIBLE.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          Precio por litro / m³
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
          <input
            type="number" inputMode="decimal" min="0" step="0.001"
            value={precio} onChange={(e) => setPrecio(e.target.value)}
            placeholder="0.000" disabled={saving}
            className={`${field} pl-7`}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {saved && (
        <p className="text-xs text-[#006836] flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Configuración guardada.
        </p>
      )}
      <button
        type="submit" disabled={saving || !precio}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors"
      >
        <Check className="w-4 h-4" />
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
