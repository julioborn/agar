'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Filter, X, BarChart2, Upload, ChevronRight, Search, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import ExportButtons from '@/components/export-buttons';
import { CATEGORIAS } from '../productos/constants';
import { useCurrency } from '@/lib/currency-context';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));
const CATEGORIA_BADGE: Record<string, string> = {
  fertilizante:   'bg-blue-100 text-blue-700',
  semilla:        'bg-[#006836]/10 text-[#006836]',
  agroquimico:    'bg-orange-100 text-orange-700',
  combustible:    'bg-red-100 text-red-700',
  insumo_cosecha: 'bg-purple-100 text-purple-700',
  inoculante:     'bg-teal-100 text-teal-700',
  otro:           'bg-zinc-100 text-zinc-500',
};

interface StockRow {
  id: string; cantidad_actual: number;
  producto_id: string; producto_nombre: string; producto_categoria: string;
  producto_unidad_base: string; producto_stock_minimo: number;
  deposito_id: string; deposito_nombre: string;
  precio_ultimo: number | null;
  precio_usd_mercado: number | null;
  precio_fuente: 'compra' | 'ria' | 'produccion' | null;
}

interface Props { stockRows: StockRow[]; empresaNombre: string; hasta: string | null }

const numFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const num = (n: number, unit: string) => `${numFmt.format(n)} ${unit}`;
const hoyStr = () => new Date().toISOString().slice(0, 10);

