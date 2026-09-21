import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import Link from 'next/link';
import { ArrowLeft, Package, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIAS } from '../../productos/constants';
import HistorialExportButton from './historial-export-button';

interface Props { params: Promise<{ productoId: string }> }

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));

const TIPO_META: Record<string, {
  label: string; color: string; signo: '+' | '-' | '~'; esEntrada: boolean
}> = {
  entrada_compra:         { label: 'Compra',         color: 'text-[#006836]',  signo: '+', esEntrada: true  },
  entrada_devolucion:     { label: 'Devolución',      color: 'text-[#006836]',  signo: '+', esEntrada: true  },
  transferencia_entrada:  { label: 'Transferencia ↓', color: 'text-blue-600',   signo: '+', esEntrada: true  },
  entrada_produccion_ria: { label: 'Cosecha (RIA)',   color: 'text-teal-600',   signo: '+', esEntrada: true  },
  salida_aplicacion:      { label: 'Aplicación',      color: 'text-orange-600', signo: '-', esEntrada: false },
  salida_ria:             { label: 'Remito (RIA)',    color: 'text-orange-600', signo: '-', esEntrada: false },
  transferencia_salida:   { label: 'Transferencia ↑', color: 'text-blue-600',   signo: '-', esEntrada: false },
  merma:                  { label: 'Merma / pérdida', color: 'text-red-600',    signo: '-', esEntrada: false },
  salida_consumo_ganadero:{ label: 'Consumo ganadero (RIG)', color: 'text-orange-600', signo: '-', esEntrada: false },
  ajuste:                 { label: 'Ajuste',          color: 'text-zinc-500',   signo: '~', esEntrada: true  },
};

const nFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const TZ = 'America/Argentina/Buenos_Aires';
const fmtFecha = (s: string) =>
  new Date(s).toLocaleDateString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = (s: string) =>
  new Date(s).toLocaleTimeString('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

export default async function StockProductoPage({ params }: Props) {
  const { productoId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  // ── Producto ─────────────────────────────────────────────────────────────
  const { data: producto } = await supabase
    .from('productos')
    .select('id, nombre, categoria, unidad_base, stock_minimo, principio_activo')
    .eq('id', productoId)
    .eq('empresa_id', empresa.id)
    .maybeSingle();

  if (!producto) notFound();

  // ── Stock por depósito ────────────────────────────────────────────────────
  const { data: stockRows } = await supabase
    .from('stock')
    .select('cantidad_actual, deposito:depositos(id, nombre, tipo)')
    .eq('producto_id', productoId)
    .gt('cantidad_actual', 0)
    .order('cantidad_actual', { ascending: false });

  const stockTotal = (stockRows ?? []).reduce((s: number, r: any) => s + Number(r.cantidad_actual), 0);

  // ── Movimientos ───────────────────────────────────────────────────────────
  const { data: movimientos } = await supabase
    .from('movimientos_stock')
    .select('id, tipo, cantidad, fecha, created_at, observaciones, referencia_tipo, referencia_id, deposito:depositos(nombre)')
    .eq('producto_id', productoId)
    .order('created_at', { ascending: false })
    .limit(200);

  // ── Enriquecer referencias ────────────────────────────────────────────────
  const movList = movimientos ?? [];

  const compraIds = [...new Set(movList.filter(m => m.referencia_tipo === 'compra' && m.referencia_id).map(m => m.referencia_id!))];
  const riaIds    = [...new Set(movList.filter(m => (m.referencia_tipo === 'remito_interno' || m.referencia_tipo === 'anulacion_ria') && m.referencia_id).map(m => m.referencia_id!))];
  const aplItemIds = [...new Set(movList.filter(m => m.referencia_tipo === 'aplicaciones_items' && m.referencia_id).map(m => m.referencia_id!))];
  const rigIds    = [...new Set(movList.filter(m => (m.referencia_tipo === 'remito_ganadero' || m.referencia_tipo === 'anulacion_remito_ganadero') && m.referencia_id).map(m => m.referencia_id!))];

  const [comprasMap, riasMap, aplItemsMap, rigsMap] = await Promise.all([
    // Compras → factura + proveedor
    compraIds.length > 0
      ? supabase
          .from('compras')
          .select('id, numero_factura, fecha, proveedor:proveedores(nombre)')
          .in('id', compraIds)
          .then(({ data }) => Object.fromEntries((data ?? []).map(c => [c.id, c])))
      : Promise.resolve({} as Record<string, any>),

    // RIAs → numero + campo/lote
    riaIds.length > 0
      ? supabase
          .from('remitos_internos')
          .select('id, numero_ria, lote:lotes(nombre, campo:campos(nombre))')
          .in('id', riaIds)
          .then(({ data }) => Object.fromEntries((data ?? []).map(r => [r.id, r])))
      : Promise.resolve({} as Record<string, any>),

    // Aplicaciones items → tipo + cultivo/lote
    aplItemIds.length > 0
      ? supabase
          .from('aplicaciones_items')
          .select('id, aplicacion:aplicaciones(tipo, fecha, cultivo:cultivos(cultivo, lote:lotes(nombre, campo:campos(nombre))))')
          .in('id', aplItemIds)
          .then(({ data }) => Object.fromEntries((data ?? []).map(ai => [ai.id, ai])))
      : Promise.resolve({} as Record<string, any>),

    // Remitos ganaderos → numero + lote de hacienda
    rigIds.length > 0
      ? supabase
          .from('remitos_ganaderos')
          .select('id, numero_rig, lote_hacienda:lotes_hacienda(nombre)')
          .in('id', rigIds)
          .then(({ data }) => Object.fromEntries((data ?? []).map(r => [r.id, r])))
      : Promise.resolve({} as Record<string, any>),
  ]);

  // ── Saldo acumulado (reconstruimos de fin hacia atrás) ────────────────────
  let saldo = stockTotal;
  const movConSaldo = movList.map((m) => {
    const meta = TIPO_META[m.tipo] ?? { label: m.tipo, color: 'text-zinc-500', signo: '~' as const, esEntrada: true };
    // El saldo ANTES de este movimiento
    const saldoAntes = meta.signo === '-'
      ? saldo + Number(m.cantidad)
      : meta.signo === '+'
        ? saldo - Number(m.cantidad)
        : saldo;
    saldo = saldoAntes;

    const compra  = m.referencia_tipo === 'compra' ? comprasMap[m.referencia_id!] : null;
    const ria     = (m.referencia_tipo === 'remito_interno' || m.referencia_tipo === 'anulacion_ria') ? riasMap[m.referencia_id!] : null;
    const aplItem = m.referencia_tipo === 'aplicaciones_items' ? aplItemsMap[m.referencia_id!] : null;
    const apl     = aplItem?.aplicacion ?? null;
    const rig     = (m.referencia_tipo === 'remito_ganadero' || m.referencia_tipo === 'anulacion_remito_ganadero') ? rigsMap[m.referencia_id!] : null;

    let detalle = '';
    if (compra) {
      detalle = `${compra.numero_factura ? `Factura ${compra.numero_factura}` : 'Sin N° de factura'}${compra.proveedor?.nombre ? ` · ${compra.proveedor.nombre}` : ''}`;
    } else if (ria) {
      detalle = `${ria.numero_ria}${(ria.lote as any)?.campo?.nombre ? ` · ${(ria.lote as any).campo.nombre}` : ''}${(ria.lote as any)?.nombre ? ` › ${(ria.lote as any).nombre}` : ''}`;
    } else if (apl) {
      detalle = `${apl.tipo ? apl.tipo.charAt(0).toUpperCase() + apl.tipo.slice(1) : ''}${(apl.cultivo as any)?.cultivo ? ` · ${(apl.cultivo as any).cultivo}` : ''}${(apl.cultivo as any)?.lote?.nombre ? ` › ${(apl.cultivo as any).lote.nombre}` : ''}`;
    } else if (rig) {
      detalle = `${rig.numero_rig}${(rig.lote_hacienda as any)?.nombre ? ` · ${(rig.lote_hacienda as any).nombre}` : ''}`;
    } else if (m.observaciones) {
      detalle = m.observaciones;
    }

    return { ...m, meta, saldoAntes, compra, ria, apl, rig, detalle };
  });

  const entradas = movConSaldo.filter((m) => m.meta.esEntrada);
  const salidas  = movConSaldo.filter((m) => !m.meta.esEntrada);
  const totalEntradas = entradas.reduce((s, m) => s + Number(m.cantidad), 0);
  const totalSalidas  = salidas.reduce((s, m) => s + Number(m.cantidad), 0);

  const exportData = movConSaldo.map((m) => ({
    fecha: `${fmtFecha(m.created_at)} ${fmtHora(m.created_at)}`,
    direccion: m.meta.esEntrada ? 'Entrada' : 'Salida',
    tipo: m.meta.label,
    cantidad: Number(m.cantidad),
    deposito: (m.deposito as any)?.nombre ?? '—',
    detalle: m.detalle,
    saldo: m.saldoAntes,
  }));

  const bajo = stockTotal <= producto.stock_minimo && producto.stock_minimo > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/app/stock"
          className="mt-1 p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
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
            {nFmt.format(stockTotal)} {producto.unidad_base}
            {bajo && <span className="ml-2 text-xs font-medium text-red-500">⚠ Bajo mínimo</span>}
          </div>
        </div>

        {(stockRows ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Sin stock disponible en ningún depósito.</p>
        ) : (
          <div className="space-y-0 divide-y divide-zinc-50">
            {(stockRows as any[]).map((s) => (
              <div key={s.deposito?.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-700">{s.deposito?.nombre ?? '—'}</span>
                  <span className="text-xs text-zinc-400">
                    {s.deposito?.tipo === 'central' ? 'Central' : 'Galpón campo'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-zinc-900">
                  {nFmt.format(s.cantidad_actual)} {producto.unidad_base}
                </span>
              </div>
            ))}
          </div>
        )}

        {producto.stock_minimo > 0 && (
          <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-50">
            Stock mínimo configurado: {nFmt.format(producto.stock_minimo)} {producto.unidad_base}
          </p>
        )}
      </div>

      {/* Historial: entradas / salidas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">Historial de movimientos</h2>
          <HistorialExportButton
            data={exportData}
            unidad={producto.unidad_base}
            filename={`stock-${producto.nombre.toLowerCase().replace(/\s+/g, '-')}`}
            title={`Historial de stock · ${producto.nombre}`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MovColumn
            titulo="Entradas"
            icon={<TrendingUp className="w-4 h-4 text-[#006836]" />}
            total={totalEntradas}
            unidad={producto.unidad_base}
            movs={entradas}
            nFmt={nFmt}
            fmtFecha={fmtFecha}
            fmtHora={fmtHora}
          />
          <MovColumn
            titulo="Salidas"
            icon={<TrendingDown className="w-4 h-4 text-orange-500" />}
            total={totalSalidas}
            unidad={producto.unidad_base}
            movs={salidas}
            nFmt={nFmt}
            fmtFecha={fmtFecha}
            fmtHora={fmtHora}
          />
        </div>
      </div>
    </div>
  );
}

// ── Columna de entradas o salidas ─────────────────────────────────────────────

function MovColumn({ titulo, icon, total, unidad, movs, nFmt, fmtFecha, fmtHora }: {
  titulo: string;
  icon: React.ReactNode;
  total: number;
  unidad: string;
  movs: any[];
  nFmt: Intl.NumberFormat;
  fmtFecha: (s: string) => string;
  fmtHora: (s: string) => string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold text-zinc-700">{titulo}</h3>
          </div>
          <span className="text-xs text-zinc-400">{movs.length} registros</span>
        </div>
        <p className="text-lg font-bold text-zinc-900 mt-1 tabular-nums">{nFmt.format(total)} {unidad}</p>
      </div>

      {movs.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-zinc-400">Sin movimientos.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-50 max-h-[480px] overflow-y-auto">
          {movs.map((mov) => (
            <div key={mov.id} className="px-5 py-3.5 hover:bg-zinc-50/60 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-800">{mov.meta.label}</p>
                  {mov.detalle && (
                    <p className="text-xs text-zinc-500 mt-0.5">{mov.detalle}</p>
                  )}
                  <p className="text-xs text-zinc-400 mt-1">
                    {mov.deposito?.nombre ?? '—'} · {fmtFecha(mov.created_at)} {fmtHora(mov.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-bold tabular-nums', mov.meta.color)}>
                    {mov.meta.signo !== '~' ? mov.meta.signo : ''}{nFmt.format(Number(mov.cantidad))} {unidad}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
                    Saldo: {nFmt.format(mov.saldoAntes)} {unidad}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
