import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, Sprout, Wheat, Tractor, Package, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { cn } from '@/lib/utils';
import RegistrarCosechaForm from './registrar-cosecha-form';
import ConfigProduccionForm from './config-produccion-form';
import AplicacionesList from './aplicaciones-list';
import NuevaAplicacionInline from './nueva-aplicacion-inline';
import NuevaLaborInline from './nueva-labor-inline';
import LaborsList from './labores-list';
import NuevaCosechaInline from './nueva-cosecha-inline';
import CosechaList from './cosecha-list';

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
    { data: costosCosecha },
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
  ]);

  if (!cultivo) notFound();

  const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const num = (n: number | null, d = 2) => n != null ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n) : '—';
  const fmt = (d: string | null) => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const lote     = cultivo.lote as any;
  const unidad   = cultivo.unidad_negocio as any;
  const campania = cultivo.campania as any;
  const costoTotal = cultivo.costo_directo_ars ?? 0;
  const unidadLabel = (cultivo as any).unidad_produccion ?? 'kg';

  const costoLaboresTotal     = (labores ?? []).reduce((acc, l: any) => acc + Number(l.costo_total_calculado ?? 0), 0);
  const costoCosechaTotal     = (costosCosecha ?? []).reduce((acc, c: any) => acc + Number(c.costo_total_calculado ?? 0), 0);
  const costoAplicacionesTotal = (aplicaciones ?? []).reduce((acc, a: any) =>
    acc + ((a.aplicaciones_items ?? []) as any[]).reduce((s: number, it: any) => s + Number(it.costo_imputado_ars ?? 0), 0), 0);

  const activo = cultivo.estado !== 'cancelada';
  const editable = cultivo.estado === 'en_curso' || cultivo.estado === 'planificada';

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Banner ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-[#006836] px-6 py-5 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-48 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 50%, white 0%, transparent 70%)' }} />
        <Link href="/app/cultivos"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white text-xs mb-3 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Cultivos
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Sprout className="w-5 h-5 text-white/70" />
              <h1 className="text-2xl font-bold tracking-tight">{cultivo.cultivo}</h1>
              <span className={cn('inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold', ESTADO_STYLE[cultivo.estado] ?? 'bg-white/20 text-white')}>
                {ESTADO_LABEL[cultivo.estado] ?? cultivo.estado}
              </span>
            </div>
            <p className="text-white/60 text-sm">
              {lote?.campo?.nombre}
              {lote?.nombre && <> <span className="text-white/30">›</span> {lote.nombre}</>}
              {lote?.hectareas && <span className="text-white/40 ml-1">({num(lote.hectareas, 1)} ha)</span>}
              {unidad?.nombre && <> <span className="text-white/30">·</span> {unidad.nombre}</>}
              {campania?.nombre && <> <span className="text-white/30">·</span> <span className="text-white/80">{campania.nombre}</span></>}
            </p>
            {cultivo.observaciones && (
              <p className="text-white/50 text-xs mt-2 italic">{cultivo.observaciones}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          {[
            { label: 'Siembra',       value: fmt(cultivo.fecha_siembra) },
            { label: 'Est. cosecha',  value: fmt(cultivo.fecha_cosecha_estimada) },
            { label: 'Cosecha real',  value: fmt(cultivo.fecha_cosecha_real) },
            { label: 'Costo directo', value: costoTotal > 0 ? ars.format(costoTotal) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-white/40 text-xs">{label}</p>
              <p className="text-white font-semibold text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          GRUPO 1 — TRABAJOS Y SERVICIOS
          Labores de campo + servicios de cosecha/trilla (no afectan stock)
      ════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-100">
            <Tractor className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-800">Trabajos y Servicios</h2>
            <p className="text-xs text-zinc-400">Labores de campo · Cosecha / Trilla (servicio contratado)</p>
          </div>
          {(costoLaboresTotal + costoCosechaTotal) > 0 && (
            <span className="ml-auto text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {ars.format(costoLaboresTotal + costoCosechaTotal)}
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
          {/* Labores */}
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Labores</span>
            {labores && labores.length > 0 && (
              <span className="text-xs text-zinc-400">({labores.length})</span>
            )}
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

          {/* Cosecha / Trilla — servicio */}
          <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cosecha / Trilla — servicio</span>
            {costosCosecha && costosCosecha.length > 0 && (
              <span className="text-xs text-zinc-400">({costosCosecha.length})</span>
            )}
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          GRUPO 2 — USO DE PRODUCTOS
          Aplicaciones de insumos que descuentan del stock
      ════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-orange-100">
            <Package className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-800">Uso de Productos</h2>
            <p className="text-xs text-zinc-400">Agroquímicos, fertilizantes y otros insumos · descuenta del stock</p>
          </div>
          {costoAplicacionesTotal > 0 && (
            <span className="ml-auto text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
              {ars.format(costoAplicacionesTotal)}
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm">
          <div className="p-4 space-y-3">
            {editable && (
              <NuevaAplicacionInline
                cultivoId={cultivoId}
                productos={productos ?? []}
                depositos={depositos ?? []}
                todayISO={todayISO}
              />
            )}
            <AplicacionesList
              aplicaciones={(aplicaciones ?? []) as any}
              cultivoId={cultivoId}
              costoTotal={costoTotal}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          GRUPO 3 — COSECHA / RECOLECCIÓN
          Registro de producción y resultado económico
      ════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#006836]/10">
            <Wheat className="w-4 h-4 text-[#006836]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-800">Cosecha / Recolección</h2>
            <p className="text-xs text-zinc-400">Registro de producción y resultado económico del cultivo</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#006836]/15 overflow-hidden shadow-sm">
          {activo && (
            <div className="p-4 border-b border-zinc-100 space-y-3">
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

          {/* Panel de producción — visible cuando está cosechada */}
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
                    {(cultivo as any).precio_venta_ars != null ? ars.format((cultivo as any).precio_venta_ars) : '—'}
                  </p>
                  <p className="text-xs text-zinc-400">por {unidadLabel}</p>
                </div>
              </div>

              {/* Estado de resultados */}
              <div className="rounded-xl overflow-hidden border border-zinc-100 text-sm">
                <div className="flex justify-between items-center px-4 py-2.5 bg-zinc-50">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Valor de producción</span>
                  <span className="font-semibold text-zinc-800">
                    {(cultivo as any).ingreso_bruto_ars != null ? ars.format((cultivo as any).ingreso_bruto_ars) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5 border-t border-zinc-100">
                  <span className="text-zinc-500 flex items-center gap-1.5">
                    <span className="text-zinc-300 text-xs">−</span> Trabajos y servicios
                  </span>
                  <span className="font-medium text-red-500">
                    {(costoLaboresTotal + costoCosechaTotal) > 0 ? ars.format(costoLaboresTotal + costoCosechaTotal) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5 border-t border-zinc-100">
                  <span className="text-zinc-500 flex items-center gap-1.5">
                    <span className="text-zinc-300 text-xs">−</span> Uso de productos
                  </span>
                  <span className="font-medium text-red-500">
                    {costoAplicacionesTotal > 0 ? ars.format(costoAplicacionesTotal) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5 border-t border-zinc-200 bg-zinc-50">
                  <span className="text-zinc-600 font-semibold">Costo directo total</span>
                  <span className="font-semibold text-red-500">
                    {costoTotal > 0 ? `− ${ars.format(costoTotal)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-t border-zinc-300 bg-zinc-800">
                  <span className="font-bold text-zinc-300 text-sm uppercase tracking-wider">Margen bruto</span>
                  <span className={cn('font-bold text-2xl', cultivo.margen_bruto_ars != null && cultivo.margen_bruto_ars >= 0 ? 'text-[#4ade80]' : 'text-red-400')}>
                    {cultivo.margen_bruto_ars != null ? ars.format(cultivo.margen_bruto_ars) : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Cuando está en curso, mostrar resumen de costos parciales */}
          {cultivo.estado !== 'cosechada' && cultivo.estado !== 'cancelada' && costoTotal > 0 && (
            <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between text-sm">
              <span className="text-zinc-500">Costo acumulado hasta hoy</span>
              <span className="font-bold text-zinc-800">{ars.format(costoTotal)}</span>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
