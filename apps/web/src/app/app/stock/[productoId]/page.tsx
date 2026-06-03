import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import Link from 'next/link';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, RotateCcw, Minus, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIAS } from '../../productos/constants';

interface Props { params: Promise<{ productoId: string }> }

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));

const TIPO_META: Record<string, { label: string; color: string; signo: '+' | '-' | '~'; icon: 'up' | 'down' | 'rev' | 'adj' }> = {
  entrada_compra:         { label: 'Compra',          color: 'text-[#006836]',  signo: '+', icon: 'up' },
  entrada_devolucion:     { label: 'Devolución',       color: 'text-[#006836]',  signo: '+', icon: 'rev' },
  transferencia_entrada:  { label: 'Transferencia ↓',  color: 'text-blue-600',   signo: '+', icon: 'up' },
  entrada_produccion_ria: { label: 'Cosecha (RIA)',    color: 'text-teal-600',   signo: '+', icon: 'up' },
  salida_aplicacion:      { label: 'Aplicación',       color: 'text-orange-600', signo: '-', icon: 'down' },
  salida_ria:             { label: 'Remito (RIA)',     color: 'text-orange-600', signo: '-', icon: 'down' },
  transferencia_salida:   { label: 'Transferencia ↑',  color: 'text-blue-600',   signo: '-', icon: 'down' },
  merma:                  { label: 'Merma / pérdida',  color: 'text-red-600',    signo: '-', icon: 'down' },
  ajuste:                 { label: 'Ajuste',           color: 'text-zinc-500',   signo: '~', icon: 'adj' },
};

const numFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const monFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmtFecha = (ts: string) =>
  new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = (ts: string) =>
  new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default async function StockProductoPage({ params }: Props) {
  const { productoId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  // ── Producto ──────────────────────────────────────────────────────────────
  const { data: producto } = await supabase
    .from('productos')
    .select('id, nombre, categoria, unidad_base, stock_minimo, principio_activo')
    .eq('id', productoId)
    .eq('empresa_id', empresa.id)
    .maybeSingle();

  if (!producto) notFound();

  // ── Stock por depósito ───────────────────────────────────────────────────
  const { data: stockRows } = await supabase
    .from('stock')
    .select('cantidad_actual, deposito:depositos(id, nombre, tipo)')
    .eq('producto_id', productoId)
    .gt('cantidad_actual', 0)
    .order('cantidad_actual', { ascending: false });

  const stockTotal = (stockRows ?? []).reduce((s, r) => s + Number(r.cantidad_actual), 0);

  // ── Movimientos ──────────────────────────────────────────────────────────
  const { data: movimientos } = await supabase
    .from('movimientos_stock')
    .select(`
      id, tipo, cantidad, fecha, created_at,
      observaciones, referencia_tipo, referencia_id,
      deposito:depositos(nombre)
    `)
    .eq('producto_id', productoId)
    .order('created_at', { ascending: false })
    .limit(200);

  // ── Enriquecer con referencias ───────────────────────────────────────────
  const compraIds   = (movimientos ?? []).filter(m => m.referencia_tipo === 'compra'         && m.referencia_id).map(m => m.referencia_id!);
  const riaIds      = (movimientos ?? []).filter(m => m.referencia_tipo === 'remito_interno' && m.referencia_id).map(m => m.referencia_id!);
  const aplIds      = (movimientos ?? []).filter(m => m.referencia_tipo === 'aplicacion'     && m.referencia_id).map(m => m.referencia_id!);
  const anulIds     = (movimientos ?? []).filter(m => m.referencia_tipo === 'anulacion_ria'  && m.referencia_id).map(m => m.referencia_id!);

  const [comprasMap, riasMap, aplMap] = await Promise.all([
    // Compras: factura + proveedor
    compraIds.length > 0
      ? supabase
          .from('compras')
          .select('id, numero_factura, fecha, proveedor:proveedores(nombre)')
          .in('id', [...new Set(compraIds)])
          .then(({ data }) =>
            Object.fromEntries((data ?? []).map(c => [c.id, c])),
          )
      : Promise.resolve({} as Record<string, any>),

    // RIAs: numero + lote
    riaIds.length > 0 || anulIds.length > 0
      ? supabase
          .from('remitos_internos')
          .select('id, numero_ria, fecha, lote:lotes(nombre, campo:campos(nombre))')
          .in('id', [...new Set([...riaIds, ...anulIds])])
          .then(({ data }) =>
            Object.fromEntries((data ?? []).map(r => [r.id, r])),
          )
      : Promise.resolve({} as Record<string, any>),

    // Aplicaciones: tipo + cultivo/lote
    aplIds.length > 0
      ? supabase
          .from('aplicaciones')
          .select('id, tipo, fecha, cultivo:cultivos(cultivo, lote:lotes(nombre, campo:campos(nombre)))')
          .in('id', [...new Set(aplIds)])
          .then(({ data }) =>
            Object.fromEntries((data ?? []).map(a => [a.id, a])),
          )
      : Promise.resolve({} as Record<string, any>),
  ]);

  // Saldo acumulado (de más reciente a más antiguo → calculamos de fin hacia atrás)
  let saldoAcum = stockTotal;
  const movimientosConSaldo = (movimientos ?? []).map((m) => {
    const meta = TIPO_META[m.tipo] ?? { label: m.tipo, color: 'text-zinc-500', signo: '~' as const, icon: 'adj' as const };
    const esEntrada = meta.signo === '+';
    const esSalida  = meta.signo === '-';
    const saldoAntes = esSalida ? saldoAcum + Number(m.cantidad) : esEntrada ? saldoAcum - Number(m.cantidad) : saldoAcum;
    saldoAcum = saldoAntes;
    return { ...m, meta, saldoAntes };
  });

  const bajo = stockTotal <= producto.stock_minimo && producto.stock_minimo > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/app/stock"
          className="mt-1 p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-zinc-900">{producto.nombre}</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
              {CATEGORIA_LABEL[producto.categoria] ?? producto.categoria}
            </span>
          </div>
          {producto.principio_activo && (
            <p className="text-sm text-zinc-400 mt-0.5">{producto.principio_activo}</p>
          )}
        </div>
      </div>

      {/* Stock por depósito */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-700">Stock actual</h2>
          <div className={cn('text-lg font-bold', bajo ? 'text-red-600' : 'text-zinc-900')}>
            {numFmt.format(stockTotal)} {producto.unidad_base}
            {bajo && <span className="ml-2 text-xs font-medium text-red-500">⚠ Bajo mínimo</span>}
          </div>
        </div>

        {(!stockRows || stockRows.length === 0) ? (
          <p className="text-sm text-zinc-400 text-center py-4">Sin stock disponible.</p>
        ) : (
          <div className="space-y-2">
            {(stockRows as any[]).map((s) => (
              <div key={s.deposito?.id} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-700">{s.deposito?.nombre ?? '—'}</span>
                  <span className="text-xs text-zinc-400">{s.deposito?.tipo === 'central' ? 'Central' : 'Galpón'}</span>
                </div>
                <span className="text-sm font-semibold text-zinc-900">
                  {numFmt.format(s.cantidad_actual)} {producto.unidad_base}
                </span>
              </div>
            ))}
          </div>
        )}

        {producto.stock_minimo > 0 && (
          <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-50">
            Mínimo configurado: {numFmt.format(producto.stock_minimo)} {producto.unidad_base}
          </p>
        )}
      </div>

      {/* Historial de movimientos */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">Historial de movimientos</h2>
          <span className="text-xs text-zinc-400">{movimientosConSaldo.length} registros</span>
        </div>

        {movimientosConSaldo.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-zinc-400">Sin movimientos registrados.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {movimientosConSaldo.map((mov) => {
              const compra = mov.referencia_tipo === 'compra'         ? comprasMap[mov.referencia_id!] : null;
              const ria    = (mov.referencia_tipo === 'remito_interno' || mov.referencia_tipo === 'anulacion_ria')
                              ? riasMap[mov.referencia_id!] : null;
              const apl    = mov.referencia_tipo === 'aplicacion'     ? aplMap[mov.referencia_id!]    : null;

              const esEntrada = mov.meta.signo === '+';
              const esSalida  = mov.meta.signo === '-';

              return (
                <div key={mov.id} className="px-5 py-4 flex items-start gap-4 hover:bg-zinc-50/60 transition-colors">

                  {/* Ícono */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    esEntrada ? 'bg-[#006836]/10' : esSalida ? 'bg-orange-50' : 'bg-zinc-100',
                  )}>
                    {esEntrada
                      ? <ArrowUpCircle className="w-4 h-4 text-[#006836]" />
                      : esSalida
                        ? <ArrowDownCircle className="w-4 h-4 text-orange-500" />
                        : <Minus className="w-4 h-4 text-zinc-400" />}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {/* Tipo + referencia */}
                        <p className="text-sm font-semibold text-zinc-800">{mov.meta.label}</p>

                        {/* Detalle de la referencia */}
                        {compra && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Factura{compra.numero_factura ? ` ${compra.numero_factura}` : ''}
                            {compra.proveedor?.nombre ? ` · ${compra.proveedor.nombre}` : ''}
                            {compra.fecha ? ` · ${fmtFecha(compra.fecha)}` : ''}
                          </p>
                        )}
                        {ria && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {ria.numero_ria}
                            {ria.lote?.campo?.nombre ? ` · ${ria.lote.campo.nombre}` : ''}
                            {ria.lote?.nombre ? ` › ${ria.lote.nombre}` : ''}
                          </p>
                        )}
                        {apl && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {apl.tipo ? apl.tipo.charAt(0).toUpperCase() + apl.tipo.slice(1) : ''}
                            {apl.cultivo?.cultivo ? ` · ${apl.cultivo.cultivo}` : ''}
                            {apl.cultivo?.lote?.nombre ? ` › ${apl.cultivo.lote.nombre}` : ''}
                            {apl.cultivo?.lote?.campo?.nombre ? ` (${apl.cultivo.lote.campo.nombre})` : ''}
                          </p>
                        )}
                        {mov.observaciones && !compra && !ria && !apl && (
                          <p className="text-xs text-zinc-400 mt-0.5 italic">{mov.observaciones}</p>
                        )}

                        {/* Depósito + fecha */}
                        <p className="text-xs text-zinc-400 mt-1">
                          {(mov.deposito as any)?.nombre ?? '—'} · {fmtFecha(mov.created_at)} {fmtHora(mov.created_at)}
                        </p>
                      </div>

                      {/* Cantidad + saldo */}
                      <div className="text-right shrink-0">
                        <p className={cn('text-sm font-bold', mov.meta.color)}>
                          {mov.meta.signo !== '~' ? mov.meta.signo : ''}{numFmt.format(mov.cantidad)} {producto.unidad_base}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Saldo: {numFmt.format(mov.saldoAntes)} {producto.unidad_base}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
