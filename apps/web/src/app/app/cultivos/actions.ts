'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Todos los tipos de movimiento que suman stock
const MOV_ENTRADA = new Set([
  'entrada_compra', 'entrada_devolucion', 'transferencia_entrada',
  'ajuste', 'carga_stock', 'entrada_produccion_ria',
]);
// Todos los tipos que restan stock
const MOV_SALIDA = new Set([
  'salida_aplicacion', 'transferencia_salida', 'merma', 'salida_ria',
]);

function calcStockDesdeMovs(movs: { tipo: string; cantidad: number | string }[]): number {
  return movs.reduce((acc, m) => {
    const qty = Number(m.cantidad ?? 0);
    if (MOV_ENTRADA.has(String(m.tipo))) return acc + qty;
    if (MOV_SALIDA.has(String(m.tipo)))  return acc - qty;
    return acc + qty; // desconocido: tratar como entrada
  }, 0);
}

// ─── Helper compartido ────────────────────────────────────────────────────────
export async function recalcularCostoDirecto(cultivoId: string) {
  const supabase = await createClient();
  // Costo de aplicaciones directas
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

  // Costo total (insumos + labores) de RIAs confirmados
  const { data: remitosIds } = await supabase
    .from('remitos_internos').select('id').eq('cultivo_id', cultivoId).eq('estado', 'confirmado');
  let costoRia = 0;
  if (remitosIds && remitosIds.length > 0) {
    const ids = remitosIds.map((r: any) => r.id);
    const [{ data: riaInsumos }, { data: riaLabores }] = await Promise.all([
      supabase.from('remitos_insumos').select('subtotal').in('remito_id', ids),
      supabase.from('remitos_labores').select('subtotal').in('remito_id', ids),
    ]);
    costoRia = [...(riaInsumos ?? []), ...(riaLabores ?? [])].reduce(
      (acc: number, i: any) => acc + Number(i.subtotal ?? 0), 0,
    );
  }

  const total = costoAplicaciones + costoLabores + costoCosecha + costoRia;
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

  await recalcularCostoDirecto(data.cultivo_id);

  revalidatePath('/app/cultivos');
  revalidatePath(`/app/cultivos/${data.cultivo_id}`);
  revalidatePath('/app/stock');

  return { aplicacionId };
}

export async function eliminarAplicacion(aplicacionId: string, cultivoId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  // 1. Obtener ítems para saber qué stock revertir
  const { data: items } = await supabase
    .from('aplicaciones_items')
    .select('id, producto_id, deposito_origen_id')
    .eq('aplicacion_id', aplicacionId);

  for (const item of items ?? []) {
    // 2. Eliminar movimientos_stock de la aplicación (salida_aplicacion + entrada_devolucion)
    await supabase
      .from('movimientos_stock')
      .delete()
      .eq('referencia_id', item.id)
      .eq('referencia_tipo', 'aplicaciones_items');

    // 3. Recalcular stock desde los movimientos restantes
    const { data: movs } = await supabase
      .from('movimientos_stock')
      .select('tipo, cantidad')
      .eq('producto_id', (item as any).producto_id)
      .eq('deposito_id', (item as any).deposito_origen_id);

    const nuevaCantidad = calcStockDesdeMovs(movs ?? []);

    await supabase
      .from('stock')
      .update({ cantidad_actual: nuevaCantidad })
      .eq('producto_id', (item as any).producto_id)
      .eq('deposito_id', (item as any).deposito_origen_id);
  }

  // 4. Eliminar la aplicación (cascade elimina aplicaciones_items)
  const { error } = await supabase.from('aplicaciones').delete().eq('id', aplicacionId);
  if (error) return { error: error.message };

  await recalcularCostoDirecto(cultivoId);
  revalidatePath(`/app/cultivos/${cultivoId}`);
  revalidatePath('/app/stock');
  return {};
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

  await recalcularCostoDirecto(data.cultivo_id);

  revalidatePath('/app/cultivos');
  revalidatePath(`/app/cultivos/${data.cultivo_id}`);

  return {};
}

// ─── Labor con costeo (Modo A / B / C) ────────────────────────────────────────
export interface LaborCosteoData {
  cultivo_id: string;
  tipo_labor_id: string;
  fecha: string;
  tipo_ejecucion: 'propio' | 'tercero';
  observaciones?: string;
  modo_costeo: 'A_propio' | 'B_tercero' | 'C_manual';
  unidad_salida: 'ha' | 'h' | 'tn' | 'm' | 'unidad';
  magnitud_aplicada: number;
  // Modo A
  maquinaria_id?: string;
  implemento_id?: string;
  horas_trabajadas?: number;
  // Overrides de parámetros para Modo A
  override_ancho?: number;
  override_velocidad?: number;
  override_eficiencia?: number;
  // Modo B
  proveedor_id?: string;
  precio_unitario?: number;
  flete_adicional_ha?: number;
  iva_porcentaje?: number;
  tarifa_indice_tipo?: string;
  tarifa_indice_valor?: number;
  // Modo C
  costo_total_manual?: number;
  costo_unitario_manual?: number;
  justificacion_modo_c?: string;
}

