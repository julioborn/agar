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
