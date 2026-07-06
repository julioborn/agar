'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  MapPin, Sprout, Wheat, TrendingDown, Building2, Layers, BarChart3,
  Leaf, X,
} from 'lucide-react';
import MapaDueno from './mapa-dueno';
import type { CampoGlobal } from './mapa-dueno-inner';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CultivoDetalle {
  id: string;
  cultivo: string | null;
  estado: string;
  ingreso_bruto_ars: number;
  costo_directo_ars: number;
  margen_bruto_ars: number;
  lote_id: string;
  lote_nombre: string;
  campo_id: string;
}

interface RiaTotales {
  total_insumos: number;
  total_labores: number;
  total_ria: number;
}

interface ResultadoCampo {
  nombre: string;
  ingreso: number;
  costo: number;
  margen: number;
}

interface Props {
  empresaNombre: string;
  haTotal: number;
  costoTotalCI: number;
  campos: CampoGlobal[];
  cultivosDetalle: CultivoDetalle[];
  riasPorLote: Record<string, RiaTotales>;
  resultadoPorCampo: ResultadoCampo[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const ESTADO_LABEL: Record<string, string> = {
  planificada: 'Planificado',
  en_curso:    'En curso',
  cosechada:   'Cosechado',
  cancelada:   'Cancelado',
};

const ESTADO_COLOR: Record<string, { bg: string; text: string }> = {
  planificada: { bg: 'bg-zinc-100',  text: 'text-zinc-500'  },
  en_curso:    { bg: 'bg-green-50',  text: 'text-green-600' },
  cosechada:   { bg: 'bg-amber-50',  text: 'text-amber-600' },
  cancelada:   { bg: 'bg-red-50',    text: 'text-red-500'   },
};

const numHa  = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const numARS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

function fmtARS(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${numARS.format(v)}`;
}

function capitalize(s: string | null) {
  if (!s) return 'Sin nombre';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DuenoDashboard({
  empresaNombre, haTotal, costoTotalCI, campos,
  cultivosDetalle, riasPorLote, resultadoPorCampo,
}: Props) {
  const hoy = new Date();
  const fechaLabel = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const [selectedLote, setSelectedLote] = useState<{
    loteId: string; loteNombre: string; campoNombre: string;
  } | null>(null);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const activos    = cultivosDetalle.filter((c) => c.estado === 'en_curso').length;
  const cosechados = cultivosDetalle.filter((c) => c.estado === 'cosechada').length;

  const campoNombres = useMemo(
    () => Object.fromEntries(campos.map((c) => [c.id, c.nombre])),
    [campos],
  );

  const lotesHectareas = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of campos) {
      for (const l of c.lotes) map[l.id] = l.hectareas;
    }
    return map;
  }, [campos]);

  const lotesCultivos = useMemo(() => {
    const map: Record<string, CultivoDetalle[]> = {};
    for (const c of cultivosDetalle) {
      if (!map[c.lote_id]) map[c.lote_id] = [];
      map[c.lote_id].push(c);
    }
    return map;
  }, [cultivosDetalle]);

  const cultivosActivos = useMemo(
    () => cultivosDetalle
      .filter((c) => c.estado === 'en_curso')
      .sort((a, b) => b.margen_bruto_ars - a.margen_bruto_ars),
    [cultivosDetalle],
  );

  const chartData = useMemo(
    () => resultadoPorCampo
      .sort((a, b) => b.margen - a.margen)
      .map((d) => ({
        ...d,
        nombreCorto: d.nombre.length > 14 ? d.nombre.slice(0, 12) + '…' : d.nombre,
      })),
    [resultadoPorCampo],
  );

  const hasChartData = chartData.some((d) => d.ingreso !== 0 || d.costo !== 0);

  // ── Lote seleccionado ──────────────────────────────────────────────────────

  const loteCultivos = selectedLote ? (lotesCultivos[selectedLote.loteId] ?? []) : [];
  const loteRia      = selectedLote ? (riasPorLote[selectedLote.loteId] ?? null) : null;
  const loteHa       = selectedLote ? (lotesHectareas[selectedLote.loteId] ?? 0) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#004d24] via-[#005f30] to-[#006836] p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-[#006836]/25 border border-white/5">
        <div className="absolute -right-14 -top-14 w-60 h-60 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute -right-7  -top-7  w-44 h-44 rounded-full border border-white/[0.06] pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-black/10 pointer-events-none" />
        <div className="absolute right-5 bottom-0 opacity-[0.04] pointer-events-none">
          <Sprout className="w-52 h-52" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-white/90 tracking-wide border border-white/10">
              Panel del propietario
            </span>
            <span className="text-white/30 text-xs">·</span>
            <span className="text-white/50 text-xs">{fechaLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-inner">
              <Building2 className="w-7 h-7 text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{empresaNombre}</h1>
              <p className="text-white/50 text-sm mt-0.5 font-medium">Seguimiento de producción agropecuaria</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#006836]/10 flex items-center justify-center mb-4">
            <MapPin className="w-4 h-4 text-[#006836]" />
          </div>
          <p className="text-3xl font-bold tracking-tight text-zinc-900">{numHa.format(haTotal)}</p>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            Hectáreas · {campos.length} campo{campos.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center mb-4">
            <Sprout className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-3xl font-bold tracking-tight text-zinc-900">{activos}</p>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Cultivos en curso</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
            <Wheat className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-bold tracking-tight text-zinc-900">{cosechados}</p>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            Cosechados · {cultivosDetalle.length} total
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center mb-4">
            <TrendingDown className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
            $ {numARS.format(costoTotalCI)}
          </p>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Gastos indirectos</p>
        </div>

      </div>

      {/* ── Mapa ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[#006836]" />
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Campos y lotes</h2>
          {!selectedLote && (
            <span className="text-xs text-zinc-400 ml-auto italic">Tocá un lote para ver sus cultivos</span>
          )}
        </div>

        <MapaDueno
          campos={campos}
          onLoteClick={(loteId, loteNombre, campoNombre) =>
            setSelectedLote({ loteId, loteNombre, campoNombre })
          }
        />

        {/* ── Panel de detalle del lote ────────────────────────────── */}
        {selectedLote && (
          <div className="mt-4 border border-zinc-100 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-zinc-50 border-b border-zinc-100">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-zinc-800">{selectedLote.loteNombre}</p>
                  {loteHa > 0 && (
                    <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                      {numHa.format(loteHa)} ha
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{selectedLote.campoNombre}</p>
              </div>
              <button
                onClick={() => setSelectedLote(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-200 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="p-5 space-y-5">

              {/* Cultivos del lote */}
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Cultivos</p>
                {loteCultivos.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">Sin cultivos registrados en este lote</p>
                ) : (
                  <div className="space-y-2">
                    {loteCultivos.map((c) => {
                      const est = ESTADO_COLOR[c.estado] ?? { bg: 'bg-zinc-100', text: 'text-zinc-500' };
                      const margenPos = c.margen_bruto_ars >= 0;
                      return (
                        <div key={c.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-800 truncate">
                              {capitalize(c.cultivo)}
                            </p>
                            {(c.ingreso_bruto_ars > 0 || c.costo_directo_ars > 0) && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                Ingreso {fmtARS(c.ingreso_bruto_ars)} · Costo {fmtARS(c.costo_directo_ars)}
                              </p>
                            )}
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${est.bg} ${est.text}`}>
                            {ESTADO_LABEL[c.estado] ?? c.estado}
                          </span>
                          {c.margen_bruto_ars !== 0 && (
                            <span className={`text-xs font-bold flex-shrink-0 ${margenPos ? 'text-green-600' : 'text-red-500'}`}>
                              {margenPos ? '+' : ''}{fmtARS(c.margen_bruto_ars)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIAs confirmadas del lote */}
              {loteRia && loteRia.total_ria > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Insumos y labores (RIAs confirmadas)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-blue-700">{fmtARS(loteRia.total_insumos)}</p>
                      <p className="text-[11px] text-blue-400 mt-0.5">Insumos</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-orange-700">{fmtARS(loteRia.total_labores)}</p>
                      <p className="text-[11px] text-orange-400 mt-0.5">Labores</p>
                    </div>
                    <div className="bg-zinc-100 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-zinc-700">{fmtARS(loteRia.total_ria)}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">Total RIA</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Estadísticas ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#006836]" />
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Estadísticas</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Resultado por campo */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-700 mb-0.5">Resultado por campo</p>
            <p className="text-xs text-zinc-400 mb-4">Margen = ingresos − costos directos − gastos CI</p>
            {!hasChartData ? (
              <p className="text-zinc-400 text-sm text-center py-10">Sin datos de producción cargados</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 48)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 8, right: 36, top: 4, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#a1a1aa' }}
                    tickFormatter={(v) => fmtARS(v)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="nombreCorto"
                    type="category"
                    tick={{ fontSize: 11, fill: '#52525b' }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <ReferenceLine x={0} stroke="#e4e4e7" strokeWidth={1} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const pos = d.margen >= 0;
                      return (
                        <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2.5 shadow-lg text-sm space-y-1">
                          <p className="font-bold text-zinc-700">{d.nombre}</p>
                          <p className="text-zinc-400 text-xs">
                            Ingreso: <span className="text-green-600 font-semibold">{fmtARS(d.ingreso)}</span>
                          </p>
                          <p className="text-zinc-400 text-xs">
                            Costos: <span className="text-red-500 font-semibold">{fmtARS(d.costo)}</span>
                          </p>
                          <p className={`text-xs font-bold border-t border-zinc-100 pt-1 mt-1 ${pos ? 'text-green-600' : 'text-red-500'}`}>
                            Margen: {pos ? '+' : ''}{fmtARS(d.margen)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="margen" name="Margen" radius={[0, 5, 5, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.margen >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cultivos en curso */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-700 mb-0.5">Cultivos en curso</p>
            <p className="text-xs text-zinc-400 mb-4">Activos ordenados por margen bruto</p>
            {cultivosActivos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Leaf className="w-8 h-8 text-zinc-200" />
                <p className="text-zinc-400 text-sm">Sin cultivos en curso</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 300 }}>
                {cultivosActivos.map((c) => {
                  const campo = campoNombres[c.campo_id] ?? '';
                  const margenPos = c.margen_bruto_ars >= 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Sprout className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 truncate">
                          {capitalize(c.cultivo)}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">
                          {c.lote_nombre}{campo ? ` · ${campo}` : ''}
                        </p>
                      </div>
                      {c.margen_bruto_ars !== 0 && (
                        <span className={`text-xs font-bold flex-shrink-0 ${margenPos ? 'text-green-600' : 'text-red-500'}`}>
                          {margenPos ? '+' : ''}{fmtARS(c.margen_bruto_ars)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
