'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

export type GrupoProduccion = 'grano' | 'semilla' | 'silo' | 'rollo';
type UnidadBase = 'kg' | 'tn' | 'L' | 'unidad';

async function assertAdmin() {
  const empresaData = await getEmpresaActiva();
  if (!empresaData) throw new Error('Sin sesión');
  const { rol, empresa } = empresaData;
  if (rol !== 'admin_empresa' && rol !== 'super_admin') throw new Error('Sin permisos');
  return { empresa };
}

export interface TipoProduccionCreado {
  id: string;
  producto_id: string;
  nombre: string;
  grupo: GrupoProduccion;
  unidad_medida: string;
  unidad_base: UnidadBase;
  valor_mercado: number;
}

export async function crearTipoProduccion(data: {
  nombre: string;
  grupo: GrupoProduccion;
  unidadMedida: string;
  unidadBase: UnidadBase;
  valorMercado: number;
}): Promise<{ data?: TipoProduccionCreado; error?: string }> {
  try {
    const { empresa } = await assertAdmin();
    const supabase = await createClient();

    const nombre = data.nombre.trim();
    if (!nombre) return { error: 'El nombre es obligatorio.' };

    const { data: producto, error: errProd } = await supabase
      .from('productos')
      .insert({
        empresa_id: empresa.id,
        nombre,
        categoria: 'produccion',
        unidad_base: data.unidadBase,
      })
      .select('id')
      .single();
    if (errProd || !producto) return { error: errProd?.message ?? 'No se pudo crear el producto vinculado.' };

    const { data: tipo, error: errTipo } = await supabase
      .from('tipos_produccion')
      .insert({
        empresa_id: empresa.id,
        producto_id: producto.id,
        nombre,
        grupo: data.grupo,
        unidad_medida: data.unidadMedida.trim(),
        unidad_base: data.unidadBase,
        valor_mercado: data.valorMercado,
      })
      .select('id, producto_id, nombre, grupo, unidad_medida, unidad_base, valor_mercado')
      .single();
    if (errTipo || !tipo) return { error: errTipo?.message ?? 'No se pudo crear el tipo de producción.' };

    revalidatePath('/app/tipos-produccion');
    revalidatePath('/app/ria');
    return { data: tipo as TipoProduccionCreado };
  } catch (e: any) {
    return { error: e.message ?? 'Error inesperado' };
  }
}

export async function actualizarTipoProduccion(
  id: string,
  data: { nombre?: string; grupo?: GrupoProduccion; unidadMedida?: string; valorMercado?: number },
): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = await createClient();

    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload.nombre = data.nombre.trim();
    if (data.grupo !== undefined) payload.grupo = data.grupo;
    if (data.unidadMedida !== undefined) payload.unidad_medida = data.unidadMedida.trim();
    if (data.valorMercado !== undefined) payload.valor_mercado = data.valorMercado;

    const { error } = await supabase.from('tipos_produccion').update(payload).eq('id', id);
    if (error) return { error: error.message };

    revalidatePath('/app/tipos-produccion');
    revalidatePath('/app/ria');
    return {};
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function eliminarTipoProduccion(id: string): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = await createClient();

    const { error } = await supabase.from('tipos_produccion').delete().eq('id', id);
    if (error) return { error: error.message };

    revalidatePath('/app/tipos-produccion');
    revalidatePath('/app/ria');
    return {};
  } catch (e: any) {
    return { error: e.message };
  }
}
