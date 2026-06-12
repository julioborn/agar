'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, MapPin, Sprout, Building, Landmark, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Cultivo {
  id: string;
  cultivo: string | null;
  estado: string;
  producto_final: string | null;
  ingreso_bruto_ars: number | null;
  costo_directo_ars: number | null;
  margen_bruto_ars: number | null;
  campania_id: string | null;
  lote: { id: string; nombre: string; campo_id: string } | null;
}
interface RiaData {
  cultivo_id: string;
  total_insumos: number;
  total_labores: number;
  total_ria: number;
}
interface CostoIndCampo {
  id: string; campo_id: string; campania_id: string | null;
  fecha: string; categoria: string; descripcion: string; monto_ars: number;
  comprobante: { numero: string } | null;
}
interface CostoIndEmpresa {
  id: string; campania_id: string | null;
  fecha: string; categoria: string; descripcion: string; monto_ars: number;
  comprobante: { numero: string } | null;
}
interface Props {
  empresaNombre: string;
  campos: { id: string; nombre: string; hectareas_totales?: number | null }[];
  cultivos: Cultivo[];
  rias: RiaData[];
  costosIndCampo: CostoIndCampo[];
  costosIndEmpresa: CostoIndEmpresa[];
  campanias: { id: string; nombre: string }[];
}

