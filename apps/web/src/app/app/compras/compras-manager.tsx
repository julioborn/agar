'use client';

import { useState, useMemo } from 'react';
import { Filter, X, ChevronDown, ChevronUp, ShoppingCart, Calendar, Truck, FileText, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import ExportButtons from '@/components/export-buttons';
import { useCurrency } from '@/lib/currency-context';

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'bg-[#006836]/10 text-[#006836]',
  borrador:   'bg-amber-100 text-amber-700',
};
const ESTADO_LABEL: Record<string, string> = {
  confirmada: 'Confirmada',
  borrador:   'Borrador',
};

interface Compra {
  id: string; fecha: string; numero_factura: string | null;
  moneda: string; cotizacion_usd: number | null;
  total_moneda_original: number | null; total_en_ars: number | null;
  estado: string; proveedor_nombre: string;
}
interface CompraItem {
  id: string;
  cantidad_presentacion: number | null;
  cantidad_unidad_base: number;
  precio_unitario_moneda_original: number;
  precio_unitario_ars: number;
  subtotal_ars: number;
  subtotal_moneda_original: number;
  producto: { nombre: string; unidad_base: string } | null;
  presentacion: { descripcion: string } | null;
  deposito_destino: { nombre: string } | null;
}

interface Props { compras: Compra[]; proveedores: { id: string; nombre: string }[]; empresaNombre: string }

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const num4 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtLong = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function ComprasManager({ compras, proveedores, empresaNombre }: Props) {
  const { formatMoney, currency } = useCurrency();
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [estado, setEstado] = useState('');
  const [moneda, setMoneda]  = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, CompraItem[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtradas = useMemo(() => compras.filter((c) => {
    if (fechaDesde && c.fecha < fechaDesde) return false;
    if (fechaHasta && c.fecha > fechaHasta) return false;
    if (proveedorId && !c.proveedor_nombre.includes(proveedores.find(p => p.id === proveedorId)?.nombre ?? '')) return false;
    if (estado && c.estado !== estado) return false;
    if (moneda && c.moneda !== moneda) return false;
    return true;
  }), [compras, fechaDesde, fechaHasta, proveedorId, estado, moneda, proveedores]);

  const totalArs = filtradas.reduce((acc, c) => acc + Number(c.total_en_ars ?? 0), 0);
  const confirmadas = filtradas.filter((c) => c.estado === 'confirmada').length;
  const filtrosActivos = [fechaDesde, fechaHasta, proveedorId, estado, moneda].filter(Boolean).length;

  async function handleToggle(compra: Compra) {
    if (expandedId === compra.id) { setExpandedId(null); return; }
    setExpandedId(compra.id);
    if (itemsCache[compra.id]) return;
    setLoadingId(compra.id);
    const { data } = await createClient()
      .from('compras_items')
      .select(`
        id, cantidad_presentacion, cantidad_unidad_base,
        precio_unitario_moneda_original, precio_unitario_ars,
        subtotal_moneda_original, subtotal_ars,
        producto:productos(nombre, unidad_base),
        presentacion:presentaciones(descripcion),
        deposito_destino:depositos!deposito_destino_id(nombre)
      `)
      .eq('compra_id', compra.id);
    setItemsCache((prev) => ({ ...prev, [compra.id]: (data as any) ?? [] }));
    setLoadingId(null);
  }

  const exportColumns = [
    { header: 'Fecha',          key: 'fecha',                  width: 12, format: (v: string) => fmt(v) },
    { header: 'N° Factura',     key: 'numero_factura',         width: 18, format: (v: any) => v ?? '' },
    { header: 'Proveedor',      key: 'proveedor_nombre',       width: 30 },
    { header: 'Moneda original',key: 'moneda',                 width: 14 },
    { header: 'Total original', key: 'total_moneda_original',  width: 16, format: (v: any) => v != null ? num.format(v) : '' },
    { header: 'Cotiz. USD',     key: 'cotizacion_usd',         width: 12, format: (v: any) => v != null ? num.format(v) : '' },
    { header: `Total (${currency})`, key: 'total_en_ars',      width: 20, format: (v: any) => v != null ? formatMoney(v) : '' },
    { header: 'Estado',         key: 'estado',                 width: 14, format: (v: string) => ESTADO_LABEL[v] ?? v },
  ];

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{filtradas.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Compras</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{totalArs > 0 ? formatMoney(totalArs) : '—'}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Total {currency}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{confirmadas}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Confirmadas</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors',
              showFilters || filtrosActivos > 0
                ? 'border-[#006836]/40 text-[#006836] bg-[#006836]/5'
                : 'border-zinc-200 text-zinc-500 bg-white hover:bg-zinc-50')}>
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {filtrosActivos > 0 && (
              <span className="w-4 h-4 bg-[#006836] text-white rounded-full text-xs leading-none flex items-center justify-center">{filtrosActivos}</span>
            )}
          </button>
          <div className="flex items-center gap-3">
            {filtrosActivos > 0 && (
              <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setProveedorId(''); setEstado(''); setMoneda(''); }}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
            <ExportButtons data={filtradas} columns={exportColumns}
              filename={`compras-${empresaNombre.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`}
              title={`Compras · ${empresaNombre}`} />
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-zinc-100">
            {[
              { label: 'Desde', el: <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" /> },
              { label: 'Hasta', el: <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" /> },
              { label: 'Proveedor', el: <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"><option value="">Todos</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select> },
              { label: 'Estado', el: <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"><option value="">Todos</option><option value="confirmada">Confirmada</option><option value="borrador">Borrador</option></select> },
              { label: 'Moneda', el: <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"><option value="">Todas</option><option value="ARS">ARS</option><option value="USD">USD</option></select> },
            ].map(({ label, el }) => (
              <div key={label}><label className="block text-xs text-zinc-400 mb-1.5">{label}</label>{el}</div>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        {filtradas.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShoppingCart className="w-10 h-10 text-zinc-200 mx-auto" />
            <p className="text-zinc-400 text-sm">
              {compras.length === 0 ? 'No hay compras registradas todavía.' : 'Sin resultados con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtradas.map((c) => {
              const isOpen = expandedId === c.id;
              const isLoading = loadingId === c.id;
              const items = itemsCache[c.id] ?? [];

              return (
                <div key={c.id}>
                  {/* Fila principal */}
                  <button
                    type="button"
                    onClick={() => handleToggle(c)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors',
                      isOpen ? 'bg-[#006836]/5' : 'hover:bg-zinc-50'
                    )}
                  >
                    {/* Fecha + factura */}
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-semibold text-zinc-800">{fmt(c.fecha)}</p>
                      {c.numero_factura && (
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">{c.numero_factura}</p>
                      )}
                    </div>

                    {/* Proveedor */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-700 truncate">{c.proveedor_nombre || <span className="text-zinc-300">Sin proveedor</span>}</p>
                    </div>

                    {/* Moneda */}
                    <div className="w-20 shrink-0 text-right">
                      <p className="text-xs font-medium text-zinc-500">{c.moneda}</p>
                      {c.moneda === 'USD' && c.cotizacion_usd && (
                        <p className="text-xs text-zinc-400">@ {num.format(c.cotizacion_usd)}</p>
                      )}
                    </div>

                    {/* Total */}
                    <div className="w-32 shrink-0 text-right">
                      <p className="text-sm font-bold text-zinc-900">
                        {c.total_en_ars != null ? formatMoney(c.total_en_ars) : '—'}
                      </p>
                      {c.moneda !== 'ARS' && c.total_moneda_original != null && (
                        <p className="text-xs text-zinc-400">{num.format(c.total_moneda_original)} {c.moneda}</p>
                      )}
                    </div>

                    {/* Estado */}
                    <div className="w-24 shrink-0">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        ESTADO_BADGE[c.estado] ?? 'bg-zinc-100 text-zinc-500')}>
                        {ESTADO_LABEL[c.estado] ?? c.estado}
                      </span>
                    </div>

                    {/* Chevron */}
                    <div className="w-5 shrink-0 text-zinc-400">
                      {isOpen
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Panel expandido */}
                  {isOpen && (
                    <div className="border-t border-[#006836]/10 bg-[#006836]/[0.02] px-4 py-4 space-y-4">

                      {/* Cabecera info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex items-start gap-2">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-zinc-400">Fecha</p>
                            <p className="text-sm font-medium text-zinc-800">{fmtLong(c.fecha)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Truck className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-zinc-400">Proveedor</p>
                            <p className="text-sm font-medium text-zinc-800">{c.proveedor_nombre || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-zinc-400">Moneda</p>
                            <p className="text-sm font-medium text-zinc-800">
                              {c.moneda}
                              {c.moneda === 'USD' && c.cotizacion_usd && (
                                <span className="text-zinc-400 font-normal ml-1">@ {num.format(c.cotizacion_usd)}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-zinc-400">N° Factura</p>
                            <p className="text-sm font-medium text-zinc-800 font-mono">{c.numero_factura ?? '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Ítems */}
                      {isLoading ? (
                        <div className="text-xs text-zinc-400 py-4 text-center">Cargando ítems...</div>
                      ) : items.length === 0 ? (
                        <div className="text-xs text-zinc-400 py-4 text-center">Sin ítems registrados.</div>
                      ) : (
                        <div className="rounded-xl border border-zinc-100 overflow-hidden bg-white">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[560px]">
                              <thead className="bg-zinc-50 border-b border-zinc-100">
                                <tr>
                                  <th className="text-left px-3 py-2.5 font-medium text-zinc-500">Producto</th>
                                  <th className="text-left px-3 py-2.5 font-medium text-zinc-500">Presentación</th>
                                  <th className="text-right px-3 py-2.5 font-medium text-zinc-500">Cantidad</th>
                                  <th className="text-right px-3 py-2.5 font-medium text-zinc-500">Precio unit.</th>
                                  <th className="text-left px-3 py-2.5 font-medium text-zinc-500">Depósito</th>
                                  <th className="text-right px-3 py-2.5 font-medium text-zinc-500">Subtotal ARS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {items.map((item) => (
                                  <tr key={item.id} className="hover:bg-zinc-50">
                                    <td className="px-3 py-2.5 font-medium text-zinc-800">{item.producto?.nombre}</td>
                                    <td className="px-3 py-2.5 text-zinc-500">{item.presentacion?.descripcion ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-right text-zinc-700">
                                      {num4.format(item.cantidad_unidad_base)} {item.producto?.unidad_base}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-zinc-700">
                                      {num4.format(item.precio_unitario_moneda_original)} {c.moneda}
                                    </td>
                                    <td className="px-3 py-2.5 text-zinc-500">{(item.deposito_destino as any)?.nombre ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-right font-semibold text-zinc-800">{formatMoney(item.subtotal_ars)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Totales */}
                          <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-5 text-xs">
                            {c.moneda === 'USD' && c.total_moneda_original != null && (
                              <span className="text-zinc-500">
                                Total USD: <strong className="text-zinc-700">{num.format(c.total_moneda_original)}</strong>
                              </span>
                            )}
                            <span className="text-zinc-600">
                              Total {currency}: <strong className="text-sm text-zinc-900">{c.total_en_ars != null ? formatMoney(c.total_en_ars) : '—'}</strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
