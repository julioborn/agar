'use server';

import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

export interface CodigoProveedorData {
  producto_id: string;
  proveedor_id: string | null;
  codigo_externo: string | null;
  nombre_en_factura: string;
}

export async function guardarCodigosProveedor(codigos: CodigoProveedorData[]): Promise<void> {
  if (!codigos.length) return;

  const supabase = await createClient();
  const empresaData = await getEmpresaActiva();
  if (!empresaData) return;

  const rows = codigos.map((c) => ({
    empresa_id: empresaData.empresa.id,
    producto_id: c.producto_id,
    proveedor_id: c.proveedor_id,
    codigo_externo: c.codigo_externo,
    nombre_en_factura: c.nombre_en_factura,
  }));

  // Upsert: si ya existe la combinación (empresa, proveedor, nombre), no duplicar
  await supabase
    .from('codigos_proveedor')
    .upsert(rows, { onConflict: 'empresa_id,proveedor_id,nombre_en_factura', ignoreDuplicates: true });
}

export async function crearProductoNuevo(data: {
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
