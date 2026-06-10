'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function recalcularCostoCultivo(supabase: Awaited<ReturnType<typeof createClient>>, cultivoId: string) {
  const [{ data: aplicsIds }, { data: labores }, { data: cosechas }, { data: riaItems }] = await Promise.all([
    supabase.from('aplicaciones').select('id').eq('cultivo_id', cultivoId),
    supabase.from('labores').select('costo_total_calculado').eq('cultivo_id', cultivoId),
    supabase.from('costos_cosecha').select('costo_total_calculado').eq('cultivo_id', cultivoId),
    // RIA insumos del cultivo (solo confirmados)
    supabase
      .from('remitos_insumos')
      .select('subtotal, remito_id')
      .in('remito_id',
        (await supabase
          .from('remitos_internos')
          .select('id')
          .eq('cultivo_id', cultivoId)
          .eq('estado', 'confirmado')
        ).data?.map((r: any) => r.id) ?? []
      ),
  ]);

  let costoAplicaciones = 0;
  if (aplicsIds && aplicsIds.length > 0) {
    const { data: items } = await supabase
      .from('aplicaciones_items').select('costo_imputado_ars')
      .in('aplicacion_id', aplicsIds.map((a: any) => a.id));
    costoAplicaciones = (items ?? []).reduce((s: number, i: any) => s + Number(i.costo_imputado_ars ?? 0), 0);
  }

  const costoLabores  = (labores  ?? []).reduce((s: number, l: any) => s + Number(l.costo_total_calculado ?? 0), 0);
  const costoCosecha  = (cosechas ?? []).reduce((s: number, c: any) => s + Number(c.costo_total_calculado ?? 0), 0);
  const costoRia      = (riaItems ?? []).reduce((s: number, i: any) => s + Number(i.subtotal ?? 0), 0);

  await supabase.from('cultivos')
    .update({ costo_directo_ars: costoAplicaciones + costoLabores + costoCosecha + costoRia })
    .eq('id', cultivoId);
}

export async function guardarPrecioYActualizarRias(
  productoId: string,
  precio: number,
  empresaId: string
): Promise<{ error?: string; riasActualizados: number; cultivosActualizados: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado', riasActualizados: 0, cultivosActualizados: 0 };

  // 1. Guardar en precios_reposicion
  const { error: e1 } = await supabase.from('precios_reposicion').insert({
    empresa_id: empresaId,
    producto_id: productoId,
    precio_ars: precio,
    vigencia_desde: new Date().toISOString().split('T')[0],
    vigencia_hasta: null,
    observaciones: 'Carga manual desde alerta de precio',
  });
  if (e1) return { error: e1.message, riasActualizados: 0, cultivosActualizados: 0 };

  // 2. RIAs confirmados que tienen este producto con costo = 0
  const { data: remitosConf } = await supabase
    .from('remitos_internos')
    .select('id, cultivo_id')
    .eq('estado', 'confirmado');

  const remitoIds = (remitosConf ?? []).map((r: any) => r.id);
  if (remitoIds.length === 0) {
    revalidatePath('/app/valuacion');
    revalidatePath('/app/stock');
    return { riasActualizados: 0, cultivosActualizados: 0 };
  }

  const { data: riaItems } = await supabase
    .from('remitos_insumos')
    .select('id, cantidad, remito_id')
    .eq('producto_id', productoId)
    .lte('costo_unitario', 0)
    .in('remito_id', remitoIds);

  if (!riaItems || riaItems.length === 0) {
    revalidatePath('/app/valuacion');
    revalidatePath('/app/stock');
    return { riasActualizados: 0, cultivosActualizados: 0 };
  }

  // 3. Actualizar cada remito_insumo
  for (const item of riaItems) {
    await supabase.from('remitos_insumos').update({
      costo_unitario: precio,
      subtotal: Number((item as any).cantidad) * precio,
    }).eq('id', (item as any).id);
  }

  // 4. Recalcular costo_directo_ars de cada cultivo afectado
  const remitoCultivoMap = Object.fromEntries(
    (remitosConf ?? []).map((r: any) => [r.id, r.cultivo_id])
  );
  const cultivoIds = [...new Set(
    riaItems.map((i: any) => remitoCultivoMap[i.remito_id]).filter(Boolean)
  )] as string[];

  for (const cultivoId of cultivoIds) {
    await recalcularCostoCultivo(supabase, cultivoId);
  }

  revalidatePath('/app/valuacion');
  revalidatePath('/app/stock');
  revalidatePath('/app/cultivos');
  revalidatePath('/app/ria');

  return { riasActualizados: riaItems.length, cultivosActualizados: cultivoIds.length };
}
