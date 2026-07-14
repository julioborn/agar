'use client';

import { useMemo, useState } from 'react';
import { MapPin, Sprout, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';
import ExportButtons, { ExportColumn } from '@/components/export-buttons';

interface RiaRow {
  loteId: string;
  loteNombre: string;
  campoNombre: string;
  hectareas: number | null;
  cultivoActivo: string | null;
  campaniaId: string | null;
  tieneCultivo: boolean;
  cultivoDescripcion: string | null;
  totalInsumos: number;
  totalLabores: number;
}

interface Props {
  rias: RiaRow[];
  campanias: { id: string; nombre: string }[];
}

const fmtHa = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const fmtQty = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

type FiltroTipo = 'todos' | 'con_cultivo' | 'sin_cultivo';

export default function CostosLoteReport({ rias, campanias }: Props) {
  const { formatMoney } = useCurrency();
  const [campaniaFiltro, setCampaniaFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');

  // Filtrar RIAs por campaña
  const riasFiltradas = useMemo(() =>
    campaniaFiltro
      ? rias.filter((r) => r.campaniaId === campaniaFiltro)
      : rias,
    [rias, campaniaFiltro]);

  // Agrupar por lote y sumar costos
  const lotes = useMemo(() => {
    const map = new Map<string, {
      loteId: string;
      loteNombre: string;
      campoNombre: string;
      hectareas: number | null;
      cultivoActivo: string | null;
      totalInsumos: number;
      totalLabores: number;
      riaCount: number;
      conCultivo: number;
      sinCultivo: number;
    }>();

    for (const r of riasFiltradas) {
      const g = map.get(r.loteId) ?? {
        loteId: r.loteId,
        loteNombre: r.loteNombre,
        campoNombre: r.campoNombre,
        hectareas: r.hectareas,
        cultivoActivo: r.cultivoActivo,
        totalInsumos: 0,
        totalLabores: 0,
        riaCount: 0,
        conCultivo: 0,
        sinCultivo: 0,
      };
      g.totalInsumos += r.totalInsumos;
      g.totalLabores += r.totalLabores;
      g.riaCount += 1;
      if (r.tieneCultivo) g.conCultivo += 1; else g.sinCultivo += 1;
      map.set(r.loteId, g);
    }

    return Array.from(map.values())
      .map((g) => ({
        ...g,
        totalDirecto: g.totalInsumos + g.totalLabores,
        costoPorHa: g.hectareas && g.hectareas > 0
          ? (g.totalInsumos + g.totalLabores) / g.hectareas
          : null,
        tieneSoloCultivo: g.sinCultivo === 0,
        tieneSoloSinCultivo: g.conCultivo === 0,
        tieneMixto: g.conCultivo > 0 && g.sinCultivo > 0,
      }))
      .filter((g) => {
        if (filtroTipo === 'con_cultivo') return !g.tieneSoloSinCultivo;
        if (filtroTipo === 'sin_cultivo') return g.sinCultivo > 0;
        return true;
      })
      .sort((a, b) =>
        a.campoNombre.localeCompare(b.campoNombre) || a.loteNombre.localeCompare(b.loteNombre),
      );
  }, [riasFiltradas, filtroTipo]);

  const totalInsumos = lotes.reduce((s, l) => s + l.totalInsumos, 0);
  const totalLabores = lotes.reduce((s, l) => s + l.totalLabores, 0);
  const totalDirecto = totalInsumos + totalLabores;
  const totalHa = lotes.reduce((s, l) => s + (l.hectareas ?? 0), 0);

  const exportData = useMemo(() => lotes.map((l) => ({
    campo: l.campoNombre,
    lote: l.loteNombre,
    hectareas: l.hectareas ?? 0,
    cultivoActivo: l.cultivoActivo ?? '—',
    estado: l.tieneSoloSinCultivo ? 'Sin cultivo' : l.tieneMixto ? 'Mixto' : 'Con cultivo',
    rias: l.riaCount,
    totalInsumos: l.totalInsumos,
    totalLabores: l.totalLabores,
    totalDirecto: l.totalDirecto,
    costoPorHa: l.costoPorHa ?? 0,
  })), [lotes]);

  const exportColumns: ExportColumn[] = [
    { header: 'Campo', key: 'campo', width: 20 },
    { header: 'Lote', key: 'lote', width: 20 },
    { header: 'Ha', key: 'hectareas', width: 8, align: 'right', format: (v) => v > 0 ? fmtHa.format(v) : '—' },
    { header: 'Cultivo activo', key: 'cultivoActivo', width: 18 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'RIAs', key: 'rias', width: 6, align: 'right' },
    { header: 'Insumos', key: 'totalInsumos', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Labores', key: 'totalLabores', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: 'Total directo', key: 'totalDirecto', width: 16, align: 'right', format: (v) => formatMoney(v), total: true },
    { header: '$/ha', key: 'costoPorHa', width: 14, align: 'right', format: (v) => v > 0 ? formatMoney(v) : '—' },
  ];

  if (lotes.length === 0 && rias.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-16 text-center">
        <MapPin className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
        <p className="text-sm text-zinc-400">No hay RIAs confirmados con costos registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros + Export */}
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
            {campaniaFiltro && (
              <button onClick={() => setCampaniaFiltro('')} className="text-xs text-zinc-400 hover:text-zinc-700 underline">
                Limpiar
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <ExportButtons
            data={exportData}
            columns={exportColumns}
            filename="costos-directos-lote"
            title="Costos Directos por Lote"
          />
          {/* Toggle con/sin cultivo */}
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden bg-white">
            {([
              ['todos', 'Todos'],
              ['con_cultivo', 'Con cultivo'],
              ['sin_cultivo', 'Sin cultivo'],
            ] as [FiltroTipo, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFiltroTipo(id)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  filtroTipo === id
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Lotes con costos" value={lotes.length.toString()} color="bg-teal-400" />
        <KpiCard label="Ha totales" value={`${fmtHa.format(totalHa)} ha`} color="bg-blue-400" />
        <KpiCard label="Total insumos" value={formatMoney(totalInsumos)} color="bg-amber-400" />
        <KpiCard label="Total directo" value={formatMoney(totalDirecto)} color="bg-[#006836]" />
      </div>

      {lotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
          <MapPin className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Sin lotes que coincidan con el filtro seleccionado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          {/* Encabezado tabla */}
          <div className="hidden sm:grid grid-cols-[2fr_2fr_auto_2fr_auto_2fr_2fr_2fr_2fr] gap-x-3 px-5 py-3 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            <span>Campo</span>
            <span>Lote</span>
            <span className="text-right">Ha</span>
            <span>Cultivo</span>
            <span className="text-right">RIAs</span>
            <span className="text-right">Insumos</span>
            <span className="text-right">Labores</span>
            <span className="text-right">Total</span>
            <span className="text-right">$/ha</span>
          </div>

          <ul className="divide-y divide-zinc-100">
            {lotes.map((l) => (
              <li key={l.loteId} className="px-5 py-4 hover:bg-zinc-50 transition-colors">
                {/* Mobile layout */}
                <div className="sm:hidden space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-zinc-400">{l.campoNombre}</p>
                      <p className="font-semibold text-zinc-900">{l.loteNombre}</p>
                      {l.hectareas && (
                        <p className="text-xs text-zinc-400">{fmtHa.format(l.hectareas)} ha</p>
                      )}
                    </div>
                    <CultivoChip
                      cultivoActivo={l.cultivoActivo}
                      sinCultivo={l.sinCultivo}
                      mixto={l.tieneMixto}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <p className="text-xs text-zinc-400">Insumos</p>
                      <p className="text-sm font-semibold text-zinc-800">{formatMoney(l.totalInsumos)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Labores</p>
                      <p className="text-sm font-semibold text-zinc-800">{formatMoney(l.totalLabores)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Total</p>
                      <p className="text-sm font-bold text-[#006836]">{formatMoney(l.totalDirecto)}</p>
                    </div>
                  </div>
                  {l.costoPorHa != null && (
                    <p className="text-xs text-zinc-400">{formatMoney(l.costoPorHa)}/ha</p>
                  )}
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:grid grid-cols-[2fr_2fr_auto_2fr_auto_2fr_2fr_2fr_2fr] gap-x-3 items-center text-sm">
                  <span className="text-zinc-500 truncate">{l.campoNombre}</span>
                  <span className="font-medium text-zinc-800 truncate">{l.loteNombre}</span>
                  <span className="text-right text-zinc-500 text-xs">
                    {l.hectareas ? fmtHa.format(l.hectareas) : '—'}
                  </span>
                  <CultivoChip
                    cultivoActivo={l.cultivoActivo}
                    sinCultivo={l.sinCultivo}
                    mixto={l.tieneMixto}
                  />
                  <span className="text-right text-xs text-zinc-400">{l.riaCount}</span>
                  <span className="text-right text-zinc-700">{formatMoney(l.totalInsumos)}</span>
                  <span className="text-right text-zinc-700">{formatMoney(l.totalLabores)}</span>
                  <span className="text-right font-semibold text-[#006836]">{formatMoney(l.totalDirecto)}</span>
                  <span className="text-right text-xs text-zinc-500">
                    {l.costoPorHa != null ? formatMoney(l.costoPorHa) : '—'}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Fila de totales */}
          <div className="hidden sm:grid grid-cols-[2fr_2fr_auto_2fr_auto_2fr_2fr_2fr_2fr] gap-x-3 px-5 py-3 bg-zinc-50 border-t border-zinc-200 text-sm font-bold text-zinc-800">
            <span className="col-span-5 text-zinc-500 font-semibold">TOTAL ({lotes.length} lotes)</span>
            <span className="text-right">{formatMoney(totalInsumos)}</span>
            <span className="text-right">{formatMoney(totalLabores)}</span>
            <span className="text-right text-[#006836]">{formatMoney(totalDirecto)}</span>
            <span className="text-right text-zinc-500 text-xs">
              {totalHa > 0 ? formatMoney(totalDirecto / totalHa) : '—'}
            </span>
          </div>
          {/* Totales mobile */}
          <div className="sm:hidden px-5 py-4 bg-zinc-50 border-t border-zinc-200">
            <p className="text-xs font-semibold text-zinc-500 mb-2">TOTAL ({lotes.length} lotes)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-zinc-400">Insumos</p>
                <p className="text-sm font-bold">{formatMoney(totalInsumos)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Labores</p>
                <p className="text-sm font-bold">{formatMoney(totalLabores)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Total</p>
                <p className="text-sm font-bold text-[#006836]">{formatMoney(totalDirecto)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 truncate">{label}</p>
        <p className="text-base font-bold text-zinc-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function CultivoChip({
  cultivoActivo, sinCultivo, mixto,
}: { cultivoActivo: string | null; sinCultivo: number; mixto: boolean }) {
  if (sinCultivo > 0 && !mixto) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
        <AlertCircle className="w-3 h-3" />
        Sin cultivo
      </span>
    );
  }
  if (mixto) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap max-w-[140px] truncate">
        <Sprout className="w-3 h-3 shrink-0" />
        {cultivoActivo ?? 'Mixto'}
        <span className="text-amber-500 shrink-0">+previo</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#006836]/10 text-[#006836] whitespace-nowrap max-w-[140px] truncate">
      <Sprout className="w-3 h-3 shrink-0" />
      {cultivoActivo ?? '—'}
    </span>
  );
}
