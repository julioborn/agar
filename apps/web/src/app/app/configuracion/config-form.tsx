'use client';

import { useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  empresaId: string;
  initialPrecio: number;
  initialTipo: string;
  initialCotizUsd: number | null;
  cotizBNA: number | null;
}

const TIPOS_COMBUSTIBLE = [
  { value: 'gasoil', label: 'Gasoil' },
  { value: 'nafta',  label: 'Nafta' },
  { value: 'gnc',    label: 'GNC (m³)' },
];

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function ConfigForm({ empresaId, initialPrecio, initialTipo, initialCotizUsd, cotizBNA }: Props) {
  const [precio,  setPrecio]  = useState(initialPrecio > 0 ? String(initialPrecio) : '');
  const [tipo,    setTipo]    = useState(initialTipo);
  const [cotizUsd, setCotizUsd] = useState(initialCotizUsd ? String(initialCotizUsd) : '');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!precio || Number(precio) <= 0) { setError('Ingresá un precio de combustible válido.'); return; }
    setSaving(true); setError(null);

    const cotizVal = cotizUsd && Number(cotizUsd) > 0 ? Number(cotizUsd) : null;

    const { error: err } = await createClient()
      .from('configuracion_empresa')
      .upsert({
        empresa_id: empresaId,
        precio_combustible: Number(precio),
        tipo_combustible: tipo,
        cotizacion_usd: cotizVal,
        cotizacion_usd_fecha: cotizVal ? new Date().toISOString().slice(0, 10) : null,
      }, { onConflict: 'empresa_id' });

    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-sm">

      {/* ── Combustible ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo de combustible</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={saving} className={field}>
            {TIPOS_COMBUSTIBLE.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Precio por litro / m³</label>
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
      </div>

      <hr className="border-zinc-100" />

      {/* ── Cotización USD ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Cotización USD manual (ARS por 1 USD)
          </label>
          <p className="text-xs text-zinc-400 mb-2">
            Si la dejás vacía, el sistema usa la tasa oficial BNA publicada automáticamente.
          </p>

          {/* Tasa BNA en tiempo real */}
          {cotizBNA != null && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700">
              <RefreshCw className="w-3 h-3 shrink-0" />
              Tasa BNA actual: <strong>${num.format(cotizBNA)}</strong>
              <button
                type="button"
                onClick={() => setCotizUsd(String(cotizBNA))}
                className="ml-auto underline hover:no-underline"
              >
                Usar esta
              </button>
            </div>
          )}

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
            <input
              type="number" inputMode="decimal" min="0" step="0.01"
              value={cotizUsd} onChange={(e) => setCotizUsd(e.target.value)}
              placeholder={cotizBNA ? `BNA: ${num.format(cotizBNA)}` : 'Ej: 1450,00'}
              disabled={saving}
              className={`${field} pl-7`}
            />
          </div>
          {cotizUsd && Number(cotizUsd) > 0 && (
            <button
              type="button"
              onClick={() => setCotizUsd('')}
              className="text-xs text-zinc-400 hover:text-red-500 mt-1 transition-colors"
            >
              Limpiar → volver a usar BNA automático
            </button>
          )}
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
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </form>
  );
}
