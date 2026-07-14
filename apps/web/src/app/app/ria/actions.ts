'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getEmpresaActiva } from '@/lib/empresa-actual';

const TIPOS_ENTRADA = new Set([
  'entrada_compra', 'entrada_devolucion', 'transferencia_entrada',
  'ajuste', 'carga_stock', 'entrada_produccion_ria',
]);
const TIPOS_SALIDA = new Set([
  'salida_aplicacion', 'transferencia_salida', 'merma', 'salida_ria',
]);

function calcStock(movs: { tipo: string; cantidad: number | string }[]): number {
  return movs.reduce((acc, m) => {
    const qty = Number(m.cantidad ?? 0);
    if (TIPOS_ENTRADA.has(String(m.tipo))) return acc + qty;
    if (TIPOS_SALIDA.has(String(m.tipo))) return acc - qty;
    return acc + qty;
  }, 0);
}

export interface InsumoPayload {
  depositoId: string;
  productoId: string;
  hectareasAfectadas?: number;
  cantidad: number;
  dosisPorHa?: number;
  costoUnitario: number;
  subtotal: number;
  observaciones?: string;
}

export interface LaborPayload {
  tipoLaborId?: string;
  tipoLaborNombre?: string;
  descripcion: string;
  prestadorId?: string;
  prestadorNombre?: string;
  unidadMedida: string;
  hectareasAfectadas?: number;
  cantidad: number;
  tarifa: number;
  subtotal: number;
  fechaEjecucion?: string;
  observaciones?: string;
}

export interface ProduccionPayload {
  productoId: string;
  depositoIngresoId: string;
  cantidad: number;
  humedadPorcentaje?: number;
  calidadCategoria?: string;
  precioReferencia?: number;
  subtotalValor?: number;
  observaciones?: string;
}

export interface SaveRiaPayload {
  riaId?: string;
  fecha: string;
  loteId: string;
  campaniaId?: string;
  cultivoId?: string;
  superficieAfectada?: number;
  cultivoDescripcion?: string;
  tipoCultivoId?: string;
  observaciones?: string;
  insumos: InsumoPayload[];
  labores: LaborPayload[];
  produccion: ProduccionPayload[];
  crearNuevoCultivo?: boolean;
}