export async function crearLaborCosteo(data: LaborCosteoData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  let costoTotal = 0;
  let costoUnitario = 0;
  let desgloseJson: any = null;
  let snapshotVars: any = null;

  if (data.modo_costeo === 'A_propio') {
    if (!data.maquinaria_id) return { error: 'Seleccioná una maquinaria.' };

    // Obtener empresa_id
    const { data: maqRow } = await supabase
      .from('maquinarias').select('empresa_id').eq('id', data.maquinaria_id).single();
    if (!maqRow) return { error: 'Maquinaria no encontrada.' };

    const { data: resultado, error: rpcErr } = await supabase.rpc('fn_calcular_costo_labor', {
      p_maquinaria_id: data.maquinaria_id,
      p_implemento_id: data.implemento_id ?? null,
      p_empresa_id:    maqRow.empresa_id,
      p_unidad_salida: data.unidad_salida,
      p_fecha:         data.fecha,
      p_ancho_m:       data.override_ancho       ?? null,
      p_velocidad_kmh: data.override_velocidad   ?? null,
      p_eficiencia:    data.override_eficiencia  ?? null,
      p_factor_carga:  null,
      p_rend_tn_h:     null,
      p_veloc_emb_m_h: null,
    });

    if (rpcErr) return { error: rpcErr.message };
    const res = resultado as any;
    if (!res?.ok) return { error: res?.error ?? 'Error al calcular costo.' };

    costoUnitario = res.costo_unitario ?? 0;
    costoTotal = costoUnitario * data.magnitud_aplicada;
    desgloseJson = res.desglose;
    snapshotVars = res.parametros;

  } else if (data.modo_costeo === 'B_tercero') {
    if (!data.precio_unitario) return { error: 'Ingresá la tarifa del servicio.' };
    const tarifa = data.precio_unitario;
    const flete  = data.flete_adicional_ha ?? 0;
    const iva    = data.iva_porcentaje ?? 0;
    costoUnitario = (tarifa + flete) * (1 + iva / 100);
    costoTotal    = costoUnitario * data.magnitud_aplicada;
    desgloseJson  = { tarifa_base: tarifa, flete_ha: flete, iva_pct: iva };
    snapshotVars  = { indice_tipo: data.tarifa_indice_tipo, indice_valor: data.tarifa_indice_valor };

  } else {
    // Modo C
    if (!data.justificacion_modo_c?.trim()) return { error: 'La justificación es obligatoria en Modo C.' };
    if (data.costo_total_manual != null) {
      costoTotal    = data.costo_total_manual;
      costoUnitario = data.magnitud_aplicada > 0 ? costoTotal / data.magnitud_aplicada : 0;
    } else if (data.costo_unitario_manual != null) {
      costoUnitario = data.costo_unitario_manual;
      costoTotal    = costoUnitario * data.magnitud_aplicada;
    } else {
      return { error: 'Ingresá el costo total o el costo unitario.' };
    }
  }

  const { error: err } = await supabase.from('labores').insert({
    cultivo_id:           data.cultivo_id,
    tipo_labor_id:        data.tipo_labor_id,
    fecha:                data.fecha,
    tipo_ejecucion:       data.tipo_ejecucion,
    observaciones:        data.observaciones || null,
    maquinaria_id:        data.maquinaria_id        ?? null,
    horas_trabajadas:     data.unidad_salida === 'h' ? data.magnitud_aplicada : null,
    proveedor_id:         data.proveedor_id          ?? null,
    modalidad_cobro:      null,
    precio_unitario:      data.precio_unitario       ?? null,
    hectareas_trabajadas: data.unidad_salida === 'ha' ? data.magnitud_aplicada : null,
    costo_total_calculado: costoTotal,
    // Nuevos campos (mig 019)
    modo_costeo:          data.modo_costeo,
    unidad_salida:        data.unidad_salida,
    magnitud_aplicada:    data.magnitud_aplicada,
    costo_unitario_labor: costoUnitario,
    costo_desglose_json:  desgloseJson,
    snapshot_variables:   snapshotVars,
    implemento_id:        data.implemento_id         ?? null,
    flete_adicional_ha:   data.flete_adicional_ha    ?? 0,
    iva_porcentaje:       data.iva_porcentaje         ?? 0,
    tarifa_indice_tipo:   data.tarifa_indice_tipo    ?? null,
    tarifa_indice_valor:  data.tarifa_indice_valor   ?? null,
    es_costo_manual:      data.modo_costeo === 'C_manual',
    justificacion_modo_c: data.justificacion_modo_c  ?? null,
  });

  if (err) return { error: err.message };

  await recalcularCostoDirecto(data.cultivo_id);
  revalidatePath('/app/cultivos');
  revalidatePath(`/app/cultivos/${data.cultivo_id}`);
  return {};
}

