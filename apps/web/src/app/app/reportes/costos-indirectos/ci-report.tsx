'use client';

import { useState, useMemo } from 'react';
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ExportButtons from '@/components/export-buttons';

const CATEGORIAS_CAMPO: Record<string, string> = {
  impuesto:         'Impuesto',
  arrendamiento:    'Arrendamiento',
  infraestructura:  'Infraestructura',
  seguro:           'Seguro',
  servicios_campo:  'Servicios del campo',
  otros:            'Otros',
};

const CATEGORIAS_EMPRESA: Record<string, string> = {
  administrativo:  'Administrativo',
  contable:        'Contable / Honorarios',
  bancario:        'Bancario',
  seguro:          'Seguro',
  alquiler:        'Alquiler',
  personal_admin:  'Personal administrativo',
  otros:           'Otros',
};

const ALL_CATEGORIAS: Record<string, string> = { ...CATEGORIAS_CAMPO, ...CATEGORIAS_EMPRESA };

interface CostoBase {
  id: string;
  campania_id: string | null;
  fecha: string;
  categoria: string;
  descripcion: string;
  monto_ars: number;
  campania: { id: string; nombre: string } | null;
  proveedor: { id: string; nombre: string } | null;
  comprobante: { id: string; numero: string } | null;
}

interface CostoCampo extends CostoBase {
  campo_id: string;
  campo: { id: string; nombre: string } | null;
}

interface CostoEmpresa extends CostoBase {}

interface CombinedRow {
  id: string;
  tipo: 'campo' | 'empresa';
  campo_id: string | null;
  campania_id: string | null;
  fecha: string;
  categoria: string;
  descripcion: string;
  monto_ars: number;
  campo: { id: string; nombre: string } | null;
  campania: { id: string; nombre: string } | null;
  proveedor: { id: string; nombre: string } | null;
  comprobante: { id: string; numero: string } | null;
}

