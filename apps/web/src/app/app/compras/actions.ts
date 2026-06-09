'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

export interface ItemData {
  producto_id: string;
  presentacion_id: string | null;
  cantidad_presentacion: number | null;
  cantidad_unidad_base: number;
  precio_unitario_moneda_original: number;
  precio_unitario_ars: number;
  subtotal_moneda_original: number;
  subtotal_ars: number;
  deposito_destino_id: string;
}

export interface CompraData {
  proveedor_id: string | null;
  fecha: string;
  numero_factura: string | null;
  moneda: 'ARS' | 'USD';
  cotizacion_usd: number | null;
  total_moneda_original: number;
  total_en_ars: number;
  items: ItemData[];
}

export async function crearCompra(data: CompraData): Promise<{ error?: string; compraId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa' };

  // 1. Insertar cabecera de la compra
  const { data: compra, error: e1 } = await supabase
    .from('compras')
    .insert({
      empresa_id: empresaData.empresa.id,
      proveedor_id: data.proveedor_id || null,
      fecha: data.fecha,
      numero_factura: data.numero_factura || null,
      moneda: data.moneda,
      cotizacion_usd: data.cotizacion_usd,
      total_moneda_original: data.total_moneda_original,
      total_en_ars: data.total_en_ars,
      estado: 'confirmada',
      creado_por: user.id,
    })
    .select('id')
    .single();

  if (e1 || !compra) return { error: e1?.message ?? 'Error al crear la compra' };

  // 2. Insertar ítems
  const items = data.items.map((item) => ({
    compra_id: compra.id,
    producto_id: item.producto_id,
    presentacion_id: item.presentacion_id,
    cantidad_presentacion: item.cantidad_presentacion,
    cantidad_unidad_base: item.cantidad_unidad_base,
    precio_unitario_moneda_original: item.precio_unitario_moneda_original,
    precio_unitario_ars: item.precio_unitario_ars,
    subtotal_moneda_original: item.subtotal_moneda_original,
    subtotal_ars: item.subtotal_ars,
    deposito_destino_id: item.deposito_destino_id,
  }));

  const { error: e2 } = await supabase.from('compras_items').insert(items);
  if (e2) return { error: e2.message };

  // 3. Insertar movimientos_stock → el trigger actualiza stock automáticamente
  const movimientos = data.items.map((item) => ({
    deposito_id: item.deposito_destino_id,
    producto_id: item.producto_id,
    tipo: 'entrada_compra' as const,
    cantidad: item.cantidad_unidad_base,
    fecha: new Date().toISOString(),
    usuario_id: user.id,
    referencia_tipo: 'compra',
    referencia_id: compra.id,
  }));

  const { error: e3 } = await supabase.from('movimientos_stock').insert(movimientos);
  if (e3) return { error: e3.message };

  revalidatePath('/app/compras');
  revalidatePath('/app/stock');

  return { compraId: compra.id };
}

export async function corregirItemsCompra(
  correcciones: Array<{ id: string; cantidad_unidad_base: number }>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa' };

  // Obtener datos actuales de todos los ítems a corregir
  const ids = correcciones.map((c) => c.id);
  const { data: itemsActuales, error: fetchErr } = await supabase
    .from('compras_items')
    .select('id, compra_id, producto_id, deposito_destino_id, precio_unitario_ars, precio_unitario_moneda_original')
    .in('id', ids);

  if (fetchErr || !itemsActuales) return { error: fetchErr?.message ?? 'Error al obtener ítems' };

  const compraIds = new Set<string>();
  const stockRecalcKeys = new Set<string>(); // "producto_id::deposito_id"

  for (const corr of correcciones) {
    const item = itemsActuales.find((i: any) => i.id === corr.id);
    if (!item) continue;

    const nuevaCantidad = corr.cantidad_unidad_base;
    const nuevaSubtotalArs = Number(item.precio_unitario_ars) * nuevaCantidad;
    const nuevaSubtotalOrig = Number(item.precio_unitario_moneda_original) * nuevaCantidad;

    // 1. Actualizar compras_items
    const { error: e1 } = await supabase
      .from('compras_items')
      .update({
        cantidad_unidad_base: nuevaCantidad,
        subtotal_ars: nuevaSubtotalArs,
        subtotal_moneda_original: nuevaSubtotalOrig,
      })
      .eq('id', corr.id);
    if (e1) return { error: e1.message };

    // 2. Actualizar movimientos_stock correspondiente a esta compra+producto
    const { error: e2 } = await supabase
      .from('movimientos_stock')
      .update({ cantidad: nuevaCantidad })
      .eq('referencia_id', item.compra_id)
      .eq('referencia_tipo', 'compra')
      .eq('producto_id', item.producto_id)
      .eq('deposito_id', item.deposito_destino_id);
    if (e2) return { error: e2.message };

    compraIds.add(item.compra_id);
    stockRecalcKeys.add(`${item.producto_id}::${item.deposito_destino_id}`);
  }

  // 3. Recalcular stock desde movimientos para cada producto+depósito afectado
  for (const key of stockRecalcKeys) {
    const [productoId, depositoId] = key.split('::');

    const { data: movs } = await supabase
      .from('movimientos_stock')
      .select('tipo, cantidad')
      .eq('producto_id', productoId)
      .eq('deposito_id', depositoId);

    const nuevaCantidadStock = (movs ?? []).reduce((acc: number, m: any) => {
      const qty = Number(m.cantidad ?? 0);
      return acc + (String(m.tipo).startsWith('entrada') ? qty : -qty);
    }, 0);

    await supabase
      .from('stock')
      .update({ cantidad_actual: nuevaCantidadStock })
      .eq('producto_id', productoId)
      .eq('deposito_id', depositoId);
  }

  // 4. Recalcular totales de cada compra afectada
  for (const compraId of compraIds) {
    const { data: allItems } = await supabase
      .from('compras_items')
      .select('subtotal_ars, subtotal_moneda_original')
      .eq('compra_id', compraId);

    const totalArs = (allItems ?? []).reduce((acc: number, i: any) => acc + Number(i.subtotal_ars ?? 0), 0);
    const totalOrig = (allItems ?? []).reduce((acc: number, i: any) => acc + Number(i.subtotal_moneda_original ?? 0), 0);

    await supabase
      .from('compras')
      .update({ total_en_ars: totalArs, total_moneda_original: totalOrig })
      .eq('id', compraId);
  }

  revalidatePath('/app/compras');
  revalidatePath('/app/stock');
  return {};
}

export async function eliminarComprasVacias(): Promise<{ deleted: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deleted: 0, error: 'No autenticado' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { deleted: 0, error: 'Sin empresa activa' };

  const { data: conItems } = await supabase
    .from('compras_items')
    .select('compra_id');

  const idsConItems = new Set((conItems ?? []).map((r: any) => r.compra_id));

  const { data: todasCompras } = await supabase
    .from('compras')
    .select('id');

  const vacias = (todasCompras ?? [])
    .map((c: any) => c.id)
    .filter((id: string) => !idsConItems.has(id));

  if (vacias.length === 0) return { deleted: 0 };

  const { error } = await supabase.from('compras').delete().in('id', vacias);
  if (error) return { deleted: 0, error: error.message };

  revalidatePath('/app/compras');
  revalidatePath('/app/stock');

  return { deleted: vacias.length };
}
