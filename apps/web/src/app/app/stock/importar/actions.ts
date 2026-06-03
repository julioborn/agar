'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

export interface CargaStockItem {
  producto_id: string;
  cantidad: number;
  deposito_id: string;
}

export async function registrarCargaStock(data: {
  items: CargaStockItem[];
  fecha: string;
  observaciones?: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa' };

  const fechaISO = data.fecha
    ? new Date(data.fecha + 'T12:00:00').toISOString()
    : new Date().toISOString();

  const movimientos = data.items.map((item) => ({
    deposito_id: item.deposito_id,
    producto_id: item.producto_id,
    tipo: 'ajuste' as const,
    cantidad: item.cantidad,
    fecha: fechaISO,
    usuario_id: user.id,
    referencia_tipo: 'carga_stock',
    observaciones: data.observaciones || null,
  }));

  const { error } = await supabase.from('movimientos_stock').insert(movimientos);
  if (error) return { error: error.message };

  revalidatePath('/app/stock');
  return {};
}

// Cuando el usuario indica proveedor/factura, creamos una compra real
// para que el historial de stock muestre el proveedor correctamente.
export async function registrarCompraDesdeImportacion(data: {
  proveedor_id?: string;
  numero_factura?: string;
  fecha: string;
  observaciones?: string;
  items: { producto_id: string; cantidad: number; deposito_id: string; precio_unitario: number }[];
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa' };

  const total = data.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  // 1. Crear cabecera de compra
  const { data: compra, error: errC } = await supabase
    .from('compras')
    .insert({
      empresa_id: empresaData.empresa.id,
      proveedor_id: data.proveedor_id || null,
      fecha: data.fecha,
      numero_factura: data.numero_factura?.trim() || null,
      moneda: 'ARS',
      total_moneda_original: total,
      total_en_ars: total,
      estado: 'confirmada',
      creado_por: user.id,
    })
    .select('id')
    .single();

  if (errC || !compra) return { error: errC?.message ?? 'Error al crear compra' };

  // 2. Items de compra
  const { error: errI } = await supabase.from('compras_items').insert(
    data.items.map((i) => ({
      compra_id: compra.id,
      producto_id: i.producto_id,
      cantidad_unidad_base: i.cantidad,
      precio_unitario_moneda_original: i.precio_unitario,
      precio_unitario_ars: i.precio_unitario,
      subtotal_moneda_original: i.cantidad * i.precio_unitario,
      subtotal_ars: i.cantidad * i.precio_unitario,
      deposito_destino_id: i.deposito_id,
    })),
  );
  if (errI) return { error: errI.message };

  // 3. Movimientos de stock como entrada_compra (referenciados a la compra)
  const { error: errM } = await supabase.from('movimientos_stock').insert(
    data.items.map((i) => ({
      deposito_id: i.deposito_id,
      producto_id: i.producto_id,
      tipo: 'entrada_compra' as const,
      cantidad: i.cantidad,
      fecha: new Date(data.fecha + 'T12:00:00').toISOString(),
      usuario_id: user.id,
      referencia_tipo: 'compra',
      referencia_id: compra.id,
      observaciones: data.observaciones || null,
    })),
  );
  if (errM) return { error: errM.message };

  revalidatePath('/app/stock');
  revalidatePath('/app/compras');
  return {};
}

export async function crearProveedorParaStock(data: {
  nombre: string;
  cuit?: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa' };

  const { data: prov, error } = await supabase
    .from('proveedores')
    .insert({
      empresa_id: empresaData.empresa.id,
      nombre: data.nombre.trim(),
      cuit: data.cuit?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !prov) return { error: error?.message ?? 'Error al crear el proveedor' };
  return { id: prov.id };
}

export async function crearProductoParaStock(data: {
  nombre: string;
  categoria: string;
  unidad_base: string;
  principio_activo?: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa' };

  const { data: prod, error } = await supabase
    .from('productos')
    .insert({
      empresa_id: empresaData.empresa.id,
      nombre: data.nombre.trim(),
      categoria: data.categoria,
      unidad_base: data.unidad_base,
      principio_activo: data.principio_activo?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !prod) return { error: error?.message ?? 'Error al crear el producto' };
  return { id: prod.id };
}
