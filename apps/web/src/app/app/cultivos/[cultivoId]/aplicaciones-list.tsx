'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';
import { eliminarAplicacion } from '../actions';

const TIPO_COLOR: Record<string, string> = {
  fitosanitaria: 'bg-orange-100 text-orange-700',
  fertilizacion: 'bg-blue-100 text-blue-700',
  siembra:       'bg-[#006836]/10 text-[#006836]',
  otro:          'bg-zinc-100 text-zinc-600',
};
const TIPO_LABEL: Record<string, string> = {
  fitosanitaria: 'Fitosanitaria',
  fertilizacion: 'Fertilización',
  siembra:       'Siembra',
  otro:          'Otro',
};

interface Item {
  id: string;
  cantidad_retirada: number;
  cantidad_aplicada: number;
  cantidad_perdida: number;
  causa_perdida: string | null;
  costo_imputado_ars: number;
  costo_perdida_ars: number;
  producto: { nombre: string; unidad_base: string } | null;
  deposito: { nombre: string } | null;
}

interface Aplicacion {
  id: string;
  fecha: string;
  tipo: string;
  observaciones: string | null;
  aplicaciones_items: Item[];
}

interface Props {
  aplicaciones: Aplicacion[];
  cultivoId: string;
  costoTotal: number;
  editable?: boolean;
}

const num = (n: number | null, d = 4) => n != null ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n) : '—';
const fmtFecha = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function AplicacionesList({ aplicaciones, cultivoId, costoTotal, editable }: Props) {
  const router = useRouter();
  const { formatMoney } = useCurrency();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [eliminando, setEliminando] = useState<string | null>(null);

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleEliminar(id: string) {
    if (!confirm('¿Eliminar esta aplicación? El stock se revertirá automáticamente.')) return;
    setEliminando(id);
    const result = await eliminarAplicacion(id, cultivoId);
    setEliminando(null);
    if (result.error) { alert('Error: ' + result.error); return; }
    router.refresh();
  }

  if (aplicaciones.length === 0) return null;

  return (
    <div className="space-y-2">
      {aplicaciones.map((aplic) => {
        const open = abiertos.has(aplic.id);
        const total = aplic.aplicaciones_items.reduce((acc, it) => acc + Number(it.costo_imputado_ars ?? 0), 0);

        return (
          <div key={aplic.id} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
            {/* Header clickeable */}
            <button
              onClick={() => toggle(aplic.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn('shrink-0 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold', TIPO_COLOR[aplic.tipo] ?? 'bg-zinc-100 text-zinc-600')}>
                  {TIPO_LABEL[aplic.tipo] ?? aplic.tipo}
                </span>
                <span className="text-sm font-medium text-zinc-700 truncate">{fmtFecha(aplic.fecha)}</span>
                <span className="hidden sm:inline text-xs text-zinc-400">
                  {aplic.aplicaciones_items.length} producto{aplic.aplicaciones_items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-zinc-800">{formatMoney(total)}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleEliminar(aplic.id); }}
                    disabled={eliminando === aplic.id}
                    className="p-1 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Eliminar aplicación"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {open
                  ? <ChevronUp className="w-4 h-4 text-zinc-400" />
                  : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </div>
            </button>

            {/* Detalle expandido */}
            {open && (
              <div className="border-t border-zinc-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-zinc-400 text-xs">Producto</th>
                        <th className="text-left px-4 py-2.5 font-medium text-zinc-400 text-xs">Depósito</th>
                        <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Aplicado</th>
                        <th className="text-right px-4 py-2.5 font-medium text-orange-400 text-xs">Desvío</th>
                        <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Costo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {aplic.aplicaciones_items.map((it) => {
                        const perdida = Number(it.cantidad_perdida ?? 0);
                        return (
                          <tr key={it.id} className={perdida > 0 ? 'bg-orange-50/40' : ''}>
                            <td className="px-4 py-2.5 font-medium text-zinc-800">{it.producto?.nombre}</td>
                            <td className="px-4 py-2.5 text-zinc-400 text-xs">{it.deposito?.nombre}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-600">
                              {num(it.cantidad_aplicada, 3)} <span className="text-zinc-400 text-xs">{it.producto?.unidad_base}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {perdida > 0 ? (
                                <span className="text-xs font-semibold text-orange-500">
                                  {num(perdida, 3)} {it.producto?.unidad_base}
                                  {it.causa_perdida && <span className="block font-normal text-orange-400">{it.causa_perdida}</span>}
                                </span>
                              ) : <span className="text-zinc-200 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-zinc-800">
                              {formatMoney(it.costo_imputado_ars ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {aplic.observaciones && (
                  <p className="px-5 py-2 text-xs text-zinc-400 border-t border-zinc-50 italic">{aplic.observaciones}</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Total acumulado */}
      <div className="flex justify-between items-center px-5 py-3 bg-zinc-900 rounded-2xl">
        <span className="text-sm font-medium text-zinc-400">Costo directo total acumulado</span>
        <span className="text-lg font-bold text-white">{formatMoney(costoTotal)}</span>
      </div>
    </div>
  );
}
