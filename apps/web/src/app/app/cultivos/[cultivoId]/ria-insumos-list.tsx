'use client';

import Link from 'next/link';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';

const num = (n: number, d = 3) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n);
const fmtFecha = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

interface Insumo {
  id: string;
  cantidad: number;
  dosis_por_ha: number | null;
  costo_unitario: number;
  subtotal: number;
  producto: { nombre: string; unidad_base: string } | null;
  deposito: { nombre: string } | null;
}

export interface RiaConInsumos {
  id: string;
  numero_ria: string;
  fecha: string;
  observaciones: string | null;
  superficie_afectada: number | null;
  remitos_insumos: Insumo[];
}

interface Props {
  rias: RiaConInsumos[];
}

export default function RiaInsumosList({ rias }: Props) {
  const { formatMoney } = useCurrency();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (rias.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Vía Remito Interno (RIA)</span>
        <span className="text-xs text-zinc-300">{rias.length} remito{rias.length !== 1 ? 's' : ''}</span>
      </div>

      {rias.map((ria) => {
        const open = abiertos.has(ria.id);
        const totalRia = ria.remitos_insumos.reduce((acc, i) => acc + Number(i.subtotal ?? 0), 0);

        return (
          <div key={ria.id} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
            <button
              onClick={() => toggle(ria.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                  <FileText className="w-3 h-3" />
                  RIA
                </span>
                <span className="text-sm font-medium text-zinc-700 truncate">{fmtFecha(ria.fecha)}</span>
                <Link
                  href={`/app/ria/${ria.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-mono shrink-0"
                >
                  {ria.numero_ria}
                </Link>
                {ria.superficie_afectada && (
                  <span className="hidden sm:inline text-xs text-zinc-400">{num(ria.superficie_afectada, 1)} ha</span>
                )}
                <span className="hidden sm:inline text-xs text-zinc-400">
                  {ria.remitos_insumos.length} producto{ria.remitos_insumos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-zinc-800">{formatMoney(totalRia)}</span>
                {open
                  ? <ChevronUp className="w-4 h-4 text-zinc-400" />
                  : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </div>
            </button>

            {open && (
              <div className="border-t border-zinc-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-zinc-400 text-xs">Producto</th>
                        <th className="text-left px-4 py-2.5 font-medium text-zinc-400 text-xs">Depósito</th>
                        <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Cantidad</th>
                        <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Dosis/ha</th>
                        <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Costo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {ria.remitos_insumos.map((ins) => (
                        <tr key={ins.id}>
                          <td className="px-4 py-2.5 font-medium text-zinc-800">{ins.producto?.nombre}</td>
                          <td className="px-4 py-2.5 text-zinc-400 text-xs">{ins.deposito?.nombre ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">
                            {num(ins.cantidad)} <span className="text-zinc-400 text-xs">{ins.producto?.unidad_base}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-zinc-400 text-xs">
                            {ins.dosis_por_ha ? `${num(ins.dosis_por_ha)}/${ins.producto?.unidad_base}/ha` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-zinc-800">
                            {formatMoney(ins.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ria.observaciones && (
                  <p className="px-5 py-2 text-xs text-zinc-400 border-t border-zinc-50 italic">{ria.observaciones}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
