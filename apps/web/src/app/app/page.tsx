import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { cn } from '@/lib/utils';
import {
  Sprout, ShoppingCart, AlertTriangle, ArrowRight, CircleDollarSign, Building2,
} from 'lucide-react';
import { Money } from '@/lib/currency-context';
import AccesosRapidos from './accesos-rapidos';

const ROL_LABEL: Record<string, string> = {
  super_admin:     'Super Administrador',
  admin_empresa:   'Administrador',
  contador:        'Contador',
  encargado_campo: 'Encargado de Campo',
  lector:          'Solo lectura',
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
  const esLector = rol === 'lector';

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

  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Encabezado ───────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-black/40 border border-white/5">

        {/* Anillos decorativos */}
        <div className="absolute -right-14 -top-14 w-60 h-60 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute -right-7 -top-7 w-44 h-44 rounded-full border border-white/[0.06] pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-black/20 pointer-events-none" />
        <div className="absolute right-20 bottom-2 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

        {/* Ícono decorativo de fondo */}
        <div className="absolute right-5 bottom-0 opacity-[0.04] pointer-events-none">
          <Sprout className="w-52 h-52" />
        </div>

        <div className="relative">
          {/* Rol + fecha */}
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-white/90 tracking-wide border border-white/10">
              {ROL_LABEL[rol] ?? rol}
            </span>
            <span className="text-white/30 text-xs">·</span>
            <span className="text-white/50 text-xs">{fechaLabel}</span>
          </div>

          {/* Empresa: avatar + nombre */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-inner">
              <Building2 className="w-7 h-7 text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{empresa.nombre}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        {/* Cultivos en curso — visible para todos */}
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

        {/* Stock bajo mínimo — oculto para lector */}
        {!esLector && (
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
        )}

        {/* Compras del mes — oculto para lector */}
        {!esLector && (
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
                {cantidadCompras > 0 ? <Money ars={comprasMes} /> : 'Sin compras este mes'}
              </p>
            </div>
          </Link>
        )}

        {/* Cotización USD — sin link a configuracion para lector */}
        {esLector ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <CircleDollarSign className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            {cotizVenta != null ? (
              <>
                <p className="text-3xl font-bold tracking-tight text-zinc-900">${num.format(cotizVenta)}</p>
                <p className="text-xs text-zinc-400 mt-1 font-medium">
                  {cotizEsManual ? 'USD · cotización manual' : cotizCompra != null ? `USD · compra $${num.format(cotizCompra)}` : 'USD oficial BNA'}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold tracking-tight text-zinc-400">—</p>
                <p className="text-xs text-zinc-400 mt-1 font-medium">USD · sin cotización</p>
              </>
            )}
          </div>
        ) : (
          <Link href="/app/configuracion" className="group block">
            <div className="bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 p-5 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <CircleDollarSign className="w-5 h-5 text-amber-500" />
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-200 group-hover:text-[#006836] group-hover:translate-x-0.5 transition-all" />
              </div>
              {cotizVenta != null ? (
                <>
                  <p className="text-3xl font-bold tracking-tight text-zinc-900">${num.format(cotizVenta)}</p>
                  <p className="text-xs text-zinc-400 mt-1 font-medium">
                    {cotizEsManual ? 'USD · cotización manual' : cotizCompra != null ? `USD · compra $${num.format(cotizCompra)}` : 'USD oficial BNA'}
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
        )}

      </div>

      {/* ── Accesos rápidos ───────────────────────────────────────────── */}
      <AccesosRapidos esLector={esLector} />

    </div>
  );
}
