'use client';

import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, Tooltip as BarTooltip, ResponsiveContainer, Cell as BarCell,
} from 'recharts';
import {
  MapPin, Sprout, Wheat, TrendingDown, Building2, Layers, BarChart3,
  Leaf, X, Tractor,
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

interface Props {
  empresaNombre: string;
  haTotal: number;
  costoTotalCI: number;
  campos: CampoGlobal[];
  cultivosDetalle: CultivoDetalle[];
  riasPorLote: Record<string, RiaTotales>;
  resultadoPorCampo: { nombre: string; ingreso: number; costo: number; margen: number }[];
  laboresPorTipo: { tipo: string; total: number }[];
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

// Paleta para cultivos (donut)
const CULTIVO_COLORS = [
  '#006836', '#22c55e', '#f59e0b', '#3b82f6',
  '#8b5cf6', '#ec4899', '#f97316', '#06b6d4',
  '#84cc16', '#14b8a6',
];

// Paleta para labores (barra)
const LABOR_COLORS = [
  '#005f30', '#006836', '#007a3d', '#008c45',
  '#009e4e', '#00b057', '#22c55e', '#4ade80',
];

const numHa  = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const numARS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

function fmtARS(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${numARS.format(v)}`;
}

function capitalize(s: string | null) {
  if (!s) return 'Sin nombre';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ── Tick del eje Y con word-wrap ─────────────────────────────────────────────

function wrapLabel(text: string, maxChars = 18): string[] {
  if (text.length <= maxChars) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const cut = remaining.lastIndexOf(' ', maxChars);
    if (cut <= 0) {
      lines.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars).trim();
    } else {
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut + 1);
    }
  }
  if (remaining) lines.push(remaining);
  return lines.slice(0, 3);
}

function CustomYTick({ x, y, payload }: any) {
  const lines  = wrapLabel(String(payload.value));
  const lh     = 14;
  const startY = -((lines.length - 1) * lh) / 2;
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={startY + i * lh} textAnchor="end" fill="#52525b" fontSize={10}>
          {line}
        </text>
      ))}
    </g>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DuenoDashboard({
  empresaNombre, haTotal, costoTotalCI, campos,
  cultivosDetalle, riasPorLote, resultadoPorCampo, laboresPorTipo,
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

  // Costos totales por tipo de cultivo (costo directo + RIA)
  const costosPorCultivo = useMemo(() => {
    const map = new Map<string, { costoDir: number; costoRia: number; ingreso: number }>();
    for (const c of cultivosDetalle) {
      const key    = capitalize(c.cultivo);
      const ria    = riasPorLote[c.lote_id]?.total_ria ?? 0;
      const prev   = map.get(key) ?? { costoDir: 0, costoRia: 0, ingreso: 0 };
      map.set(key, {
        costoDir: prev.costoDir + c.costo_directo_ars,
        costoRia: prev.costoRia + ria,
        ingreso:  prev.ingreso  + c.ingreso_bruto_ars,
      });
    }
    return Array.from(map.entries())
      .map(([cultivo, d]) => ({
        cultivo,
        costoTotal: d.costoDir + d.costoRia,
        costoDir:   d.costoDir,
        costoRia:   d.costoRia,
        ingreso:    d.ingreso,
        margen:     d.ingreso - d.costoDir - d.costoRia,
      }))
      .sort((a, b) => b.costoTotal - a.costoTotal);
  }, [cultivosDetalle, riasPorLote]);

  // Distribución de ha por tipo de cultivo (para el donut)
  const cultivosPorTipo = useMemo(() => {
    const map = new Map<string, { ha: number; lotes: number }>();
    for (const c of cultivosDetalle) {
      const key = capitalize(c.cultivo);
      const ha  = lotesHectareas[c.lote_id] ?? 0;
      const prev = map.get(key) ?? { ha: 0, lotes: 0 };
      map.set(key, { ha: prev.ha + ha, lotes: prev.lotes + 1 });
    }
    return Array.from(map.entries())
      .map(([cultivo, data]) => ({ cultivo, ...data }))
      .sort((a, b) => b.ha - a.ha);
  }, [cultivosDetalle, lotesHectareas]);

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

        {/* Panel de detalle del lote */}
        {selectedLote && (
          <div className="mt-4 border border-zinc-100 rounded-2xl overflow-hidden">
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

      {/* ── Cultivos en curso ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-[#006836]" />
          <p className="text-sm font-semibold text-zinc-700">Cultivos en curso</p>
        </div>
        <p className="text-xs text-zinc-400 mb-4 ml-6">Activos ordenados por margen bruto</p>
        {cultivosActivos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Leaf className="w-8 h-8 text-zinc-200" />
            <p className="text-zinc-400 text-sm">Sin cultivos en curso</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 320 }}>
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

      {/* ── Gráficos: cultivos y labores ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Distribución de cultivos (donut por ha) */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Sprout className="w-4 h-4 text-[#006836]" />
            <p className="text-sm font-semibold text-zinc-700">Distribución de cultivos</p>
          </div>
          <p className="text-xs text-zinc-400 mb-4 ml-6">Hectáreas por tipo de cultivo</p>

          {cultivosPorTipo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Leaf className="w-8 h-8 text-zinc-200" />
              <p className="text-zinc-400 text-sm">Sin datos de cultivos</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={cultivosPorTipo}
                  dataKey="ha"
                  nameKey="cultivo"
                  cx="50%"
                  cy="48%"
                  outerRadius={88}
                  innerRadius={50}
                  paddingAngle={3}
                >
                  {cultivosPorTipo.map((_, i) => (
                    <Cell key={i} fill={CULTIVO_COLORS[i % CULTIVO_COLORS.length]} />
                  ))}
                </Pie>
                <PieTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    const color = CULTIVO_COLORS[(cultivosPorTipo.findIndex(c => c.cultivo === d.name)) % CULTIVO_COLORS.length];
                    return (
                      <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-sm">
                        <p className="font-bold" style={{ color }}>{d.name}</p>
                        <p className="text-zinc-500 text-xs">
                          {numHa.format(Number(d.value))} ha · {(d.payload as any).lotes} lote{(d.payload as any).lotes !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-zinc-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Costos por tipo de labor */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Tractor className="w-4 h-4 text-[#006836]" />
            <p className="text-sm font-semibold text-zinc-700">Costos por tipo de labor</p>
          </div>
          <p className="text-xs text-zinc-400 mb-4 ml-6">RIAs confirmadas · labores aplicadas</p>

          {laboresPorTipo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Tractor className="w-8 h-8 text-zinc-200" />
              <p className="text-zinc-400 text-sm">Sin labores registradas</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, laboresPorTipo.length * 56)}>
              <BarChart
                data={laboresPorTipo}
                layout="vertical"
                margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickFormatter={(v) => fmtARS(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="tipo"
                  type="category"
                  tick={<CustomYTick />}
                  axisLine={false}
                  tickLine={false}
                  width={148}
                />
                <BarTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-sm">
                        <p className="font-bold text-zinc-700">{d.tipo}</p>
                        <p className="text-[#006836] font-semibold">{fmtARS(d.total)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" name="Total" radius={[0, 5, 5, 0]}>
                  {laboresPorTipo.map((_, i) => (
                    <BarCell key={i} fill={LABOR_COLORS[i % LABOR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

      {/* Costos por tipo de cultivo */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Wheat className="w-4 h-4 text-[#006836]" />
          <p className="text-sm font-semibold text-zinc-700">Costos por tipo de cultivo</p>
        </div>
        <p className="text-xs text-zinc-400 mb-4 ml-6">Costo directo + RIA · ordenado por mayor costo</p>

        {costosPorCultivo.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Leaf className="w-8 h-8 text-zinc-200" />
            <p className="text-zinc-400 text-sm">Sin datos de costos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, costosPorCultivo.length * 56)}>
            <BarChart
              data={costosPorCultivo}
              layout="vertical"
              margin={{ left: 8, right: 56, top: 4, bottom: 4 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                tickFormatter={(v) => fmtARS(v)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="cultivo"
                type="category"
                tick={<CustomYTick />}
                axisLine={false}
                tickLine={false}
                width={148}
              />
              <BarTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const margenPos = d.margen >= 0;
                  return (
                    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2.5 shadow-lg text-sm space-y-1">
                      <p className="font-bold text-zinc-700">{d.cultivo}</p>
                      <p className="text-zinc-400 text-xs">
                        Costo directo: <span className="text-zinc-600 font-semibold">{fmtARS(d.costoDir)}</span>
                      </p>
                      <p className="text-zinc-400 text-xs">
                        Costo RIA: <span className="text-zinc-600 font-semibold">{fmtARS(d.costoRia)}</span>
                      </p>
                      <p className="text-zinc-400 text-xs border-t border-zinc-100 pt-1">
                        Total: <span className="text-red-500 font-bold">{fmtARS(d.costoTotal)}</span>
                      </p>
                      {d.ingreso > 0 && (
                        <p className={`text-xs font-bold ${margenPos ? 'text-green-600' : 'text-red-500'}`}>
                          Margen: {margenPos ? '+' : ''}{fmtARS(d.margen)}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="costoTotal" name="Costo total" radius={[0, 5, 5, 0]}>
                {costosPorCultivo.map((_, i) => (
                  <BarCell key={i} fill={CULTIVO_COLORS[i % CULTIVO_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
