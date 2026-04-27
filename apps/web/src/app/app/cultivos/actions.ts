'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// ─── Helper compartido ────────────────────────────────────────────────────────
async function recalcularCostoDirecto(supabase: Awaited<ReturnType<typeof createClient>>, cultivoId: string) {
  // Costo de aplicaciones
  const { data: aplicsIds } = await supabase
    .from('aplicaciones').select('id').eq('cultivo_id', cultivoId);

  let costoAplicaciones = 0;
  if (aplicsIds && aplicsIds.length > 0) {
    const { data: items } = await supabase
      .from('aplicaciones_items')
      .select('costo_imputado_ars')
      .in('aplicacion_id', aplicsIds.map((a: any) => a.id));
    costoAplicaciones = (items ?? []).reduce((acc: number, ci: any) => acc + Number(ci.costo_imputado_ars ?? 0), 0);
  }

  // Costo de labores
  const { data: labores } = await supabase
    .from('labores').select('costo_total_calculado').eq('cultivo_id', cultivoId);
  const costoLabores = (labores ?? []).reduce((acc: number, l: any) => acc + Number(l.costo_total_calculado ?? 0), 0);

  // Costo de cosecha/trilla
  const { data: cosechas } = await supabase
    .from('costos_cosecha').select('costo_total_calculado').eq('cultivo_id', cultivoId);
  const costoCosecha = (cosechas ?? []).reduce((acc: number, c: any) => acc + Number(c.costo_total_calculado ?? 0), 0);

  const total = costoAplicaciones + costoLabores + costoCosecha;
  await supabase.from('cultivos').update({ costo_directo_ars: total }).eq('id', cultivoId);
  return total;
}

// ─── Aplicaciones ─────────────────────────────────────────────────────────────
export interface AplicacionItem {
  producto_id: string;
  deposito_origen_id: string;
  cantidad_retirada: number;
  cantidad_aplicada: number;
  cantidad_devuelta: number;
  causa_perdida?: string;
}

export interface AplicacionData {
  cultivo_id: string;
  fecha: string;
  tipo: 'fitosanitaria' | 'fertilizacion' | 'siembra' | 'otro';
  observaciones?: string;
  items: AplicacionItem[];
}

export async function crearAplicacion(data: AplicacionData): Promise<{ error?: string; aplicacionId?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { data: aplicacion, error: errAplic } = await supabase
    .from('aplicaciones')
    .insert({
      cultivo_id: data.cultivo_id,
      fecha: data.fecha,
      tipo: data.tipo,
      usuario_id: user.id,
      observaciones: data.observaciones || null,
    })
    .select('id')
    .single();

  if (errAplic || !aplicacion) return { error: errAplic?.message ?? 'Error al crear la aplicación' };

  const aplicacionId = aplicacion.id;

  for (const item of data.items) {
    const { data: ultimaCompraItem } = await supabase
      .from('compras_items')
      .select('precio_unitario_ars, compra:compras!inner(fecha)')
      .eq('producto_id', item.producto_id)
      .eq('deposito_destino_id', item.deposito_origen_id)
      .order('fecha', { referencedTable: 'compras', ascending: false })
      .limit(1)
      .maybeSingle();

    const costoUnitario = ultimaCompraItem?.precio_unitario_ars ?? 0;
    const cantidadPerdida = Math.max(0, Number(item.cantidad_retirada) - Number(item.cantidad_aplicada) - Number(item.cantidad_devuelta));
    const costoPerdida   = cantidadPerdida * Number(costoUnitario);
    const costoImputado  = Number(item.cantidad_aplicada) * Number(costoUnitario) + costoPerdida;

    const { data: appItem, error: errItem } = await supabase
      .from('aplicaciones_items')
      .insert({
        aplicacion_id: aplicacionId,
        producto_id: item.producto_id,
        deposito_origen_id: item.deposito_origen_id,
        cantidad_retirada: item.cantidad_retirada,
        cantidad_aplicada: item.cantidad_aplicada,
        cantidad_devuelta: item.cantidad_devuelta,
        cantidad_perdida: cantidadPerdida,
        causa_perdida: cantidadPerdida > 0 ? (item.causa_perdida ?? null) : null,
        costo_perdida_ars: costoPerdida,
        costo_unitario_ars_momento: costoUnitario,
        costo_imputado_ars: costoImputado,
      })
      .select('id')
      .single();

    if (errItem || !appItem) return { error: errItem?.message ?? 'Error al insertar ítem' };

    const { error: errMov } = await supabase.from('movimientos_stock').insert({
      producto_id: item.producto_id,
      deposito_id: item.deposito_origen_id,
      tipo: 'salida_aplicacion',
      cantidad: Math.abs(item.cantidad_retirada),
      referencia_tipo: 'aplicaciones_items',
      referencia_id: appItem.id,
      usuario_id: user.id,
    });
    if (errMov) return { error: errMov.message };

    if (item.cantidad_devuelta > 0) {
      const { error: errDevol } = await supabase.from('devoluciones_stock').insert({
        aplicacion_item_id: appItem.id,
        fecha: data.fecha,
        cantidad: item.cantidad_devuelta,
        deposito_destino_id: item.deposito_origen_id,
        usuario_id: user.id,
      });
      if (errDevol) return { error: errDevol.message };

      await supabase.from('movimientos_stock').insert({
        producto_id: item.producto_id,
        deposito_id: item.deposito_origen_id,
        tipo: 'entrada_devolucion',
        cantidad: Math.abs(item.cantidad_devuelta),
        referencia_tipo: 'aplicaciones_items',
        referencia_id: appItem.id,
        usuario_id: user.id,
      });
    }
  }

  await recalcularCostoDirecto(supabase, data.cultivo_id);

  revalidatePath('/app/cultivos');
  revalidatePath(`/app/cultivos/${data.cultivo_id}`);
  revalidatePath('/app/stock');

  return { aplicacionId };
}

