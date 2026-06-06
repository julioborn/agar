'use client';

import { useState } from 'react';
import {
  Plus, ChevronDown, ChevronUp, Tractor, Zap, Wrench, TrendingDown,
  Pencil, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import MaquinariaForm, { type MaquinariaInitialData } from './maquinaria-form';

interface Maquinaria extends MaquinariaInitialData {
  activa: boolean;
}

interface Props {
  maquinarias: Maquinaria[];
  empresaId: string;
  precioCombustible: number;
  tipoCombustible: string;
}

function costoHora(m: Maquinaria, precioCombustible: number) {
  const combustible   = m.consumo_combustible_hora * precioCombustible;
  const mantenimiento = m.costo_mantenimiento_hora ?? 0;
  const amortizacion  = m.valor_adquisicion && m.vida_util_horas
    ? m.valor_adquisicion / m.vida_util_horas
    : 0;
  return { combustible, mantenimiento, amortizacion, total: combustible + mantenimiento + amortizacion };
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MaquinariasLayout({ maquinarias: initial, empresaId, precioCombustible, tipoCombustible }: Props) {
  const router = useRouter();
  const [maquinarias, setMaquinarias] = useState(initial);
  const [formOpen,    setFormOpen]    = useState(false);
  const [expandida,   setExpandida]   = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  async function handleDelete(id: string) {
    setDeleting(true);
    const { error } = await createClient().from('maquinarias').delete().eq('id', id);
    setDeleting(false);
    if (error) { alert(error.message); return; }
    setMaquinarias((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
    setExpandida(null);
    router.refresh();
  }

  function handleEditSuccess() {
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <Tractor className="w-5 h-5 text-[#006836] shrink-0" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{maquinarias.filter((m) => m.activa).length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Activas</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm col-span-2 sm:col-span-1">
          <Zap className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-zinc-900 leading-none">
              ${fmt(precioCombustible)}<span className="text-xs font-normal text-zinc-400">/L</span>
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 capitalize">{tipoCombustible}</p>
          </div>
        </div>
      </div>

      {/* Nueva maquinaria (collapsible) */}
      <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
        formOpen ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>
        <button type="button" onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              formOpen ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
              <Plus className={cn('w-4 h-4', formOpen ? 'text-white' : 'text-[#006836]')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">Nueva maquinaria</p>
              <p className="text-xs text-zinc-400">Ficha técnica y costos operativos</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5 max-w-2xl">
            <MaquinariaForm
              empresaId={empresaId}
              onSuccess={() => { setFormOpen(false); router.refresh(); }}
              onCancel={() => setFormOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {maquinarias.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
            <Tractor className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No hay maquinarias registradas todavía.</p>
          </div>
        ) : (
          maquinarias.map((m) => {
            const costo   = costoHora(m, precioCombustible);
            const abierta = expandida === m.id;
            const editing = editingId === m.id;
            const confirming = deletingId === m.id;

            return (
              <div key={m.id} className={cn('bg-white rounded-2xl border overflow-hidden transition-all shadow-sm',
                abierta || editing ? 'border-[#006836]/20' : 'border-zinc-100')}>

                {/* Cabecera */}
                <button
                  type="button"
                  onClick={() => {
                    if (editing) return;
                    setExpandida(abierta ? null : m.id);
                    setDeletingId(null);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#006836]/10 flex items-center justify-center shrink-0">
                    <Tractor className="w-4 h-4 text-[#006836]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 truncate">{m.nombre}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                      {m.es_implemento && ' · Implemento'}
                      {m.marca && ` · ${m.marca}`}
                      {m.hp && ` · ${m.hp} HP`}
                      {m.anio && ` · ${m.anio}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-zinc-900">${fmt(costo.total)}<span className="text-xs font-normal text-zinc-400">/h</span></p>
                    <p className="text-xs text-zinc-400">costo/hora</p>
                  </div>
                  {abierta && !editing
                    ? <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />}
                </button>

                {/* Detalle expandido */}
                {abierta && !editing && (
                  <div className="border-t border-zinc-100 px-5 py-4 space-y-4">

                    {/* Desglose de costo/hora */}
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Desglose costo/hora</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-amber-50 rounded-xl p-3 text-center">
                          <Zap className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                          <p className="text-sm font-bold text-zinc-900">${fmt(costo.combustible)}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Combustible<br/>
                            <span className="text-zinc-400">{m.consumo_combustible_hora} L/h</span>
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                          <Wrench className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                          <p className="text-sm font-bold text-zinc-900">${fmt(costo.mantenimiento)}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">Mantenimiento</p>
                        </div>
                        <div className="bg-zinc-50 rounded-xl p-3 text-center">
                          <TrendingDown className="w-4 h-4 text-zinc-400 mx-auto mb-1" />
                          <p className="text-sm font-bold text-zinc-900">${fmt(costo.amortizacion)}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Amortización
                            {(!m.valor_adquisicion || !m.vida_util_horas) && (
                              <span className="block text-zinc-300">sin datos</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Parámetros de CdT si los tiene */}
                    {(m.ancho_labor_m || m.velocidad_kmh) && (
                      <div className="bg-[#006836]/5 rounded-xl px-4 py-2.5 border border-[#006836]/10">
                        <p className="text-xs font-semibold text-[#006836] mb-1">Parámetros operativos (CdT)</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-600">
                          {m.ancho_labor_m && <span>Ancho: <strong>{m.ancho_labor_m} m</strong></span>}
                          {m.velocidad_kmh && <span>Velocidad: <strong>{m.velocidad_kmh} km/h</strong></span>}
                          {m.eficiencia_campo && <span>Eficiencia: <strong>{(m.eficiencia_campo * 100).toFixed(0)}%</strong></span>}
                          {m.ancho_labor_m && m.velocidad_kmh && (
                            <span className="font-semibold text-[#006836]">
                              CdT: {((m.ancho_labor_m * m.velocidad_kmh * (m.eficiencia_campo ?? 0.75)) / 10).toFixed(2)} ha/h
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex items-center justify-between bg-[#006836]/5 rounded-xl px-4 py-3">
                      <span className="text-sm font-semibold text-zinc-700">Costo total por hora</span>
                      <span className="text-lg font-bold text-[#006836]">${fmt(costo.total)}</span>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-3 pt-1 border-t border-zinc-100">
                      {/* Confirmar eliminación inline */}
                      {confirming ? (
                        <div className="flex items-center gap-3 w-full">
                          <p className="text-xs text-red-600 flex-1">¿Eliminar <strong>{m.nombre}</strong>? Esta acción no se puede deshacer.</p>
                          <button
                            onClick={() => handleDelete(m.id)}
                            disabled={deleting}
                            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {deleting ? 'Eliminando…' : 'Confirmar'}
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-3 py-1.5 text-xs text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(m.id); setExpandida(m.id); setDeletingId(null); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            onClick={() => setDeletingId(m.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 rounded-xl hover:bg-red-50 text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Formulario de edición inline */}
                {editing && (
                  <div className="border-t border-[#006836]/20 p-5 max-w-2xl">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Editando: {m.nombre}</p>
                    <MaquinariaForm
                      empresaId={empresaId}
                      initialData={m}
                      onSuccess={handleEditSuccess}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
