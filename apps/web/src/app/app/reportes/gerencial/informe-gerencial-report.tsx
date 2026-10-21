'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Filter, ChevronDown, ChevronUp, X, FileSpreadsheet, FileText, Loader2,
  Wallet, Layers, MapPin, TrendingUp, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';
import type {
  InformeGerencialData, KpiData, CampaniaAgg, CultivoAgg, LoteAgg, InsumoAgg, LaborAgg,
} from './types';

// ── Tipos de entrada (tal como llegan del server component) ────────────────

interface RiaRow {
  id: string;
  fecha: string;
  lote_id: string;
  campania_id: string | null;
  cultivo_id: string | null;
  cultivo_descripcion: string | null;
  superficie_afectada: number | null;
  lote: { nombre: string; hectareas: number; campo: { nombre: string } | null } | null;
  campania: { nombre: string } | null;
  cultivo: { cultivo: string } | null;
}
interface InsumoRow {
  remito_id: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  producto: { id: string; nombre: string; categoria: string; unidad_base: string } | null;
}
interface LaborRow {
  remito_id: string;
  tipo_labor_nombre: string | null;
  descripcion: string;
  cantidad: number;
  tarifa: number;
  subtotal: number;
  unidad_medida: string;
}
interface ProduccionRow {
  remito_id: string;
  cantidad: number;
  subtotal_valor: number | null;
  precio_referencia: number | null;
  producto: { nombre: string } | null;
}
interface Props {
  rias: RiaRow[];
  insumos: InsumoRow[];
  labores: LaborRow[];
  produccion: ProduccionRow[];
  campanias: { id: string; nombre: string }[];
  empresaNombre: string;
}

const num  = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const pesos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const normCultivo = (r: RiaRow) => (r.cultivo?.cultivo || r.cultivo_descripcion || 'SIN CULTIVO').toUpperCase().trim();

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-zinc-700 truncate max-w-[200px]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill ?? p.stroke }}>
          {p.name}: <strong>${pesos.format(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}
function wrapLabel(text: string, maxChars = 22): string[] {
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
  const lh = 12;
  const startY = -((lines.length - 1) * lh) / 2;
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={startY + i * lh} textAnchor="end" fill="#52525b" fontSize={10}>{line}</text>
      ))}
    </g>
  );
}

function KpiCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold text-zinc-900 leading-tight truncate">{value}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, data, dataKey, color, formatValue }: {
  title: string; data: { name: string; value: number }[]; dataKey: string; color: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
      <p className="text-sm font-semibold text-zinc-700 mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
          <XAxis type="number" tickFormatter={(v) => formatValue ? formatValue(v) : `$${pesos.format(v)}`} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={170} tick={<CustomYTick />} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey={dataKey} name={title} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((_, i) => <Cell key={i} fill={color} opacity={1 - i * 0.06} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function InformeGerencialReport({ rias, insumos, labores, produccion, campanias, empresaNombre }: Props) {
  const { formatMoney, currency, usdRate } = useCurrency();
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [campaniaFiltro, setCampaniaFiltro] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  const filtrosActivos = [fechaDesde, fechaHasta, campaniaFiltro].filter(Boolean).length;
  const limpiarFiltros = () => { setFechaDesde(''); setFechaHasta(''); setCampaniaFiltro(''); };

  // ── Filtrado base ──────────────────────────────────────────────────────────
  const riasFiltradas = useMemo(() => rias.filter((r) => {
    if (fechaDesde && r.fecha < fechaDesde) return false;
    if (fechaHasta && r.fecha > fechaHasta) return false;
    if (campaniaFiltro && r.campania_id !== campaniaFiltro) return false;
    return true;
  }), [rias, fechaDesde, fechaHasta, campaniaFiltro]);

  const data = useMemo<InformeGerencialData>(() => {
    const riaIds = new Set(riasFiltradas.map((r) => r.id));
    const riaById = new Map(riasFiltradas.map((r) => [r.id, r]));
    const insumosF = insumos.filter((i) => riaIds.has(i.remito_id));
    const laboresF = labores.filter((l) => riaIds.has(l.remito_id));
    const produccionF = produccion.filter((p) => riaIds.has(p.remito_id));

    // Costo/ingreso por RIA (para poder agregar por cualquier dimensión sin recorrer 3 listas por vista)
    const costoInsPorRia = new Map<string, number>();
    for (const i of insumosF) costoInsPorRia.set(i.remito_id, (costoInsPorRia.get(i.remito_id) ?? 0) + Number(i.subtotal ?? 0));
    const costoLabPorRia = new Map<string, number>();
    for (const l of laboresF) costoLabPorRia.set(l.remito_id, (costoLabPorRia.get(l.remito_id) ?? 0) + Number(l.subtotal ?? 0));
    const ingresoPorRia = new Map<string, number>();
    for (const p of produccionF) {
      const v = Number(p.subtotal_valor ?? (Number(p.cantidad ?? 0) * Number(p.precio_referencia ?? 0)));
      ingresoPorRia.set(p.remito_id, (ingresoPorRia.get(p.remito_id) ?? 0) + v);
    }

    const haDeRia = (r: RiaRow) => Number(r.superficie_afectada ?? r.lote?.hectareas ?? 0);

    // ── KPIs ────────────────────────────────────────────────────────────────
    const hectareas = riasFiltradas.reduce((s, r) => s + haDeRia(r), 0);
    const costoInsumos = insumosF.reduce((s, i) => s + Number(i.subtotal ?? 0), 0);
    const costoLabores = laboresF.reduce((s, l) => s + Number(l.subtotal ?? 0), 0);
    const costoTotal = costoInsumos + costoLabores;
    const ingresoBruto = produccionF.reduce((s, p) => s + Number(p.subtotal_valor ?? (Number(p.cantidad ?? 0) * Number(p.precio_referencia ?? 0))), 0);
    const kpis: KpiData = {
      riasCount: riasFiltradas.length,
      hectareas,
      costoInsumos,
      costoLabores,
      costoTotal,
      costoPorHa: hectareas > 0 ? costoTotal / hectareas : null,
      lotesDistintos: new Set(riasFiltradas.map((r) => r.lote_id)).size,
      cultivosDistintos: new Set(riasFiltradas.map(normCultivo)).size,
      ingresoBruto,
      margen: ingresoBruto - costoTotal,
    };

    // ── Por campaña ─────────────────────────────────────────────────────────
    const campaniaMap = new Map<string, CampaniaAgg>();
    for (const r of riasFiltradas) {
      const key = r.campania_id ?? '_sin_';
      const nombre = r.campania?.nombre ?? 'Sin campaña';
      if (!campaniaMap.has(key)) campaniaMap.set(key, { nombre, hectareas: 0, costoInsumos: 0, costoLabores: 0, costoTotal: 0, costoPorHa: null, ingresoBruto: 0, margen: 0, riasCount: 0 });
      const g = campaniaMap.get(key)!;
      g.hectareas += haDeRia(r);
      g.costoInsumos += costoInsPorRia.get(r.id) ?? 0;
      g.costoLabores += costoLabPorRia.get(r.id) ?? 0;
      g.ingresoBruto += ingresoPorRia.get(r.id) ?? 0;
      g.riasCount += 1;
    }
    const porCampania = [...campaniaMap.values()].map((g) => ({
      ...g, costoTotal: g.costoInsumos + g.costoLabores,
      costoPorHa: g.hectareas > 0 ? (g.costoInsumos + g.costoLabores) / g.hectareas : null,
      margen: g.ingresoBruto - (g.costoInsumos + g.costoLabores),
    })).sort((a, b) => b.costoTotal - a.costoTotal);

    // ── Por cultivo ─────────────────────────────────────────────────────────
    const cultivoMap = new Map<string, CultivoAgg & { lotesSet: Set<string> }>();
    for (const r of riasFiltradas) {
      const key = normCultivo(r);
      if (!cultivoMap.has(key)) cultivoMap.set(key, { cultivo: key, hectareas: 0, costoInsumos: 0, costoLabores: 0, costoTotal: 0, costoPorHa: null, ingresoBruto: 0, margen: 0, lotesCount: 0, riasCount: 0, lotesSet: new Set() });
      const g = cultivoMap.get(key)!;
      g.hectareas += haDeRia(r);
      g.costoInsumos += costoInsPorRia.get(r.id) ?? 0;
      g.costoLabores += costoLabPorRia.get(r.id) ?? 0;
      g.ingresoBruto += ingresoPorRia.get(r.id) ?? 0;
      g.riasCount += 1;
      g.lotesSet.add(r.lote_id);
    }
    const porCultivo = [...cultivoMap.values()].map((g) => ({
      cultivo: g.cultivo, hectareas: g.hectareas, costoInsumos: g.costoInsumos, costoLabores: g.costoLabores,
      costoTotal: g.costoInsumos + g.costoLabores,
      costoPorHa: g.hectareas > 0 ? (g.costoInsumos + g.costoLabores) / g.hectareas : null,
      ingresoBruto: g.ingresoBruto, margen: g.ingresoBruto - (g.costoInsumos + g.costoLabores),
      lotesCount: g.lotesSet.size, riasCount: g.riasCount,
    })).sort((a, b) => b.costoTotal - a.costoTotal);

    // ── Por lote ────────────────────────────────────────────────────────────
    const loteMap = new Map<string, LoteAgg & { cultivosSet: Set<string> }>();
    for (const r of riasFiltradas) {
      const key = r.lote_id;
      if (!loteMap.has(key)) loteMap.set(key, {
        loteNombre: r.lote?.nombre ?? 'Sin nombre', campoNombre: r.lote?.campo?.nombre ?? '—',
        hectareas: Number(r.lote?.hectareas ?? 0), cultivos: '', riasCount: 0,
        costoInsumos: 0, costoLabores: 0, costoTotal: 0, costoPorHa: null, ingresoBruto: 0, margen: 0,
        cultivosSet: new Set(),
      });
      const g = loteMap.get(key)!;
      g.costoInsumos += costoInsPorRia.get(r.id) ?? 0;
      g.costoLabores += costoLabPorRia.get(r.id) ?? 0;
      g.ingresoBruto += ingresoPorRia.get(r.id) ?? 0;
      g.riasCount += 1;
      g.cultivosSet.add(normCultivo(r));
    }
    const porLote = [...loteMap.values()].map((g) => ({
      loteNombre: g.loteNombre, campoNombre: g.campoNombre, hectareas: g.hectareas,
      cultivos: [...g.cultivosSet].join(', '), riasCount: g.riasCount,
      costoInsumos: g.costoInsumos, costoLabores: g.costoLabores, costoTotal: g.costoInsumos + g.costoLabores,
      costoPorHa: g.hectareas > 0 ? (g.costoInsumos + g.costoLabores) / g.hectareas : null,
      ingresoBruto: g.ingresoBruto, margen: g.ingresoBruto - (g.costoInsumos + g.costoLabores),
    })).sort((a, b) => b.costoTotal - a.costoTotal);

    // ── Insumos ─────────────────────────────────────────────────────────────
    const insumoMap = new Map<string, InsumoAgg & { lotesSet: Set<string> }>();
    for (const i of insumosF) {
      const key = i.producto?.id ?? i.producto?.nombre ?? 'desconocido';
      if (!insumoMap.has(key)) insumoMap.set(key, {
        nombre: i.producto?.nombre ?? 'Producto sin catalogar', categoria: i.producto?.categoria ?? '—',
        unidadBase: i.producto?.unidad_base ?? '', cantidadTotal: 0, costoTotal: 0, pctTotal: 0, lotesCount: 0,
        lotesSet: new Set(),
      });
      const g = insumoMap.get(key)!;
      g.cantidadTotal += Number(i.cantidad ?? 0);
      g.costoTotal += Number(i.subtotal ?? 0);
      const ria = riaById.get(i.remito_id);
      if (ria) g.lotesSet.add(ria.lote_id);
    }
    const insumosArr = [...insumoMap.values()].map((g) => ({
      nombre: g.nombre, categoria: g.categoria, unidadBase: g.unidadBase, cantidadTotal: g.cantidadTotal,
      costoTotal: g.costoTotal, pctTotal: costoInsumos > 0 ? (g.costoTotal / costoInsumos) * 100 : 0,
      lotesCount: g.lotesSet.size,
    })).sort((a, b) => b.costoTotal - a.costoTotal);

    // ── Labores ─────────────────────────────────────────────────────────────
    const laborMap = new Map<string, LaborAgg>();
    for (const l of laboresF) {
      const key = l.tipo_labor_nombre || l.descripcion || 'Sin tipo';
      if (!laborMap.has(key)) laborMap.set(key, { nombre: key, cantidadTotal: 0, unidad: l.unidad_medida, costoTotal: 0, pctTotal: 0, riasCount: 0, tarifaPromedio: null });
      const g = laborMap.get(key)!;
      g.cantidadTotal += Number(l.cantidad ?? 0);
      g.costoTotal += Number(l.subtotal ?? 0);
      g.riasCount += 1;
    }
    const laboresArr = [...laborMap.values()].map((g) => ({
      ...g, pctTotal: costoLabores > 0 ? (g.costoTotal / costoLabores) * 100 : 0,
      tarifaPromedio: g.cantidadTotal > 0 ? g.costoTotal / g.cantidadTotal : null,
    })).sort((a, b) => b.costoTotal - a.costoTotal);

    const periodoLabel = fechaDesde || fechaHasta
      ? `${fechaDesde ? fmtDate(fechaDesde) : 'inicio'} — ${fechaHasta ? fmtDate(fechaHasta) : 'hoy'}`
      : 'Todo el histórico';
    const campaniaLabel = campaniaFiltro ? (campanias.find((c) => c.id === campaniaFiltro)?.nombre ?? '') : 'Todas las campañas';

    return { empresaNombre, periodoLabel, campaniaLabel, kpis, porCampania, porCultivo, porLote, insumos: insumosArr, labores: laboresArr };
  }, [riasFiltradas, insumos, labores, produccion, fechaDesde, fechaHasta, campaniaFiltro, campanias, empresaNombre]);

  const slug = empresaNombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const today = new Date().toISOString().split('T')[0];

  async function handlePdf() {
    setLoadingPdf(true);
    try {
      const { generateInformeGerencialPdf } = await import('./informe-gerencial-pdf');
      await generateInformeGerencialPdf(data, currency, usdRate);
    } finally {
      setLoadingPdf(false);
    }
  }
  async function handleExcel() {
    setLoadingXlsx(true);
    try {
      const { exportInformeGerencialExcel } = await import('./informe-gerencial-excel');
      await exportInformeGerencialExcel(data, `informe-gerencial-${slug}-${today}`, currency, usdRate);
    } finally {
      setLoadingXlsx(false);
    }
  }

  const sinDatos = riasFiltradas.length === 0;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
            showFilters ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300',
          )}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {filtrosActivos > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {filtrosActivos}
            </span>
          )}
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {filtrosActivos > 0 && (
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExcel}
            disabled={loadingXlsx || sinDatos}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loadingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Excel
          </button>
          <button
            onClick={handlePdf}
            disabled={loadingPdf || sinDatos}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            PDF
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Campaña</label>
            <select value={campaniaFiltro} onChange={(e) => setCampaniaFiltro(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white">
              <option value="">Todas</option>
              {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      {sinDatos ? (
        <div className="text-center py-16 text-zinc-400 bg-white border border-zinc-100 rounded-2xl">
          Sin RIA confirmados para los filtros aplicados.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="RIA confirmados" value={num.format(data.kpis.riasCount)} color="bg-zinc-700" icon={FileText} />
            <KpiCard label="Hectáreas trabajadas" value={`${num.format(data.kpis.hectareas)} ha`} color="bg-[#006836]" icon={MapPin} />
            <KpiCard label="Lotes distintos" value={num.format(data.kpis.lotesDistintos)} color="bg-teal-600" icon={Layers} />
            <KpiCard label="Costo total" value={formatMoney(data.kpis.costoTotal)} color="bg-amber-600" icon={Wallet} />
            <KpiCard label="Costo / ha" value={data.kpis.costoPorHa != null ? formatMoney(data.kpis.costoPorHa) : '—'} color="bg-orange-600" icon={Wallet} />
            <KpiCard label="Costo insumos" value={formatMoney(data.kpis.costoInsumos)} color="bg-blue-600" icon={Wallet} />
            <KpiCard label="Costo labores" value={formatMoney(data.kpis.costoLabores)} color="bg-violet-600" icon={Wallet} />
            <KpiCard label="Ingreso bruto" value={formatMoney(data.kpis.ingresoBruto)} color="bg-emerald-600" icon={TrendingUp} />
            <KpiCard label="Margen" value={formatMoney(data.kpis.margen)} color={data.kpis.margen >= 0 ? 'bg-emerald-600' : 'bg-red-600'} icon={data.kpis.margen >= 0 ? TrendingUp : TrendingDown} />
            <KpiCard label="Cultivos distintos" value={num.format(data.kpis.cultivosDistintos)} color="bg-indigo-600" icon={Layers} />
          </div>

          {/* Evolución por campaña */}
          <Section title="Evolución por campaña">
            <ChartCard title="Costo total por campaña" data={data.porCampania.map((c) => ({ name: c.nombre, value: c.costoTotal }))} dataKey="value" color="#006836" />
            <Tabla
              cols={['Campaña', 'Hectáreas', 'Costo insumos', 'Costo labores', 'Costo total', 'Costo/ha', 'Ingreso bruto', 'Margen', 'RIA']}
              rows={data.porCampania.map((c) => [
                c.nombre, num.format(c.hectareas), formatMoney(c.costoInsumos), formatMoney(c.costoLabores),
                formatMoney(c.costoTotal), c.costoPorHa != null ? formatMoney(c.costoPorHa) : '—',
                formatMoney(c.ingresoBruto), formatMoney(c.margen), num.format(c.riasCount),
              ])}
            />
          </Section>

          {/* Por cultivo */}
          <Section title="Por cultivo">
            <ChartCard title="Costo por hectárea por cultivo" data={data.porCultivo.map((c) => ({ name: c.cultivo, value: c.costoPorHa ?? 0 }))} dataKey="value" color="#059669" />
            <Tabla
              cols={['Cultivo', 'Hectáreas', 'Lotes', 'Costo insumos', 'Costo labores', 'Costo total', 'Costo/ha', 'Ingreso bruto', 'Margen']}
              rows={data.porCultivo.map((c) => [
                c.cultivo, num.format(c.hectareas), num.format(c.lotesCount), formatMoney(c.costoInsumos), formatMoney(c.costoLabores),
                formatMoney(c.costoTotal), c.costoPorHa != null ? formatMoney(c.costoPorHa) : '—',
                formatMoney(c.ingresoBruto), formatMoney(c.margen),
              ])}
            />
          </Section>

          {/* Por lote */}
          <Section title="Por lote">
            <ChartCard title="Top 10 lotes por costo total" data={data.porLote.slice(0, 10).map((l) => ({ name: `${l.campoNombre} › ${l.loteNombre}`, value: l.costoTotal }))} dataKey="value" color="#d97706" />
            <Tabla
              cols={['Campo', 'Lote', 'Hectáreas', 'Cultivo(s)', 'RIA', 'Costo insumos', 'Costo labores', 'Costo total', 'Costo/ha', 'Ingreso bruto', 'Margen']}
              rows={data.porLote.map((l) => [
                l.campoNombre, l.loteNombre, num.format(l.hectareas), l.cultivos || '—', num.format(l.riasCount),
                formatMoney(l.costoInsumos), formatMoney(l.costoLabores), formatMoney(l.costoTotal),
                l.costoPorHa != null ? formatMoney(l.costoPorHa) : '—', formatMoney(l.ingresoBruto), formatMoney(l.margen),
              ])}
            />
          </Section>

          {/* Insumos */}
          <Section title="Insumos">
            <ChartCard title="Top 10 insumos por costo" data={data.insumos.slice(0, 10).map((i) => ({ name: i.nombre, value: i.costoTotal }))} dataKey="value" color="#2563eb" />
            <Tabla
              cols={['Insumo', 'Categoría', 'Cantidad', 'Costo total', '% del total', 'Lotes']}
              rows={data.insumos.map((i) => [
                i.nombre, i.categoria, `${num.format(i.cantidadTotal)} ${i.unidadBase}`, formatMoney(i.costoTotal),
                `${num.format(i.pctTotal)}%`, num.format(i.lotesCount),
              ])}
            />
          </Section>

          {/* Labores */}
          <Section title="Labores">
            <ChartCard title="Top 10 labores por costo" data={data.labores.slice(0, 10).map((l) => ({ name: l.nombre, value: l.costoTotal }))} dataKey="value" color="#7c3aed" />
            <Tabla
              cols={['Labor', 'Cantidad', 'Unidad', 'Costo total', '% del total', 'RIA', 'Tarifa prom.']}
              rows={data.labores.map((l) => [
                l.nombre, num.format(l.cantidadTotal), l.unidad, formatMoney(l.costoTotal),
                `${num.format(l.pctTotal)}%`, num.format(l.riasCount), l.tarifaPromedio != null ? formatMoney(l.tarifaPromedio) : '—',
              ])}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Tabla({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return <div className="text-center py-8 text-sm text-zinc-400 bg-white border border-zinc-100 rounded-2xl">Sin datos para este bloque.</div>;
  }
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
            <tr>
              {cols.map((c, i) => (
                <th key={i} className={cn('px-4 py-2.5 text-xs font-medium text-zinc-400 whitespace-nowrap', i > 0 && 'text-right')}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-zinc-50/60">
                {row.map((cell, ci) => (
                  <td key={ci} className={cn('px-4 py-2 whitespace-nowrap', ci === 0 ? 'font-medium text-zinc-800' : 'text-right text-zinc-600')}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
