'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Sprout, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiaInfo {
  id: string;
  lote_id: string;
  superficie_afectada: number | null;
  cultivo_descripcion: string | null;
  campania_id: string | null;
  lote: { nombre: string; campo: { nombre: string } | null } | null;
}
interface ProduccionRow {
  remito_id: string;
  cantidad: number;
  humedad_porcentaje: number | null;
  precio_referencia: number | null;
  subtotal_valor: number | null;
  producto: { nombre: string; unidad_base: string } | null;
}
interface Props {
  rias: RiaInfo[];
  produccion: ProduccionRow[];
  campanias: { id: string; nombre: string }[];
}

const qty = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const ars = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

function fmtAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-zinc-700 truncate max-w-[180px]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill ?? p.stroke }}>
          {p.name}: <strong>{qty.format(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

export default function ProduccionReport({ rias, produccion, campanias }: Props) {
  const [tab, setTab] = useState<'cultivo' | 'lote'>('cultivo');
  const [campaniaFiltro, setCampaniaFiltro] = useState('');

  const riaIdsFiltrados = useMemo(() => {
    if (!campaniaFiltro) return new Set(rias.map((r) => r.id));
    return new Set(rias.filter((r) => r.campania_id === campaniaFiltro).map((r) => r.id));
  }, [rias, campaniaFiltro]);

  // Mapa remito_id → ria info
  const riaMap = useMemo(() => {
    const m = new Map<string, RiaInfo>();
    for (const r of rias) m.set(r.id, r);
    return m;
  }, [rias]);

  // ── Por cultivo (agrupado por cultivo_descripcion del remito) ─────────────────
  const produccionPorCultivo = useMemo(() => {
    const map = new Map<string, { cultivo: string; cantidad: number; valorTotal: number; lotes: Set<string> }>();
    for (const p of produccion) {
      if (!riaIdsFiltrados.has(p.remito_id)) continue;
      const ria = riaMap.get(p.remito_id);
      const key = ria?.cultivo_descripcion ?? p.producto?.nombre ?? 'Sin cultivo';
      const g = map.get(key) ?? { cultivo: key, cantidad: 0, valorTotal: 0, lotes: new Set() };
      g.cantidad += Number(p.cantidad);
      g.valorTotal += Number(p.subtotal_valor ?? 0);
      if (ria?.lote_id) g.lotes.add(ria.lote_id);
      map.set(key, g);
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, loteCount: g.lotes.size }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [produccion, riaIdsFiltrados, riaMap]);

  // ── Por lote (tn/ha) ──────────────────────────────────────────────────────────
  const produccionPorLote = useMemo(() => {
    const map = new Map<string, {
      loteNombre: string; campoNombre: string; cultivo: string;
      cantidad: number; superficie: number | null;
    }>();
    for (const p of produccion) {
      if (!riaIdsFiltrados.has(p.remito_id)) continue;
      const ria = riaMap.get(p.remito_id);
      const key = ria?.lote_id ?? p.remito_id;
      const g = map.get(key) ?? {
        loteNombre: ria?.lote?.nombre ?? '—',
        campoNombre: ria?.lote?.campo?.nombre ?? '—',
        cultivo: ria?.cultivo_descripcion ?? '—',
        cantidad: 0,
        superficie: ria?.superficie_afectada ?? null,
      };
      g.cantidad += Number(p.cantidad);
      map.set(key, g);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        tnPorHa: g.superficie && g.superficie > 0 ? g.cantidad / g.superficie : null,
      }))
      .sort((a, b) => (b.tnPorHa ?? 0) - (a.tnPorHa ?? 0));
  }, [produccion, riaIdsFiltrados, riaMap]);

  const totalProduccion = produccionPorCultivo.reduce((acc, g) => acc + g.cantidad, 0);
  const totalValor = produccionPorCultivo.reduce((acc, g) => acc + g.valorTotal, 0);

  const chartCultivo = produccionPorCultivo.slice(0, 8).map((g) => ({
    name: g.cultivo.length > 22 ? g.cultivo.slice(0, 20) + '…' : g.cultivo,
    fullName: g.cultivo,
    Producción: g.cantidad,
  }));

  const chartLote = produccionPorLote.filter((l) => l.tnPorHa != null).slice(0, 10).map((l) => ({
    name: l.loteNombre.length > 18 ? l.loteNombre.slice(0, 16) + '…' : l.loteNombre,
    fullName: `${l.campoNombre} › ${l.loteNombre}`,
    'tn/ha': Number(l.tnPorHa!.toFixed(2)),
  }));

  const noData = produccion.filter((p) => riaIdsFiltrados.has(p.remito_id)).length === 0;

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
          {([['cultivo', Sprout, 'Por Cultivo'], ['lote', Layers, 'Por Lote']] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                tab === id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {noData ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-16 text-center">
          <Sprout className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Sin producción registrada aún</p>
          <p className="text-xs text-zinc-300 mt-1">La producción se registra en los RIAs confirmados</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Producción total" value={`${qty.format(totalProduccion)} u`} color="bg-blue-400" />
            <KpiCard label={tab === 'cultivo' ? 'Cultivos distintos' : 'Lotes con producción'} value={(tab === 'cultivo' ? produccionPorCultivo.length : produccionPorLote.length).toString()} color="bg-[#006836]" />
            {totalValor > 0 && <KpiCard label="Valor estimado" value={`$${ars.format(totalValor)}`} color="bg-amber-400" />}
          </div>

          {/* Gráfico */}
          {tab === 'cultivo' && chartCultivo.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
              <p className="text-sm font-semibold text-zinc-700 mb-4">Producción por cultivo</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartCultivo} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Producción" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {chartCultivo.map((_, i) => (
                      <Cell key={i} fill="#3b82f6" opacity={1 - i * 0.07} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {tab === 'lote' && chartLote.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
              <p className="text-sm font-semibold text-zinc-700 mb-4">Rendimiento por lote (unidades/ha)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartLote} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="tn/ha" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {chartLote.map((_, i) => (
                      <Cell key={i} fill="#22c55e" opacity={1 - i * 0.07} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                {tab === 'cultivo' ? 'Producción por tipo de cultivo' : 'Producción y rendimiento por lote'}
              </p>
            </div>
            <div className="overflow-x-auto">
              {tab === 'cultivo' ? (
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-100">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400">Cultivo</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Producción total</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Lotes</th>
                      {totalValor > 0 && <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Valor estimado</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {produccionPorCultivo.map((g, i) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-800 capitalize">{g.cultivo}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">{qty.format(g.cantidad)}</td>
                        <td className="px-4 py-3 text-right text-zinc-400">{g.loteCount}</td>
                        {totalValor > 0 && <td className="px-4 py-3 text-right text-zinc-700">{g.valorTotal > 0 ? `$${ars.format(g.valorTotal)}` : '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-zinc-200 bg-zinc-50">
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-zinc-600">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-900">{qty.format(totalProduccion)}</td>
                      <td />
                      {totalValor > 0 && <td className="px-4 py-3 text-right font-bold text-zinc-900">${ars.format(totalValor)}</td>}
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-100">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400">Campo › Lote</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400">Cultivo</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Producción</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Superficie</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Rend./ha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {produccionPorLote.map((l, i) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-800">
                          <span className="text-zinc-400">{l.campoNombre} › </span>{l.loteNombre}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs capitalize">{l.cultivo}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">{qty.format(l.cantidad)}</td>
                        <td className="px-4 py-3 text-right text-zinc-400">{l.superficie ? `${qty.format(l.superficie)} ha` : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {l.tnPorHa != null
                            ? <span className="font-semibold text-blue-600">{qty.format(l.tnPorHa)}</span>
                            : <span className="text-zinc-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
