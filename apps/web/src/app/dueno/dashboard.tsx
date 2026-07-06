'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  MapPin, Sprout, Wheat, TrendingDown, Building2, Layers, BarChart3,
} from 'lucide-react';
import MapaDueno from './mapa-dueno';
import type { CampoGlobal } from './mapa-dueno-inner';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Cultivo {
  id: string;
  cultivo: string | null;
  estado: string;
  campania_id: string | null;
}

interface LoteStats {
  nombre: string;      // "Lote A · Campo Sur"
  campo: string;
  hectareas: number;
}

interface Props {
  empresaNombre: string;
  haTotal: number;
  costoTotalCI: number;
  campos: CampoGlobal[];
  lotesStats: LoteStats[];
  cultivos: Cultivo[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Valores reales del enum estado_campania en la DB
const ESTADO_LABEL: Record<string, string> = {
  planificada: 'Planificado',
  en_curso:    'En curso',
  cosechada:   'Cosechado',
  cancelada:   'Cancelado',
};

const ESTADO_COLOR: Record<string, string> = {
  planificada: '#a3a3a3',
  en_curso:    '#22c55e',
  cosechada:   '#f59e0b',
  cancelada:   '#ef4444',
};

const COLORES_BARRA = ['#006836','#22c55e','#3b82f6','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#f97316','#14b8a6','#84cc16'];

const numHa  = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const numARS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DuenoDashboard({
  empresaNombre, haTotal, costoTotalCI, campos, lotesStats, cultivos,
}: Props) {
  const hoy = new Date();
  const fechaLabel = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const activos    = cultivos.filter((c) => c.estado === 'en_curso').length;
  const cosechados = cultivos.filter((c) => c.estado === 'cosechada').length;

  // Datos gráfico de estados
  const estadosData = Object.entries(
    cultivos.reduce<Record<string, number>>((acc, c) => {
      const e = c.estado || 'planificada';
      acc[e] = (acc[e] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([estado, count]) => ({
      name:  ESTADO_LABEL[estado] ?? estado,
      value: count,
      fill:  ESTADO_COLOR[estado] ?? '#a3a3a3',
    }))
    .sort((a, b) => b.value - a.value);

  // Ha por lote (todos, sin filtrar por > 0 para que aparezcan aunque sean 0)
  const haData = lotesStats
    .sort((a, b) => b.hectareas - a.hectareas)
    .map((l, i) => ({
      nombre:     l.nombre.length > 22 ? l.nombre.slice(0, 20) + '…' : l.nombre,
      nombreFull: l.nombre,
      campo:      l.campo,
      hectareas:  l.hectareas,
      fill:       COLORES_BARRA[i % COLORES_BARRA.length],
    }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header verde degradado ─────────────────────────────────────── */}
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

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
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
            Cosechados · {cultivos.length} total
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

      {/* ── Mapa ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[#006836]" />
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Campos y lotes</h2>
        </div>
        <MapaDueno campos={campos} />
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#006836]" />
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Estadísticas</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Estado de cultivos */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-700 mb-4">Estado de los cultivos</p>
            {estadosData.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-10">Sin cultivos registrados</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={estadosData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={52}
                    paddingAngle={3}
                    label={({ name, value }) => `${value}`}
                  >
                    {estadosData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-sm">
                          <p className="font-semibold" style={{ color: d.payload.fill }}>{d.name}</p>
                          <p className="text-zinc-500">{d.value} cultivo{Number(d.value) !== 1 ? 's' : ''}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-zinc-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Ha por lote */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-700 mb-4">Hectáreas por lote</p>
            {haData.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-10">Sin lotes registrados</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, haData.length * 32)}>
                <BarChart
                  data={haData}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#a1a1aa' }}
                    tickFormatter={(v) => `${numHa.format(v)}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="nombre"
                    type="category"
                    tick={{ fontSize: 11, fill: '#52525b' }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-sm">
                          <p className="font-semibold text-zinc-700">{d.nombreFull}</p>
                          <p className="text-xs text-zinc-400">{d.campo}</p>
                          <p style={{ color: d.fill }} className="font-bold">{numHa.format(d.hectareas)} ha</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="hectareas" name="Hectáreas" radius={[0, 5, 5, 0]}>
                    {haData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
