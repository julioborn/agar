'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2, Check, X, Info, CheckCircle2 } from 'lucide-react';
import { guardarPrecioYActualizarRias } from './actions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import ExportButtons from '@/components/export-buttons';

const CRITERIOS = [
  { value: 'ultima_compra', label: 'Última compra',         desc: 'Precio de la compra más reciente' },
  { value: 'ppp',           label: 'PPP / FIFO',            desc: 'Promedio ponderado de las capas de stock vigentes' },
  { value: 'reposicion',    label: 'Valor de reposición',   desc: 'Precio de mercado actual cargado manualmente' },
];

const CATEGORIAS = [
  'fertilizante', 'semilla', 'agroquimico', 'combustible', 'insumo_cosecha', 'inoculante', 'otro',
];

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const $ = (v: number | null | undefined) => v != null ? `$${num.format(v)}` : '—';
const today = () => new Date().toISOString().split('T')[0];

const inp = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40';
const lbl = 'block text-xs font-medium text-zinc-500 mb-1.5';

interface Props {
  configuraciones: any[];
  precios: any[];
  productos: any[];
  stockValuacion: any[];
  empresaId: string;
  productosSinPrecio: { id: string; nombre: string; unidad_base: string; categoria: string }[];
}

type Tab = 'criterios' | 'reposicion' | 'informe';

