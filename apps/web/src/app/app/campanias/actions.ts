'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface AplicacionItem {
  producto_id: string;
  deposito_origen_id: string;
  cantidad_retirada: number;
  cantidad_aplicada: number;
  cantidad_devuelta: number;
  causa_perdida?: string; // si hay desvío, se puede informar la causa
}

export interface AplicacionData {
  campania_id: string;
  fecha: string;
  tipo: 'fitosanitaria' | 'fertilizacion' | 'siembra' | 'otro';
  observaciones?: string;
  items: AplicacionItem[];
}

export async function crearAplicacion(data: AplicacionData): Promise<{ error?: string; aplicacionId?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  // 1. Insertar la aplicación
  const { data: aplicacion, error: errAplic } = await supabase
    .from('aplicaciones')
    .insert({
      campania_id: data.campania_id,
      fecha: data.fecha,
      tipo: data.tipo,
      usuario_id: user.id,
      observaciones: data.observaciones || null,
    })
    .select('id')
    .single();

  if (errAplic || !aplicacion) {
    return { error: errAplic?.message ?? 'Error al crear la aplicación' };
  }

  const aplicacionId = aplicacion.id;

  // 2. Para cada ítem: buscar costo unitario de la última compra, insertar item y movimiento de stock
  for (const item of data.items) {
    // Buscar precio_unitario_ars de la compra_item más reciente de este producto/depósito
    // compras_items usa deposito_destino_id; ordenamos por compra.fecha via join
    const { data: ultimaCompraItem } = await supabase
      .from('compras_items')
      .select('precio_unitario_ars, compra:compras!inner(fecha)')
      .eq('producto_id', item.producto_id)
      .eq('deposito_destino_id', item.deposito_origen_id)
      .order('fecha', { referencedTable: 'compras', ascending: false })
      .limit(1)
      .maybeSingle();

    const costoUnitario = ultimaCompraItem?.precio_unitario_ars ?? 0;

    // Pérdida = lo que salió del depósito - lo que se aplicó - lo que volvió
    const cantidadPerdida = Math.max(
      0,
      Number(item.cantidad_retirada) - Number(item.cantidad_aplicada) - Number(item.cantidad_devuelta)
    );
    const costoPerdida   = cantidadPerdida * Number(costoUnitario);
    // El costo imputado a la campaña incluye lo aplicado + la pérdida
    const costoImputado  = Number(item.cantidad_aplicada) * Number(costoUnitario) + costoPerdida;

    // Insertar ítem de aplicación
    const { data: appItem, error: errItem } = await supabase
      .from('aplicaciones_items')
      .insert({
        aplicacion_id: aplicacionId,
        producto_id: item.producto_id,
        deposito_origen_id: item.deposito_origen_id,
        cantidad_retirada: item.cantidad_retirada,
        cantidad_aplicada: item.cantidad_aplicada,
        cantidad_devuelta: item.cantidad_devuelta,
        cantidad_perdida:  cantidadPerdida,
        causa_perdida:     cantidadPerdida > 0 ? (item.causa_perdida ?? null) : null,
        costo_perdida_ars: costoPerdida,
        costo_unitario_ars_momento: costoUnitario,
        costo_imputado_ars: costoImputado,
      })
      .select('id')
      .single();

    if (errItem || !appItem) {
      return { error: errItem?.message ?? 'Error al insertar ítem de aplicación' };
    }

    // Movimiento de stock por la cantidad retirada (salida del depósito)
    // cantidad debe ser POSITIVO; el trigger aplica el signo según el tipo
    const { error: errMov } = await supabase
      .from('movimientos_stock')
      .insert({
        producto_id: item.producto_id,
        deposito_id: item.deposito_origen_id,
        tipo: 'salida_aplicacion',
        cantidad: Math.abs(item.cantidad_retirada),
        referencia_tipo: 'aplicaciones_items',
        referencia_id: appItem.id,
        usuario_id: user.id,
      });

    if (errMov) {
      return { error: errMov.message };
    }

    // Si hay devolución, insertar en devoluciones_stock + movimiento de entrada
    if (item.cantidad_devuelta > 0) {
      const { error: errDevol } = await supabase
        .from('devoluciones_stock')
        .insert({
          aplicacion_item_id: appItem.id,
          fecha: data.fecha,
          cantidad: item.cantidad_devuelta,
          deposito_destino_id: item.deposito_origen_id,
          usuario_id: user.id,
        });

      if (errDevol) {
        return { error: errDevol.message };
      }

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

  // Recalcular costo_directo_ars: sumar todos los costos imputados de esta campaña
  // Primero obtenemos los IDs de aplicaciones de esta campaña
  const { data: aplicsIds } = await supabase
    .from('aplicaciones')
    .select('id')
    .eq('campania_id', data.campania_id);

  if (aplicsIds && aplicsIds.length > 0) {
    const ids = aplicsIds.map((a: any) => a.id);
    const { data: costos } = await supabase
      .from('aplicaciones_items')
      .select('costo_imputado_ars')
      .in('aplicacion_id', ids);

    if (costos) {
      const totalCosto = costos.reduce((acc: number, ci: any) => acc + Number(ci.costo_imputado_ars ?? 0), 0);
      await supabase
        .from('campanias')
        .update({ costo_directo_ars: totalCosto })
        .eq('id', data.campania_id);
    }
  }

  revalidatePath('/app/campanias');
  revalidatePath(`/app/campanias/${data.campania_id}`);
  revalidatePath('/app/stock');

  return { aplicacionId };
}
