'use client';

import { useState, useTransition } from 'react';
import { Tractor, Truck, Trash2, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { eliminarLabor } from '../actions';
import { useCurrency } from '@/lib/currency-context';

interface Labor {
  id: string;
  fecha: string;
  tipo_ejecucion: 'propio' | 'tercero';
  observaciones: string | null;
  horas_trabajadas: number | null;
  modalidad_cobro: string | null;
  precio_unitario: number | null;
  hectareas_trabajadas: number | null;
  costo_total_calculado: number;
  tipo_labor: { nombre: string } | null;
  maquinaria: { nombre: string; tipo: string } | null;
  proveedor: { nombre: string } | null;
}

interface Props {
  labores: Labor[];
  cultivoId: string;
}

const fmtFecha = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function LaborsList({ labores, cultivoId }: Props) {
  const { formatMoney } = useCurrency();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  function toggle(id: string) {
    setAbiertos((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta labor? Se recalculará el costo directo del cultivo.')) return;
    setDeleting(id);
    startTransition(async () => {
      await eliminarLabor(id, cultivoId);
      setDeleting(null);
    });
  }

  const total = labores.reduce((acc, l) => acc + Number(l.costo_total_calculado ?? 0), 0);

  if (labores.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
        <Wrench className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
        <p className="text-zinc-400 text-sm">No hay labores registradas todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {labores.map((labor) => {
        const open = abiertos.has(labor.id);
        const EsPropio = labor.tipo_ejecucion === 'propio';

        return (
          <div key={labor.id} className={cn('bg-white rounded-2xl border overflow-hidden',
            open ? 'border-[#006836]/20' : 'border-zinc-100')}>

            <button onClick={() => toggle(labor.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  EsPropio ? 'bg-[#006836]/10' : 'bg-blue-50')}>
                  {EsPropio
                    ? <Tractor className="w-3.5 h-3.5 text-[#006836]" />
                    : <Truck className="w-3.5 h-3.5 text-blue-500" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-800 truncate">
                    {labor.tipo_labor?.nombre ?? 'Labor'}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {fmtFecha(labor.fecha)} ·{' '}
                    {EsPropio
                      ? (labor.maquinaria?.nombre ?? 'Equipo propio')
                      : (labor.proveedor?.nombre ?? 'Servicio tercero')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-zinc-800">
                  {formatMoney(labor.costo_total_calculado)}
                </span>
                {open
                  ? <ChevronUp className="w-4 h-4 text-zinc-400" />
                  : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </div>
            </button>

            {open && (
              <div className="border-t border-zinc-100 px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-xs text-zinc-400">Ejecución</span>
                    <p className="font-medium text-zinc-700">{EsPropio ? 'Equipo propio' : 'Servicio tercero'}</p>
                  </div>
                  {EsPropio && labor.horas_trabajadas && (
                    <div>
                      <span className="text-xs text-zinc-400">Horas trabajadas</span>
                      <p className="font-medium text-zinc-700">{labor.horas_trabajadas} h</p>
                    </div>
                  )}
                  {!EsPropio && labor.modalidad_cobro && (
                    <div>
                      <span className="text-xs text-zinc-400">Modalidad</span>
                      <p className="font-medium text-zinc-700">
                        {labor.modalidad_cobro === 'por_ha' ? 'Por hectárea' : 'Total fijo'}
                        {labor.modalidad_cobro === 'por_ha' && labor.hectareas_trabajadas && (
                          <span className="text-zinc-400 font-normal"> · {labor.hectareas_trabajadas} ha</span>
                        )}
                      </p>
                    </div>
                  )}
                  {!EsPropio && labor.precio_unitario && (
                    <div>
                      <span className="text-xs text-zinc-400">
                        {labor.modalidad_cobro === 'por_ha' ? 'Precio/ha' : 'Precio total'}
                      </span>
                      <p className="font-medium text-zinc-700">{formatMoney(labor.precio_unitario)}</p>
                    </div>
                  )}
                  {labor.observaciones && (
                    <div className="col-span-2">
                      <span className="text-xs text-zinc-400">Observaciones</span>
                      <p className="text-zinc-500 italic text-xs">{labor.observaciones}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-[#006836]">
                    Costo: {formatMoney(labor.costo_total_calculado)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(labor.id)}
                    disabled={pending || deleting === labor.id}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Subtotal labores */}
      <div className="flex justify-between items-center px-5 py-3 bg-zinc-800 rounded-2xl">
        <span className="text-sm font-medium text-zinc-400">Total labores</span>
        <span className="text-lg font-bold text-white">{formatMoney(total)}</span>
      </div>
    </div>
  );
}
