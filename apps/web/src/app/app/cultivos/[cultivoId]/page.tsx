import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, Sprout, Wheat, Tractor, Package, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { cn } from '@/lib/utils';
import { Money } from '@/lib/currency-context';
import RegistrarCosechaForm from './registrar-cosecha-form';
import ConfigProduccionForm from './config-produccion-form';
import AplicacionesList from './aplicaciones-list';
import NuevaLaborInline from './nueva-labor-inline';
import LaborsList from './labores-list';
import NuevaCosechaInline from './nueva-cosecha-inline';
import CosechaList from './cosecha-list';
import CollapsibleCard from './collapsible-card';
import RiaInsumosList from './ria-insumos-list';

const ESTADO_STYLE: Record<string, string> = {
  planificada: 'bg-blue-500/20 text-blue-100',
  en_curso:    'bg-amber-400/20 text-amber-100',
  cosechada:   'bg-white/20 text-white',
  cancelada:   'bg-white/10 text-white/50',
};
const ESTADO_LABEL: Record<string, string> = {
  planificada: 'Planificada', en_curso: 'En curso', cosechada: 'Cosechada', cancelada: 'Cancelada',
};

interface Props { params: Promise<{ cultivoId: string }> }

export default async function CultivoDetallePage({ params }: Props) {
  const { cultivoId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const todayISO = new Date().toISOString().slice(0, 10);

  const [
    { data: cultivo }, { data: aplicaciones }, { data: productos }, { data: depositos },
    { data: labores }, { data: tiposLabor }, { data: maquinarias }, { data: proveedores }, { data: config },
    { data: costosCosecha }, { data: riasConfirmados },
  ] = await Promise.all([
    supabase
      .from('cultivos')
      .select(`
        id, cultivo, estado,
        producto_final, unidad_produccion,
        fecha_siembra, fecha_cosecha_estimada, fecha_cosecha_real,
        produccion_total_kg, rendimiento_kg_ha,
        precio_venta_ars, ingreso_bruto_ars,
        costo_directo_ars, margen_bruto_ars, observaciones,
        lote:lotes(nombre, hectareas, campo:campos(nombre)),
        unidad_negocio:unidades_negocio(nombre),
        campania:campanias(nombre)
      `)
      .eq('id', cultivoId)
      .single(),
    supabase
      .from('aplicaciones')
      .select(`
        id, fecha, tipo, observaciones,
        aplicaciones_items(
          id, cantidad_retirada, cantidad_aplicada, cantidad_perdida,
          causa_perdida, costo_imputado_ars, costo_perdida_ars,
          producto:productos(nombre, unidad_base),
          deposito:depositos(nombre)
        )
      `)
      .eq('cultivo_id', cultivoId)
      .order('fecha', { ascending: false }),
    supabase.from('productos').select('id, nombre, unidad_base').order('nombre'),
    supabase.from('depositos').select('id, nombre').order('nombre'),
    supabase.from('labores')
      .select(`id, fecha, tipo_ejecucion, observaciones, horas_trabajadas,
               modalidad_cobro, precio_unitario, hectareas_trabajadas, costo_total_calculado,
               tipo_labor:tipos_labor(nombre),
               maquinaria:maquinarias(nombre, tipo),
               proveedor:proveedores(nombre)`)
      .eq('cultivo_id', cultivoId)
      .order('fecha', { ascending: false }),
    supabase.from('tipos_labor').select('id, nombre')
      .eq('empresa_id', empresaData.empresa.id).order('nombre'),
    supabase.from('maquinarias')
      .select('id, nombre, tipo, consumo_combustible_hora, costo_mantenimiento_hora, valor_adquisicion, vida_util_horas')
      .eq('empresa_id', empresaData.empresa.id).eq('activa', true).order('nombre'),
    supabase.from('proveedores').select('id, nombre')
      .eq('empresa_id', empresaData.empresa.id).order('nombre'),
    supabase.from('configuracion_empresa').select('precio_combustible')
      .eq('empresa_id', empresaData.empresa.id).maybeSingle(),
    supabase.from('costos_cosecha')
      .select(`id, fecha, tipo_ejecucion, observaciones, horas_trabajadas,
               modalidad_cobro, precio_unitario, hectareas_trabajadas, toneladas_trabajadas,
               costo_total_calculado,
               maquinaria:maquinarias(nombre),
               proveedor:proveedores(nombre)`)
      .eq('cultivo_id', cultivoId)
      .order('fecha', { ascending: false }),
    supabase
      .from('remitos_internos')
      .select(`
        id, numero_ria, fecha, observaciones, superficie_afectada,
        remitos_insumos(
          id, cantidad, dosis_por_ha, costo_unitario, subtotal,
          producto:productos(nombre, unidad_base),
          deposito:depositos(nombre)
        )
      `)
      .eq('cultivo_id', cultivoId)
      .eq('estado', 'confirmado')
      .order('fecha', { ascending: false }),
  ]);

  if (!cultivo) notFound();

  const num = (n: number | null, d = 2) => n != null ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n) : '—';
  const fmt = (d: string | null) => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const lote     = cultivo.lote as any;
  const unidad   = cultivo.unidad_negocio as any;
  const campania = cultivo.campania as any;
  const costoTotal = cultivo.costo_directo_ars ?? 0;
  const unidadLabel = (cultivo as any).unidad_produccion ?? 'kg';

  const costoLaboresTotal      = (labores ?? []).reduce((acc, l: any) => acc + Number(l.costo_total_calculado ?? 0), 0);
  const costoCosechaTotal      = (costosCosecha ?? []).reduce((acc, c: any) => acc + Number(c.costo_total_calculado ?? 0), 0);
  const costoAplicacionesTotal = (aplicaciones ?? []).reduce((acc, a: any) =>
    acc + ((a.aplicaciones_items ?? []) as any[]).reduce((s: number, it: any) => s + Number(it.costo_imputado_ars ?? 0), 0), 0);
  const costoRiaTotal = (riasConfirmados ?? []).reduce((acc, r: any) =>
    acc + ((r.remitos_insumos ?? []) as any[]).reduce((s: number, i: any) => s + Number(i.subtotal ?? 0), 0), 0);
  const costoInsumosTotalDisplay = costoAplicacionesTotal + costoRiaTotal;
  const totalTrabajosServicios = costoLaboresTotal + costoCosechaTotal;

  const cantLabores     = (labores ?? []).length;
  const cantCosechas    = (costosCosecha ?? []).length;
  const cantAplicaciones = (aplicaciones ?? []).length;
  const cantRias        = (riasConfirmados ?? []).length;

  const activo   = cultivo.estado !== 'cancelada';
  const editable = cultivo.estado === 'en_curso' || cultivo.estado === 'planificada';

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Banner ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#005a2c] via-[#006836] to-[#004d24] px-6 py-5 text-white relative overflow-hidden shadow-lg shadow-[#006836]/20 border border-white/5">

        {/* Decoración: círculos difusos */}
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-16 w-64 h-64 rounded-full bg-black/10 pointer-events-none" />
        <div className="absolute right-4 top-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        {/* Ícono decorativo de fondo */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
          <Sprout className="w-40 h-40" />
        </div>

        {/* Breadcrumb */}
        <Link href="/app/cultivos"
          className="inline-flex items-center gap-1 text-white/50 hover:text-white/90 text-xs mb-4 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Volver a cultivos
        </Link>

        {/* Título + estado */}
        <div className="flex items-start gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 flex-shrink-0 mt-0.5">
            <Sprout className="w-5 h-5 text-white/80" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">{cultivo.cultivo}</h1>
              <span className={cn('inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border border-white/10', ESTADO_STYLE[cultivo.estado] ?? 'bg-white/20 text-white')}>
                {ESTADO_LABEL[cultivo.estado] ?? cultivo.estado}
              </span>
            </div>
            <p className="text-white/55 text-sm leading-relaxed">
              {lote?.campo?.nombre}
              {lote?.nombre && <> <span className="text-white/25 mx-1">›</span> {lote.nombre}</>}
              {lote?.hectareas && <span className="text-white/35 ml-1">({num(lote.hectareas, 1)} ha)</span>}
              {unidad?.nombre && <> <span className="text-white/25 mx-1.5">·</span> {unidad.nombre}</>}
              {campania?.nombre && <> <span className="text-white/25 mx-1.5">·</span> <span className="text-white/75 font-medium">{campania.nombre}</span></>}
            </p>
            {cultivo.observaciones && (
              <p className="text-white/40 text-xs mt-1.5 italic">{cultivo.observaciones}</p>
            )}
          </div>
        </div>

        {/* Fechas y costo — glass cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
          {[
            { label: 'Siembra',       value: fmt(cultivo.fecha_siembra) },
            { label: 'Est. cosecha',  value: fmt(cultivo.fecha_cosecha_estimada) },
            { label: 'Cosecha real',  value: fmt(cultivo.fecha_cosecha_real) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.08] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/[0.08]">
              <p className="text-white/45 text-[10px] uppercase tracking-wider font-medium">{label}</p>
              <p className="text-white font-semibold text-sm mt-1 leading-none">{value}</p>
            </div>
          ))}
          <div className="bg-white/[0.08] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/[0.08]">
            <p className="text-white/45 text-[10px] uppercase tracking-wider font-medium">Costo acumulado</p>
            <p className="text-white font-semibold text-sm mt-1 leading-none">
              {costoTotal > 0 ? <Money ars={costoTotal} /> : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Resumen de costos por categoría ───────────────────────────── */}
      {(totalTrabajosServicios > 0 || costoInsumosTotalDisplay > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-indigo-100 px-4 py-3 shadow-sm text-center">
            <p className="text-xs text-zinc-400 mb-1">Trabajos y servicios</p>
            <p className="text-base font-bold text-indigo-600">
              {totalTrabajosServicios > 0 ? <Money ars={totalTrabajosServicios} /> : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 px-4 py-3 shadow-sm text-center">
            <p className="text-xs text-zinc-400 mb-1">Uso de productos</p>
            <p className="text-base font-bold text-orange-600">
              {costoInsumosTotalDisplay > 0 ? <Money ars={costoInsumosTotalDisplay} /> : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3 shadow-sm text-center">
            <p className="text-xs text-zinc-400 mb-1">Total costos</p>
            <p className="text-base font-bold text-zinc-700">
              {costoTotal > 0 ? <Money ars={costoTotal} /> : '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── Card 1: Trabajos y Servicios ──────────────────────────────── */}
      <CollapsibleCard
        icon={<Tractor className="w-4 h-4 text-indigo-600" />}
        iconBg="bg-indigo-100"
        title="Trabajos y Servicios"
        subtitle="Labores de campo · Cosecha / Trilla (servicio contratado)"
        borderColor="border-indigo-100"
        badge={
          totalTrabajosServicios > 0
            ? <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg"><Money ars={totalTrabajosServicios} /></span>
            : undefined
        }
        stats={[
          { label: 'Labores', value: cantLabores > 0 ? String(cantLabores) : 'Sin registros' },
          { label: 'Cosecha/Trilla', value: cantCosechas > 0 ? String(cantCosechas) : 'Sin registros' },
        ]}
      >
        {/* Labores */}
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Labores</span>
          {cantLabores > 0 && <span className="text-xs text-zinc-400">({cantLabores})</span>}
        </div>
        <div className="p-4 space-y-3">
          {editable && (
            <NuevaLaborInline
              cultivoId={cultivoId}
              tiposLabor={(tiposLabor ?? []) as any}
              maquinarias={(maquinarias ?? []) as any}
              proveedores={(proveedores ?? []) as any}
              precioCombustible={config?.precio_combustible ?? 0}
              hectareasLote={(cultivo.lote as any)?.hectareas ?? null}
            />
          )}
          <LaborsList labores={(labores ?? []) as any} cultivoId={cultivoId} />
        </div>

        {/* Cosecha / Trilla */}
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cosecha / Trilla — servicio</span>
          {cantCosechas > 0 && <span className="text-xs text-zinc-400">({cantCosechas})</span>}
        </div>
        <div className="p-4 space-y-3">
          {activo && (
            <NuevaCosechaInline
              cultivoId={cultivoId}
              maquinarias={(maquinarias ?? []) as any}
              proveedores={(proveedores ?? []) as any}
              precioCombustible={config?.precio_combustible ?? 0}
              hectareasLote={(cultivo.lote as any)?.hectareas ?? null}
              produccionTotalKg={cultivo.produccion_total_kg ?? null}
            />
          )}
          <CosechaList costosCosecha={(costosCosecha ?? []) as any} cultivoId={cultivoId} />
        </div>
      </CollapsibleCard>

      {/* ── Card 2: Uso de Productos ──────────────────────────────────── */}
      <CollapsibleCard
        icon={<Package className="w-4 h-4 text-orange-600" />}
        iconBg="bg-orange-100"
        title="Uso de Productos"
        subtitle="Agroquímicos, fertilizantes y otros insumos · descuenta del stock"
        borderColor="border-orange-100"
        badge={
          costoInsumosTotalDisplay > 0
            ? <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg"><Money ars={costoInsumosTotalDisplay} /></span>
            : undefined
        }
        stats={[
          { label: 'Aplicaciones', value: cantAplicaciones > 0 ? String(cantAplicaciones) : 'Sin registros' },
          ...(cantRias > 0 ? [{ label: 'Vía RIA', value: String(cantRias) }] : []),
        ]}
      >
        <div className="p-4 space-y-3">
          {editable && (
            <Link
              href="/app/ria/nuevo"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] transition-colors"
            >
              <span className="text-base leading-none">+</span> Crear Remito Interno (RIA)
            </Link>
          )}
          <AplicacionesList
            aplicaciones={(aplicaciones ?? []) as any}
            cultivoId={cultivoId}
            costoTotal={costoTotal}
            editable={editable}
          />
          <RiaInsumosList rias={(riasConfirmados ?? []) as any} />
        </div>
      </CollapsibleCard>

      {/* ── Card 3: Cosecha / Recolección ────────────────────────────── */}
      <CollapsibleCard
        icon={<Wheat className="w-4 h-4 text-[#006836]" />}
        iconBg="bg-[#006836]/10"
        title="Cosecha y Recolección"
        subtitle="Registro de producción y resultado económico del cultivo"
        borderColor="border-[#006836]/15"
        defaultOpen={cultivo.estado === 'cosechada'}
        badge={
          cultivo.estado === 'cosechada' && cultivo.margen_bruto_ars != null
            ? (
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-lg',
                cultivo.margen_bruto_ars >= 0 ? 'text-[#006836] bg-[#006836]/10' : 'text-red-600 bg-red-50'
              )}>
                MB: <Money ars={cultivo.margen_bruto_ars} />
              </span>
            )
            : cultivo.produccion_total_kg != null
              ? <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-lg">{num(cultivo.produccion_total_kg, 0)} {unidadLabel}</span>
              : undefined
        }
        stats={cultivo.estado !== 'cosechada' && costoTotal > 0
          ? [{ label: 'Costo acumulado', value: <Money ars={costoTotal} /> }]
          : []
        }
      >
        {/* Configuración de producción y registro */}
        {activo && (
          <div className="p-4 space-y-3">
            <ConfigProduccionForm
              cultivoId={cultivoId}
              productoFinalActual={(cultivo as any).producto_final ?? null}
              unidadActual={(cultivo as any).unidad_produccion ?? 'kg'}
            />
            {editable && (
              <RegistrarCosechaForm
                cultivoId={cultivoId}
                hectareas={lote?.hectareas ?? null}
                unidadProduccion={(cultivo as any).unidad_produccion ?? 'kg'}
                productoFinal={(cultivo as any).producto_final ?? null}
                produccionActual={cultivo.produccion_total_kg ?? null}
                precioVentaActual={(cultivo as any).precio_venta_ars ?? null}
                fechaCosechaActual={cultivo.fecha_cosecha_real}
                costoDirecto={cultivo.costo_directo_ars ?? null}
              />
            )}
          </div>
        )}

        {/* Panel de resultados — solo cuando está cosechada */}
        {cultivo.estado === 'cosechada' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#006836]" />
              <h3 className="text-sm font-semibold text-zinc-700">Producción y margen bruto</h3>
              {(cultivo as any).producto_final && (
                <span className="text-xs text-zinc-400">· {(cultivo as any).producto_final}</span>
              )}
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-zinc-50 rounded-xl">
                <p className="text-xs text-zinc-400 mb-1">Producción</p>
                <p className="text-xl font-bold text-zinc-800">
                  {cultivo.produccion_total_kg != null ? num(cultivo.produccion_total_kg, 0) : '—'}
                </p>
                <p className="text-xs text-zinc-400">{unidadLabel}</p>
              </div>
              <div className="text-center p-3 bg-zinc-50 rounded-xl">
                <p className="text-xs text-zinc-400 mb-1">Rendimiento</p>
                <p className="text-xl font-bold text-zinc-800">
                  {cultivo.rendimiento_kg_ha != null ? num(cultivo.rendimiento_kg_ha, 1) : '—'}
                </p>
                <p className="text-xs text-zinc-400">{unidadLabel}/ha</p>
              </div>
              <div className="text-center p-3 bg-zinc-50 rounded-xl">
                <p className="text-xs text-zinc-400 mb-1">Precio venta</p>
                <p className="text-xl font-bold text-zinc-800">
                  {(cultivo as any).precio_venta_ars != null ? <Money ars={(cultivo as any).precio_venta_ars} /> : '—'}
                </p>
                <p className="text-xs text-zinc-400">por {unidadLabel}</p>
              </div>
            </div>

            {/* Estado de resultados */}
            <div className="rounded-xl overflow-hidden border border-zinc-100 text-sm">
              <div className="flex justify-between items-center px-4 py-2.5 bg-zinc-50">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Valor de producción</span>
                <span className="font-semibold text-zinc-800">
                  {(cultivo as any).ingreso_bruto_ars != null ? <Money ars={(cultivo as any).ingreso_bruto_ars} /> : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 border-t border-zinc-100">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <span className="text-zinc-300 text-xs">−</span> Trabajos y servicios
                </span>
                <span className="font-medium text-red-500">
                  {totalTrabajosServicios > 0 ? <Money ars={totalTrabajosServicios} /> : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 border-t border-zinc-100">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <span className="text-zinc-300 text-xs">−</span> Uso de productos
                </span>
                <span className="font-medium text-red-500">
                  {costoInsumosTotalDisplay > 0 ? <Money ars={costoInsumosTotalDisplay} /> : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 border-t border-zinc-200 bg-zinc-50">
                <span className="text-zinc-600 font-semibold">Costo directo total</span>
                <span className="font-semibold text-red-500">
                  {costoTotal > 0 ? <>− <Money ars={costoTotal} /></> : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 border-t border-zinc-300 bg-zinc-800">
                <span className="font-bold text-zinc-300 text-sm uppercase tracking-wider">Margen bruto</span>
                <span className={cn('font-bold text-2xl', cultivo.margen_bruto_ars != null && cultivo.margen_bruto_ars >= 0 ? 'text-[#4ade80]' : 'text-red-400')}>
                  {cultivo.margen_bruto_ars != null ? <Money ars={cultivo.margen_bruto_ars} /> : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Costo parcial cuando está en curso */}
        {cultivo.estado !== 'cosechada' && cultivo.estado !== 'cancelada' && costoTotal > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between text-sm">
            <span className="text-zinc-500">Costo acumulado hasta hoy</span>
            <span className="font-bold text-zinc-800"><Money ars={costoTotal} /></span>
          </div>
        )}
      </CollapsibleCard>

    </div>
  );
}