export async function saveRiaBorrador(payload: SaveRiaPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) return { error: 'Sin empresa activa.' };
  const { empresa } = empresaResult;

  if (!payload.loteId) return { error: 'Debe seleccionar un lote.' };
  if (!payload.fecha) return { error: 'La fecha es obligatoria.' };

  // Si se pidió crear un cultivo nuevo y no hay cultivoId, lo creamos primero
  let cultivoIdFinal = payload.cultivoId;
  let cultivoCreado = false;
  if (payload.crearNuevoCultivo && payload.cultivoDescripcion && !payload.cultivoId) {
    const { data: nuevoCultivo, error: cultErr } = await supabase
      .from('cultivos')
      .insert({
        lote_id: payload.loteId,
        campania_id: payload.campaniaId ?? null,
        cultivo: payload.cultivoDescripcion.trim(),
        tipo_cultivo_id: payload.tipoCultivoId ?? null,
        estado: 'en_curso',
        fecha_siembra: payload.fecha,
      })
      .select('id')
      .single();
    if (cultErr) return { error: `Error al crear cultivo: ${cultErr.message}` };
    if (nuevoCultivo) {
      cultivoIdFinal = nuevoCultivo.id;
      cultivoCreado = true;
    }
  }

  const anio = new Date(payload.fecha).getFullYear();
  let riaId: string;

  if (payload.riaId) {
    riaId = payload.riaId;

    const { error: upErr } = await supabase
      .from('remitos_internos')
      .update({
        fecha: payload.fecha,
        lote_id: payload.loteId,
        campania_id: payload.campaniaId || null,
        cultivo_id: cultivoIdFinal || null,
        superficie_afectada: payload.superficieAfectada ?? null,
        cultivo_descripcion: payload.cultivoDescripcion || null,
        observaciones: payload.observaciones || null,
      })
      .eq('id', riaId)
      .eq('estado', 'borrador');

    if (upErr) return { error: upErr.message };

    await supabase.from('remitos_insumos').delete().eq('remito_id', riaId);
    await supabase.from('remitos_labores').delete().eq('remito_id', riaId);
    await supabase.from('remitos_produccion').delete().eq('remito_id', riaId);
  } else {
    const { data: maxData } = await supabase
      .from('remitos_internos')
      .select('numero_correlativo')
      .eq('empresa_id', empresa.id)
      .eq('numero_anio', anio)
      .order('numero_correlativo', { ascending: false })
      .limit(1);

    const nextCorrelativo = ((maxData?.[0]?.numero_correlativo ?? 0) as number) + 1;
    const numeroRia = `RIA-${anio}-${nextCorrelativo.toString().padStart(5, '0')}`;

    const { data: newRia, error: insErr } = await supabase
      .from('remitos_internos')
      .insert({
        empresa_id: empresa.id,
        numero_anio: anio,
        numero_correlativo: nextCorrelativo,
        numero_ria: numeroRia,
        fecha: payload.fecha,
        operador_id: user.id,
        lote_id: payload.loteId,
        campania_id: payload.campaniaId || null,
        cultivo_id: cultivoIdFinal || null,
        superficie_afectada: payload.superficieAfectada ?? null,
        cultivo_descripcion: payload.cultivoDescripcion || null,
        observaciones: payload.observaciones || null,
        estado: 'borrador',
      })
      .select('id')
      .single();

    if (insErr) return { error: insErr.message };
    riaId = newRia.id;
  }

  if (payload.insumos.length > 0) {
    const { error } = await supabase.from('remitos_insumos').insert(
      payload.insumos.map((i) => ({
        remito_id: riaId,
        deposito_id: i.depositoId,
        producto_id: i.productoId,
        hectareas_afectadas: i.hectareasAfectadas ?? null,
        cantidad: i.cantidad,
        dosis_por_ha: i.dosisPorHa ?? null,
        costo_unitario: i.costoUnitario,
        subtotal: i.subtotal,
        observaciones: i.observaciones || null,
      })),
    );
    if (error) return { error: error.message };
  }

  if (payload.labores.length > 0) {
    const { error } = await supabase.from('remitos_labores').insert(
      payload.labores.map((l) => ({
        remito_id: riaId,
        tipo_labor_id: l.tipoLaborId || null,
        tipo_labor_nombre: l.tipoLaborNombre || null,
        descripcion: l.descripcion,
        prestador_id: l.prestadorId || null,
        prestador_nombre: l.prestadorNombre || null,
        unidad_medida: l.unidadMedida,
        hectareas_afectadas: l.hectareasAfectadas ?? null,
        cantidad: l.cantidad,
        tarifa: l.tarifa,
        subtotal: l.subtotal,
        fecha_ejecucion: l.fechaEjecucion || null,
        observaciones: l.observaciones || null,
      })),
    );
    if (error) return { error: error.message };
  }

  if (payload.produccion.length > 0) {
    const { error } = await supabase.from('remitos_produccion').insert(
      payload.produccion.map((p) => ({
        remito_id: riaId,
        producto_id: p.productoId,
        deposito_ingreso_id: p.depositoIngresoId,
        cantidad: p.cantidad,
        humedad_porcentaje: p.humedadPorcentaje ?? null,
        calidad_categoria: p.calidadCategoria || null,
        precio_referencia: p.precioReferencia ?? null,
        subtotal_valor: p.subtotalValor ?? null,
        observaciones: p.observaciones || null,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath('/app/ria');
  if (cultivoCreado) revalidatePath('/app/cultivos');
  return { riaId, cultivoCreado };
}

export async function confirmarRia(riaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  const { data, error } = await supabase.rpc('confirmar_ria', {
    p_ria_id: riaId,
    p_usuario_id: user.id,
  });

  if (error) return { error: error.message };
  if (!data?.ok) return { error: data?.error ?? 'Error al confirmar.' };

  // Guardar precios manuales de insumos sin compras previas en precios_reposicion
  try {
    const { data: ria } = await supabase
      .from('remitos_internos')
      .select('empresa_id, fecha')
      .eq('id', riaId)
      .single();

    const { data: insumos } = await supabase
      .from('remitos_insumos')
      .select('producto_id, costo_unitario')
      .eq('remito_id', riaId)
      .gt('costo_unitario', 0);

    if (ria && insumos?.length) {
      for (const ins of insumos) {
        // Solo guardar si el producto no tiene compras con precio > 0
        const { count } = await supabase
          .from('compras_items')
          .select('id', { count: 'exact', head: true })
          .eq('producto_id', ins.producto_id)
          .gt('precio_unitario_ars', 0);

        if ((count ?? 0) === 0) {
          await supabase.from('precios_reposicion').insert({
            empresa_id:     ria.empresa_id,
            producto_id:    ins.producto_id,
            precio_ars:     ins.costo_unitario,
            vigencia_desde: ria.fecha,
            observaciones:  'Precio ingresado en RIA (sin factura de compra)',
            usuario_id:     user.id,
          });
        }
      }
    }
  } catch { /* no es crítico, no bloquea la confirmación */ }

  revalidatePath('/app/ria');
  revalidatePath('/app/valuacion');
  return { ok: true };
}

export async function eliminarRia(riaId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };
  const empresaRia = await getEmpresaActiva();
  if (!empresaRia) return { error: 'Sin empresa activa.' };
  const { rol: rolRia, esSuperAdmin: esAdminRia } = empresaRia;
  if (!esAdminRia && rolRia !== 'admin_empresa') return { error: 'Sin permiso.' };

  // Obtener el estado y cultivo_id del RIA antes de borrarlo
  const { data: remito } = await supabase
    .from('remitos_internos')
    .select('estado, cultivo_id')
    .eq('id', riaId)
    .single();

  if (!remito) return { error: 'RIA no encontrado.' };

  // ── 1. Revertir movimientos de stock ──────────────────────────────────────────
  // Para confirmados: hay movimientos salida_ria (insumos) + entrada_produccion_ria (producción).
  // Para anulados: también hay los movimientos de reversión (entrada_devolucion / transferencia_salida),
  // todos con el mismo referencia_id. Borrarlos todos y recalcular deja el stock neto correcto.
  const { data: movs } = await supabase
    .from('movimientos_stock')
    .select('id, producto_id, deposito_id')
    .eq('referencia_id', riaId);

  if (movs && movs.length > 0) {
    await supabase.from('movimientos_stock').delete().eq('referencia_id', riaId);

    // Recalcular stock para cada par producto+depósito afectado
    const pares = [...new Map(
      movs.map((m: any) => [`${m.producto_id}::${m.deposito_id}`, m])
    ).values()];

    for (const m of pares as any[]) {
      const { data: restantes } = await supabase
        .from('movimientos_stock')
        .select('tipo, cantidad')
        .eq('producto_id', m.producto_id)
        .eq('deposito_id', m.deposito_id);

      // calcStock conoce todos los tipos incluyendo salida_ria y entrada_produccion_ria
      const nueva = calcStock(restantes ?? []);
      await supabase.from('stock')
        .update({ cantidad_actual: nueva })
        .eq('producto_id', m.producto_id)
        .eq('deposito_id', m.deposito_id);
    }
  }

  // ── 2. Borrar el RIA (cascade elimina insumos, labores y producción) ──────────
  const { error } = await supabase.from('remitos_internos').delete().eq('id', riaId);
  if (error) return { error: error.message };

  // ── 3. Recalcular costo directo del cultivo DESPUÉS de borrar el RIA ──────────
  // Ahora las líneas del RIA eliminado ya no existen, así que el cálculo es correcto.
  const cultivoId = (remito as any).cultivo_id;
  if (cultivoId) {
    const [{ data: aplicsIds }, { data: labores }, { data: cosechas }, { data: riasRestantes }] =
      await Promise.all([
        supabase.from('aplicaciones').select('id').eq('cultivo_id', cultivoId),
        supabase.from('labores').select('costo_total_calculado').eq('cultivo_id', cultivoId),
        supabase.from('costos_cosecha').select('costo_total_calculado').eq('cultivo_id', cultivoId),
        // RIAs que siguen confirmados para este cultivo (el borrado ya no aparece)
        supabase.from('remitos_internos').select('id')
          .eq('cultivo_id', cultivoId).eq('estado', 'confirmado'),
      ]);

    let costoAplic = 0;
    if (aplicsIds && aplicsIds.length > 0) {
      const { data: items } = await supabase.from('aplicaciones_items')
        .select('costo_imputado_ars')
        .in('aplicacion_id', aplicsIds.map((a: any) => a.id));
      costoAplic = (items ?? []).reduce((s: number, i: any) => s + Number(i.costo_imputado_ars ?? 0), 0);
    }
    const costoLab = (labores ?? []).reduce((s: number, l: any) => s + Number(l.costo_total_calculado ?? 0), 0);
    const costoCos = (cosechas ?? []).reduce((s: number, c: any) => s + Number(c.costo_total_calculado ?? 0), 0);

    let costoRia = 0;
    if (riasRestantes && riasRestantes.length > 0) {
      const ids = riasRestantes.map((r: any) => r.id);
      const [{ data: riaInsumos }, { data: riaLabores }] = await Promise.all([
        supabase.from('remitos_insumos').select('subtotal').in('remito_id', ids),
        supabase.from('remitos_labores').select('subtotal').in('remito_id', ids),
      ]);
      costoRia = [...(riaInsumos ?? []), ...(riaLabores ?? [])].reduce(
        (s: number, i: any) => s + Number(i.subtotal ?? 0), 0,
      );
    }

    await supabase.from('cultivos')
      .update({ costo_directo_ars: costoAplic + costoLab + costoCos + costoRia })
      .eq('id', cultivoId);
  }

  revalidatePath('/app/ria');
  revalidatePath('/app/stock');
  revalidatePath('/app/cultivos');
  return {};
}

export async function anularRia(riaId: string, motivo: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  const { data, error } = await supabase.rpc('anular_ria', {
    p_ria_id: riaId,
    p_usuario_id: user.id,
    p_motivo: motivo || 'Sin motivo especificado',
  });

  if (error) return { error: error.message };
  if (!data?.ok) return { error: data?.error ?? 'Error al anular.' };

  revalidatePath('/app/ria');
  return { ok: true };
}

export async function sincronizarRiasConCultivos(): Promise<{
  cultivosCreados: number;
  cultivosActualizados: number;
  riasSincronizados: number;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { cultivosCreados: 0, cultivosActualizados: 0, riasSincronizados: 0, error: 'No autenticado.' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { cultivosCreados: 0, cultivosActualizados: 0, riasSincronizados: 0, error: 'Sin empresa activa.' };
  const { empresa } = empresaData;

  let cultivosCreados = 0;
  let cultivosActualizados = 0;
  let riasSincronizados = 0;

  // ── Paso 1: crear cultivos para RIAs sin cultivo_id ────────────────────────
  const { data: riasSinVincular } = await supabase
    .from('remitos_internos')
    .select('id, lote_id, campania_id, cultivo_descripcion, fecha')
    .eq('empresa_id', empresa.id)
    .eq('estado', 'confirmado')
    .is('cultivo_id', null)
    .not('cultivo_descripcion', 'is', null);

  if (riasSinVincular && riasSinVincular.length > 0) {
    // Agrupar por (lote_id, cultivo_descripcion normalizado)
    const grupos = new Map<string, typeof riasSinVincular>();
    for (const ria of riasSinVincular) {
      const key = `${ria.lote_id}::${((ria as any).cultivo_descripcion ?? '').toLowerCase().trim()}`;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(ria as any);
    }

    for (const [, grupo] of grupos) {
      // Usar el RIA más antiguo del grupo como fecha de siembra
      const ordenado = [...grupo].sort((a, b) => ((a as any).fecha ?? '') < ((b as any).fecha ?? '') ? -1 : 1);
      const primer = ordenado[0] as any;

      const { data: nuevoCultivo } = await supabase
        .from('cultivos')
        .insert({
          lote_id: primer.lote_id,
          campania_id: primer.campania_id ?? null,
          cultivo: (primer.cultivo_descripcion ?? '').trim(),
          estado: 'en_curso',
          fecha_siembra: primer.fecha,
        })
        .select('id')
        .single();

      if (!nuevoCultivo) continue;
      cultivosCreados++;

      const ids = grupo.map((r: any) => r.id);
      await supabase.from('remitos_internos').update({ cultivo_id: nuevoCultivo.id }).in('id', ids);
      riasSincronizados += ids.length;
    }
  }

  // ── Paso 2: completar cultivos ya existentes con fecha_siembra vacía ────────
  const { data: cultivosIncompletos } = await supabase
    .from('cultivos')
    .select('id')
    .eq('empresa_id', empresa.id)
    .is('fecha_siembra', null);

  if (cultivosIncompletos && cultivosIncompletos.length > 0) {
    for (const cultivo of cultivosIncompletos) {
      // Buscar el RIA confirmado más antiguo vinculado a este cultivo
      const { data: primerRia } = await supabase
        .from('remitos_internos')
        .select('fecha, superficie_afectada, campania_id')
        .eq('cultivo_id', cultivo.id)
        .eq('estado', 'confirmado')
        .order('fecha', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!primerRia) continue;

      const patch: Record<string, any> = { fecha_siembra: (primerRia as any).fecha };
      if ((primerRia as any).campania_id) patch.campania_id = (primerRia as any).campania_id;

      await supabase.from('cultivos').update(patch).eq('id', cultivo.id);
      cultivosActualizados++;
    }
  }

  revalidatePath('/app/ria');
  revalidatePath('/app/cultivos');
  return { cultivosCreados, cultivosActualizados, riasSincronizados };
}
