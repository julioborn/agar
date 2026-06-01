'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getEmpresaActiva } from '@/lib/empresa-actual';

export interface InsumoPayload {
  depositoId: string;
  productoId: string;
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
  observaciones?: string;
  insumos: InsumoPayload[];
  labores: LaborPayload[];
  produccion: ProduccionPayload[];
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
        cultivo_id: payload.cultivoId || null,
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
        cultivo_id: payload.cultivoId || null,
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
  return { riaId };
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

  revalidatePath('/app/ria');
  return { ok: true };
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
