'use client';

import { useState, useMemo } from 'react';
import {
  BarChart3, Wheat, Package, Wrench, FileText, Download,
  ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ExportButtons from '@/components/export-buttons';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RiaRow {
  id: string;
  numero_ria: string;
  fecha: string;
  estado: string;
  superficie_afectada: number | null;
  cultivo_descripcion: string | null;
  total_insumos: number;
  total_labores: number;
  total_ria: number;
  costo_por_ha: number | null;
  motivo_anulacion: string | null;
  lote: { id: string; nombre: string; campo: { nombre: string } | null } | null;
  campania: { id: string; nombre: string } | null;
}

interface InsumoRow {
  remito_id: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  producto: { id: string; nombre: string; unidad_base: string; categoria: string } | null;
  deposito: { id: string; nombre: string } | null;
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
  fecha_ejecucion: string | null;
}

interface ProduccionRow {
  remito_id: string;
  cantidad: number;
  humedad_porcentaje: number | null;
  precio_referencia: number | null;
  subtotal_valor: number | null;
  producto: { id: string; nombre: string; unidad_base: string } | null;
  deposito_ingreso: { id: string; nombre: string } | null;
}

interface Props {
  rias: RiaRow[];
  insumos: InsumoRow[];
  labores: LaborRow[];
  produccion: ProduccionRow[];
  campanias: { id: string; nombre: string }[];
  empresaNombre: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
const $ = (v: number | null | undefined) =>
  v != null ? `$${num.format(v)}` : '—';

const ESTADO_STYLE: Record<string, string> = {
  borrador:   'bg-amber-100 text-amber-700',
  confirmado: 'bg-[#006836]/10 text-[#006836]',
  anulado:    'bg-red-100 text-red-600',
};

// ── Componente ────────────────────────────────────────────────────────────────

type Tab = 'costos' | 'produccion' | 'insumos' | 'labores' | 'listado';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'costos',    label: 'Costos por lote',   icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'produccion', label: 'Producción',        icon: <Wheat className="w-4 h-4" /> },
  { id: 'insumos',   label: 'Consumo insumos',   icon: <Package className="w-4 h-4" /> },
  { id: 'labores',   label: 'Labores',            icon: <Wrench className="w-4 h-4" /> },
  { id: 'listado',   label: 'Listado RIA',        icon: <FileText className="w-4 h-4" /> },
];

