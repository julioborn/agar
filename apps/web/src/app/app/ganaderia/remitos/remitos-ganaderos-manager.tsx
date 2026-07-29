'use client';

import Link from 'next/link';
import { FileText, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReadOnly } from '@/lib/readonly-context';

interface RemitoRow {
  id: string;
  numero_rig: string;
  fecha: string;
  estado: string;
  total_insumos: number;
  loteHaciendaNombre: string;
  ubicacion: string;
}
interface Props { remitos: RemitoRow[]; }

const ESTADO_STYLE: Record<string, string> = {
  borrador:   'bg-amber-100 text-amber-700',
  confirmado: 'bg-[#006836]/10 text-[#006836]',
  anulado:    'bg-red-100 text-red-600',
};
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador', confirmado: 'Confirmado', anulado: 'Anulado',
};

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function RemitosGanaderosManager({ remitos }: Props) {
  const esLector = useReadOnly();

  return (
    <div className="space-y-4">
      {!esLector && (
        <div className="flex justify-end">
          <Link href="/app/ganaderia/remitos/nuevo"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo remito ganadero
          </Link>
        </div>
      )}

      {remitos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay remitos ganaderos todavía.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm divide-y divide-zinc-100">
          {remitos.map((r) => (
            <Link key={r.id} href={`/app/ganaderia/remitos/${r.id}`}
              className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-zinc-800">{r.numero_rig}</span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ESTADO_STYLE[r.estado] ?? '')}>
                    {ESTADO_LABEL[r.estado] ?? r.estado}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-0.5 truncate">{r.ubicacion} · {r.loteHaciendaNombre}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-zinc-400">{fmt(r.fecha)}</p>
                {r.total_insumos > 0 && <p className="text-sm font-bold text-zinc-800">${num.format(r.total_insumos)}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
