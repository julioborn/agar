'use client';

import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Tractor, Zap, Wrench, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import MaquinariaForm from './maquinaria-form';

interface Maquinaria {
  id: string; nombre: string; tipo: string; marca: string | null; modelo: string | null;
  anio: number | null; hp: number | null;
  consumo_combustible_hora: number;
  costo_mantenimiento_hora: number;
  valor_adquisicion: number | null;
  vida_util_horas: number | null;
  activa: boolean;
}

interface Props {
  maquinarias: Maquinaria[];
  empresaId: string;
  precioCombustible: number;
  tipoCombustible: string;
}

function costoHora(m: Maquinaria, precioCombustible: number) {
  const combustible  = m.consumo_combustible_hora * precioCombustible;
  const mantenimiento = m.costo_mantenimiento_hora;
  const amortizacion = m.valor_adquisicion && m.vida_util_horas
    ? m.valor_adquisicion / m.vida_util_horas
    : 0;
  return { combustible, mantenimiento, amortizacion, total: combustible + mantenimiento + amortizacion };
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MaquinariasLayout({ maquinarias, empresaId, precioCombustible, tipoCombustible }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);

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
          <div className="border-t border-zinc-100 p-5 max-w-lg">
            <MaquinariaForm
              empresaId={empresaId}
              onSuccess={() => { setFormOpen(false); router.refresh(); }}
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
            const costo = costoHora(m, precioCombustible);
            const abierta = expandida === m.id;
            return (
              <div key={m.id} className={cn('bg-white rounded-2xl border overflow-hidden transition-all shadow-sm',
                abierta ? 'border-[#006836]/20' : 'border-zinc-100')}>
                {/* Cabecera */}
                <button
                  type="button"
                  onClick={() => setExpandida(abierta ? null : m.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#006836]/10 flex items-center justify-center shrink-0">
                    <Tractor className="w-4 h-4 text-[#006836]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 truncate">{m.nombre}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                      {m.marca && ` · ${m.marca}`}
                      {m.hp && ` · ${m.hp} HP`}
                      {m.anio && ` · ${m.anio}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-zinc-900">${fmt(costo.total)}<span className="text-xs font-normal text-zinc-400">/h</span></p>
                    <p className="text-xs text-zinc-400">costo total</p>
                  </div>
                  {abierta ? <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />}
                </button>

                {/* Detalle expandido */}
                {abierta && (
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

                    {/* Total */}
                    <div className="flex items-center justify-between bg-[#006836]/5 rounded-xl px-4 py-3">
                      <span className="text-sm font-semibold text-zinc-700">Costo total por hora</span>
                      <span className="text-lg font-bold text-[#006836]">${fmt(costo.total)}</span>
                    </div>
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