interface Props {
  costosCampo: CostoCampo[];
  costosEmpresa: CostoEmpresa[];
  campos: { id: string; nombre: string }[];
  campanias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  empresaNombre: string;
}

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function CIReport({ costosCampo, costosEmpresa, campos, campanias, proveedores, empresaNombre }: Props) {
  const [tipoFiltro, setTipoFiltro] = useState<'campo' | 'empresa' | ''>('');
  const [campoFiltro, setCampoFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [campaniaFiltro, setCampaniaFiltro] = useState('');
  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const combined = useMemo<CombinedRow[]>(() => [
    ...costosCampo.map((c) => ({
      id: c.id,
      tipo: 'campo' as const,
      campo_id: c.campo_id,
      campania_id: c.campania_id,
      fecha: c.fecha,
      categoria: c.categoria,
      descripcion: c.descripcion,
      monto_ars: Number(c.monto_ars),
      campo: c.campo,
      campania: c.campania,
      proveedor: c.proveedor,
      comprobante: c.comprobante,
    })),
    ...costosEmpresa.map((c) => ({
      id: c.id,
      tipo: 'empresa' as const,
      campo_id: null,
      campania_id: c.campania_id,
      fecha: c.fecha,
      categoria: c.categoria,
      descripcion: c.descripcion,
      monto_ars: Number(c.monto_ars),
      campo: null,
      campania: c.campania,
      proveedor: c.proveedor,
      comprobante: c.comprobante,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha)), [costosCampo, costosEmpresa]);

  const filtrados = useMemo(() => combined.filter((c) => {
    if (tipoFiltro && c.tipo !== tipoFiltro) return false;
    if (campoFiltro && c.campo_id !== campoFiltro) return false;
    if (categoriaFiltro && c.categoria !== categoriaFiltro) return false;
    if (campaniaFiltro && c.campania_id !== campaniaFiltro) return false;
    if (proveedorFiltro && c.proveedor?.id !== proveedorFiltro) return false;
    if (fechaDesde && c.fecha < fechaDesde) return false;
    if (fechaHasta && c.fecha > fechaHasta) return false;
    return true;
  }), [combined, tipoFiltro, campoFiltro, categoriaFiltro, campaniaFiltro, proveedorFiltro, fechaDesde, fechaHasta]);

  const total = filtrados.reduce((acc, c) => acc + c.monto_ars, 0);
  const filtrosActivos = [tipoFiltro, campoFiltro, categoriaFiltro, campaniaFiltro, proveedorFiltro, fechaDesde, fechaHasta].filter(Boolean).length;

  const limpiarFiltros = () => {
    setTipoFiltro('');
    setCampoFiltro('');
    setCategoriaFiltro('');
    setCampaniaFiltro('');
    setProveedorFiltro('');
    setFechaDesde('');
    setFechaHasta('');
  };

  const date = new Date().toISOString().split('T')[0];
  const slug = empresaNombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const exportData = filtrados.map((c) => ({
    tipo: c.tipo === 'campo' ? 'Campo' : 'Empresa',
    comprobante: c.comprobante?.numero ?? '—',
    fecha: c.fecha,
    campo: c.campo?.nombre ?? '—',
    campania: c.campania?.nombre ?? '—',
    categoria: ALL_CATEGORIAS[c.categoria] ?? c.categoria,
    proveedor: c.proveedor?.nombre ?? '—',
    descripcion: c.descripcion,
    monto_ars: c.monto_ars,
  }));

  const exportColumns = [
    { header: 'Tipo',        key: 'tipo',        width: 12 },
    { header: 'Comprobante', key: 'comprobante',  width: 16 },
    { header: 'Fecha',       key: 'fecha',        width: 12, format: fmt },
    { header: 'Campo',       key: 'campo',        width: 20 },
    { header: 'Campaña',     key: 'campania',     width: 18 },
    { header: 'Categoría',   key: 'categoria',    width: 24 },
    { header: 'Proveedor',   key: 'proveedor',    width: 24 },
    { header: 'Descripción', key: 'descripcion',  width: 36 },
    { header: 'Monto $',     key: 'monto_ars',    width: 16, format: (v: number) => num.format(v), align: 'right' as const, total: true },
  ];

  return (
    <div className="space-y-4">
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

        <div className="ml-auto">
          <ExportButtons
            data={exportData}
            columns={exportColumns}
            filename={`costos-indirectos-${slug}-${date}`}
            title={`Costos Indirectos · ${empresaNombre}`}
          />
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value as 'campo' | 'empresa' | ''); setCampoFiltro(''); }}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">Todos</option>
              <option value="campo">Campo</option>
              <option value="empresa">Empresa</option>
            </select>
          </div>

          {tipoFiltro !== 'empresa' && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Campo</label>
              <select
                value={campoFiltro}
                onChange={(e) => setCampoFiltro(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
              >
                <option value="">Todos</option>
                {campos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Categoría</label>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">Todas</option>
              {tipoFiltro === 'campo'
                ? Object.entries(CATEGORIAS_CAMPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)
                : tipoFiltro === 'empresa'
                  ? Object.entries(CATEGORIAS_EMPRESA).map(([k, v]) => <option key={k} value={k}>{v}</option>)
                  : Object.entries(ALL_CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)
              }
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Campaña</label>
            <select
              value={campaniaFiltro}
              onChange={(e) => setCampaniaFiltro(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">Todas</option>
              {campanias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Proveedor</label>
            <select
              value={proveedorFiltro}
              onChange={(e) => setProveedorFiltro(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
            />
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="flex items-center gap-4 text-sm text-zinc-500">
        <span>{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</span>
        <span className="font-semibold text-zinc-800">Total: $ {num.format(total)}</span>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 bg-white border border-zinc-100 rounded-2xl">
          Sin registros para los filtros aplicados.
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Comp.</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Campo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Campaña</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Categoría</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Monto $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtrados.map((c) => (
                  <tr key={`${c.tipo}-${c.id}`} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        c.tipo === 'campo'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-purple-100 text-purple-700',
                      )}>
                        {c.tipo === 'campo' ? 'Campo' : 'Empresa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{c.comprobante?.numero ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{fmt(c.fecha)}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.campo?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{c.campania?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{ALL_CATEGORIAS[c.categoria] ?? c.categoria}</td>
                    <td className="px-4 py-3 text-zinc-700 max-w-xs truncate">{c.descripcion}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900 tabular-nums">
                      $ {num.format(c.monto_ars)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-zinc-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-zinc-900 tabular-nums">
                    $ {num.format(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
