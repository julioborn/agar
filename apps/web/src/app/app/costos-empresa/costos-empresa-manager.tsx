'use client';

import { useState, useMemo, useTransition } from 'react';
import { Plus, Trash2, FileText, Filter, X, ChevronDown, ChevronUp, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crearCostoIndirectoEmpresa, eliminarCostoIndirectoEmpresa } from '../costos-indirectos/actions';
import ExportButtons from '@/components/export-buttons';

const CATEGORIAS = {
  administrativo:  'Administrativo',
  contable:        'Contable / Honorarios',
  bancario:        'Bancario',
  seguro:          'Seguro',
  alquiler:        'Alquiler',
  personal_admin:  'Personal administrativo',
  otros:           'Otros',
} as const;

type Categoria = keyof typeof CATEGORIAS;

interface CostoEmpresa {
  id: string;
  campania_id: string | null;
  fecha: string;
  categoria: Categoria;
  descripcion: string;
  monto_ars: number;
  created_at: string;
  campania: { id: string; nombre: string } | null;
  proveedor: { id: string; nombre: string } | null;
  comprobante: { id: string; numero: string; usuario_id: string } | null;
}

interface Props {
  costos: CostoEmpresa[];
  campanias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  empresaNombre: string;
}

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function CostosEmpresaManager({ costos, campanias, proveedores, empresaNombre }: Props) {
  // Filters
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [campaniaFiltro, setCampaniaFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [campaniaId, setCampaniaId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [monto, setMonto] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [ultimoComprobante, setUltimoComprobante] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const filtrados = useMemo(() => costos.filter((c) => {
    if (categoriaFiltro && c.categoria !== categoriaFiltro) return false;
    if (campaniaFiltro && c.campania_id !== campaniaFiltro) return false;
    if (fechaDesde && c.fecha < fechaDesde) return false;
    if (fechaHasta && c.fecha > fechaHasta) return false;
    return true;
  }), [costos, categoriaFiltro, campaniaFiltro, fechaDesde, fechaHasta]);

  const totalFiltrado = filtrados.reduce((acc, c) => acc + Number(c.monto_ars), 0);
  const filtrosActivos = [categoriaFiltro, campaniaFiltro, fechaDesde, fechaHasta].filter(Boolean).length;

  const exportData = filtrados.map((c) => ({
    comprobante: c.comprobante?.numero ?? '—',
    fecha: c.fecha,
    categoria: CATEGORIAS[c.categoria],
    campania: c.campania?.nombre ?? '—',
    proveedor: c.proveedor?.nombre ?? '—',
    descripcion: c.descripcion,
    monto_ars: Number(c.monto_ars),
  }));

  const exportColumns = [
    { header: 'Comprobante', key: 'comprobante', width: 16 },
    { header: 'Fecha',       key: 'fecha',       width: 12, format: fmt },
    { header: 'Categoría',   key: 'categoria',   width: 22 },
    { header: 'Campaña',     key: 'campania',    width: 18 },
    { header: 'Proveedor',   key: 'proveedor',   width: 24 },
    { header: 'Descripción', key: 'descripcion', width: 36 },
    { header: 'Monto $',     key: 'monto_ars',   width: 16, format: (v: number) => num.format(v), align: 'right' as const, total: true },
  ];

  function resetForm() {
    setCampaniaId(''); setFecha(new Date().toISOString().split('T')[0]);
    setCategoria(''); setDescripcion(''); setProveedorId(''); setMonto('');
    setFormError(null);
  }

  function handleGuardar() {
    if (!categoria) return setFormError('Seleccioná una categoría.');
    if (!descripcion.trim()) return setFormError('Ingresá una descripción.');
    const montoNum = parseFloat(monto.replace(',', '.'));
    if (!monto || isNaN(montoNum) || montoNum <= 0) return setFormError('Ingresá un monto válido.');

    setFormError(null);
    startTransition(async () => {
      const res = await crearCostoIndirectoEmpresa({
        campania_id: campaniaId || undefined,
        fecha,
        categoria: categoria as Categoria,
        descripcion: descripcion.trim(),
        proveedor_id: proveedorId || undefined,
        monto_ars: montoNum,
      });
      if (res.error) { setFormError(res.error); return; }
      setUltimoComprobante(res.comprobanteNumero ?? null);
      resetForm();
      setShowForm(false);
    });
  }

  function handleEliminar(costoId: string, comprobanteId: string) {
    if (!confirm('¿Eliminar este costo indirecto y su comprobante interno?')) return;
    startTransition(async () => {
      await eliminarCostoIndirectoEmpresa(costoId, comprobanteId);
    });
  }

  return (
    <div className="space-y-4">
      {/* Último comprobante */}
      {ultimoComprobante && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#006836]/10 border border-[#006836]/20 rounded-xl text-sm text-[#006836]">
          <FileText className="w-4 h-4 shrink-0" />
          Comprobante interno generado: <strong>{ultimoComprobante}</strong>
          <button onClick={() => setUltimoComprobante(null)} className="ml-auto text-zinc-400 hover:text-zinc-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors',
            showFilters ? 'bg-purple-50 border-purple-300 text-purple-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
          )}
        >
          <Filter className="w-4 h-4" />
          Filtros {filtrosActivos > 0 && <span className="bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{filtrosActivos}</span>}
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <ExportButtons
            data={exportData}
            columns={exportColumns}
            filename={`costos-indirectos-${empresaNombre.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`}
            title={`Costos Indirectos · ${empresaNombre}`}
          />
          <button
            onClick={() => { setShowForm((v) => !v); setUltimoComprobante(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo costo
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Categoría</label>
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Todas</option>
              {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Campaña</label>
            <select value={campaniaFiltro} onChange={(e) => setCampaniaFiltro(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Todas</option>
              {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white" />
          </div>
          {filtrosActivos > 0 && (
            <div className="flex items-end col-span-2 md:col-span-4">
              <button
                onClick={() => { setCategoriaFiltro(''); setCampaniaFiltro(''); setFechaDesde(''); setFechaHasta(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-800 underline"
              >Limpiar filtros</button>
            </div>
          )}
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="border border-purple-200 bg-purple-50/30 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-zinc-800">Nuevo costo indirecto de empresa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Campaña (opcional)</label>
              <select value={campaniaId} onChange={(e) => setCampaniaId(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white">
                <option value="">Sin campaña asignada</option>
                {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Categoría *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria | '')}
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white">
                <option value="">Seleccioná categoría</option>
                {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Proveedor (opcional)</label>
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white">
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Descripción *</label>
              <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Honorarios contables 2do semestre 2025"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Monto (ARS) *</label>
              <input type="text" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
                placeholder="0,00"
                className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white" />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { resetForm(); setShowForm(false); }}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
            <button onClick={handleGuardar} disabled={isPending}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {isPending ? 'Guardando…' : 'Guardar y generar comprobante'}
            </button>
          </div>
        </div>
      )}

      {/* Resumen */}
      {filtrados.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm">
          <span className="text-zinc-500">{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</span>
          <span className="text-zinc-300">·</span>
          <span className="font-semibold text-zinc-800">Total: $ {num.format(totalFiltrado)}</span>
        </div>
      )}

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <Landmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay costos indirectos de empresa registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c) => (
            <div key={c.id} className="bg-white border border-zinc-100 rounded-xl px-4 py-3 flex items-start gap-3 hover:border-zinc-200 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-zinc-400">{c.comprobante?.numero ?? '—'}</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {CATEGORIAS[c.categoria]}
                  </span>
                  {c.campania && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{c.campania.nombre}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-zinc-800 mt-1 truncate">{c.descripcion}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400 flex-wrap">
                  <span>{fmt(c.fecha)}</span>
                  {c.proveedor && <><span>·</span><span>{c.proveedor.nombre}</span></>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-zinc-800">$ {num.format(Number(c.monto_ars))}</p>
                <button
                  onClick={() => handleEliminar(c.id, c.comprobante?.id ?? '')}
                  disabled={isPending}
                  className="mt-1 text-zinc-300 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
