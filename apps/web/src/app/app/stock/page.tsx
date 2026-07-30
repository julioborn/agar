import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { BarChart2 } from 'lucide-react';
import StockManager from './stock-manager';

// Mismo criterio de signo que aplicar_movimiento_stock() (migración 036)
const TIPOS_ENTRADA = new Set(['entrada_compra', 'entrada_devolucion', 'transferencia_entrada', 'entrada_produccion_ria']);
const TIPOS_SALIDA = new Set(['salida_aplicacion', 'transferencia_salida', 'merma', 'salida_ria', 'salida_consumo_ganadero']);
function deltaMovimiento(tipo: string, cantidad: number) {
  if (TIPOS_ENTRADA.has(tipo)) return cantidad;
  if (TIPOS_SALIDA.has(tipo)) return -cantidad;
  if (tipo === 'ajuste') return cantidad;
  return 0;
}

interface Props {
  searchParams: Promise<{ hasta?: string }>;
}

export default async function StockPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const sp = await searchParams;
  const hasta = sp?.hasta && /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta) ? sp.hasta : null;

  let rawStock: any[];

  if (hasta) {
    // Stock acumulado desde el inicio hasta la fecha seleccionada (inclusive),
    // reconstruido a partir del historial de movimientos_stock.
    const finDia = new Date(`${hasta}T00:00:00`);
    finDia.setDate(finDia.getDate() + 1);

    const [{ data: movimientos }, { data: productosEmpresa }, { data: depositosEmpresa }] = await Promise.all([
      supabase
        .from('movimientos_stock')
        .select('deposito_id, producto_id, tipo, cantidad')
        .lt('fecha', finDia.toISOString()),
      supabase.from('productos').select('id, nombre, categoria, unidad_base, stock_minimo').eq('empresa_id', empresa.id),
      supabase.from('depositos').select('id, nombre').eq('empresa_id', empresa.id),
    ]);

    const productoMap = new Map((productosEmpresa ?? []).map((p: any) => [p.id, p]));
    const depositoMap = new Map((depositosEmpresa ?? []).map((d: any) => [d.id, d]));

    const acumulado = new Map<string, number>();
    for (const m of movimientos ?? []) {
      const key = `${(m as any).deposito_id}|${(m as any).producto_id}`;
      const delta = deltaMovimiento((m as any).tipo, Number((m as any).cantidad));
      acumulado.set(key, (acumulado.get(key) ?? 0) + delta);
    }

    rawStock = Array.from(acumulado.entries())
      .filter(([key]) => productoMap.has(key.split('|')[1]))
      .map(([key, cantidad]) => {
        const [depositoId, productoId] = key.split('|');
        return {
          id: key,
          cantidad_actual: cantidad,
          producto: productoMap.get(productoId) ?? null,
          deposito: depositoMap.get(depositoId) ?? null,
        };
      })
      .sort((a, b) => b.cantidad_actual - a.cantidad_actual);
  } else {
    const { data } = await supabase
      .from('stock')
      .select(`
        id,
        cantidad_actual,
        producto:productos(id, nombre, categoria, unidad_base, stock_minimo),
        deposito:depositos(id, nombre)
      `)
      .order('cantidad_actual', { ascending: false });
    rawStock = data ?? [];
  }

  const [{ data: ultimasCompras }, { data: preciosRia }, { data: tiposProduccion }] = await Promise.all([
    supabase
      .from('compras_items')
      .select('producto_id, precio_unitario_ars, compra:compras!inner(fecha)')
      .lte('compra.fecha', hasta ?? '9999-12-31')
      .order('fecha', { referencedTable: 'compras', ascending: false }),
    // Precio del último RIA confirmado por producto (fallback si no hay compra)
    supabase
      .from('remitos_insumos')
      .select('producto_id, costo_unitario, remito:remitos_internos!inner(fecha, estado)')
      .eq('remito.estado', 'confirmado')
      .lte('remito.fecha', hasta ?? '9999-12-31')
      .gt('costo_unitario', 0)
      .order('fecha', { referencedTable: 'remitos_internos', ascending: false }),
    // Precio de mercado (Tipos de Producción, en USD) para el stock de producción propia
    supabase
      .from('tipos_produccion')
      .select('producto_id, valor_mercado')
      .eq('empresa_id', empresa.id),
  ]);

  // Precio de la última compra por producto
  const precioUltimo: Record<string, number> = {};
  for (const item of ultimasCompras ?? []) {
    if (!precioUltimo[(item as any).producto_id]) {
      precioUltimo[(item as any).producto_id] = Number((item as any).precio_unitario_ars ?? 0);
    }
  }

  // Precio del último RIA (fallback)
  const precioRia: Record<string, number> = {};
  for (const item of preciosRia ?? []) {
    if (!precioRia[(item as any).producto_id]) {
      precioRia[(item as any).producto_id] = Number((item as any).costo_unitario ?? 0);
    }
  }

  // Valor de mercado (Tipos de Producción, en USD) — tiene prioridad para productos de producción propia
  const valorMercadoUsd: Record<string, number> = {};
  for (const t of tiposProduccion ?? []) {
    valorMercadoUsd[(t as any).producto_id] = Number((t as any).valor_mercado ?? 0);
  }

  const stockRows = (rawStock ?? []).map((r: any) => {
    const pid = r.producto?.id ?? '';
    const esProduccion = r.producto?.categoria === 'produccion';
    const precioUsd = esProduccion ? (valorMercadoUsd[pid] ?? null) : null;
    const precio = precioUsd != null ? null : (precioUltimo[pid] || precioRia[pid] || null);
    return {
      id: r.id,
      cantidad_actual: r.cantidad_actual ?? 0,
      producto_id: pid,
      producto_nombre: r.producto?.nombre ?? '—',
      producto_categoria: r.producto?.categoria ?? '',
      producto_unidad_base: r.producto?.unidad_base ?? '',
      producto_stock_minimo: r.producto?.stock_minimo ?? 0,
      deposito_id: r.deposito?.id ?? '',
      deposito_nombre: r.deposito?.nombre ?? '—',
      precio_ultimo: precio,
      precio_usd_mercado: precioUsd,
      precio_fuente: (precioUsd != null ? 'produccion' : precioUltimo[pid] ? 'compra' : precioRia[pid] ? 'ria' : null) as 'compra' | 'ria' | 'produccion' | null,
    };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Stock</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · se actualiza automáticamente al registrar compras y aplicaciones
          </p>
        </div>
      </div>

      <StockManager stockRows={stockRows} empresaNombre={empresa.nombre} hasta={hasta} />
    </div>
  );
}