// ─── Labores ──────────────────────────────────────────────────────────────────
export interface LaborData {
  cultivo_id: string;
  tipo_labor_id: string;
  fecha: string;
  tipo_ejecucion: 'propio' | 'tercero';
  observaciones?: string;
  // Propio
  maquinaria_id?: string;
  horas_trabajadas?: number;
  // Tercero
  proveedor_id?: string;
  modalidad_cobro?: 'por_ha' | 'total';
  precio_unitario?: number;
  hectareas_trabajadas?: number;
}

export async function crearLabor(data: LaborData): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  let costoCalculado = 0;

  if (data.tipo_ejecucion === 'propio') {
    if (!data.maquinaria_id || !data.horas_trabajadas) return { error: 'Seleccioná una maquinaria e ingresá las horas.' };

    const [{ data: maq }, { data: config }] = await Promise.all([
      supabase.from('maquinarias')
        .select('consumo_combustible_hora, costo_mantenimiento_hora, valor_adquisicion, vida_util_horas')
        .eq('id', data.maquinaria_id).single(),
      supabase.from('configuracion_empresa')
        .select('precio_combustible')
        .eq('empresa_id', (
          await supabase.from('maquinarias').select('empresa_id').eq('id', data.maquinaria_id).single()
        ).data?.empresa_id)
        .maybeSingle(),
    ]);

    if (maq) {
      const precio   = Number(config?.precio_combustible ?? 0);
      const combust  = Number(maq.consumo_combustible_hora) * precio;
      const mant     = Number(maq.costo_mantenimiento_hora);
      const amort    = maq.valor_adquisicion && maq.vida_util_horas
        ? Number(maq.valor_adquisicion) / Number(maq.vida_util_horas) : 0;
      costoCalculado = (combust + mant + amort) * Number(data.horas_trabajadas);
    }
  } else {
    if (!data.precio_unitario) return { error: 'Ingresá el precio del servicio.' };
    costoCalculado = data.modalidad_cobro === 'por_ha'
      ? Number(data.precio_unitario) * Number(data.hectareas_trabajadas ?? 0)
      : Number(data.precio_unitario);
  }

  const { error: err } = await supabase.from('labores').insert({
    cultivo_id:           data.cultivo_id,
    tipo_labor_id:        data.tipo_labor_id,
    fecha:                data.fecha,
    tipo_ejecucion:       data.tipo_ejecucion,
    observaciones:        data.observaciones || null,
    maquinaria_id:        data.maquinaria_id        ?? null,
    horas_trabajadas:     data.horas_trabajadas      ?? null,
    proveedor_id:         data.proveedor_id          ?? null,
    modalidad_cobro:      data.modalidad_cobro       ?? null,
    precio_unitario:      data.precio_unitario       ?? null,
    hectareas_trabajadas: data.hectareas_trabajadas  ?? null,
    costo_total_calculado: costoCalculado,
  });

  if (err) return { error: err.message };

  await recalcularCostoDirecto(supabase, data.cultivo_id);

  revalidatePath('/app/cultivos');
  revalidatePath(`/app/cultivos/${data.cultivo_id}`);

  return {};
}

