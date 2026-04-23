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
