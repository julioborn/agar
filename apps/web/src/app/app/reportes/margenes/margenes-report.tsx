'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { ChevronDown, ChevronRight, MapPin, Sprout, BarChart3, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';
import ExportButtons, { ExportColumn } from '@/components/export-buttons';

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
  cultivo_id: string | null;
  lote_id: string;
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


function wrapLabel(text: string, maxChars = 20): string[] {
  if (text.length <= maxChars) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const cut = remaining.lastIndexOf(' ', maxChars);
    if (cut <= 0) { lines.push(remaining.slice(0, maxChars)); remaining = remaining.slice(maxChars).trim(); }
    else { lines.push(remaining.slice(0, cut)); remaining = remaining.slice(cut + 1); }
  }
  if (remaining) lines.push(remaining);
  return lines.slice(0, 3);
}
function CustomYTick({ x, y, payload }: any) {
  const lines = wrapLabel(String(payload.value));
  const lh = 13;
  const startY = -((lines.length - 1) * lh) / 2;
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={startY + i * lh} textAnchor="end" fill="#52525b" fontSize={10}>{line}</text>
      ))}
    </g>
  );
}

export default function MargenesReport({
  empresaNombre, campos, cultivos, rias, costosIndCampo, costosIndEmpresa, campanias,
}: Props) {
  const { formatMoney, currency, usdRate } = useCurrency();
  const [vista, setVista] = useState<'jerarquia' | 'cultivo'>('jerarquia');

  function fmtAxis(v: number) {
    const converted = currency === 'USD' && usdRate ? v / usdRate : v;
    const abs = Math.abs(converted);
    const prefix = currency === 'USD' ? 'U$S ' : '$ ';
    if (abs >= 1_000_000) return `${prefix}${(converted / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${prefix}${(converted / 1_000).toFixed(0)}K`;
    return `${prefix}${converted.toFixed(0)}`;
  }

  function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1 min-w-[160px]">
        <p className="font-semibold text-zinc-700 mb-1 truncate max-w-[200px]">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill }}>
            {p.name}: <strong>{formatMoney(p.value)}</strong>
          </p>
        ))}
      </div>
    );
  }
  const [campaniaFiltro, setCampaniaFiltro] = useState('');
  const [expandedCampos, setExpandedCampos] = useState<Set<string>>(new Set());

  function toggleCampo(id: string) {
    setExpandedCampos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Labores de RIA por cultivo_id (insumos ya están en costo_directo_ars)
  const riasPorCultivo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rias) {
      if (!r.cultivo_id) continue;
      map[r.cultivo_id] = (map[r.cultivo_id] ?? 0) + Number(r.total_labores);
    }
    return map;
  }, [rias]);

  const cultivosFiltrados = useMemo(() =>
    campaniaFiltro ? cultivos.filter((c) => c.campania_id === campaniaFiltro) : cultivos,
    [cultivos, campaniaFiltro]);

  const costosCampoFiltrados = useMemo(() =>
    campaniaFiltro ? costosIndCampo.filter((c) => !c.campania_id || c.campania_id === campaniaFiltro) : costosIndCampo,
    [costosIndCampo, campaniaFiltro]);

  const costosEmpresaFiltrados = useMemo(() =>
    campaniaFiltro ? costosIndEmpresa.filter((c) => !c.campania_id || c.campania_id === campaniaFiltro) : costosIndEmpresa,
    [costosIndEmpresa, campaniaFiltro]);

  // ── Datos por campo ────────────────────────────────────────────────────────────
  const datosCampo = useMemo(() => campos.map((campo) => {
    const cultivosDelCampo = cultivosFiltrados.filter((c) => c.lote?.campo_id === campo.id);
    const ingresoBruto = cultivosDelCampo.reduce((acc, c) => acc + Number(c.ingreso_bruto_ars ?? 0), 0);
    const costoDirecto = cultivosDelCampo.reduce((acc, c) => {
      const costoBase = Number(c.costo_directo_ars ?? 0);
      const costoRia = riasPorCultivo[c.id] ?? 0;
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
    };
  }), [campos, cultivosFiltrados, costosCampoFiltrados, riasPorCultivo]);

  // ── Datos por tipo de cultivo ──────────────────────────────────────────────────
  const datosPorCultivo = useMemo(() => {
    const map = new Map<string, { label: string; ingreso: number; costo: number; lotes: number }>();
    for (const c of cultivosFiltrados) {
      const raw = (c.cultivo ?? '').trim();
      const key = raw.toLowerCase() || 'sin-cultivo';
      const label = raw
        ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
        : 'Sin cultivo';
      const ingreso = Number(c.ingreso_bruto_ars ?? 0);
      const costo = Number(c.costo_directo_ars ?? 0) + (riasPorCultivo[c.id] ?? 0);
      const g = map.get(key) ?? { label, ingreso: 0, costo: 0, lotes: 0 };
      map.set(key, { label, ingreso: g.ingreso + ingreso, costo: g.costo + costo, lotes: g.lotes + 1 });
    }
    return Array.from(map.values())
      .map((v) => ({ ...v, margen: v.ingreso - v.costo }))
      .sort((a, b) => b.margen - a.margen);
  }, [cultivosFiltrados, riasPorCultivo]);

  // ── Totales empresa ────────────────────────────────────────────────────────────
  const totalIngresoBruto = datosCampo.reduce((acc, d) => acc + d.ingresoBruto, 0);
  const totalCostoDirecto = datosCampo.reduce((acc, d) => acc + d.costoDirecto, 0);
  const totalMargenLotes = datosCampo.reduce((acc, d) => acc + d.margenBrutoLotes, 0);
  const totalCostosIndCampo = datosCampo.reduce((acc, d) => acc + d.costosIndirectos, 0);
  const totalMargenCampos = datosCampo.reduce((acc, d) => acc + d.margenCampo, 0);
  const totalCostosIndEmpresa = costosEmpresaFiltrados.reduce((acc, c) => acc + Number(c.monto_ars), 0);
  const margenLiquidoEmpresa = totalMargenCampos - totalCostosIndEmpresa;

  const exportDataJerarquia = useMemo(() => datosCampo.map((d) => ({
    campo: d.campo.nombre,
    ingresoBruto: d.ingresoBruto,
    costoDirecto: d.costoDirecto,
    costosIndirectos: d.costosIndirectos,
    margenCampo: d.margenCampo,
  })), [datosCampo]);

  const exportDataCultivo = useMemo(() => datosPorCultivo.map((d) => ({
    label: d.label,
    ingreso: d.ingreso,
    costo: d.costo,
    margen: d.margen,
  })), [datosPorCultivo]);

  const exportColumnsJerarquia: ExportColumn[] = [
    { header: 'Campo', key: 'campo', width: 20 },
    { header: 'Ingreso bruto', key: 'ingresoBruto', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Costo directo', key: 'costoDirecto', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Costos campo', key: 'costosIndirectos', width: 14, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Margen campo', key: 'margenCampo', width: 14, align: 'right', format: (v) => formatMoney(v), total: true },
  ];

  const exportColumnsCultivo: ExportColumn[] = [
    { header: 'Cultivo', key: 'label', width: 22 },
    { header: 'Ingreso', key: 'ingreso', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Costo', key: 'costo', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Margen', key: 'margen', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
  ];

  // ── Chart data ─────────────────────────────────────────────────────────────────
  const chartCampos = datosCampo
    .filter((d) => d.ingresoBruto + d.costoDirecto + Math.abs(d.margenCampo) > 0)
    .map((d) => ({
      name: d.campo.nombre,
      fullName: d.campo.nombre,
      Ingreso: d.ingresoBruto,
      Costo: d.costoDirecto + d.costosIndirectos,
      Margen: d.margenCampo,
    }));

  const chartCultivos = datosPorCultivo
    .filter((d) => d.ingreso + d.costo + Math.abs(d.margen) > 0)
    .map((d) => ({
      name: d.label,
      fullName: d.label,
      Ingreso: d.ingreso,
      Costo: d.costo,
      Margen: d.margen,
    }));

  return (
    <div className="space-y-5">
      {/* Filtro campaña + Toggle vista */}
      <div className="flex flex-wrap items-center gap-3">
        {campanias.length > 0 && (
          <div className="flex items-center gap-2">
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
        )}
        <div className="flex items-center gap-2 ml-auto">
          <ExportButtons
            data={vista === 'jerarquia' ? exportDataJerarquia : exportDataCultivo}
            columns={vista === 'jerarquia' ? exportColumnsJerarquia : exportColumnsCultivo}
            filename={vista === 'jerarquia' ? 'reporte-margenes-campos' : 'reporte-margenes-cultivos'}
            title={vista === 'jerarquia' ? 'Márgenes por Campo' : 'Márgenes por Cultivo'}
          />
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden bg-white">
            <button
              onClick={() => setVista('jerarquia')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                vista === 'jerarquia' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
              )}
            >
              <Layers className="w-4 h-4" />
              Jerarquía
            </button>
            <button
              onClick={() => setVista('cultivo')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                vista === 'cultivo' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
              )}
            >
              <Sprout className="w-4 h-4" />
              Por Cultivo
            </button>
          </div>
        </div>
      </div>

      {/* ── VISTA JERARQUÍA ───────────────────────────────────────────────────── */}
      {vista === 'jerarquia' && (
        <>
          {/* Gráfico campos */}
          {chartCampos.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
              <p className="text-sm font-semibold text-zinc-700 mb-4">Márgenes por campo</p>
              <ResponsiveContainer width="100%" height={Math.max(200, chartCampos.length * 48)}>
                <BarChart data={chartCampos} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={160} tick={<CustomYTick />} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Ingreso" fill="#3b82f6" radius={[0, 2, 2, 0]} maxBarSize={16} />
                  <Bar dataKey="Costo" fill="#f59e0b" radius={[0, 2, 2, 0]} maxBarSize={16} />
                  <Bar dataKey="Margen" radius={[0, 2, 2, 0]} maxBarSize={16}>
                    {chartCampos.map((d, i) => (
                      <Cell key={i} fill={d.Margen >= 0 ? '#006836' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Empresa summary */}
          <div className="bg-zinc-900 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-zinc-400" />
              <span className="font-bold text-lg">{empresaNombre}</span>
              <span className="text-xs text-zinc-500 ml-auto">Nivel empresa</span>
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
                  {formatMoney(margenLiquidoEmpresa)}
                </p>
              </div>
            </div>
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
                      <span className="text-red-400 font-medium">− {formatMoney(Number(c.monto_ars))}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Campos */}
          {datosCampo.map(({ campo, cultivosDelCampo, costosIndCampo: cic, ingresoBruto, costoDirecto, margenBrutoLotes, costosIndirectos, margenCampo }) => (
            <div key={campo.id} className="border border-zinc-200 rounded-2xl overflow-hidden">
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
                      {formatMoney(margenBrutoLotes)}
                    </p>
                  </div>
                  {cic.length > 0 && (
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-zinc-400">Costos indirectos</p>
                      <p className="font-semibold text-amber-600">− {formatMoney(costosIndirectos)}</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Margen campo</p>
                    <p className={cn('font-bold', margenCampo >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                      {formatMoney(margenCampo)}
                    </p>
                  </div>
                  {expandedCampos.has(campo.id)
                    ? <ChevronDown className="w-4 h-4 text-zinc-400" />
                    : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                </div>
              </button>

              {expandedCampos.has(campo.id) && (
                <div className="divide-y divide-zinc-100">
                  <div className="px-5 py-3 bg-white grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <FinRow label="Ingreso bruto" value={ingresoBruto} />
                    <FinRow label="Costo directo" value={-costoDirecto} />
                    <FinRow label="Margen bruto lotes" value={margenBrutoLotes} bold />
                    <FinRow label="Costos indirectos campo" value={-costosIndirectos} amber />
                  </div>
                  {cic.length > 0 && (
                    <div className="px-5 py-3 bg-amber-50/40">
                      <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Costos indirectos imputados</p>
                      <div className="space-y-1">
                        {cic.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="font-mono text-zinc-400">{c.comprobante?.numero ?? '—'}</span>
                            <span className="flex-1 truncate">{c.descripcion}</span>
                            <span className="text-amber-700 font-medium">− {formatMoney(Number(c.monto_ars))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {cultivosDelCampo.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-zinc-400 italic">Sin cultivos registrados para este campo</div>
                  ) : (
                    cultivosDelCampo.map((cultivo) => {
                      const costoBase = Number(cultivo.costo_directo_ars ?? 0);
                      const costoRia = riasPorCultivo[cultivo.id] ?? 0;
                      const costoDirectoTotal = costoBase + costoRia;
                      const ingresoBrutoC = Number(cultivo.ingreso_bruto_ars ?? 0);
                      const margenBruto = ingresoBrutoC - costoDirectoTotal;
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
                                {ingresoBrutoC > 0 ? ` · Ingreso: ${formatMoney(ingresoBrutoC)}` : ''}
                                {costoDirectoTotal > 0 ? ` · Costo: ${formatMoney(costoDirectoTotal)}` : ''}
                              </p>
                              {costoRia > 0 && (
                                <p className="text-xs text-zinc-400 mt-0.5">
                                  RIA — Labores: {formatMoney(costoRia)}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-zinc-400">Margen bruto</p>
                              <p className={cn('text-sm font-bold', margenBruto >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                                {formatMoney(margenBruto)}
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
        </>
      )}

      {/* ── VISTA POR CULTIVO ─────────────────────────────────────────────────── */}
      {vista === 'cultivo' && (
        <>
          {datosPorCultivo.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <Sprout className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Sin cultivos registrados</p>
            </div>
          ) : (
            <>
              {/* Gráfico */}
              {chartCultivos.length > 0 && (
                <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-zinc-700 mb-4">Márgenes por tipo de cultivo</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, chartCultivos.length * 52)}>
                    <BarChart data={chartCultivos} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={160} tick={<CustomYTick />} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Ingreso" fill="#3b82f6" radius={[0, 2, 2, 0]} maxBarSize={16} />
                      <Bar dataKey="Costo" fill="#f59e0b" radius={[0, 2, 2, 0]} maxBarSize={16} />
                      <Bar dataKey="Margen" radius={[0, 2, 2, 0]} maxBarSize={16}>
                        {chartCultivos.map((d, i) => (
                          <Cell key={i} fill={d.Margen >= 0 ? '#006836' : '#dc2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tabla por cultivo */}
              <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Resumen por tipo de cultivo</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-zinc-100">
                      <tr className="text-left">
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400">Cultivo</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Lotes</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Ingreso bruto</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Costo directo</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Margen bruto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {datosPorCultivo.map((d, i) => (
                        <tr key={i} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-medium text-zinc-800">{d.label}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{d.lotes}</td>
                          <td className="px-4 py-3 text-right text-blue-600 font-medium">{d.ingreso > 0 ? formatMoney(d.ingreso) : '—'}</td>
                          <td className="px-4 py-3 text-right text-amber-600 font-medium">{d.costo > 0 ? formatMoney(d.costo) : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn('font-bold text-sm', d.margen >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                              {formatMoney(d.margen)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-zinc-200 bg-zinc-50">
                      <tr>
                        <td className="px-4 py-3 text-xs font-semibold text-zinc-600">Total empresa</td>
                        <td className="px-4 py-3 text-right text-zinc-400">{datosPorCultivo.reduce((a, d) => a + d.lotes, 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatMoney(totalIngresoBruto)}</td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatMoney(totalCostoDirecto)}</td>
                        <td className={cn('px-4 py-3 text-right font-bold', totalMargenLotes >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                          {formatMoney(totalMargenLotes)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight, color }: { label: string; value: number; highlight?: boolean; color?: string }) {
  const { formatMoney } = useCurrency();
  return (
    <div className={cn('rounded-xl p-3', highlight ? 'bg-white/10' : 'bg-white/5')}>
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className={cn('text-lg font-bold', color ? `text-${color}` : value >= 0 ? 'text-zinc-100' : 'text-red-400')}>
        {formatMoney(value)}
      </p>
    </div>
  );
}

function FinRow({ label, value, bold, amber }: { label: string; value: number; bold?: boolean; amber?: boolean }) {
  const { formatMoney } = useCurrency();
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={cn(
        'text-sm',
        bold && 'font-bold',
        amber ? 'text-amber-600' : value >= 0 ? 'text-[#006836]' : 'text-red-600',
      )}>
        {formatMoney(value)}
      </p>
    </div>
  );
}