export async function eliminarLabor(laborId: string, cultivoId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error: err } = await supabase.from('labores').delete().eq('id', laborId);
  if (err) return { error: err.message };

  await recalcularCostoDirecto(supabase, cultivoId);
  revalidatePath(`/app/cultivos/${cultivoId}`);
  return {};
}

// ─── Cosecha / Trilla ─────────────────────────────────────────────────────────
export interface CosechaData {
  cultivo_id: string;
  fecha: string;
  tipo_ejecucion: 'propio' | 'tercero';
  observaciones?: string;
  // Propio
  maquinaria_id?: string;
  horas_trabajadas?: number;
  // Tercero
  proveedor_id?: string;
  modalidad_cobro?: 'por_ha' | 'por_tonelada' | 'total';
  precio_unitario?: number;
  hectareas_trabajadas?: number;
  toneladas_trabajadas?: number;
}

export async function crearCostoCosecha(data: CosechaData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  let costoCalculado = 0;

  if (data.tipo_ejecucion === 'propio') {
    if (!data.maquinaria_id || !data.horas_trabajadas) return { error: 'Seleccioná una maquinaria e ingresá las horas.' };

    const { data: maq } = await supabase
      .from('maquinarias')
      .select('empresa_id, consumo_combustible_hora, costo_mantenimiento_hora, valor_adquisicion, vida_util_horas')
      .eq('id', data.maquinaria_id).single();

    if (maq) {
      const { data: cfg } = await supabase
        .from('configuracion_empresa')
        .select('precio_combustible')
        .eq('empresa_id', maq.empresa_id).maybeSingle();

      const precio  = Number(cfg?.precio_combustible ?? 0);
      const combust = Number(maq.consumo_combustible_hora) * precio;
      const mant    = Number(maq.costo_mantenimiento_hora);
      const amort   = maq.valor_adquisicion && maq.vida_util_horas
        ? Number(maq.valor_adquisicion) / Number(maq.vida_util_horas) : 0;
      costoCalculado = (combust + mant + amort) * Number(data.horas_trabajadas);
    }
  } else {
    if (!data.precio_unitario) return { error: 'Ingresá el precio del servicio.' };
    if (data.modalidad_cobro === 'por_ha')
      costoCalculado = Number(data.precio_unitario) * Number(data.hectareas_trabajadas ?? 0);
    else if (data.modalidad_cobro === 'por_tonelada')
      costoCalculado = Number(data.precio_unitario) * Number(data.toneladas_trabajadas ?? 0);
    else
      costoCalculado = Number(data.precio_unitario);
  }

  const { error: err } = await supabase.from('costos_cosecha').insert({
    cultivo_id:           data.cultivo_id,
    fecha:                data.fecha,
    tipo_ejecucion:       data.tipo_ejecucion,
    observaciones:        data.observaciones || null,
    maquinaria_id:        data.maquinaria_id        ?? null,
    horas_trabajadas:     data.horas_trabajadas      ?? null,
    proveedor_id:         data.proveedor_id          ?? null,
    modalidad_cobro:      data.modalidad_cobro       ?? null,
    precio_unitario:      data.precio_unitario       ?? null,
    hectareas_trabajadas: data.hectareas_trabajadas  ?? null,
    toneladas_trabajadas: data.toneladas_trabajadas  ?? null,
    costo_total_calculado: costoCalculado,
  });

  if (err) return { error: err.message };

  await recalcularCostoDirecto(supabase, data.cultivo_id);
  revalidatePath('/app/cultivos');
  revalidatePath(`/app/cultivos/${data.cultivo_id}`);
  return {};
}

export async function eliminarCostoCosecha(id: string, cultivoId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error: err } = await supabase.from('costos_cosecha').delete().eq('id', id);
  if (err) return { error: err.message };

  await recalcularCostoDirecto(supabase, cultivoId);
  revalidatePath(`/app/cultivos/${cultivoId}`);
  return {};
}