export default function ReportesManager({
  rias, insumos, labores, produccion, campanias, empresaNombre,
}: Props) {
  const [tab, setTab] = useState<Tab>('costos');
  const [campaniaFilter, setCampaniaFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  const confirmedRias = useMemo(
    () => rias.filter((r) => r.estado === 'confirmado'),
    [rias],
  );

  const filteredConfirmed = useMemo(
    () => campaniaFilter
      ? confirmedRias.filter((r) => r.campania?.id === campaniaFilter)
      : confirmedRias,
    [confirmedRias, campaniaFilter],
  );

  // ── Costos por lote ────────────────────────────────────────────────────────
  const costosPorLote = useMemo(() => {
    const groups = new Map<string, {
      loteNombre: string; campoNombre: string; campaniaNombre: string;
      cultivoDesc: string; superficie: number;
      totalInsumos: number; totalLabores: number; totalRia: number;
      riaIds: string[];
    }>();

    for (const r of filteredConfirmed) {
      const key = `${r.lote?.id ?? ''}_${r.campania?.id ?? ''}`;
      const g = groups.get(key);
      if (g) {
        g.totalInsumos  += r.total_insumos;
        g.totalLabores  += r.total_labores;
        g.totalRia      += r.total_ria;
        g.riaIds.push(r.id);
        if (r.superficie_afectada) g.superficie = Math.max(g.superficie, r.superficie_afectada);
      } else {
        groups.set(key, {
          loteNombre:    r.lote?.nombre ?? '—',
          campoNombre:   r.lote?.campo?.nombre ?? '—',
          campaniaNombre: r.campania?.nombre ?? '—',
          cultivoDesc:   r.cultivo_descripcion ?? '',
          superficie:    r.superficie_afectada ?? 0,
          totalInsumos:  r.total_insumos,
          totalLabores:  r.total_labores,
          totalRia:      r.total_ria,
          riaIds:        [r.id],
        });
      }
    }

    return Array.from(groups.values()).map((g) => {
      const prodRows = produccion.filter((p) => g.riaIds.includes(p.remito_id));
      const totalProd = prodRows.reduce((s, p) => s + p.cantidad, 0);
      const firstProd = prodRows[0];
      const costoPerHa = g.superficie > 0 ? g.totalRia / g.superficie : null;
      const costoPerUnit = totalProd > 0 ? g.totalRia / totalProd : null;
      return {
        ...g,
        costoPerHa,
        produccionStr: totalProd > 0
          ? `${num.format(totalProd)} ${firstProd?.producto?.unidad_base ?? ''}`
          : '—',
        costoPerUnit,
      };
    });
  }, [filteredConfirmed, produccion]);

  // ── Producción ─────────────────────────────────────────────────────────────
  const produccionRows = useMemo(() => {
    const riaMap = new Map(filteredConfirmed.map((r) => [r.id, r]));
    return produccion
      .filter((p) => riaMap.has(p.remito_id))
      .map((p) => {
        const ria = riaMap.get(p.remito_id)!;
        const sup = ria.superficie_afectada ?? 0;
        const rend = sup > 0 ? p.cantidad / sup : null;
        const valorBruto = p.precio_referencia != null ? p.cantidad * p.precio_referencia : null;
        const margenBruto = valorBruto != null ? valorBruto - ria.total_ria : null;
        return {
          lote:       ria.lote?.nombre ?? '—',
          campo:      ria.lote?.campo?.nombre ?? '—',
          campania:   ria.campania?.nombre ?? '—',
          cultivo:    ria.cultivo_descripcion ?? '',
          superficie: sup,
          producto:   p.producto?.nombre ?? '—',
          unidad:     p.producto?.unidad_base ?? '',
          cantidad:   p.cantidad,
          rendimiento: rend,
          humedad:    p.humedad_porcentaje,
          precioRef:  p.precio_referencia,
          valorBruto,
          costoTotal: ria.total_ria,
          margenBruto,
        };
      });
  }, [filteredConfirmed, produccion]);

  // ── Consumo insumos ────────────────────────────────────────────────────────
  const consumoInsumos = useMemo(() => {
    const riaIds = new Set(filteredConfirmed.map((r) => r.id));
    const filteredIns = insumos.filter((i) => riaIds.has(i.remito_id));
    const totalGlobal = filteredIns.reduce((s, i) => s + i.subtotal, 0);

    const groups = new Map<string, {
      nombre: string; categoria: string; unidad: string;
      totalCantidad: number; totalSubtotal: number; totalPonderado: number;
    }>();

    for (const i of filteredIns) {
      const key = i.producto?.id ?? i.producto?.nombre ?? 'unknown';
      const g = groups.get(key);
      if (g) {
        g.totalCantidad  += i.cantidad;
        g.totalSubtotal  += i.subtotal;
        g.totalPonderado += i.cantidad * i.costo_unitario;
      } else {
        groups.set(key, {
          nombre:         i.producto?.nombre ?? '—',
          categoria:      i.producto?.categoria ?? '—',
          unidad:         i.producto?.unidad_base ?? '',
          totalCantidad:  i.cantidad,
          totalSubtotal:  i.subtotal,
          totalPonderado: i.cantidad * i.costo_unitario,
        });
      }
    }

    return Array.from(groups.values())
      .map((g) => ({
        ...g,
        costoPromedio: g.totalCantidad > 0 ? g.totalPonderado / g.totalCantidad : 0,
        porcentaje:    totalGlobal > 0 ? (g.totalSubtotal / totalGlobal) * 100 : 0,
      }))
      .sort((a, b) => b.totalSubtotal - a.totalSubtotal);
  }, [filteredConfirmed, insumos]);

  // ── Labores ────────────────────────────────────────────────────────────────
  const laboresRows = useMemo(() => {
    const riaMap = new Map(filteredConfirmed.map((r) => [r.id, r]));
    return labores
      .filter((l) => riaMap.has(l.remito_id))
      .map((l) => {
        const ria = riaMap.get(l.remito_id)!;
        return {
          lote:        ria.lote?.nombre ?? '—',
          campania:    ria.campania?.nombre ?? '—',
          tipo:        l.tipo_labor_nombre ?? '—',
          descripcion: l.descripcion,
          prestador:   l.prestador_nombre ?? 'Campo propio',
          cantidad:    l.cantidad,
          unidad:      l.unidad_medida,
          tarifa:      l.tarifa,
          subtotal:    l.subtotal,
          fecha:       l.fecha_ejecucion,
        };
      });
  }, [filteredConfirmed, labores]);

  // ── Listado RIA ────────────────────────────────────────────────────────────
  const listadoRias = useMemo(() => {
    const filtered = estadoFilter
      ? rias.filter((r) => r.estado === estadoFilter)
      : rias;
    const withCampania = campaniaFilter
      ? filtered.filter((r) => r.campania?.id === campaniaFilter)
      : filtered;
    return withCampania.map((r) => ({
      ...r,
      tieneProduccion: produccion.some((p) => p.remito_id === r.id) ? 'Sí' : 'No',
    }));
  }, [rias, produccion, campaniaFilter, estadoFilter]);

  // ── Sub-totales ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalCosto = filteredConfirmed.reduce((s, r) => s + r.total_ria, 0);
    const totalSup   = filteredConfirmed.reduce((s, r) => s + (r.superficie_afectada ?? 0), 0);
    const costoPerHa = totalSup > 0 ? totalCosto / totalSup : null;
    const withProd   = new Set(produccion.map((p) => p.remito_id));
    const lotesActivos = new Set(filteredConfirmed.map((r) => r.lote?.id)).size;
    const lotesConProd = new Set(
      filteredConfirmed.filter((r) => withProd.has(r.id)).map((r) => r.lote?.id),
    ).size;
    const borradores = rias.filter((r) => r.estado === 'borrador').length;

    return { totalCosto, costoPerHa, lotesActivos, lotesConProd, borradores };
  }, [filteredConfirmed, produccion, rias]);

  return (
    <div className="space-y-5">

      {/* Filtros globales */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Campaña</label>
          <select
            value={campaniaFilter}
            onChange={(e) => setCampaniaFilter(e.target.value)}
            className="text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
          >
            <option value="">Todas las campañas</option>
            {campanias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        {tab === 'listado' && (
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
            >
              <option value="">Todos</option>
              <option value="borrador">Borrador</option>
              <option value="confirmado">Confirmado</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>
        )}
        {(campaniaFilter || estadoFilter) && (
          <button
            onClick={() => { setCampaniaFilter(''); setEstadoFilter(''); }}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 pb-1.5"
          >
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Costo total campaña',   val: $(kpis.totalCosto), accent: true },
          { label: 'Costo/ha promedio',      val: $(kpis.costoPerHa) },
          { label: 'Lotes activos',          val: kpis.lotesActivos.toString() },
          { label: 'Lotes con producción',   val: `${kpis.lotesConProd} / ${kpis.lotesActivos}` },
          { label: 'Borradores pendientes',  val: kpis.borradores.toString(), warn: kpis.borradores > 0 },
        ].map(({ label, val, accent, warn }) => (
          <div
            key={label}
            className={cn(
              'bg-white rounded-2xl border px-4 py-3 shadow-sm',
              accent ? 'border-[#006836]/30' : warn ? 'border-amber-200' : 'border-zinc-100',
            )}
          >
            <p className={cn(
              'text-lg font-bold leading-none',
              accent ? 'text-[#006836]' : warn ? 'text-amber-600' : 'text-zinc-900',
            )}>{val}</p>
            <p className="text-xs text-zinc-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        <div className="flex border-b border-zinc-100 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                tab === t.id
                  ? 'border-[#006836] text-[#006836]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── TAB: Costos por lote ─────────────────────────────────────── */}
          {tab === 'costos' && (
            <TabSection
              title="Costos acumulados por lote / campaña"
              exportData={costosPorLote.map((g) => ({
                lote:        g.loteNombre,
                campo:       g.campoNombre,
                campania:    g.campaniaNombre,
                cultivo:     g.cultivoDesc,
                superficie:  g.superficie > 0 ? `${g.superficie} ha` : '—',
                ins:         g.totalInsumos,
                lab:         g.totalLabores,
                total:       g.totalRia,
                costo_ha:    g.costoPerHa,
                produccion:  g.produccionStr,
                costo_unidad: g.costoPerUnit,
              }))}
              exportColumns={[
                { header: 'Lote',          key: 'lote',        width: 22 },
                { header: 'Campo',         key: 'campo',       width: 22 },
                { header: 'Campaña',       key: 'campania',    width: 22 },
                { header: 'Cultivo',       key: 'cultivo',     width: 20 },
                { header: 'Superficie',    key: 'superficie',  width: 16 },
                { header: 'Insumos $',     key: 'ins',         width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Labores $',     key: 'lab',         width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Total $',       key: 'total',       width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Costo/ha $',    key: 'costo_ha',    width: 18, align: 'right', format: (v: any) => $(v) },
                { header: 'Producción',    key: 'produccion',  width: 18 },
                { header: 'Costo/unidad $',key: 'costo_unidad',width: 18, align: 'right', format: (v: any) => $(v) },
              ]}
              filename={`costos-por-lote-${empresaNombre}`}
              docTitle={`Costos por lote — ${empresaNombre}`}
            >
              {costosPorLote.length === 0 ? (
                <EmptyState text="Sin datos confirmados para los filtros seleccionados." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-100">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        {['Campo › Lote','Campaña','Cultivo','Sup. ha','Total insumos','Total labores','Costo total','Costo/ha','Producción','Costo/unid.'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {costosPorLote.map((g, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/60">
                          <td className="px-3 py-2">
                            <span className="text-zinc-400">{g.campoNombre} › </span>
                            <span className="font-medium text-zinc-800">{g.loteNombre}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{g.campaniaNombre}</td>
                          <td className="px-3 py-2 text-zinc-500">{g.cultivoDesc || '—'}</td>
                          <td className="px-3 py-2 text-zinc-600">{g.superficie > 0 ? `${g.superficie} ha` : '—'}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{$(g.totalInsumos)}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{$(g.totalLabores)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">{$(g.totalRia)}</td>
                          <td className="px-3 py-2 text-right text-[#006836] font-medium">{$(g.costoPerHa)}</td>
                          <td className="px-3 py-2 text-zinc-600">{g.produccionStr}</td>
                          <td className="px-3 py-2 text-right text-zinc-600">{$(g.costoPerUnit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 border-t border-zinc-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-zinc-600">Total general</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-zinc-800">
                          {$(costosPorLote.reduce((s, g) => s + g.totalInsumos, 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-zinc-800">
                          {$(costosPorLote.reduce((s, g) => s + g.totalLabores, 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-[#006836]">
                          {$(costosPorLote.reduce((s, g) => s + g.totalRia, 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabSection>
          )}

          {/* ── TAB: Producción ──────────────────────────────────────────── */}
          {tab === 'produccion' && (
            <TabSection
              title="Producción por lote / campaña"
              exportData={produccionRows.map((p) => ({
                lote:       p.lote,
                campo:      p.campo,
                campania:   p.campania,
                cultivo:    p.cultivo,
                superficie: p.superficie > 0 ? `${p.superficie} ha` : '—',
                producto:   p.producto,
                unidad:     p.unidad,
                cantidad:   p.cantidad,
                rendimiento: p.rendimiento != null ? num.format(p.rendimiento) : '—',
                humedad:    p.humedad != null ? `${p.humedad}%` : '—',
                precio_ref: p.precioRef,
                valor_bruto: p.valorBruto,
                costo_total: p.costoTotal,
                margen:     p.margenBruto,
              }))}
              exportColumns={[
                { header: 'Lote',           key: 'lote',        width: 22 },
                { header: 'Campo',          key: 'campo',       width: 22 },
                { header: 'Campaña',        key: 'campania',    width: 22 },
                { header: 'Cultivo',        key: 'cultivo',     width: 18 },
                { header: 'Superficie',     key: 'superficie',  width: 14 },
                { header: 'Producto',       key: 'producto',    width: 18 },
                { header: 'Unidad',         key: 'unidad',      width: 10 },
                { header: 'Cantidad',       key: 'cantidad',    width: 14, align: 'right', format: (v: any) => num.format(v), total: true },
                { header: 'Rend./ha',       key: 'rendimiento', width: 14 },
                { header: 'Humedad',        key: 'humedad',     width: 12 },
                { header: 'Precio ref.',    key: 'precio_ref',  width: 16, align: 'right', format: (v: any) => $(v) },
                { header: 'Valor bruto $',  key: 'valor_bruto', width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Costo total $',  key: 'costo_total', width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Margen bruto $', key: 'margen',      width: 18, align: 'right', format: (v: any) => $(v), total: true },
              ]}
              filename={`produccion-${empresaNombre}`}
              docTitle={`Producción — ${empresaNombre}`}
            >
              {produccionRows.length === 0 ? (
                <EmptyState text="Sin registros de producción para los filtros seleccionados." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-100">
                  <table className="w-full text-xs min-w-[1000px]">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        {['Campo › Lote','Campaña','Cultivo','Sup.','Producto','Cantidad','Rend./ha','Hum.%','P.Ref.','Valor bruto','Costo','Margen'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {produccionRows.map((p, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/60">
                          <td className="px-3 py-2">
                            <span className="text-zinc-400">{p.campo} › </span>
                            <span className="font-medium text-zinc-800">{p.lote}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{p.campania}</td>
                          <td className="px-3 py-2 text-zinc-500">{p.cultivo || '—'}</td>
                          <td className="px-3 py-2 text-zinc-500">{p.superficie > 0 ? `${p.superficie} ha` : '—'}</td>
                          <td className="px-3 py-2 font-medium text-zinc-800">{p.producto}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{num.format(p.cantidad)} {p.unidad}</td>
                          <td className="px-3 py-2 text-right text-zinc-600">{p.rendimiento != null ? `${num.format(p.rendimiento)} ${p.unidad}/ha` : '—'}</td>
                          <td className="px-3 py-2 text-right text-zinc-500">{p.humedad != null ? `${p.humedad}%` : '—'}</td>
                          <td className="px-3 py-2 text-right text-zinc-600">{$(p.precioRef)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">{$(p.valorBruto)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{$(p.costoTotal)}</td>
                          <td className={cn('px-3 py-2 text-right font-semibold',
                            p.margenBruto != null && p.margenBruto >= 0 ? 'text-[#006836]' : 'text-red-600',
                          )}>
                            {$(p.margenBruto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabSection>
          )}

          {/* ── TAB: Consumo insumos ──────────────────────────────────────── */}
          {tab === 'insumos' && (
            <TabSection
              title="Consumo de insumos por campaña"
              exportData={consumoInsumos.map((i) => ({
                producto:    i.nombre,
                categoria:   i.categoria,
                cantidad:    i.totalCantidad,
                unidad:      i.unidad,
                costo_prom:  i.costoPromedio,
                total:       i.totalSubtotal,
                porcentaje:  `${num.format(i.porcentaje)}%`,
              }))}
              exportColumns={[
                { header: 'Producto',       key: 'producto',   width: 28 },
                { header: 'Categoría',      key: 'categoria',  width: 20 },
                { header: 'Cantidad total', key: 'cantidad',   width: 18, align: 'right', format: (v: any) => num.format(v), total: true },
                { header: 'Unidad',         key: 'unidad',     width: 12 },
                { header: 'Costo prom. $',  key: 'costo_prom', width: 18, align: 'right', format: (v: any) => $(v) },
                { header: 'Costo total $',  key: 'total',      width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: '% del total',    key: 'porcentaje', width: 14, align: 'right' },
              ]}
              filename={`consumo-insumos-${empresaNombre}`}
              docTitle={`Consumo de insumos — ${empresaNombre}`}
            >
              {consumoInsumos.length === 0 ? (
                <EmptyState text="Sin insumos registrados para los filtros seleccionados." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-100">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        {['Producto','Categoría','Cantidad total','Unidad','Costo prom.','Costo total','% del total'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {consumoInsumos.map((i, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/60">
                          <td className="px-3 py-2 font-medium text-zinc-800">{i.nombre}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded text-xs">{i.categoria}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-700">{num.format(i.totalCantidad)}</td>
                          <td className="px-3 py-2 text-zinc-500">{i.unidad}</td>
                          <td className="px-3 py-2 text-right text-zinc-600">{$(i.costoPromedio)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">{$(i.totalSubtotal)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-zinc-100 rounded-full h-1.5">
                                <div
                                  className="bg-[#006836] h-1.5 rounded-full"
                                  style={{ width: `${Math.min(100, i.porcentaje)}%` }}
                                />
                              </div>
                              <span className="text-zinc-600 tabular-nums">{num.format(i.porcentaje)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 border-t border-zinc-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-zinc-600">Total</td>
                        <td />
                        <td className="px-3 py-2 text-right text-xs font-bold text-[#006836]">
                          {$(consumoInsumos.reduce((s, i) => s + i.totalSubtotal, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabSection>
          )}

          {/* ── TAB: Labores ──────────────────────────────────────────────── */}
          {tab === 'labores' && (
            <TabSection
              title="Labores y servicios por campaña"
              exportData={laboresRows.map((l) => ({
                lote:        l.lote,
                campania:    l.campania,
                tipo:        l.tipo,
                descripcion: l.descripcion,
                prestador:   l.prestador,
                cantidad:    l.cantidad,
                unidad:      l.unidad,
                tarifa:      l.tarifa,
                subtotal:    l.subtotal,
                fecha:       l.fecha ? fmt(l.fecha) : '—',
              }))}
              exportColumns={[
                { header: 'Lote',          key: 'lote',        width: 22 },
                { header: 'Campaña',       key: 'campania',    width: 22 },
                { header: 'Tipo',          key: 'tipo',        width: 20 },
                { header: 'Descripción',   key: 'descripcion', width: 30 },
                { header: 'Prestador',     key: 'prestador',   width: 22 },
                { header: 'Cantidad',      key: 'cantidad',    width: 14, align: 'right', format: (v: any) => num.format(v), total: true },
                { header: 'Unidad',        key: 'unidad',      width: 12 },
                { header: 'Tarifa $',      key: 'tarifa',      width: 16, align: 'right', format: (v: any) => $(v) },
                { header: 'Subtotal $',    key: 'subtotal',    width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Fecha ejec.',   key: 'fecha',       width: 16 },
              ]}
              filename={`labores-${empresaNombre}`}
              docTitle={`Labores y servicios — ${empresaNombre}`}
            >
              {laboresRows.length === 0 ? (
                <EmptyState text="Sin labores registradas para los filtros seleccionados." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-100">
                  <table className="w-full text-xs min-w-[800px]">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        {['Lote','Campaña','Tipo','Descripción','Prestador','Cant.','Unid.','Tarifa','Subtotal','Fecha'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {laboresRows.map((l, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/60">
                          <td className="px-3 py-2 font-medium text-zinc-800">{l.lote}</td>
                          <td className="px-3 py-2 text-zinc-600">{l.campania}</td>
                          <td className="px-3 py-2 text-zinc-500">{l.tipo}</td>
                          <td className="px-3 py-2 text-zinc-700">{l.descripcion}</td>
                          <td className="px-3 py-2 text-zinc-500">{l.prestador}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{num.format(l.cantidad)}</td>
                          <td className="px-3 py-2 text-zinc-500">{l.unidad}</td>
                          <td className="px-3 py-2 text-right text-zinc-600">{$(l.tarifa)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">{$(l.subtotal)}</td>
                          <td className="px-3 py-2 text-zinc-500">{l.fecha ? fmt(l.fecha) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 border-t border-zinc-200">
                      <tr>
                        <td colSpan={8} className="px-3 py-2 text-xs font-semibold text-zinc-600">Total labores</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-[#006836]">
                          {$(laboresRows.reduce((s, l) => s + l.subtotal, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabSection>
          )}

          {/* ── TAB: Listado RIA ─────────────────────────────────────────── */}
          {tab === 'listado' && (
            <TabSection
              title="Listado de RIA — auditoría"
              exportData={listadoRias.map((r) => ({
                numero:     r.numero_ria,
                fecha:      fmt(r.fecha),
                estado:     r.estado.toUpperCase(),
                lote:       r.lote?.nombre ?? '—',
                campo:      r.lote?.campo?.nombre ?? '—',
                campania:   r.campania?.nombre ?? '—',
                insumos:    r.total_insumos,
                labores:    r.total_labores,
                total:      r.total_ria,
                produccion: r.tieneProduccion,
                motivo:     r.motivo_anulacion ?? '',
              }))}
              exportColumns={[
                { header: 'Nº RIA',         key: 'numero',      width: 20 },
                { header: 'Fecha',          key: 'fecha',       width: 16 },
                { header: 'Estado',         key: 'estado',      width: 14 },
                { header: 'Lote',           key: 'lote',        width: 22 },
                { header: 'Campo',          key: 'campo',       width: 22 },
                { header: 'Campaña',        key: 'campania',    width: 22 },
                { header: 'Insumos $',      key: 'insumos',     width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Labores $',      key: 'labores',     width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Total $',        key: 'total',       width: 18, align: 'right', format: (v: any) => $(v), total: true },
                { header: 'Producción',     key: 'produccion',  width: 14 },
                { header: 'Motivo anul.',   key: 'motivo',      width: 30 },
              ]}
              filename={`listado-ria-${empresaNombre}`}
              docTitle={`Listado de RIA — ${empresaNombre}`}
            >
              {listadoRias.length === 0 ? (
                <EmptyState text="Sin RIA para los filtros seleccionados." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-100">
                  <table className="w-full text-xs min-w-[800px]">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        {['Nº RIA','Fecha','Estado','Campo › Lote','Campaña','Total insumos','Total labores','Costo total','Producción'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {listadoRias.map((r) => (
                        <tr
                          key={r.id}
                          className={cn(
                            'hover:bg-zinc-50/60',
                            r.estado === 'anulado' && 'opacity-55',
                          )}
                        >
                          <td className="px-3 py-2">
                            <a
                              href={`/app/ria/${r.id}`}
                              className={cn(
                                'font-mono font-semibold text-[#006836] hover:underline',
                                r.estado === 'anulado' && 'line-through text-zinc-400',
                              )}
                            >
                              {r.numero_ria}
                            </a>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{fmt(r.fecha)}</td>
                          <td className="px-3 py-2">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ESTADO_STYLE[r.estado])}>
                              {r.estado}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-zinc-400">{r.lote?.campo?.nombre} › </span>
                            <span className="font-medium text-zinc-800">{r.lote?.nombre ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{r.campania?.nombre ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{$(r.total_insumos)}</td>
                          <td className="px-3 py-2 text-right text-zinc-700">{$(r.total_labores)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">{$(r.total_ria)}</td>
                          <td className="px-3 py-2 text-center text-zinc-500">{r.tieneProduccion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabSection>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-zinc-400">{text}</p>
    </div>
  );
}

function TabSection({
  title, docTitle, children, exportData, exportColumns, filename,
}: {
  title: string;
  docTitle: string;
  children: React.ReactNode;
  exportData: Record<string, any>[];
  exportColumns: any[];
  filename: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
        <ExportButtons
          data={exportData}
          columns={exportColumns}
          filename={filename}
          title={docTitle}
        />
      </div>
      {children}
    </div>
  );
}