export async function eliminarLabor(laborId: string, cultivoId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error: err } = await supabase.from('labores').delete().eq('id', laborId);
  if (err) return { error: err.message };

  await recalcularCostoDirecto(cultivoId);
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

  await recalcularCostoDirecto(data.cultivo_id);
  revalidatePath('/app/cultivos');
  revalidatePath(`/app/cultivos/${data.cultivo_id}`);
  return {};
}

export async function eliminarCostoCosecha(id: string, cultivoId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error: err } = await supabase.from('costos_cosecha').delete().eq('id', id);
  if (err) return { error: err.message };

  await recalcularCostoDirecto(cultivoId);
  revalidatePath(`/app/cultivos/${cultivoId}`);
  return {};
}

// ─── Eliminar cultivo ──────────────────────────────────────────────────────────
export async function eliminarCultivo(cultivoId: string, restaurarStock: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  if (restaurarStock) {
    // Restaurar stock de aplicaciones directas
    const { data: aplicaciones } = await supabase
      .from('aplicaciones').select('id').eq('cultivo_id', cultivoId);

    for (const aplic of aplicaciones ?? []) {
      const { data: items } = await supabase
        .from('aplicaciones_items')
        .select('id, producto_id, deposito_origen_id')
        .eq('aplicacion_id', aplic.id);

      for (const item of items ?? []) {
        await supabase.from('movimientos_stock').delete()
          .eq('referencia_id', item.id)
          .eq('referencia_tipo', 'aplicaciones_items');

        const { data: movs } = await supabase.from('movimientos_stock')
          .select('tipo, cantidad')
          .eq('producto_id', (item as any).producto_id)
          .eq('deposito_id', (item as any).deposito_origen_id);

        const nueva = (movs ?? []).reduce((acc: number, m: any) =>
          acc + (String(m.tipo).startsWith('entrada') ? Number(m.cantidad) : -Number(m.cantidad)), 0);

        await supabase.from('stock')
          .update({ cantidad_actual: nueva })
          .eq('producto_id', (item as any).producto_id)
          .eq('deposito_id', (item as any).deposito_origen_id);
      }
    }

    // Restaurar stock de RIAs confirmados
    const { data: rias } = await supabase
      .from('remitos_internos').select('id')
      .eq('cultivo_id', cultivoId).eq('estado', 'confirmado');

    for (const ria of rias ?? []) {
      const { data: movs } = await supabase.from('movimientos_stock')
        .select('id, producto_id, deposito_id')
        .eq('referencia_id', ria.id);

      if (movs && movs.length > 0) {
        await supabase.from('movimientos_stock').delete().eq('referencia_id', ria.id);

        const pares = [...new Map(movs.map((m: any) => [`${m.producto_id}::${m.deposito_id}`, m])).values()];
        for (const m of pares as any[]) {
          const { data: restantes } = await supabase.from('movimientos_stock')
            .select('tipo, cantidad')
            .eq('producto_id', (m as any).producto_id)
            .eq('deposito_id', (m as any).deposito_id);

          const nueva = calcStockDesdeMovs(restantes ?? []);

          await supabase.from('stock')
            .update({ cantidad_actual: nueva })
            .eq('producto_id', (m as any).producto_id)
            .eq('deposito_id', (m as any).deposito_id);
        }
      }
    }
  }

  // Eliminar RIAs del cultivo — el stock de confirmados ya fue restaurado arriba
  const { data: riasDelCultivo } = await supabase
    .from('remitos_internos').select('id').eq('cultivo_id', cultivoId);
  if (riasDelCultivo && riasDelCultivo.length > 0) {
    const riaIds = riasDelCultivo.map((r: any) => r.id);
    await supabase.from('remitos_insumos').delete().in('remito_id', riaIds);
    await supabase.from('remitos_labores').delete().in('remito_id', riaIds);
    await supabase.from('remitos_produccion').delete().in('remito_id', riaIds);
    await supabase.from('remitos_internos').delete().in('id', riaIds);
  }

  const { error } = await supabase.from('cultivos').delete().eq('id', cultivoId);
  if (error) return { error: error.message };

  revalidatePath('/app/cultivos');
  revalidatePath('/app/stock');
  return {};
}
