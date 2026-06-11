'use client';

import Link from 'next/link';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useCurrency } from '@/lib/currency-context';

const num = (n: number, d = 2) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n);
const fmtFecha = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

interface LaborRia {
  id: string;
  tipo_labor_nombre: string | null;
  descripcion: string;
  prestador_nombre: string | null;
  unidad_medida: string;
  cantidad: number;
  tarifa: number;
  subtotal: number;
}

export interface RiaConLabores {
  id: string;
  numero_ria: string;
  fecha: string;
  superficie_afectada: number | null;
  remitos_labores: LaborRia[];
}

interface Props { rias: RiaConLabores[] }

export default function RiaLaboresList({ rias }: Props) {
  const { formatMoney } = useCurrency();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const riasConLabores = rias.filter((r) => r.remitos_labores.length > 0);
  if (riasConLabores.length === 0) return null;

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Vía Remito Interno (RIA)</span>
        <span className="text-xs text-zinc-300">
          {riasConLabores.reduce((acc, r) => acc + r.remitos_labores.length, 0)} labor{riasConLabores.reduce((acc, r) => acc + r.remitos_labores.length, 0) !== 1 ? 'es' : ''}
        </span>
      </div>

      {riasConLabores.map((ria) => {
        const open = abiertos.has(ria.id);
        const totalRia = ria.remitos_labores.reduce((acc, l) => acc + Number(l.subtotal ?? 0), 0);

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
                  {ria.remitos_labores.length} labor{ria.remitos_labores.length !== 1 ? 'es' : ''}
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
              <div className="border-t border-zinc-100 overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-400 text-xs">Labor</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-400 text-xs">Prestador</th>
                      <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Cant.</th>
                      <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Tarifa</th>
                      <th className="text-right px-4 py-2.5 font-medium text-zinc-400 text-xs">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {ria.remitos_labores.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-zinc-800">{l.tipo_labor_nombre ?? l.descripcion}</p>
                          {l.tipo_labor_nombre && l.descripcion !== l.tipo_labor_nombre && (
                            <p className="text-xs text-zinc-400">{l.descripcion}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400 text-xs">{l.prestador_nombre ?? 'Campo propio'}</td>
                        <td className="px-4 py-2.5 text-right text-zinc-600">
                          {num(l.cantidad)} <span className="text-zinc-400 text-xs">{l.unidad_medida}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-zinc-500 text-xs">{formatMoney(l.tarifa)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-zinc-800">{formatMoney(l.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