export default function StockManager({ stockRows, empresaNombre, hasta }: Props) {
  const router = useRouter();
  const { formatMoney, usdRate } = useCurrency();
  const [vista, setVista]               = useState<'insumos' | 'produccion'>('insumos');
  const [searchText, setSearchText]     = useState('');
  const [depositoId, setDepositoId]     = useState('');
  const [categoria, setCategoria]       = useState('');
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [showFilters, setShowFilters]   = useState(false);

  const stockRowsVista = useMemo(() =>
    stockRows.filter((r) => vista === 'produccion'
      ? r.producto_categoria === 'produccion'
      : r.producto_categoria !== 'produccion'),
    [stockRows, vista]
  );

  const categoriasVista = useMemo(() =>
    CATEGORIAS.filter((c) => vista === 'produccion' ? c.value === 'produccion' : c.value !== 'produccion'),
    [vista]
  );

  const depositos = useMemo(() =>
    Array.from(new Map(stockRowsVista.map((r) => [r.deposito_id, r.deposito_nombre])).entries())
      .map(([id, nombre]) => ({ id, nombre })),
    [stockRowsVista]
  );

  const filtradas = useMemo(() => stockRowsVista.filter((r) => {
    if (searchText && !r.producto_nombre.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (depositoId && r.deposito_id !== depositoId) return false;
    if (categoria && r.producto_categoria !== categoria) return false;
    if (soloBajoMinimo && !(r.cantidad_actual <= r.producto_stock_minimo && r.producto_stock_minimo > 0)) return false;
    return true;
  }), [stockRowsVista, searchText, depositoId, categoria, soloBajoMinimo]);

  const deposiGroups = useMemo(() => {
    const map = new Map<string, { nombre: string; filas: StockRow[] }>();
    for (const r of filtradas) {
      if (!map.has(r.deposito_id)) map.set(r.deposito_id, { nombre: r.deposito_nombre, filas: [] });
      map.get(r.deposito_id)!.filas.push(r);
    }
    return Array.from(map.values());
  }, [filtradas]);

  const filtrosActivos = [searchText, depositoId, categoria, soloBajoMinimo ? 'bajo' : ''].filter(Boolean).length;
  const bajoMinimo = filtradas.filter((r) => r.cantidad_actual <= r.producto_stock_minimo && r.producto_stock_minimo > 0).length;

  const precioArs = (r: StockRow): number | null => {
    if (r.precio_fuente === 'produccion' && r.precio_usd_mercado != null && usdRate) {
      return r.precio_usd_mercado * usdRate;
    }
    return r.precio_ultimo;
  };

  const exportData = filtradas.map((r) => ({
    ...r,
    _precio_mostrado: precioArs(r),
    _estado: r.cantidad_actual <= r.producto_stock_minimo && r.producto_stock_minimo > 0 ? 'Bajo mínimo' : 'OK',
  }));
  const exportColumns = [
    { header: 'Depósito', key: 'deposito_nombre', width: 20 },
    { header: 'Producto', key: 'producto_nombre', width: 28 },
    { header: 'Categoría', key: 'producto_categoria', width: 18, format: (v: string) => CATEGORIA_LABEL[v] ?? v },
    { header: 'Stock actual', key: 'cantidad_actual', width: 14, format: (v: number) => numFmt.format(v), total: true },
    { header: 'Unidad', key: 'producto_unidad_base', width: 10 },
    { header: 'Precio unit.', key: '_precio_mostrado', width: 22, format: (v: number | null) => v != null ? formatMoney(v) : '' },
    { header: 'Stock mínimo', key: 'producto_stock_minimo', width: 14, format: (v: number) => v > 0 ? numFmt.format(v) : '' },
    { header: 'Estado', key: '_estado', width: 14 },
  ];

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Insumos / Producción */}
        <div className="flex rounded-2xl border border-zinc-100 bg-white p-1 shadow-sm w-fit">
          {(['insumos', 'produccion'] as const).map((v) => (
            <button key={v} type="button"
              onClick={() => { setVista(v); setCategoria(''); }}
              className={cn('px-5 py-2 text-sm font-semibold rounded-xl transition-colors',
                vista === v ? 'bg-[#006836] text-white' : 'text-zinc-500 hover:bg-zinc-50')}>
              {v === 'insumos' ? 'Stock de Insumos' : 'Stock de Producción'}
            </button>
          ))}
        </div>

        {/* Filtro de fecha: stock acumulado hasta la fecha elegida */}
        <div className="flex items-center gap-2 bg-white rounded-2xl border border-zinc-100 px-3 py-2 shadow-sm">
          <CalendarClock className="w-4 h-4 text-zinc-400 shrink-0" />
          <label className="text-xs text-zinc-500 font-medium whitespace-nowrap">Ver stock al</label>
          <input
            type="date"
            value={hasta ?? ''}
            max={hoyStr()}
            onChange={(e) => router.push(e.target.value ? `/app/stock?hasta=${e.target.value}` : '/app/stock')}
            className="text-sm border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
          />
          {hasta && (
            <button
              onClick={() => router.push('/app/stock')}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3 h-3" /> Ver actual
            </button>
          )}
        </div>
      </div>

      {hasta && (
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 w-fit">
          <CalendarClock className="w-3.5 h-3.5" />
          Mostrando stock acumulado desde el inicio hasta el {new Date(`${hasta}T00:00:00`).toLocaleDateString('es-AR')} (no el stock actual)
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{filtradas.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Productos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{deposiGroups.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Depósitos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', bajoMinimo > 0 ? 'bg-red-400' : 'bg-zinc-300')} />
          <div>
            <p className={cn('text-xl font-bold leading-none', bajoMinimo > 0 ? 'text-red-600' : 'text-zinc-900')}>{bajoMinimo}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Bajo mínimo</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        {/* Buscador siempre visible */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
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
              <button onClick={() => { setSearchText(''); setDepositoId(''); setCategoria(''); setSoloBajoMinimo(false); }}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
            <Link
              href="/app/stock/importar"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-[#006836]/30 text-[#006836] bg-[#006836]/5 hover:bg-[#006836]/10 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Cargar desde archivo
            </Link>
            <ExportButtons data={exportData} columns={exportColumns}
              filename={`stock-${empresaNombre.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`}
              title={`Stock · ${empresaNombre}`} />
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-100">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Depósito</label>
              <select value={depositoId} onChange={(e) => setDepositoId(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                <option value="">Todos</option>
                {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            {vista === 'insumos' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Categoría</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                  className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                  <option value="">Todas</option>
                  {categoriasVista.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={soloBajoMinimo} onChange={(e) => setSoloBajoMinimo(e.target.checked)}
                  className="w-4 h-4 accent-[#006836] rounded" />
                <span className="text-sm text-zinc-600">Solo bajo mínimo</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Tablas por depósito */}
      {deposiGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <BarChart2 className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">
            {stockRowsVista.length === 0
              ? (vista === 'produccion'
                ? 'Confirmá un RIA con producción para ver stock acá.'
                : 'Registrá una compra para ver el stock.')
              : 'Sin resultados con los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {deposiGroups.map(({ nombre: depNombre, filas }) => (
            <div key={depNombre} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#006836]" />
                <h2 className="font-semibold text-zinc-700">{depNombre}</h2>
                <span className="text-xs text-zinc-400">· {filas.length} producto{filas.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Producto</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Categoría</th>
                      <th className="text-right px-4 py-2.5 font-medium text-zinc-500">Stock actual</th>
                      <th className="text-right px-4 py-2.5 font-medium text-zinc-500">Precio unit.</th>
                      <th className="text-right px-4 py-2.5 font-medium text-zinc-500">Mínimo</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {filas.map((row) => {
                      const bajo = row.cantidad_actual <= row.producto_stock_minimo && row.producto_stock_minimo > 0;
                      const precioMostrado = precioArs(row);
                      return (
                        <tr key={row.id} className={cn('transition-colors cursor-pointer', bajo ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-[#006836]/5')}>
                          <td className="px-4 py-3">
                            <Link href={`/app/stock/${row.producto_id}`} className="flex items-center gap-1 font-medium text-zinc-800 hover:text-[#006836] transition-colors">
                              {row.producto_nombre}
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                              CATEGORIA_BADGE[row.producto_categoria] ?? 'bg-zinc-100 text-zinc-500')}>
                              {CATEGORIA_LABEL[row.producto_categoria] ?? row.producto_categoria}
                            </span>
                          </td>
                          <td className={cn('px-4 py-3 text-right font-semibold', bajo ? 'text-red-600' : 'text-zinc-800')}>
                            {num(row.cantidad_actual, row.producto_unidad_base)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {precioMostrado != null ? (
                              <span className={cn(
                                row.precio_fuente === 'ria' && 'text-indigo-600',
                                row.precio_fuente === 'produccion' && 'text-amber-600',
                                row.precio_fuente === 'compra' && 'text-zinc-500',
                              )}>
                                {formatMoney(precioMostrado)}
                                {row.precio_fuente === 'ria' && (
                                  <span className="ml-1 text-xs text-indigo-400">RIA</span>
                                )}
                                {row.precio_fuente === 'produccion' && (
                                  <span className="ml-1 text-xs text-amber-500">Mercado</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-red-400 font-medium">Sin precio</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400">
                            {row.producto_stock_minimo > 0 ? num(row.producto_stock_minimo, row.producto_unidad_base) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {bajo
                              ? <span className="text-xs font-medium text-red-600">⚠ Bajo mínimo</span>
                              : <span className="text-xs font-medium text-[#006836]">OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
