'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

function titleCase(s: string) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export async function crearTipoCultivo(nombre: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa.' };
  const { empresa } = empresaData;

  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return { error: 'El nombre es obligatorio.' };

  const { data, error } = await supabase
    .from('tipos_cultivo')
    .insert({ empresa_id: empresa.id, nombre: nombreLimpio })
    .select('id')
    .single();

  if (error) return { error: error.code === '23505' ? 'Ya existe un tipo con ese nombre.' : error.message };

  revalidatePath('/app/cultivos/tipos');
  return { id: data.id };
}

export async function actualizarTipoCultivo(id: string, nombre: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return { error: 'El nombre es obligatorio.' };

  const { error } = await supabase
    .from('tipos_cultivo')
    .update({ nombre: nombreLimpio })
    .eq('id', id);

  if (error) return { error: error.code === '23505' ? 'Ya existe un tipo con ese nombre.' : error.message };

  revalidatePath('/app/cultivos/tipos');
  revalidatePath('/app/cultivos');
  return {};
}

export async function eliminarTipoCultivo(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('tipos_cultivo').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/app/cultivos/tipos');
  return {};
}

export async function importarTiposDesdeExistentes(): Promise<{ error?: string; creados: number }> {
  const supabase = await createClient();
  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa.', creados: 0 };
  const { empresa } = empresaData;

  // Obtener todos los nombres distintos de cultivos (RLS ya filtra por empresa)
  const { data: cultivos } = await supabase
    .from('cultivos')
    .select('cultivo')
    .not('cultivo', 'is', null);

  const nombresSet = new Set<string>();
  for (const c of cultivos ?? []) {
    if (!c.cultivo?.trim()) continue;
    // Normalizar: cada token capitalizado, ordenados para unificar consociados
    const tokens = (c.cultivo as string)
      .split(',')
      .map((t: string) => titleCase(t.trim()))
      .filter(Boolean)
      .sort();
    nombresSet.add(tokens.join(', '));
  }

  if (nombresSet.size === 0) return { creados: 0 };

  const inserts = Array.from(nombresSet).map((nombre) => ({ empresa_id: empresa.id, nombre }));
  const { data, error } = await supabase
    .from('tipos_cultivo')
    .upsert(inserts, { onConflict: 'empresa_id,nombre', ignoreDuplicates: true })
    .select('id');

  if (error) return { error: error.message, creados: 0 };

  revalidatePath('/app/cultivos/tipos');
  return { creados: data?.length ?? 0 };
}

function normalizarPorComas(s: string) {
  return s.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean).sort().join(',');
}

function normalizarPorPalabras(s: string) {
  return s.split(/[,\s]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean).sort().join(' ');
}

// Vincula cultivos existentes al tipo correcto por coincidencia de nombre normalizado
export async function vincularCultivosExistentes(): Promise<{ error?: string; vinculados: number }> {
  const supabase = await createClient();
  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'Sin empresa activa.', vinculados: 0 };
  const { empresa } = empresaData;

  const [{ data: tipos }, { data: cultivos }] = await Promise.all([
    supabase.from('tipos_cultivo').select('id, nombre').eq('empresa_id', empresa.id),
    supabase.from('cultivos').select('id, cultivo').not('cultivo', 'is', null),
  ]);

  if (!tipos?.length || !cultivos?.length) return { vinculados: 0 };

  // Dos mapas: uno por comas, otro por palabras sueltas (fallback para typos de coma)
  const mapaComas = new Map<string, string>();
  const mapaPalabras = new Map<string, string>();
  for (const t of tipos) {
    mapaComas.set(normalizarPorComas(t.nombre), t.id);
    mapaPalabras.set(normalizarPorPalabras(t.nombre), t.id);
  }

  let vinculados = 0;
  for (const c of cultivos) {
    const tipoId =
      mapaComas.get(normalizarPorComas(c.cultivo)) ??
      mapaPalabras.get(normalizarPorPalabras(c.cultivo));
    if (tipoId) {
      await supabase.from('cultivos').update({ tipo_cultivo_id: tipoId }).eq('id', c.id);
      vinculados++;
    }
  }

  revalidatePath('/app/cultivos');
  return { vinculados };
}