const num = (v: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(v);

const badge = (v: number) =>
  v >= 0
    ? 'text-[#006836] bg-[#006836]/10'
    : 'text-red-600 bg-red-50';

export default function MargenesReport({
  empresaNombre, campos, cultivos, rias, costosIndCampo, costosIndEmpresa, campanias,
}: Props) {
  const [campaniaFiltro, setCampaniaFiltro] = useState('');
  const [expandedCampos, setExpandedCampos] = useState<Set<string>>(new Set());

  function toggleCampo(id: string) {
    setExpandedCampos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Agrupar costos RIA por cultivo_id
  const riasPorCultivo = useMemo(() => {
    const map: Record<string, { insumos: number; labores: number; total: number }> = {};
    for (const r of rias) {
      if (!r.cultivo_id) continue;
      if (!map[r.cultivo_id]) map[r.cultivo_id] = { insumos: 0, labores: 0, total: 0 };
      map[r.cultivo_id].insumos += Number(r.total_insumos);
      map[r.cultivo_id].labores += Number(r.total_labores);
      map[r.cultivo_id].total += Number(r.total_ria);
    }
    return map;
  }, [rias]);

  // Filtrado por campaña
  const cultivosFiltrados = useMemo(() =>
    campaniaFiltro
      ? cultivos.filter((c) => c.campania_id === campaniaFiltro)
      : cultivos,
    [cultivos, campaniaFiltro]);

  const costosCampoFiltrados = useMemo(() =>
    campaniaFiltro
      ? costosIndCampo.filter((c) => !c.campania_id || c.campania_id === campaniaFiltro)
      : costosIndCampo,
    [costosIndCampo, campaniaFiltro]);

  const costosEmpresaFiltrados = useMemo(() =>
    campaniaFiltro
      ? costosIndEmpresa.filter((c) => !c.campania_id || c.campania_id === campaniaFiltro)
      : costosIndEmpresa,
    [costosIndEmpresa, campaniaFiltro]);

  // Agregar por campo
  const datosCampo = useMemo(() => campos.map((campo) => {
    const lotesDelCampo = new Set(
      cultivosFiltrados
        .filter((c) => c.lote?.campo_id === campo.id)
        .map((c) => c.lote!.nombre),
    );

    const cultivosDelCampo = cultivosFiltrados.filter((c) => c.lote?.campo_id === campo.id);

    // Para cada cultivo, el costo directo incluye lo registrado en el cultivo + costos RIA
    const ingresoBruto = cultivosDelCampo.reduce((acc, c) => acc + Number(c.ingreso_bruto_ars ?? 0), 0);
    const costoDirecto = cultivosDelCampo.reduce((acc, c) => {
      const costoBase = Number(c.costo_directo_ars ?? 0);
      const costoRia = riasPorCultivo[c.id]?.total ?? 0;
      return acc + costoBase + costoRia;
    }, 0);
    const margenBrutoLotes = ingresoBruto - costoDirecto;

    const costosIndirectos = costosCampoFiltrados
      .filter((c) => c.campo_id === campo.id)
      .reduce((acc, c) => acc + Number(c.monto_ars), 0);

    const margenCampo = margenBrutoLotes - costosIndirectos;

    return {
      campo,
      cultivosDelCampo,
      costosIndCampo: costosCampoFiltrados.filter((c) => c.campo_id === campo.id),
      ingresoBruto,
      costoDirecto,
      margenBrutoLotes,
      costosIndirectos,
      margenCampo,
      lotesCount: lotesDelCampo.size,
    };
  }), [campos, cultivosFiltrados, costosCampoFiltrados, riasPorCultivo]);

  // Totales empresa
  const totalIngresoBruto = datosCampo.reduce((acc, d) => acc + d.ingresoBruto, 0);
  const totalCostoDirecto = datosCampo.reduce((acc, d) => acc + d.costoDirecto, 0);
  const totalMargenLotes = datosCampo.reduce((acc, d) => acc + d.margenBrutoLotes, 0);
  const totalCostosIndCampo = datosCampo.reduce((acc, d) => acc + d.costosIndirectos, 0);
  const totalMargenCampos = datosCampo.reduce((acc, d) => acc + d.margenCampo, 0);
  const totalCostosIndEmpresa = costosEmpresaFiltrados.reduce((acc, c) => acc + Number(c.monto_ars), 0);
  const margenLiquidoEmpresa = totalMargenCampos - totalCostosIndEmpresa;

  return (
    <div className="space-y-5">
      {/* Filtro campaña */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-600">Campaña:</label>
        <select
          value={campaniaFiltro}
          onChange={(e) => setCampaniaFiltro(e.target.value)}
          className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">Todas las campañas</option>
          {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {campaniaFiltro && (
          <button onClick={() => setCampaniaFiltro('')} className="text-xs text-zinc-400 hover:text-zinc-700 underline">
            Limpiar
          </button>
        )}
      </div>

      {/* ── NIVEL 3: Empresa ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-zinc-400" />
          <span className="font-bold text-lg">{empresaNombre}</span>
          <span className="text-xs text-zinc-500 ml-auto">Nivel: Empresa</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Ingreso bruto total" value={totalIngresoBruto} color="zinc-300" />
          <Kpi label="Costo directo total" value={-totalCostoDirecto} color="zinc-300" />
          <Kpi label="Margen bruto lotes" value={totalMargenLotes} highlight />
          <div />
          <Kpi label="− Costos indirectos campo" value={-totalCostosIndCampo} color="amber-400" />
          <Kpi label="= Margen neto campos" value={totalMargenCampos} highlight />
          <Kpi label="− Costos indirectos empresa" value={-totalCostosIndEmpresa} color="purple-400" />
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-zinc-400 mb-1">Margen líquido empresa</p>
            <p className={cn('text-xl font-bold', margenLiquidoEmpresa >= 0 ? 'text-green-400' : 'text-red-400')}>
              $ {num(margenLiquidoEmpresa)}
            </p>
          </div>
        </div>

        {/* Costos indirectos empresa */}
        {costosEmpresaFiltrados.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200 select-none">
              Ver {costosEmpresaFiltrados.length} costo{costosEmpresaFiltrados.length !== 1 ? 's' : ''} indirecto{costosEmpresaFiltrados.length !== 1 ? 's' : ''} de empresa
            </summary>
            <div className="mt-2 space-y-1">
              {costosEmpresaFiltrados.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs text-zinc-400 py-1 border-t border-white/5">
                  <span className="font-mono text-zinc-600">{c.comprobante?.numero ?? '—'}</span>
                  <span className="flex-1 truncate">{c.descripcion}</span>
                  <span className="text-red-400 font-medium">− $ {num(Number(c.monto_ars))}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── NIVEL 2: Campos ──────────────────────────────────────────────── */}
      {datosCampo.map(({ campo, cultivosDelCampo, costosIndCampo: cic, ingresoBruto, costoDirecto, margenBrutoLotes, costosIndirectos, margenCampo }) => (
        <div key={campo.id} className="border border-zinc-200 rounded-2xl overflow-hidden">
          {/* Header campo */}
          <button
            onClick={() => toggleCampo(campo.id)}
            className="w-full flex items-center gap-3 px-5 py-4 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
          >
            <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-zinc-800">{campo.nombre}</span>
              {campo.hectareas_totales && (
                <span className="text-xs text-zinc-400 ml-2">{campo.hectareas_totales} ha</span>
              )}
            </div>
            <div className="flex items-center gap-6 text-sm shrink-0">
              <div className="text-right hidden md:block">
                <p className="text-xs text-zinc-400">Margen bruto lotes</p>
                <p className={cn('font-semibold', margenBrutoLotes >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                  $ {num(margenBrutoLotes)}
                </p>
              </div>
              {cic.length > 0 && (
                <div className="text-right hidden md:block">
                  <p className="text-xs text-zinc-400">Costos indirectos</p>
                  <p className="font-semibold text-amber-600">− $ {num(costosIndirectos)}</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-zinc-400">Margen campo</p>
                <p className={cn('font-bold', margenCampo >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                  $ {num(margenCampo)}
                </p>
              </div>
              {expandedCampos.has(campo.id)
                ? <ChevronDown className="w-4 h-4 text-zinc-400" />
                : <ChevronRight className="w-4 h-4 text-zinc-400" />}
            </div>
          </button>

          {/* Detalle campo expandido */}
          {expandedCampos.has(campo.id) && (
            <div className="divide-y divide-zinc-100">
              {/* Resumen financiero del campo */}
              <div className="px-5 py-3 bg-white grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <FinRow label="Ingreso bruto" value={ingresoBruto} />
                <FinRow label="Costo directo" value={-costoDirecto} />
                <FinRow label="Margen bruto lotes" value={margenBrutoLotes} bold />
                <FinRow label="Costos indirectos campo" value={-costosIndirectos} amber />
              </div>

              {/* Costos indirectos del campo */}
              {cic.length > 0 && (
                <div className="px-5 py-3 bg-amber-50/40">
                  <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Costos indirectos imputados</p>
                  <div className="space-y-1">
                    {cic.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-mono text-zinc-400">{c.comprobante?.numero ?? '—'}</span>
                        <span className="flex-1 truncate">{c.descripcion}</span>
                        <span className="text-amber-700 font-medium">− $ {num(Number(c.monto_ars))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── NIVEL 1: Cultivos / Lotes ───────────────────────────── */}
              {cultivosDelCampo.length === 0 ? (
                <div className="px-5 py-4 text-sm text-zinc-400 italic">Sin cultivos registrados para este campo</div>
              ) : (
                cultivosDelCampo.map((cultivo) => {
                  const costoBase = Number(cultivo.costo_directo_ars ?? 0);
                  const costoRia = riasPorCultivo[cultivo.id]?.total ?? 0;
                  const costoDirectoTotal = costoBase + costoRia;
                  const ingresoBruto = Number(cultivo.ingreso_bruto_ars ?? 0);
                  const margenBruto = ingresoBruto - costoDirectoTotal;
                  return (
                    <div key={cultivo.id} className="px-5 py-3 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Sprout className="w-4 h-4 text-[#006836] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-700 truncate">
                            {cultivo.lote?.nombre ?? '—'}
                            {cultivo.cultivo && (
                              <span className="ml-2 text-xs text-zinc-400 font-normal capitalize">{cultivo.cultivo}</span>
                            )}
                            {cultivo.producto_final && (
                              <span className="ml-1 text-xs text-zinc-400 font-normal">· {cultivo.producto_final}</span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Estado: {cultivo.estado}
                            {ingresoBruto > 0 ? ` · Ingreso: $ ${num(ingresoBruto)}` : ''}
                            {costoDirectoTotal > 0 ? ` · Costo: $ ${num(costoDirectoTotal)}` : ''}
                          </p>
                          {costoRia > 0 && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                              RIA — Insumos: ${num(riasPorCultivo[cultivo.id]!.insumos)} · Labores: ${num(riasPorCultivo[cultivo.id]!.labores)}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-zinc-400">Margen bruto</p>
                          <p className={cn('text-sm font-bold', margenBruto >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                            $ {num(margenBruto)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}

      {campos.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay campos registrados</p>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight, color }: { label: string; value: number; highlight?: boolean; color?: string }) {
  return (
    <div className={cn('rounded-xl p-3', highlight ? 'bg-white/10' : 'bg-white/5')}>
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className={cn('text-lg font-bold', color ? `text-${color}` : value >= 0 ? 'text-zinc-100' : 'text-red-400')}>
        $ {num(value)}
      </p>
    </div>
  );
}

function FinRow({ label, value, bold, amber }: { label: string; value: number; bold?: boolean; amber?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={cn(
        'text-sm',
        bold && 'font-bold',
        amber ? 'text-amber-600' : value >= 0 ? 'text-[#006836]' : 'text-red-600',
      )}>
        $ {num(value)}
      </p>
    </div>
  );
}
