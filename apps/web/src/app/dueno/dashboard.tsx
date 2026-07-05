'use client';

import dynamic from 'next/dynamic';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { Layers } from 'lucide-react';
import type { CampoGlobal } from '@/app/app/campos/mapa-todos-campos-inner';

const MapaTodosCampos = dynamic(() => import('@/app/app/campos/mapa-todos-campos'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Cargando mapa…</p>
    </div>
  ),
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Cultivo {
  id: string;
  cultivo: string | null;
  estado: string;
  hectareas: number | null;
  campania_id: string | null;
}

interface Props {
  empresaNombre: string;
  haTotal: number;
  costoTotalCI: number;
  campos: CampoGlobal[];
  camposStats: { id: string; nombre: string; hectareas: number }[];
  cultivos: Cultivo[];
  campanias: { id: string; nombre: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  sembrado:       'Sembrado',
  en_desarrollo:  'En desarrollo',
  cosechado:      'Cosechado',
  perdida:        'Pérdida',
  planificado:    'Planificado',
};

const ESTADO_COLOR: Record<string, string> = {
  sembrado:       '#22c55e',
  en_desarrollo:  '#3b82f6',
  cosechado:      '#f59e0b',
  perdida:        '#ef4444',
  planificado:    '#a3a3a3',
};

const COLORES_CAMPOS = ['#006836', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const numHa = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`rounded-2xl p-5 text-white`} style={{ background: color }}>
      <p className="text-sm font-medium opacity-80 mb-1">{label}</p>
      <p className="text-3xl font-bold tracking-tight leading-none">{value}</p>
      {sub && <p className="text-xs mt-2 opacity-70">{sub}</p>}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill ?? p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold" style={{ color: d.payload.fill }}>{d.name}</p>
      <p className="text-zinc-600">{d.value} cultivo{d.value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DuenoDashboard({
  empresaNombre, haTotal, costoTotalCI, campos, camposStats, cultivos, campanias,
}: Props) {
  const activos = cultivos.filter((c) => ['sembrado', 'en_desarrollo'].includes(c.estado)).length;
  const cosechados = cultivos.filter((c) => c.estado === 'cosechado').length;
  const totalCultivos = cultivos.length;

  // Datos para gráfico de estados
  const estadosData = Object.entries(
    cultivos.reduce<Record<string, number>>((acc, c) => {
      const e = c.estado || 'planificado';
      acc[e] = (acc[e] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([estado, count]) => ({
      name: ESTADO_LABEL[estado] ?? estado,
      value: count,
      fill: ESTADO_COLOR[estado] ?? '#a3a3a3',
    }))
    .sort((a, b) => b.value - a.value);

  // Datos para gráfico de hectáreas por campo
  const haData = camposStats
    .filter((c) => c.hectareas > 0)
    .sort((a, b) => b.hectareas - a.hectareas)
    .slice(0, 10)
    .map((c, i) => ({
      nombre: c.nombre.length > 16 ? c.nombre.slice(0, 14) + '…' : c.nombre,
      nombreFull: c.nombre,
      hectareas: c.hectareas,
      fill: COLORES_CAMPOS[i % COLORES_CAMPOS.length],
    }));

  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 capitalize">{hoy}</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Resumen de actividad · {empresaNombre}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Hectáreas totales"
          value={`${numHa.format(haTotal)} ha`}
          sub={`${campos.length} campo${campos.length !== 1 ? 's' : ''}`}
          color="#006836"
        />
        <KpiCard
          label="Cultivos en marcha"
          value={activos}
          sub="Sembrados o en desarrollo"
          color="#2563eb"
        />
        <KpiCard
          label="Ya cosechados"
          value={cosechados}
          sub={`de ${totalCultivos} cultivo${totalCultivos !== 1 ? 's' : ''} totales`}
          color="#d97706"
        />
        <KpiCard
          label="Gastos indirectos"
          value={`$ ${num.format(costoTotalCI)}`}
          sub="Campo + empresa"
          color="#7c3aed"
        />
      </div>

      {/* Mapa */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-zinc-400" />
          <h2 className="text-base font-semibold text-zinc-800">Mapa de campos y lotes</h2>
        </div>
        <MapaTodosCampos campos={campos} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Estado de cultivos */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5">
          <h2 className="text-base font-semibold text-zinc-800 mb-4">Estado de los cultivos</h2>
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
                  innerRadius={50}
                  paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {estadosData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<PieTip />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-zinc-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Hectáreas por campo */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5">
          <h2 className="text-base font-semibold text-zinc-800 mb-4">Hectáreas por campo</h2>
          {haData.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-10">Sin datos de hectáreas</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={haData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickFormatter={(v) => `${numHa.format(v)} ha`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="nombre"
                  type="category"
                  tick={{ fontSize: 12, fill: '#52525b' }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold text-zinc-700">{d.nombreFull}</p>
                        <p style={{ color: d.fill }}><strong>{numHa.format(d.hectareas)} ha</strong></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="hectareas" name="Hectáreas" radius={[0, 6, 6, 0]}>
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
  );
}
