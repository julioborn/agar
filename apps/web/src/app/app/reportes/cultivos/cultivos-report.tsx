'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';
import ExportButtons, { ExportColumn } from '@/components/export-buttons';

interface CultivoRow {
  id: string;
  cultivo: string | null;
  estado: string;
  producto_final: string | null;
  ingreso_bruto_ars: number | null;
  costo_directo_ars: number | null;
  margen_bruto_ars: number | null;
  campania_id: string | null;
  lote: { id: string; nombre: string; hectareas: number | null; campo_id: string; campo: { nombre: string } | null } | null;
}
interface Props {
  cultivos: CultivoRow[];
  campanias: { id: string; nombre: string }[];
}

const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });


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

export default function CultivosReport({ cultivos, campanias }: Props) {
  const { formatMoney, currency, usdRate } = useCurrency();

  function fmtAxis(v: number) {
    const val = currency === 'USD' && usdRate ? v / usdRate : v;
    const prefix = currency === 'USD' ? 'U$S ' : '$ ';
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${prefix}${(val / 1_000).toFixed(0)}K`;
    return `${prefix}${val.toFixed(0)}`;
  }
  const [campaniaFiltro, setCampaniaFiltro] = useState('');

  function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1 min-w-[160px]">
        <p className="font-semibold text-zinc-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill }}>
            {p.name}: <strong>{p.name === 'Ha' ? `${fmt.format(p.value)} ha` : formatMoney(p.value)}</strong>
          </p>
        ))}
      </div>
    );
  }

  const cultivosFiltrados = useMemo(() =>
    campaniaFiltro ? cultivos.filter((c) => c.campania_id === campaniaFiltro) : cultivos,
    [cultivos, campaniaFiltro]);

  // Agrupar por tipo de cultivo
  const grupos = useMemo(() => {
    const map = new Map<string, {
      label: string;
      lotes: number;
      hectareas: number;
      ingreso: number;
      costo: number;
      margen: number;
      estados: Record<string, number>;
    }>();

    for (const c of cultivosFiltrados) {
      const raw = (c.cultivo ?? '').trim();
      if (!raw) {
        // sin cultivo
        const key = 'sin-cultivo';
        const label = 'Sin cultivo';
        const g = map.get(key) ?? { label, lotes: 0, hectareas: 0, ingreso: 0, costo: 0, margen: 0, estados: {} };
        const ha = c.lote?.hectareas ?? 0;
        const ingreso = Number(c.ingreso_bruto_ars ?? 0);
        const costo = Number(c.costo_directo_ars ?? 0);
        g.lotes += 1; g.hectareas += ha; g.ingreso += ingreso; g.costo += costo; g.margen += ingreso - costo;
        g.estados[c.estado] = (g.estados[c.estado] ?? 0) + 1;
        map.set(key, g);
        continue;
      }
      // Normalizar: split por coma, trim, filtrar vacíos, ordenar → key estable
      const tokens = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).sort();
      const key = tokens.join(', ');
      const label = raw.trim().toUpperCase();

      const ha = c.lote?.hectareas ?? 0;
      const ingreso = Number(c.ingreso_bruto_ars ?? 0);
      const costo = Number(c.costo_directo_ars ?? 0);
      const margen = ingreso - costo;

      const g = map.get(key) ?? {
        label,
        lotes: 0,
        hectareas: 0,
        ingreso: 0,
        costo: 0,
        margen: 0,
        estados: {},
      };

      g.lotes += 1;
      g.hectareas += ha;
      g.ingreso += ingreso;
      g.costo += costo;
      g.margen += margen;
      g.estados[c.estado] = (g.estados[c.estado] ?? 0) + 1;

      map.set(key, g);
    }

    return Array.from(map.values()).sort((a, b) => b.margen - a.margen);
  }, [cultivosFiltrados]);

  const totalHa = grupos.reduce((acc, g) => acc + g.hectareas, 0);
  const totalIngreso = grupos.reduce((acc, g) => acc + g.ingreso, 0);
  const totalCosto = grupos.reduce((acc, g) => acc + g.costo, 0);
  const totalMargen = grupos.reduce((acc, g) => acc + g.margen, 0);

  const chartMargen = grupos.filter((g) => g.ingreso + g.costo + Math.abs(g.margen) > 0).map((g) => ({
    name: g.label,
    Margen: g.margen,
    Ingreso: g.ingreso,
    Costo: g.costo,
  }));

  const chartHa = grupos.filter((g) => g.hectareas > 0).sort((a, b) => b.hectareas - a.hectareas).map((g) => ({
    name: g.label,
    Ha: g.hectareas,
  }));

  const exportData = useMemo(() => grupos.map((g) => ({
    label: g.label,
    lotes: g.lotes,
    hectareas: g.hectareas,
    ingreso: g.ingreso,
    costo: g.costo,
    margen: g.margen,
    margenPorHa: g.hectareas > 0 ? g.margen / g.hectareas : 0,
  })), [grupos]);

  const exportColumns: ExportColumn[] = [
    { header: 'Cultivo', key: 'label', width: 22 },
    { header: 'Lotes', key: 'lotes', width: 8, align: 'right' },
    { header: 'Ha', key: 'hectareas', width: 10, align: 'right', format: (v) => fmt.format(v) },
    { header: 'Ingreso bruto', key: 'ingreso', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Costo directo', key: 'costo', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Margen bruto', key: 'margen', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Margen/ha', key: 'margenPorHa', width: 14, align: 'right', format: (v) => formatMoney(v) },
  ];

  if (grupos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-16 text-center">
        <Sprout className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
        <p className="text-sm text-zinc-400">Sin cultivos registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtro campaña + Exportar */}
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
        <ExportButtons
          data={exportData}
          columns={exportColumns}
          filename="reporte-cultivos"
          title="Reporte de Cultivos"
          className="ml-auto"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Tipos de cultivo" value={grupos.length.toString()} color="bg-emerald-400" />
        <KpiCard label="Lotes totales" value={grupos.reduce((a, g) => a + g.lotes, 0).toString()} color="bg-blue-400" />
        <KpiCard label="Hectáreas totales" value={`${fmt.format(totalHa)} ha`} color="bg-amber-400" />
        <KpiCard label="Margen bruto total" value={formatMoney(totalMargen)} color={totalMargen >= 0 ? 'bg-[#006836]' : 'bg-red-500'} />
      </div>

      {/* Gráfico margen */}
      {chartMargen.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-700 mb-4">Márgenes por tipo de cultivo</p>
          <ResponsiveContainer width="100%" height={Math.max(200, chartMargen.length * 52)}>
            <BarChart data={chartMargen} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={160} tick={<CustomYTick />} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Ingreso" fill="#3b82f6" radius={[0, 2, 2, 0]} maxBarSize={14} />
              <Bar dataKey="Costo" fill="#f59e0b" radius={[0, 2, 2, 0]} maxBarSize={14} />
              <Bar dataKey="Margen" radius={[0, 2, 2, 0]} maxBarSize={14}>
                {chartMargen.map((d, i) => (
                  <Cell key={i} fill={d.Margen >= 0 ? '#006836' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico hectáreas */}
      {chartHa.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-700 mb-4">Hectáreas por tipo de cultivo</p>
          <ResponsiveContainer width="100%" height={Math.max(160, chartHa.length * 44)}>
            <BarChart data={chartHa} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={160} tick={<CustomYTick />} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Ha" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartHa.map((_, i) => (
                  <Cell key={i} fill="#10b981" opacity={1 - i * 0.07} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Detalle por tipo de cultivo</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-zinc-400">Cultivo</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Lotes</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Ha</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Ingreso bruto</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Costo directo</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Margen bruto</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Margen/ha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {grupos.map((g, i) => {
                const margenHa = g.hectareas > 0 ? g.margen / g.hectareas : null;
                return (
                  <tr key={i} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-800">{g.label}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{g.lotes}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {g.hectareas > 0 ? `${fmt.format(g.hectareas)} ha` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">
                      {g.ingreso > 0 ? formatMoney(g.ingreso) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 font-medium">
                      {g.costo > 0 ? formatMoney(g.costo) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-bold', g.margen >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                        {formatMoney(g.margen)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs">
                      {margenHa != null ? formatMoney(margenHa) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-200 bg-zinc-50">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold text-zinc-600">Total empresa</td>
                <td className="px-4 py-3 text-right text-zinc-400">{grupos.reduce((a, g) => a + g.lotes, 0)}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-700">
                  {totalHa > 0 ? `${fmt.format(totalHa)} ha` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatMoney(totalIngreso)}</td>
                <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatMoney(totalCosto)}</td>
                <td className={cn('px-4 py-3 text-right font-bold', totalMargen >= 0 ? 'text-[#006836]' : 'text-red-600')}>
                  {formatMoney(totalMargen)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-zinc-500 text-xs">
                  {totalHa > 0 ? formatMoney(totalMargen / totalHa) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color)} />
      <div>
        <p className="text-lg font-bold text-zinc-900 leading-none">{value}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
