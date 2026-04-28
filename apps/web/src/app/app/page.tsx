import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { cn } from '@/lib/utils';
import {
  Sprout, Package, ShoppingCart, AlertTriangle,
  MapPin, Warehouse, ArrowRight, TrendingUp, DollarSign, FileUp,
} from 'lucide-react';

const ROL_LABEL: Record<string, string> = {
  super_admin:     'Super Administrador',
  admin_empresa:   'Administrador',
  contador:        'Contador',
  encargado_campo: 'Encargado de Campo',
};

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

interface CotizacionBNA {
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

async function fetchCotizacionBNA(): Promise<CotizacionBNA | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa, rol } = empresaData;

  const hoy = new Date();
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const fechaLabel = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const [cultivosRes, stockBajoRes, comprasMesRes, cotizBNA, configRes] = await Promise.all([
    supabase.from('cultivos').select('id', { count: 'exact', head: true }).eq('estado', 'en_curso'),
    supabase.from('stock').select('id, cantidad_actual, producto:productos!inner(stock_minimo)', { count: 'exact', head: false }).gt('producto.stock_minimo', 0),
    supabase.from('compras').select('total_en_ars').gte('fecha', primerDiaMes).eq('estado', 'confirmada'),
    fetchCotizacionBNA(),
    supabase.from('configuracion_empresa').select('cotizacion_usd, cotizacion_usd_fecha').eq('empresa_id', empresa.id).maybeSingle(),
  ]);

  const cultivosActivos = cultivosRes.count ?? 0;
  const stockBajo       = (stockBajoRes.data ?? []).filter((r: any) => r.cantidad_actual <= r.producto?.stock_minimo).length;
  const comprasMes      = (comprasMesRes.data ?? []).reduce((acc: number, c: any) => acc + Number(c.total_en_ars ?? 0), 0);
  const cantidadCompras = comprasMesRes.data?.length ?? 0;

  // Cotización: usa la manual si está cargada, sino la de la API
  const cotizManual = configRes.data?.cotizacion_usd ?? null;
  const cotizVenta  = cotizManual ?? cotizBNA?.venta ?? null;
  const cotizCompra = cotizManual ? null : cotizBNA?.compra ?? null;
  const cotizEsManual = !!cotizManual;

  const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Encabezado ───────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-[#006836] p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-64 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 50%, white 0%, transparent 70%)' }} />
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full border-2 border-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-12 w-64 h-64 rounded-full border border-white/5 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white/90 tracking-wide">
              {ROL_LABEL[rol] ?? rol}
            </span>
            <span className="text-white/40 text-xs">·</span>
            <span className="text-white/60 text-xs">{fechaLabel}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{empresa.nombre}</h1>
          <p className="text-white/60 text-sm mt-1">Panel de gestión agropecuaria</p>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        {/* Cultivos en curso */}
        <Link href="/app/cultivos?estado=en_curso" className="group block">
          <div className="bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#006836]/10 flex items-center justify-center">
                <Sprout className="w-4 h-4 text-[#006836]" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-200 group-hover:text-[#006836] group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{cultivosActivos}</p>
            <p className="text-xs text-zinc-400 mt-1 font-medium">Cultivos en curso</p>
          </div>
        </Link>

        {/* Stock bajo mínimo */}
        <Link href="/app/stock" className="group block">
          <div className={cn(
            'bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all duration-200',
            stockBajo > 0 ? 'border-red-200 hover:border-red-300' : 'border-zinc-100 hover:border-[#006836]/25',
          )}>
            <div className="flex items-start justify-between mb-4">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', stockBajo > 0 ? 'bg-red-50' : 'bg-[#006836]/10')}>
                <AlertTriangle className={cn('w-4 h-4', stockBajo > 0 ? 'text-red-500' : 'text-[#006836]')} />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-200 group-hover:text-[#006836] group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className={cn('text-3xl font-bold tracking-tight', stockBajo > 0 ? 'text-red-600' : 'text-zinc-900')}>{stockBajo}</p>
            <p className="text-xs text-zinc-400 mt-1 font-medium">{stockBajo > 0 ? 'Bajo mínimo' : 'Stock OK'}</p>
          </div>
        </Link>

        {/* Compras del mes */}
        <Link href="/app/compras" className="group block">
          <div className="bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#006836]/10 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-[#006836]" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-200 group-hover:text-[#006836] group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{cantidadCompras}</p>
            <p className="text-xs text-zinc-400 mt-1 font-medium truncate">
              {cantidadCompras > 0 ? ars.format(comprasMes) : 'Sin compras este mes'}
            </p>
          </div>
        </Link>

        {/* Cotización USD — BNA oficial */}
        <Link href="/app/configuracion" className="group block">
          <div className="bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-200 group-hover:text-[#006836] group-hover:translate-x-0.5 transition-all" />
            </div>
            {cotizVenta != null ? (
              <>
                <p className="text-3xl font-bold tracking-tight text-zinc-900">
                  ${num.format(cotizVenta)}
                </p>
                <p className="text-xs text-zinc-400 mt-1 font-medium">
                  {cotizEsManual
                    ? 'USD · cotización manual'
                    : cotizCompra != null
                      ? `USD · compra $${num.format(cotizCompra)}`
                      : 'USD oficial BNA'}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold tracking-tight text-zinc-400">—</p>
                <p className="text-xs text-zinc-400 mt-1 font-medium">USD · sin cotización</p>
              </>
            )}
          </div>
        </Link>

      </div>

      {/* ── Accesos rápidos ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[#006836]" />
          <h2 className="text-md font-semibold text-zinc-500 tracking-wider">Accesos rápidos</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

          <Link href="/app/compras/importar" className="group col-span-2 sm:col-span-1">
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between hover:border-[#006836]/30 hover:shadow-sm transition-all duration-200">
              <FileUp className="w-5 h-5 text-[#006836]" />
              <div className="mt-6">
                <p className="text-zinc-800 font-semibold text-sm">Importar factura</p>
                <p className="text-zinc-400 text-xs mt-0.5">PDF o Excel con IA</p>
              </div>
            </div>
          </Link>

          <Link href="/app/compras/nueva" className="group">
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between hover:border-[#006836]/30 hover:shadow-sm transition-all duration-200">
              <ShoppingCart className="w-5 h-5 text-[#006836]" />
              <div className="mt-6">
                <p className="text-zinc-800 font-semibold text-sm">Registrar compra</p>
                <p className="text-zinc-400 text-xs mt-0.5">Carga manual</p>
              </div>
            </div>
          </Link>

          <Link href="/app/cultivos" className="group">
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between hover:border-[#006836]/30 hover:shadow-sm transition-all duration-200">
              <Sprout className="w-5 h-5 text-[#006836]" />
              <div className="mt-6">
                <p className="text-zinc-800 font-semibold text-sm">Cultivos</p>
                <p className="text-zinc-400 text-xs mt-0.5">Ver campañas</p>
              </div>
            </div>
          </Link>

          <Link href="/app/campos" className="group">
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between hover:border-[#006836]/30 hover:shadow-sm transition-all duration-200">
              <MapPin className="w-5 h-5 text-[#006836]" />
              <div className="mt-6">
                <p className="text-zinc-800 font-semibold text-sm">Campos</p>
                <p className="text-zinc-400 text-xs mt-0.5">Lotes y mapas</p>
              </div>
            </div>
          </Link>

          <Link href="/app/stock" className="group">
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between hover:border-[#006836]/30 hover:shadow-sm transition-all duration-200">
              <Warehouse className="w-5 h-5 text-[#006836]" />
              <div className="mt-6">
                <p className="text-zinc-800 font-semibold text-sm">Stock</p>
                <p className="text-zinc-400 text-xs mt-0.5">Inventario actual</p>
              </div>
            </div>
          </Link>

          <Link href="/app/productos" className="group">
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 flex flex-col justify-between hover:border-[#006836]/30 hover:shadow-sm transition-all duration-200">
              <Package className="w-5 h-5 text-[#006836]" />
              <div className="mt-6">
                <p className="text-zinc-800 font-semibold text-sm">Productos</p>
                <p className="text-zinc-400 text-xs mt-0.5">Catálogo e insumos</p>
              </div>
            </div>
          </Link>

        </div>
      </div>

    </div>
  );
}
