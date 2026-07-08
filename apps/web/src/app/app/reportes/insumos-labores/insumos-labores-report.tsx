'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Package, Wrench, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';

interface RiaInfo {
  id: string;
  lote_id: string;
  superficie_afectada: number | null;
  cultivo_descripcion: string | null;
  campania_id: string | null;
  lote: { nombre: string; campo: { nombre: string } | null } | null;
}
interface InsumoRow {
  remito_id: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  producto: { id: string; nombre: string; unidad_base: string; categoria: string } | null;
}
interface LaborRow {
  remito_id: string;
  tipo_labor_nombre: string | null;
  descripcion: string;
  prestador_nombre: string | null;
  unidad_medida: string;
  cantidad: number;
  tarifa: number;
  subtotal: number;
}
interface Props {
  rias: RiaInfo[];
  insumos: InsumoRow[];
  labores: LaborRow[];
  campanias: { id: string; nombre: string }[];
}

const qty = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });


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

export default function InsumosLaboresReport({ rias, insumos, labores, campanias }: Props) {
  const { formatMoney, currency, usdRate } = useCurrency();

  function fmtAxis(v: number) {
    const val = currency === 'USD' && usdRate ? v / usdRate : v;
    const prefix = currency === 'USD' ? 'U$S ' : '$ ';
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${prefix}${(val / 1_000).toFixed(0)}K`;
    return `${prefix}${val.toFixed(0)}`;
  }
  const [tab, setTab] = useState<'insumos' | 'labores'>('insumos');

  function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
        <p className="font-semibold text-zinc-700 truncate max-w-[180px]">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill }}>
            {p.name}: <strong>{formatMoney(p.value)}</strong>
          </p>
        ))}
      </div>
    );
  }
  const [campaniaFiltro, setCampaniaFiltro] = useState('');

  // IDs de RIAs filtrados por campaña
  const riaIdsFiltrados = useMemo(() => {
    if (!campaniaFiltro) return new Set(rias.map((r) => r.id));
    return new Set(rias.filter((r) => r.campania_id === campaniaFiltro).map((r) => r.id));
  }, [rias, campaniaFiltro]);

  // ── Insumos agrupados por producto ───────────────────────────────────────────
  const insumosPorProducto = useMemo(() => {
    const map = new Map<string, {
      nombre: string; unidad: string; categoria: string;
      cantidadTotal: number; costoTotal: number; usos: number;
    }>();
    for (const i of insumos) {
      if (!riaIdsFiltrados.has(i.remito_id)) continue;
      const id = i.producto?.id ?? 'sin-producto';
      const g = map.get(id) ?? {
        nombre: i.producto?.nombre ?? '—',
        unidad: i.producto?.unidad_base ?? '',
        categoria: i.producto?.categoria ?? '',
        cantidadTotal: 0,
        costoTotal: 0,
        usos: 0,
      };
      g.cantidadTotal += Number(i.cantidad);
      g.costoTotal += Number(i.subtotal);
      g.usos += 1;
      map.set(id, g);
    }
    return Array.from(map.values()).sort((a, b) => b.costoTotal - a.costoTotal);
  }, [insumos, riaIdsFiltrados]);

  // ── Labores agrupadas por tipo ────────────────────────────────────────────────
  const laboresPorTipo = useMemo(() => {
    const map = new Map<string, {
      nombre: string; cantidadTotal: number; costoTotal: number; usos: number;
    }>();
    for (const l of labores) {
      if (!riaIdsFiltrados.has(l.remito_id)) continue;
      const key = l.tipo_labor_nombre ?? l.descripcion ?? 'Sin tipo';
      const g = map.get(key) ?? { nombre: key, cantidadTotal: 0, costoTotal: 0, usos: 0 };
      g.cantidadTotal += Number(l.cantidad);
      g.costoTotal += Number(l.subtotal);
      g.usos += 1;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.costoTotal - a.costoTotal);
  }, [labores, riaIdsFiltrados]);

  const totalInsumos = insumosPorProducto.reduce((acc, i) => acc + i.costoTotal, 0);
  const totalLabores = laboresPorTipo.reduce((acc, l) => acc + l.costoTotal, 0);

  const chartInsumos = insumosPorProducto.slice(0, 10).map((i) => ({
    name: i.nombre,
    fullName: i.nombre,
    Costo: i.costoTotal,
  }));

  const chartLabores = laboresPorTipo.slice(0, 10).map((l) => ({
    name: l.nombre,
    fullName: l.nombre,
    Costo: l.costoTotal,
  }));

  const isEmpty = tab === 'insumos' ? insumosPorProducto.length === 0 : laboresPorTipo.length === 0;

  return (
    <div className="space-y-5">
      {/* Filtro + Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        {campanias.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-zinc-600">Campaña:</label>
            <select
              value={campaniaFiltro}
              onChange={(e) => setCampaniaFiltro(e.target.value)}
              className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="">Todas</option>
              {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="flex rounded-xl border border-zinc-200 overflow-hidden bg-white ml-auto">
          {([['insumos', Package, 'Insumos'], ['labores', Wrench, 'Labores']] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                tab === id
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tab === 'insumos' ? (
          <>
            <KpiCard label="Costo total insumos" value={formatMoney(totalInsumos)} color="bg-amber-400" />
            <KpiCard label="Productos distintos" value={insumosPorProducto.length.toString()} color="bg-[#006836]" />
            <KpiCard label="Usos registrados" value={insumos.filter((i) => riaIdsFiltrados.has(i.remito_id)).length.toString()} color="bg-blue-400" />
          </>
        ) : (
          <>
            <KpiCard label="Costo total labores" value={formatMoney(totalLabores)} color="bg-orange-400" />
            <KpiCard label="Tipos de labor" value={laboresPorTipo.length.toString()} color="bg-[#006836]" />
            <KpiCard label="Usos registrados" value={labores.filter((l) => riaIdsFiltrados.has(l.remito_id)).length.toString()} color="bg-blue-400" />
          </>
        )}
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-16 text-center">
          <Package className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Sin datos para el filtro seleccionado</p>
        </div>
      ) : (
        <>
          {/* Gráfico */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-700 mb-4">
              {tab === 'insumos' ? 'Top 10 insumos por costo' : 'Top 10 labores por costo'}
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={tab === 'insumos' ? chartInsumos : chartLabores}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              >
                <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={160} tick={<CustomYTick />} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Costo" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {(tab === 'insumos' ? chartInsumos : chartLabores).map((_, i) => (
                    <Cell
                      key={i}
                      fill={tab === 'insumos' ? '#f59e0b' : '#f97316'}
                      opacity={1 - i * 0.06}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                {tab === 'insumos' ? 'Detalle por producto' : 'Detalle por tipo de labor'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-100">
                  <tr className="text-left">
                    {tab === 'insumos' ? (
                      <>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400">Producto</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400">Categoría</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Cantidad total</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Costo total</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Usos</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400">Labor</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Cantidad total</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Costo total</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Usos</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {tab === 'insumos'
                    ? insumosPorProducto.map((i, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-medium text-zinc-800">{i.nombre}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs capitalize">{i.categoria || '—'}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{qty.format(i.cantidadTotal)} {i.unidad}</td>
                          <td className="px-4 py-3 text-right font-semibold text-zinc-900">{formatMoney(i.costoTotal)}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{i.usos}</td>
                        </tr>
                      ))
                    : laboresPorTipo.map((l, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-medium text-zinc-800">{l.nombre}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{qty.format(l.cantidadTotal)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-zinc-900">{formatMoney(l.costoTotal)}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{l.usos}</td>
                        </tr>
                      ))}
                </tbody>
                <tfoot className="border-t border-zinc-200 bg-zinc-50">
                  <tr>
                    {tab === 'insumos' ? (
                      <>
                        <td className="px-4 py-3 text-xs font-semibold text-zinc-600" colSpan={3}>Total</td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatMoney(totalInsumos)}</td>
                        <td />
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-xs font-semibold text-zinc-600" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatMoney(totalLabores)}</td>
                        <td />
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
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
