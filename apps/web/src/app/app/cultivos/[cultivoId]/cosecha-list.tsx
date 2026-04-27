'use client';

import { useState, useTransition } from 'react';
import { Tractor, Truck, Trash2, ChevronDown, ChevronUp, Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { eliminarCostoCosecha } from '../actions';

interface CostoCosecha {
  id: string;
  fecha: string;
  tipo_ejecucion: 'propio' | 'tercero';
  observaciones: string | null;
  horas_trabajadas: number | null;
  modalidad_cobro: string | null;
  precio_unitario: number | null;
  hectareas_trabajadas: number | null;
  toneladas_trabajadas: number | null;
  costo_total_calculado: number;
  maquinaria: { nombre: string } | null;
  proveedor: { nombre: string } | null;
}

interface Props { costosCosecha: CostoCosecha[]; cultivoId: string; }

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtFecha = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

const MODALIDAD_LABEL: Record<string, string> = {
  por_ha: 'Por hectárea', por_tonelada: 'Por tonelada', total: 'Total fijo',
};

export default function CosechaList({ costosCosecha, cultivoId }: Props) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  function toggle(id: string) {
    setAbiertos((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este costo de cosecha?')) return;
    setDeleting(id);
    startTransition(async () => { await eliminarCostoCosecha(id, cultivoId); setDeleting(null); });
  }

  const total = costosCosecha.reduce((acc, c) => acc + Number(c.costo_total_calculado ?? 0), 0);

  if (costosCosecha.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
        <Wheat className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
        <p className="text-zinc-400 text-sm">Sin costos de cosecha registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {costosCosecha.map((c) => {
        const open    = abiertos.has(c.id);
        const EsPropio = c.tipo_ejecucion === 'propio';
        return (
          <div key={c.id} className={cn('bg-white rounded-2xl border overflow-hidden',
            open ? 'border-[#006836]/20' : 'border-zinc-100')}>
            <button onClick={() => toggle(c.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  EsPropio ? 'bg-[#006836]/10' : 'bg-blue-50')}>
                  {EsPropio
                    ? <Tractor className="w-3.5 h-3.5 text-[#006836]" />
                    : <Truck className="w-3.5 h-3.5 text-blue-500" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">
                    {EsPropio ? 'Cosechadora propia' : (c.proveedor?.nombre ?? 'Contratista')}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {fmtFecha(c.fecha)}
                    {EsPropio && c.maquinaria && ` · ${c.maquinaria.nombre}`}
                    {!EsPropio && c.modalidad_cobro && ` · ${MODALIDAD_LABEL[c.modalidad_cobro]}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-zinc-800">{ars.format(c.costo_total_calculado)}</span>
                {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </div>
            </button>

            {open && (
              <div className="border-t border-zinc-100 px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {EsPropio && c.horas_trabajadas && (
                    <div>
                      <span className="text-xs text-zinc-400">Horas trabajadas</span>
                      <p className="font-medium text-zinc-700">{c.horas_trabajadas} h</p>
                    </div>
                  )}
                  {!EsPropio && c.modalidad_cobro && (
                    <div>
                      <span className="text-xs text-zinc-400">Modalidad</span>
                      <p className="font-medium text-zinc-700">{MODALIDAD_LABEL[c.modalidad_cobro]}</p>
                    </div>
                  )}
                  {!EsPropio && c.precio_unitario && (
                    <div>
                      <span className="text-xs text-zinc-400">Precio unitario</span>
                      <p className="font-medium text-zinc-700">{ars.format(c.precio_unitario)}</p>
                    </div>
                  )}
                  {c.hectareas_trabajadas && (
                    <div>
                      <span className="text-xs text-zinc-400">Hectáreas</span>
                      <p className="font-medium text-zinc-700">{c.hectareas_trabajadas} ha</p>
                    </div>
                  )}
                  {c.toneladas_trabajadas && (
                    <div>
                      <span className="text-xs text-zinc-400">Toneladas</span>
                      <p className="font-medium text-zinc-700">{c.toneladas_trabajadas} tn</p>
                    </div>
                  )}
                  {c.observaciones && (
                    <div className="col-span-2">
                      <span className="text-xs text-zinc-400">Observaciones</span>
                      <p className="text-zinc-500 italic text-xs">{c.observaciones}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-[#006836]">{ars.format(c.costo_total_calculado)}</span>
                  <button type="button" onClick={() => handleDelete(c.id)}
                    disabled={pending || deleting === c.id}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-between items-center px-5 py-3 bg-zinc-800 rounded-2xl">
        <span className="text-sm font-medium text-zinc-400">Total cosecha/trilla</span>
        <span className="text-lg font-bold text-white">{ars.format(total)}</span>
      </div>
    </div>
  );
}
