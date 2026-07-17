'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wheat, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useCurrency } from '@/lib/currency-context';

const UNIDAD_LABEL: Record<string, string> = {
  kg: 'kg', tn: 'tn', m3: 'm³', bolsa_silaje: 'bolsas', fardo: 'fardos', litro: 'L', unidad: 'u.',
};

interface Props {
  cultivoId: string;
  unidadProduccion: string;
  productoFinal: string | null;
  produccionActual: number | null;
  ingresoBrutoActual: number | null;
  margenBrutoActual: number | null;
  fechaCosechaActual: string | null;
}

export default function RegistrarCosechaForm({
  cultivoId, unidadProduccion, productoFinal,
  produccionActual, ingresoBrutoActual, margenBrutoActual, fechaCosechaActual,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { formatMoney } = useCurrency();
  const todayISO = new Date().toISOString().slice(0, 10);
  const unidadLabel = UNIDAD_LABEL[unidadProduccion] ?? unidadProduccion;

  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(fechaCosechaActual ?? todayISO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const num = (n: number, d = 1) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha) return;
    setSaving(true);
    setError('');

    const { error: err } = await supabase
      .from('cultivos')
      .update({ estado: 'cosechada', fecha_cosecha_real: fecha })
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
            <p className="text-sm font-semibold text-zinc-800">Cerrar cultivo</p>
            <p className="text-xs text-zinc-400">
              {productoFinal
                ? <span className="text-zinc-500">{productoFinal}</span>
                : 'Marcar como cosechado'}
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
          <p className="text-xs text-zinc-400">
            La producción y el ingreso bruto se cargan desde los Remitos Internos (RIA) de este cultivo.
            Acá solo se cierra el cultivo una vez que terminaste de cargar toda la cosecha.
          </p>

          {/* Resumen de solo lectura de lo acumulado vía RIA */}
          {(produccionActual != null || ingresoBrutoActual != null) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 rounded-xl p-3">
              {produccionActual != null && (
                <div>
                  <p className="text-xs text-zinc-400">Producción (RIA)</p>
                  <p className="text-sm font-bold text-zinc-700">{num(produccionActual, 2)} {unidadLabel}</p>
                </div>
              )}
              {ingresoBrutoActual != null && (
                <div>
                  <p className="text-xs text-zinc-400">Ingreso bruto (RIA)</p>
                  <p className="text-sm font-bold text-zinc-700">{formatMoney(ingresoBrutoActual)}</p>
                </div>
              )}
              {margenBrutoActual != null && (
                <div>
                  <p className="text-xs text-zinc-400">Margen bruto</p>
                  <p className={cn('text-sm font-bold', margenBrutoActual >= 0 ? 'text-[#006836]' : 'text-red-500')}>
                    {formatMoney(margenBrutoActual)}
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Fecha de cosecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || !fecha}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
              <CheckCircle className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Marcar como cosechado'}
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
