'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Filter, X, ChevronRight, Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';
import ExportButtons from '@/components/export-buttons';
import { useCurrency } from '@/lib/currency-context';

const ESTADO_BADGE: Record<string, string> = {
  planificada: 'bg-blue-100 text-blue-700',
  en_curso:    'bg-amber-100 text-amber-700',
  cosechada:   'bg-green-100 text-green-700',
  cancelada:   'bg-zinc-100 text-zinc-500',
};
const ESTADO_LABEL: Record<string, string> = {
  planificada: 'Planificada',
  en_curso:    'En curso',
  cosechada:   'Cosechada',
  cancelada:   'Cancelada',
};

interface Cosecha {
  id: string;
  cultivo: string;
  estado: string;
  producto_final: string | null;
  unidad_produccion: string;
  campo_nombre: string;
  lote_nombre: string;
  lote_hectareas: number | null;
  campania_nombre: string | null;
  unidad_negocio_nombre: string;
  fecha_siembra: string | null;
  fecha_cosecha_real: string | null;
  produccion_total: number | null;
  rendimiento_por_ha: number | null;
  precio_venta_ars: number | null;
  ingreso_bruto_ars: number | null;
  costo_directo_ars: number | null;
  margen_bruto_ars: number | null;
}

interface Props {
  cultivos: Cosecha[];
  campanias: { id: string; nombre: string }[];
  campos: { id: string; nombre: string }[];
  empresaNombre: string;
}

