'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wheat, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const UNIDAD_LABEL: Record<string, string> = {
  kg: 'kg', tn: 'tn', m3: 'm³', bolsa_silaje: 'bolsas', fardo: 'fardos', litro: 'L', unidad: 'u.',
};

interface Props {
  cultivoId: string;
  hectareas: number | null;
  unidadProduccion: string;
  productoFinal: string | null;
  produccionActual: number | null;
  precioVentaActual: number | null;
  fechaCosechaActual: string | null;
  costoDirecto: number | null;
}

export default function RegistrarCosechaForm({
  cultivoId, hectareas, unidadProduccion, productoFinal,
  produccionActual, precioVentaActual, fechaCosechaActual, costoDirecto,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const unidadLabel = UNIDAD_LABEL[unidadProduccion] ?? unidadProduccion;

  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(fechaCosechaActual ?? todayISO);
  const [produccion, setProduccion] = useState(produccionActual?.toString() ?? '');
  const [precio, setPrecio] = useState(precioVentaActual?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const produccionNum = Number(produccion) || 0;
  const precioNum = Number(precio) || 0;
  const ingreso = produccionNum * precioNum;
  const margen = precio ? ingreso - (costoDirecto ?? 0) : null;
  const rendimiento = produccionNum && hectareas ? produccionNum / hectareas : null;

  const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const num = (n: number, d = 1) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!produccion || !fecha) return;
    setSaving(true);
    setError('');

    const { error: err } = await supabase
      .from('cultivos')
      .update({
        estado: 'cosechada',
        fecha_cosecha_real: fecha,
        produccion_total_kg: produccionNum,
        rendimiento_kg_ha: rendimiento,
        precio_venta_ars: precioNum || null,
        ingreso_bruto_ars: precio ? ingreso : null,
        margen_bruto_ars: margen,
      })
      .eq('id', cultivoId);

    setSaving(false);
    if (err) { setError(err.message); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className={cn(
      'bg-white rounded-2xl border overflow-hidden transition-all',
      open ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100',
    )}>
      {/* Header / trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
            open ? 'bg-[#006836] text-white' : 'bg-[#006836]/10',
          )}>
            <Wheat className={cn('w-4 h-4', open ? 'text-white' : 'text-[#006836]')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Registrar cosecha / recolección</p>
            <p className="text-xs text-zinc-400">
              {productoFinal
                ? <span className="text-zinc-500">{productoFinal} · en {unidadLabel}</span>
                : `Cantidad producida en ${unidadLabel}`}
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-400" />
          : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {/* Form expandido */}
      {open && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Cantidad producida ({unidadLabel})
              </label>
              <input type="number" min="0" step="0.01" placeholder="0"
                value={produccion} onChange={(e) => setProduccion(e.target.value)} required
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Precio de venta (ARS / {unidadLabel})
              </label>
              <input type="number" min="0" step="0.01" placeholder="Opcional"
                value={precio} onChange={(e) => setPrecio(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" />
            </div>
          </div>

          {/* Resumen en tiempo real */}
          {produccionNum > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 rounded-xl p-3">
              <div>
                <p className="text-xs text-zinc-400">Producción</p>
                <p className="text-sm font-bold text-zinc-700">{num(produccionNum, 2)} {unidadLabel}</p>
              </div>
              {rendimiento && (
                <div>
                  <p className="text-xs text-zinc-400">Rend./ha</p>
                  <p className="text-sm font-bold text-zinc-700">{num(rendimiento, 2)} {unidadLabel}/ha</p>
                </div>
              )}
              {precio && (
                <div>
                  <p className="text-xs text-zinc-400">Ingreso bruto</p>
                  <p className="text-sm font-bold text-zinc-700">{ars.format(ingreso)}</p>
                </div>
              )}
              {margen !== null && (
                <div>
                  <p className="text-xs text-zinc-400">Margen bruto</p>
                  <p className={cn('text-sm font-bold', margen >= 0 ? 'text-[#006836]' : 'text-red-500')}>
                    {ars.format(margen)}
                  </p>
                </div>
              )}
            </div>
          )}

          {costoDirecto != null && costoDirecto > 0 && (
            <p className="text-xs text-zinc-400">
              Costo directo acumulado: <span className="font-medium text-zinc-600">
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(costoDirecto)}
              </span>
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || !produccion || !fecha}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
              <CheckCircle className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Confirmar cosecha'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
