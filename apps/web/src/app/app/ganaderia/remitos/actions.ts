'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { recalcularCostoLoteHacienda } from '@/app/app/ganaderia/lotes/actions';

const TIPOS_ENTRADA = new Set(['entrada_compra', 'entrada_devolucion', 'transferencia_entrada', 'ajuste', 'carga_stock', 'entrada_produccion_ria']);
const TIPOS_SALIDA = new Set(['salida_aplicacion', 'transferencia_salida', 'merma', 'salida_ria', 'salida_consumo_ganadero']);

function calcStock(movs: { tipo: string; cantidad: number | string }[]): number {
  return movs.reduce((acc, m) => {
    const qty = Number(m.cantidad ?? 0);
    if (TIPOS_ENTRADA.has(String(m.tipo))) return acc + qty;
    if (TIPOS_SALIDA.has(String(m.tipo))) return acc - qty;
    return acc + qty;
  }, 0);
}

export interface InsumoGanaderoPayload {
  depositoId: string;
  productoId: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
  observaciones?: string;
}

export interface SaveRemitoGanaderoPayload {
  remitoId?: string;
  fecha: string;
  loteHaciendaId: string;
  observaciones?: string;
  insumos: InsumoGanaderoPayload[];
}

export async function saveRemitoGanaderoBorrador(payload: SaveRemitoGanaderoPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) return { error: 'Sin empresa activa.' };
  const { empresa } = empresaResult;

  if (!payload.loteHaciendaId) return { error: 'Debe seleccionar un lote de hacienda.' };
  if (!payload.fecha) return { error: 'La fecha es obligatoria.' };

  const anio = new Date(payload.fecha).getFullYear();
  let remitoId: string;

  if (payload.remitoId) {
    remitoId = payload.remitoId;

    const { error: upErr } = await supabase
      .from('remitos_ganaderos')
      .update({
        fecha: payload.fecha,
        lote_hacienda_id: payload.loteHaciendaId,
        observaciones: payload.observaciones || null,
      })
      .eq('id', remitoId)
      .eq('estado', 'borrador');

    if (upErr) return { error: upErr.message };

    await supabase.from('remitos_ganaderos_insumos').delete().eq('remito_id', remitoId);
  } else {
    const { data: maxData } = await supabase
      .from('remitos_ganaderos')
      .select('numero_correlativo')
      .eq('empresa_id', empresa.id)
      .eq('numero_anio', anio)
      .order('numero_correlativo', { ascending: false })
      .limit(1);

    const nextCorrelativo = ((maxData?.[0]?.numero_correlativo ?? 0) as number) + 1;
    const numeroRig = `RIG-${anio}-${nextCorrelativo.toString().padStart(5, '0')}`;

    const { data: nuevo, error: insErr } = await supabase
      .from('remitos_ganaderos')
      .insert({
        empresa_id: empresa.id,
        numero_anio: anio,
        numero_correlativo: nextCorrelativo,
        numero_rig: numeroRig,
        fecha: payload.fecha,
        operador_id: user.id,
        lote_hacienda_id: payload.loteHaciendaId,
        observaciones: payload.observaciones || null,
        estado: 'borrador',
      })
      .select('id')
      .single();

    if (insErr) return { error: insErr.message };
    remitoId = nuevo.id;
  }

  if (payload.insumos.length > 0) {
    const { error } = await supabase.from('remitos_ganaderos_insumos').insert(
      payload.insumos.map((i) => ({
        remito_id: remitoId,
        deposito_id: i.depositoId,
        producto_id: i.productoId,
        cantidad: i.cantidad,
        costo_unitario: i.costoUnitario,
        subtotal: i.subtotal,
        observaciones: i.observaciones || null,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath('/app/ganaderia/remitos');
  return { remitoId };
}

export async function confirmarRemitoGanadero(remitoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  const { data, error } = await supabase.rpc('confirmar_remito_ganadero', {
    p_remito_id: remitoId,
    p_usuario_id: user.id,
  });

  if (error) return { error: error.message };
  if (!data?.ok) return { error: data?.error ?? 'Error al confirmar.' };

  try {
    const { data: remito } = await supabase
      .from('remitos_ganaderos')
      .select('lote_hacienda_id')
      .eq('id', remitoId)
      .single();
    if (remito?.lote_hacienda_id) {
      await recalcularCostoLoteHacienda(remito.lote_hacienda_id);
    }
  } catch { /* no bloquea la confirmación */ }

  revalidatePath('/app/ganaderia/remitos');
  revalidatePath('/app/ganaderia/lotes');
  revalidatePath('/app/stock');
  return { ok: true };
}

export async function anularRemitoGanadero(remitoId: string, motivo: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };

  const { data, error } = await supabase.rpc('anular_remito_ganadero', {
    p_remito_id: remitoId,
    p_usuario_id: user.id,
    p_motivo: motivo || 'Sin motivo especificado',
  });

  if (error) return { error: error.message };
  if (!data?.ok) return { error: data?.error ?? 'Error al anular.' };

  try {
    const { data: remito } = await supabase
      .from('remitos_ganaderos')
      .select('lote_hacienda_id')
      .eq('id', remitoId)
      .single();
    if (remito?.lote_hacienda_id) {
      await recalcularCostoLoteHacienda(remito.lote_hacienda_id);
    }
  } catch { /* no bloquea la anulación */ }

  revalidatePath('/app/ganaderia/remitos');
  revalidatePath('/app/ganaderia/lotes');
  revalidatePath('/app/stock');
  return { ok: true };
}

export async function eliminarRemitoGanadero(remitoId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado.' };
  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa.' };
  const { rol, esSuperAdmin } = empresaData;
  if (!esSuperAdmin && rol !== 'admin_empresa') return { error: 'Sin permiso.' };

  const { data: remito } = await supabase
    .from('remitos_ganaderos')
    .select('lote_hacienda_id')
    .eq('id', remitoId)
    .single();
  if (!remito) return { error: 'Remito no encontrado.' };

  const { data: movs } = await supabase
    .from('movimientos_stock')
    .select('id, producto_id, deposito_id')
    .eq('referencia_id', remitoId);

  if (movs && movs.length > 0) {
    await supabase.from('movimientos_stock').delete().eq('referencia_id', remitoId);

    const pares = [...new Map(movs.map((m: any) => [`${m.producto_id}::${m.deposito_id}`, m])).values()];
    for (const m of pares as any[]) {
      const { data: restantes } = await supabase
        .from('movimientos_stock')
        .select('tipo, cantidad')
        .eq('producto_id', m.producto_id)
        .eq('deposito_id', m.deposito_id);

      const nueva = calcStock(restantes ?? []);
      await supabase.from('stock')
        .update({ cantidad_actual: nueva })
        .eq('producto_id', m.producto_id)
        .eq('deposito_id', m.deposito_id);
    }
  }

  const { error } = await supabase.from('remitos_ganaderos').delete().eq('id', remitoId);
  if (error) return { error: error.message };

  await recalcularCostoLoteHacienda(remito.lote_hacienda_id);

  revalidatePath('/app/ganaderia/remitos');
  revalidatePath('/app/ganaderia/lotes');
  revalidatePath('/app/stock');
  return {};
}