const num = (n: number | null, d = 0) => n != null ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n) : '—';
const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function ProduccionManager({ cultivos, campanias, campos, empresaNombre }: Props) {
  const { formatMoney, currency } = useCurrency();
  const [campaniaId, setCampaniaId] = useState('');
  const [campoNombre, setCampoNombre] = useState('');
  const [estado, setEstado] = useState('');
  const [textoCultivo, setTextoCultivo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtrados = useMemo(() => {
    return cultivos.filter((c) => {
      if (campaniaId && c.campania_nombre !== campanias.find(x => x.id === campaniaId)?.nombre) return false;
      if (campoNombre && c.campo_nombre !== campoNombre) return false;
      if (estado && c.estado !== estado) return false;
      if (textoCultivo && !c.cultivo.toLowerCase().includes(textoCultivo.toLowerCase())) return false;
      return true;
    });
  }, [cultivos, campaniaId, campoNombre, estado, textoCultivo, campanias]);

  const cosechados = filtrados.filter((c) => c.estado === 'cosechada');
  const ingresoTotal = cosechados.reduce((acc, c) => acc + Number(c.ingreso_bruto_ars ?? 0), 0);
  const costoTotal = filtrados.reduce((acc, c) => acc + Number(c.costo_directo_ars ?? 0), 0);
  const margenTotal = cosechados.filter(c => c.margen_bruto_ars != null).reduce((acc, c) => acc + Number(c.margen_bruto_ars ?? 0), 0);

  const filtrosActivos = [campaniaId, campoNombre, estado, textoCultivo].filter(Boolean).length;

  function limpiarFiltros() {
    setCampaniaId(''); setCampoNombre(''); setEstado(''); setTextoCultivo('');
  }

  const exportColumns = [
    { header: 'Cultivo',                     key: 'cultivo',            width: 22 },
    { header: 'Producto final',              key: 'producto_final',     width: 20, format: (v: any) => v ?? '' },
    { header: 'Campo',                       key: 'campo_nombre',       width: 20 },
    { header: 'Lote',                        key: 'lote_nombre',        width: 16 },
    { header: 'Hectáreas',                   key: 'lote_hectareas',     width: 12, format: (v: any) => v != null ? num(v, 2) : '' },
    { header: 'Campaña',                     key: 'campania_nombre',    width: 16, format: (v: any) => v ?? '' },
    { header: 'Estado',                      key: 'estado',             width: 14, format: (v: string) => ESTADO_LABEL[v] ?? v },
    { header: 'F. Siembra',                  key: 'fecha_siembra',      width: 14, format: (v: any) => fmt(v) },
    { header: 'F. Cosecha',                  key: 'fecha_cosecha_real', width: 14, format: (v: any) => fmt(v) },
    { header: 'Producción',                  key: 'produccion_total',   width: 16, format: (v: any) => v != null ? num(v, 2) : '' },
    { header: 'Unidad',                      key: 'unidad_produccion',  width: 10 },
    { header: 'Rendimiento / ha',            key: 'rendimiento_por_ha', width: 16, format: (v: any) => v != null ? num(v, 2) : '' },
    { header: `Precio venta (${currency})`,  key: 'precio_venta_ars',   width: 20, format: (v: any) => v != null ? formatMoney(v) : '' },
    { header: `Ingreso bruto (${currency})`, key: 'ingreso_bruto_ars',  width: 20, format: (v: any) => v != null ? formatMoney(v) : '' },
    { header: `Costo directo (${currency})`, key: 'costo_directo_ars',  width: 20, format: (v: any) => v != null ? formatMoney(v) : '' },
    { header: `Margen bruto (${currency})`,  key: 'margen_bruto_ars',   width: 20, format: (v: any) => v != null ? formatMoney(v) : '' },
  ];

  return (
    <div className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Cultivos', value: filtrados.length.toString(), sub: `${cosechados.length} cosechados` },
          { label: 'Ingreso bruto', value: ingresoTotal > 0 ? formatMoney(ingresoTotal) : '—', sub: 'cultivos cosechados con precio' },
          { label: 'Costo directo', value: costoTotal > 0 ? formatMoney(costoTotal) : '—', sub: 'suma de aplicaciones' },
          { label: 'Margen bruto total', value: margenTotal !== 0 ? formatMoney(margenTotal) : '—', sub: 'ingreso − costo', highlight: margenTotal >= 0 },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-white rounded-2xl border border-zinc-100 px-5 py-4 shadow-sm">
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 tracking-tight ${highlight === false ? 'text-red-600' : highlight ? 'text-[#006836]' : 'text-zinc-900'}`}>{value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros + export */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
              showFilters || filtrosActivos > 0
                ? 'border-[#006836]/40 text-[#006836] bg-[#006836]/5'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {filtrosActivos > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#006836] text-white rounded-full text-xs leading-none">
                {filtrosActivos}
              </span>
            )}
          </button>

          <div className="flex items-center gap-3">
            {filtrosActivos > 0 && (
              <button onClick={limpiarFiltros} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
            <ExportButtons
              data={filtrados}
              columns={exportColumns}
              filename={`produccion-${empresaNombre.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`}
              title={`Producción · ${empresaNombre}`}
            />
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-100">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Cultivo</label>
              <input
                type="text"
                placeholder="Soja, Trigo..."
                value={textoCultivo}
                onChange={(e) => setTextoCultivo(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Campo</label>
              <select value={campoNombre} onChange={(e) => setCampoNombre(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                <option value="">Todos</option>
                {campos.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Campaña</label>
              <select value={campaniaId} onChange={(e) => setCampaniaId(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                <option value="">Todas</option>
                {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                <option value="">Todos</option>
                <option value="planificada">Planificada</option>
                <option value="en_curso">En curso</option>
                <option value="cosechada">Cosechada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Wheat className="w-10 h-10 text-zinc-200 mx-auto" />
            <p className="text-zinc-400 text-sm">
              {cultivos.length === 0 ? 'No hay cultivos registrados.' : 'Sin resultados con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Cultivo / Producto</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Campo / Lote</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Campaña</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-500">Producción</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-500">Ingreso bruto</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-500">Costo directo</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-500">Margen bruto</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-[#006836]/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-zinc-800 block">{c.cultivo}</span>
                      {c.producto_final && (
                        <span className="text-xs text-zinc-400">{c.producto_final}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-700">{c.campo_nombre}</span>
                      <span className="text-zinc-400 mx-1">›</span>
                      <span className="text-zinc-500 text-xs">{c.lote_nombre}</span>
                      {c.lote_hectareas && (
                        <span className="text-zinc-400 text-xs ml-1">({num(c.lote_hectareas, 1)} ha)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{c.campania_nombre ?? <span className="text-zinc-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium', ESTADO_BADGE[c.estado] ?? 'bg-zinc-100 text-zinc-600')}>
                        {ESTADO_LABEL[c.estado] ?? c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.produccion_total != null ? (
                        <span className="font-semibold text-zinc-800">
                          {num(c.produccion_total, 2)} <span className="text-zinc-400 font-normal text-xs">{c.unidad_produccion}</span>
                        </span>
                      ) : <span className="text-zinc-300">—</span>}
                      {c.rendimiento_por_ha != null && (
                        <span className="block text-zinc-400 text-xs">{num(c.rendimiento_por_ha, 2)}/{c.unidad_produccion}/ha</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">
                      {c.ingreso_bruto_ars != null ? formatMoney(c.ingreso_bruto_ars) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">
                      {c.costo_directo_ars != null ? formatMoney(c.costo_directo_ars) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.margen_bruto_ars != null ? (
                        <span className={c.margen_bruto_ars >= 0 ? 'text-[#006836] font-bold' : 'text-red-600 font-bold'}>
                          {formatMoney(c.margen_bruto_ars)}
                        </span>
                      ) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <Link href={`/app/cultivos/${c.id}`}>
                        <ChevronRight className="w-4 h-4 hover:text-[#006836] transition-colors" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