export default function ValuacionManager({
  configuraciones: initConfig, precios: initPrecios,
  productos, stockValuacion, empresaId, productosSinPrecio,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('criterios');
  const [configs, setConfigs] = useState(initConfig);
  const [precios, setPrecios] = useState(initPrecios);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Config form state ───────────────────────────────────────────────────────
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editConfigId, setEditConfigId] = useState<string | null>(null);
  const [alcance, setAlcance] = useState<'global' | 'tipo' | 'producto'>('global');
  const [tipoProd, setTipoProd] = useState('');
  const [productoId, setProductoId] = useState('');
  const [critImp, setCritImp] = useState('ultima_compra');
  const [critStock, setCritStock] = useState('ppp');

  // ── Precio reposicion form state ────────────────────────────────────────────
  const [showPrecioForm, setShowPrecioForm] = useState(false);
  const [editPrecioId, setEditPrecioId] = useState<string | null>(null);
  const [precioProductoId, setPrecioProductoId] = useState('');
  const [precioArs, setPrecioArs] = useState('');
  const [precioDesde, setPrecioDesde] = useState(today());
  const [precioHasta, setPrecioHasta] = useState('');
  const [precioObs, setPrecioObs] = useState('');

  // ── Sin precio ──────────────────────────────────────────────────────────────
  const [precioRapido, setPrecioRapido] = useState<Record<string, string>>({});
  const [guardandoPrecio, setGuardandoPrecio] = useState<string | null>(null);
  const [precioOkIds, setPrecioOkIds] = useState<Set<string>>(new Set());
  const [resultadoUpdate, setResultadoUpdate] = useState<{ rias: number; cultivos: number } | null>(null);

  async function handleGuardarPrecioRapido(producto: { id: string; nombre: string }) {
    const val = parseFloat(precioRapido[producto.id] || '');
    if (!val || val <= 0) return;
    setGuardandoPrecio(producto.id);
    setResultadoUpdate(null);

    const result = await guardarPrecioYActualizarRias(producto.id, val, empresaId);

    setGuardandoPrecio(null);
    if (result.error) { alert('Error: ' + result.error); return; }

    setPrecioOkIds((prev) => new Set([...prev, producto.id]));
    if (result.riasActualizados > 0) {
      setResultadoUpdate({ rias: result.riasActualizados, cultivos: result.cultivosActualizados });
    }
    router.refresh();
  }

  // ── Informe filter ──────────────────────────────────────────────────────────
  const [categoriaFilter, setCategoriaFilter] = useState('');

  const stockFiltrado = useMemo(() =>
    categoriaFilter
      ? stockValuacion.filter((r: any) => r.categoria === categoriaFilter)
      : stockValuacion,
    [stockValuacion, categoriaFilter],
  );

  const totalValuacion = useMemo(() => ({
    ultima_compra: stockFiltrado.reduce((s: number, r: any) => s + (r.valor_ultima_compra ?? 0), 0),
    ppp:           stockFiltrado.reduce((s: number, r: any) => s + (r.valor_ppp ?? 0), 0),
    reposicion:    stockFiltrado.reduce((s: number, r: any) => s + (r.valor_reposicion ?? 0), 0),
  }), [stockFiltrado]);

  // ── Config CRUD ─────────────────────────────────────────────────────────────
  function resetConfigForm() {
    setAlcance('global'); setTipoProd(''); setProductoId('');
    setCritImp('ultima_compra'); setCritStock('ppp');
    setEditConfigId(null); setError('');
  }

  function handleEditConfig(c: any) {
    setEditConfigId(c.id);
    setAlcance(c.producto_id ? 'producto' : c.tipo_producto ? 'tipo' : 'global');
    setTipoProd(c.tipo_producto ?? '');
    setProductoId(c.producto_id ?? '');
    setCritImp(c.criterio_imputacion);
    setCritStock(c.criterio_stock);
    setShowConfigForm(true);
  }

  async function handleSaveConfig() {
    setLoading(true); setError('');
    const sb = createClient();
    const payload: any = {
      empresa_id:          empresaId,
      criterio_imputacion: critImp,
      criterio_stock:      critStock,
      producto_id:         alcance === 'producto' ? productoId : null,
      tipo_producto:       alcance === 'tipo'     ? tipoProd   : null,
    };
    if (editConfigId) {
      const { error: e } = await sb.from('config_valuacion').update(payload).eq('id', editConfigId);
      if (e) { setError(e.message); setLoading(false); return; }
      setConfigs((prev) => prev.map((c) => c.id === editConfigId ? { ...c, ...payload } : c));
    } else {
      const { data, error: e } = await sb.from('config_valuacion').insert(payload).select().single();
      if (e) { setError(e.message); setLoading(false); return; }
      setConfigs((prev) => [...prev, data]);
    }
    setLoading(false); resetConfigForm(); setShowConfigForm(false); router.refresh();
  }

  async function handleDeleteConfig(id: string) {
    if (!confirm('¿Eliminar esta configuración?')) return;
    await createClient().from('config_valuacion').delete().eq('id', id);
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Precio reposición CRUD ───────────────────────────────────────────────────
  function resetPrecioForm() {
    setPrecioProductoId(''); setPrecioArs(''); setPrecioDesde(today());
    setPrecioHasta(''); setPrecioObs(''); setEditPrecioId(null); setError('');
  }

  function handleEditPrecio(p: any) {
    setEditPrecioId(p.id);
    setPrecioProductoId(p.producto_id);
    setPrecioArs(String(p.precio_ars));
    setPrecioDesde(p.vigencia_desde);
    setPrecioHasta(p.vigencia_hasta ?? '');
    setPrecioObs(p.observaciones ?? '');
    setShowPrecioForm(true);
  }

  async function handleSavePrecio() {
    if (!precioProductoId || !precioArs || !precioDesde) {
      setError('Completá producto, precio y vigencia desde.'); return;
    }
    setLoading(true); setError('');
    const sb = createClient();
    const payload = {
      empresa_id:    empresaId,
      producto_id:   precioProductoId,
      precio_ars:    parseFloat(precioArs),
      vigencia_desde: precioDesde,
      vigencia_hasta: precioHasta || null,
      observaciones: precioObs.trim() || null,
    };
    if (editPrecioId) {
      const { error: e } = await sb.from('precios_reposicion').update(payload).eq('id', editPrecioId);
      if (e) { setError(e.message); setLoading(false); return; }
      setPrecios((prev) => prev.map((p) => p.id === editPrecioId ? { ...p, ...payload } : p));
    } else {
      const { data, error: e } = await sb.from('precios_reposicion').insert(payload).select(`
        *, producto:productos(id, nombre, unidad_base, categoria)
      `).single();
      if (e) { setError(e.message); setLoading(false); return; }
      setPrecios((prev) => [data as any, ...prev]);
    }
    setLoading(false); resetPrecioForm(); setShowPrecioForm(false); router.refresh();
  }

  async function handleDeletePrecio(id: string) {
    if (!confirm('¿Eliminar este precio de reposición?')) return;
    await createClient().from('precios_reposicion').delete().eq('id', id);
    setPrecios((prev) => prev.filter((p) => p.id !== id));
  }

  const criterioLabel = (v: string) => CRITERIOS.find((c) => c.value === v)?.label ?? v;

  const sinPrecioPendientes = productosSinPrecio.filter((p) => !precioOkIds.has(p.id));

  return (
    <div className="space-y-5">

      {/* ── Alerta: productos sin precio ─────────────────────────────────── */}
      {sinPrecioPendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">⚠️</span>
            <div>
              <p className="font-semibold text-amber-800">
                {sinPrecioPendientes.length} producto{sinPrecioPendientes.length !== 1 ? 's' : ''} en stock sin precio asignado
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Estos productos no tienen precio de compra, ni de RIA, ni de reposición.
                Ingresá un precio de referencia para que el sistema pueda valuar el stock correctamente.
              </p>
            </div>
          </div>

          {resultadoUpdate && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Se actualizaron <strong>{resultadoUpdate.rias}</strong> ítem{resultadoUpdate.rias !== 1 ? 's' : ''} de RIA
              {resultadoUpdate.cultivos > 0 && <> y el costo de <strong>{resultadoUpdate.cultivos}</strong> cultivo{resultadoUpdate.cultivos !== 1 ? 's' : ''}</>}.
            </div>
          )}

          <div className="space-y-2">
            {sinPrecioPendientes.map((prod) => (
              <div key={prod.id} className="bg-white rounded-xl border border-amber-200 px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">{prod.nombre}</p>
                  <p className="text-xs text-zinc-400">{prod.unidad_base} · {prod.categoria}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Precio ARS"
                      value={precioRapido[prod.id] ?? ''}
                      onChange={(e) => setPrecioRapido((prev) => ({ ...prev, [prod.id]: e.target.value }))}
                      className="pl-6 pr-3 py-1.5 w-36 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <button
                    onClick={() => handleGuardarPrecioRapido(prod)}
                    disabled={!precioRapido[prod.id] || guardandoPrecio === prod.id}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {guardandoPrecio === prod.id ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        <div className="flex border-b border-zinc-100">
          {[
            { id: 'criterios',  label: 'Criterios de valuación' },
            { id: 'reposicion', label: 'Precios de reposición' },
            { id: 'informe',    label: 'Informe comparativo de stock' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={cn(
                'px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-[#006836] text-[#006836]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800',
              )}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">

          {/* ── TAB: Criterios ───────────────────────────────────────────── */}
          {tab === 'criterios' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-zinc-600">
                    Configurá qué precio se aplica al <strong>imputar un insumo a un lote</strong> y cómo se <strong>valoriza el stock</strong> disponible. La jerarquía va de más específico a más general: producto &gt; tipo de insumo &gt; configuración global de empresa.
                  </p>
                </div>
                <button onClick={() => { resetConfigForm(); setShowConfigForm(!showConfigForm); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] hover:bg-[#005228] text-white text-xs font-semibold rounded-xl transition-colors shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                  Nueva regla
                </button>
              </div>

              {showConfigForm && (
                <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-4 space-y-4">
                  <p className="text-xs font-semibold text-zinc-600">
                    {editConfigId ? 'Editar regla' : 'Nueva regla de valuación'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={lbl}>Alcance *</label>
                      <select value={alcance} onChange={(e) => setAlcance(e.target.value as any)} className={inp}>
                        <option value="global">Global (toda la empresa)</option>
                        <option value="tipo">Por tipo de insumo</option>
                        <option value="producto">Por producto específico</option>
                      </select>
                    </div>
                    {alcance === 'tipo' && (
                      <div>
                        <label className={lbl}>Tipo de insumo *</label>
                        <select value={tipoProd} onChange={(e) => setTipoProd(e.target.value)} className={inp}>
                          <option value="">Seleccioná…</option>
                          {CATEGORIAS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {alcance === 'producto' && (
                      <div>
                        <label className={lbl}>Producto *</label>
                        <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className={inp}>
                          <option value="">Seleccioná…</option>
                          {productos.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Criterio de imputación al lote *</label>
                      <select value={critImp} onChange={(e) => setCritImp(e.target.value)} className={inp}>
                        {CRITERIOS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Criterio de valuación de stock *</label>
                      <select value={critStock} onChange={(e) => setCritStock(e.target.value)} className={inp}>
                        {CRITERIOS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}

                  <div className="flex gap-3">
                    <button onClick={handleSaveConfig} disabled={loading}
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
                      <Check className="w-4 h-4" />
                      {loading ? 'Guardando…' : editConfigId ? 'Actualizar' : 'Guardar'}
                    </button>
                    <button onClick={() => { resetConfigForm(); setShowConfigForm(false); }}
                      className="px-4 py-2 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {configs.length === 0 ? (
                <div className="rounded-xl border border-zinc-100 p-8 text-center text-sm text-zinc-400">
                  Sin reglas configuradas. Se usará <strong>Última compra</strong> como default para imputación.
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        {['Alcance', 'Imputación al lote', 'Valuación stock', ''].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {configs.map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-50">
                          <td className="px-3 py-2.5">
                            {c.producto_id
                              ? <><span className="text-zinc-400">Producto: </span><span className="font-medium text-zinc-800">{c.producto?.nombre ?? c.producto_id}</span></>
                              : c.tipo_producto
                              ? <><span className="text-zinc-400">Tipo: </span><span className="font-medium text-zinc-800">{c.tipo_producto}</span></>
                              : <span className="font-semibold text-[#006836]">Global (empresa)</span>
                            }
                          </td>
                          <td className="px-3 py-2.5 text-zinc-700">{criterioLabel(c.criterio_imputacion)}</td>
                          <td className="px-3 py-2.5 text-zinc-700">{criterioLabel(c.criterio_stock)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEditConfig(c)}
                                className="p-1 text-zinc-400 hover:text-[#006836]">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteConfig(c.id)}
                                className="p-1 text-zinc-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Precios de reposición ────────────────────────────────── */}
          {tab === 'reposicion' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-zinc-600">
                  Precio de mercado vigente de cada insumo. Se usa cuando el criterio de valuación es <strong>Valor de reposición</strong>.
                </p>
                <button onClick={() => { resetPrecioForm(); setShowPrecioForm(!showPrecioForm); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] hover:bg-[#005228] text-white text-xs font-semibold rounded-xl transition-colors shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                  Agregar precio
                </button>
              </div>

              {showPrecioForm && (
                <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={lbl}>Producto *</label>
                      <select value={precioProductoId} onChange={(e) => setPrecioProductoId(e.target.value)} className={inp}>
                        <option value="">Seleccioná…</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Precio de reposición $ *</label>
                      <input type="number" step="0.0001" min="0" value={precioArs}
                        onChange={(e) => setPrecioArs(e.target.value)} placeholder="$/unidad base" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Vigencia desde *</label>
                      <input type="date" value={precioDesde} onChange={(e) => setPrecioDesde(e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Vigencia hasta</label>
                      <input type="date" value={precioHasta} onChange={(e) => setPrecioHasta(e.target.value)} className={inp} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={lbl}>Observaciones (fuente del precio)</label>
                      <input type="text" value={precioObs} onChange={(e) => setPrecioObs(e.target.value)}
                        placeholder="ej: cotización proveedor 05/06/2026" className={inp} />
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <div className="flex gap-3">
                    <button onClick={handleSavePrecio} disabled={loading}
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50">
                      <Check className="w-4 h-4" />
                      {loading ? 'Guardando…' : editPrecioId ? 'Actualizar' : 'Guardar'}
                    </button>
                    <button onClick={() => { resetPrecioForm(); setShowPrecioForm(false); }}
                      className="px-4 py-2 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {precios.length === 0 ? (
                <div className="rounded-xl border border-zinc-100 p-8 text-center text-sm text-zinc-400">
                  Sin precios de reposición cargados.
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        {['Producto','Categoría','Precio $/unidad','Vigencia desde','Vigencia hasta','Fuente',''].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {precios.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-50">
                          <td className="px-3 py-2.5 font-medium text-zinc-800">{p.producto?.nombre ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded text-xs">{p.producto?.categoria ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-zinc-900">{$(p.precio_ars)} / {p.producto?.unidad_base}</td>
                          <td className="px-3 py-2.5 text-zinc-600">{fmtDate(p.vigencia_desde)}</td>
                          <td className="px-3 py-2.5 text-zinc-500">{p.vigencia_hasta ? fmtDate(p.vigencia_hasta) : '—'}</td>
                          <td className="px-3 py-2.5 text-zinc-400 max-w-xs truncate">{p.observaciones ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEditPrecio(p)} className="p-1 text-zinc-400 hover:text-[#006836]">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeletePrecio(p.id)} className="p-1 text-zinc-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Informe comparativo ──────────────────────────────────── */}
          {tab === 'informe' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-zinc-600">
                    Valuación del stock bajo los tres criterios simultáneamente. Permite comparar el impacto de cada método en el valor del inventario.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={categoriaFilter} onChange={(e) => setCategoriaFilter(e.target.value)}
                    className="text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                    <option value="">Todas las categorías</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ExportButtons
                    data={stockFiltrado.map((r: any) => ({
                      deposito:       r.deposito_nombre,
                      producto:       r.producto_nombre,
                      categoria:      r.categoria,
                      unidad:         r.unidad_base,
                      cantidad:       r.cantidad_actual,
                      p_ult_compra:   r.precio_ultima_compra,
                      p_ppp:          r.precio_ppp,
                      p_reposicion:   r.precio_reposicion,
                      v_ult_compra:   r.valor_ultima_compra,
                      v_ppp:          r.valor_ppp,
                      v_reposicion:   r.valor_reposicion,
                      criterio_conf:  r.criterio_configurado,
                    }))}
                    columns={[
                      { header: 'Depósito',          key: 'deposito',      width: 22 },
                      { header: 'Producto',           key: 'producto',      width: 28 },
                      { header: 'Categoría',          key: 'categoria',     width: 18 },
                      { header: 'Unidad',             key: 'unidad',        width: 10 },
                      { header: 'Cantidad',           key: 'cantidad',      width: 14, align: 'right', format: (v: any) => num.format(v) },
                      { header: 'P. Última compra',  key: 'p_ult_compra',  width: 18, align: 'right', format: (v: any) => $(v) },
                      { header: 'P. PPP',             key: 'p_ppp',         width: 18, align: 'right', format: (v: any) => $(v) },
                      { header: 'P. Reposición',     key: 'p_reposicion',  width: 18, align: 'right', format: (v: any) => $(v) },
                      { header: 'V. Última compra',  key: 'v_ult_compra',  width: 20, align: 'right', format: (v: any) => $(v) },
                      { header: 'V. PPP',             key: 'v_ppp',         width: 20, align: 'right', format: (v: any) => $(v) },
                      { header: 'V. Reposición',     key: 'v_reposicion',  width: 20, align: 'right', format: (v: any) => $(v) },
                      { header: 'Criterio config.',  key: 'criterio_conf', width: 18 },
                    ]}
                    filename="valuacion-stock"
                    title="Valuación comparativa de stock"
                  />
                </div>
              </div>

              {/* KPI resumen */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Última compra',       val: totalValuacion.ultima_compra, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { label: 'PPP / FIFO',          val: totalValuacion.ppp,           color: 'bg-[#006836]/5 border-[#006836]/20 text-[#006836]' },
                  { label: 'Valor de reposición', val: totalValuacion.reposicion,    color: 'bg-amber-50 border-amber-200 text-amber-700' },
                ].map(({ label, val, color }) => (
                  <div key={label} className={cn('rounded-xl border px-4 py-3', color)}>
                    <p className="text-xs font-medium opacity-70">{label}</p>
                    <p className="text-xl font-bold mt-0.5">{$(val)}</p>
                  </div>
                ))}
              </div>

              {stockFiltrado.length === 0 ? (
                <div className="rounded-xl border border-zinc-100 p-8 text-center text-sm text-zinc-400">
                  Sin stock vigente para los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-100">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-zinc-500">Depósito / Producto</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-zinc-500">Categoría</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-zinc-500">Cantidad</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-blue-600">P. Últ. compra</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[#006836]">P. PPP</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-amber-600">P. Reposición</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-blue-600">V. Últ. compra</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[#006836]">V. PPP</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-amber-600">V. Reposición</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-zinc-400">Criterio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 bg-white">
                      {stockFiltrado.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-zinc-50/60">
                          <td className="px-3 py-2">
                            <p className="font-medium text-zinc-800">{r.producto_nombre}</p>
                            <p className="text-zinc-400">{r.deposito_nombre}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded">{r.categoria}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-700">{num.format(r.cantidad_actual)} {r.unidad_base}</td>
                          <td className="px-3 py-2 text-right text-blue-700">{$(r.precio_ultima_compra)}</td>
                          <td className="px-3 py-2 text-right text-[#006836]">{$(r.precio_ppp)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">{$(r.precio_reposicion)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-blue-700">{$(r.valor_ultima_compra)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-[#006836]">{$(r.valor_ppp)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-amber-600">{$(r.valor_reposicion)}</td>
                          <td className="px-3 py-2 text-zinc-400">{r.criterio_configurado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
