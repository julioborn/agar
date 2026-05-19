'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generarNumeroComprobante(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<string> {
  const anio = new Date().getFullYear();
  const { count } = await supabase
    .from('comprobantes_internos')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .like('numero', `CI-${anio}-%`);
  const seq = String((count ?? 0) + 1).padStart(4, '0');
  return `CI-${anio}-${seq}`;
}

async function getNombreUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('usuarios_empresas')
    .select('usuario_id')
    .eq('usuario_id', userId)
    .maybeSingle();
  if (!data) return userId;
  const { data: profile } = await supabase.auth.admin.getUserById(userId).catch(() => ({ data: null }));
  return profile?.user?.user_metadata?.nombre_completo
    ?? profile?.user?.email
    ?? userId;
}

// ─── Costo Indirecto de Campo ─────────────────────────────────────────────────

export interface CostoIndirectoCampoData {
  campo_id: string;
  campania_id?: string;
  fecha: string;
  categoria: 'impuesto' | 'arrendamiento' | 'infraestructura' | 'seguro' | 'servicios_campo' | 'otros';
  descripcion: string;
  proveedor_id?: string;
  monto_ars: number;
}

export async function crearCostoIndirectoCampo(
  data: CostoIndirectoCampoData,
): Promise<{ error?: string; comprobanteNumero?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'No hay empresa activa' };
  const { empresa } = empresaData;

  // Obtener info del campo
  const { data: campo } = await supabase
    .from('campos')
    .select('nombre')
    .eq('id', data.campo_id)
    .single();

  // Obtener info del proveedor si existe
  let proveedorNombre: string | null = null;
  if (data.proveedor_id) {
    const { data: prov } = await supabase
      .from('proveedores')
      .select('nombre')
      .eq('id', data.proveedor_id)
      .single();
    proveedorNombre = prov?.nombre ?? null;
  }

  const numero = await generarNumeroComprobante(supabase, empresa.id);

  const datosJson = {
    tipo: 'costo_campo',
    campo_nombre: campo?.nombre,
    campo_id: data.campo_id,
    campania_id: data.campania_id ?? null,
    fecha: data.fecha,
    categoria: data.categoria,
    descripcion: data.descripcion,
    proveedor_nombre: proveedorNombre,
    monto_ars: data.monto_ars,
    empresa_nombre: empresa.nombre,
  };

  const { data: comprobante, error: errCI } = await supabase
    .from('comprobantes_internos')
    .insert({
      empresa_id:     empresa.id,
      numero,
      tipo:           'costo_campo',
      fecha:          data.fecha,
      usuario_id:     user.id,
      descripcion:    data.descripcion,
      monto_ars:      data.monto_ars,
      datos_json:     datosJson,
    })
    .select('id')
    .single();

  if (errCI || !comprobante) return { error: errCI?.message ?? 'Error al crear comprobante' };

  const { error: errCosto } = await supabase
    .from('costos_indirectos_campo')
    .insert({
      empresa_id:     empresa.id,
      campo_id:       data.campo_id,
      comprobante_id: comprobante.id,
      campania_id:    data.campania_id ?? null,
      fecha:          data.fecha,
      categoria:      data.categoria,
      descripcion:    data.descripcion,
      proveedor_id:   data.proveedor_id ?? null,
      monto_ars:      data.monto_ars,
      usuario_id:     user.id,
    });

  if (errCosto) return { error: errCosto.message };

  revalidatePath('/app/costos-campo');
  revalidatePath('/app/reportes/margenes');
  return { comprobanteNumero: numero };
}

export async function eliminarCostoIndirectoCampo(
  costoId: string,
  comprobanteId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error: errCosto } = await supabase
    .from('costos_indirectos_campo')
    .delete()
    .eq('id', costoId);
  if (errCosto) return { error: errCosto.message };

  await supabase.from('comprobantes_internos').delete().eq('id', comprobanteId);

  revalidatePath('/app/costos-campo');
  revalidatePath('/app/reportes/margenes');
  return {};
}

// ─── Costo Indirecto de Empresa ───────────────────────────────────────────────

export interface CostoIndirectoEmpresaData {
  campania_id?: string;
  fecha: string;
  categoria: 'administrativo' | 'contable' | 'bancario' | 'seguro' | 'alquiler' | 'personal_admin' | 'otros';
  descripcion: string;
  proveedor_id?: string;
  monto_ars: number;
}

export async function crearCostoIndirectoEmpresa(
  data: CostoIndirectoEmpresaData,
): Promise<{ error?: string; comprobanteNumero?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const empresaData = await getEmpresaActiva();
  if (!empresaData) return { error: 'No hay empresa activa' };
  const { empresa } = empresaData;

  let proveedorNombre: string | null = null;
  if (data.proveedor_id) {
    const { data: prov } = await supabase
      .from('proveedores')
      .select('nombre')
      .eq('id', data.proveedor_id)
      .single();
    proveedorNombre = prov?.nombre ?? null;
  }

  const numero = await generarNumeroComprobante(supabase, empresa.id);

  const datosJson = {
    tipo: 'costo_empresa',
    campania_id: data.campania_id ?? null,
    fecha: data.fecha,
    categoria: data.categoria,
    descripcion: data.descripcion,
    proveedor_nombre: proveedorNombre,
    monto_ars: data.monto_ars,
    empresa_nombre: empresa.nombre,
  };

  const { data: comprobante, error: errCI } = await supabase
    .from('comprobantes_internos')
    .insert({
      empresa_id:     empresa.id,
      numero,
      tipo:           'costo_empresa',
      fecha:          data.fecha,
      usuario_id:     user.id,
      descripcion:    data.descripcion,
      monto_ars:      data.monto_ars,
      datos_json:     datosJson,
    })
    .select('id')
    .single();

  if (errCI || !comprobante) return { error: errCI?.message ?? 'Error al crear comprobante' };

  const { error: errCosto } = await supabase
    .from('costos_indirectos_empresa')
    .insert({
      empresa_id:     empresa.id,
      comprobante_id: comprobante.id,
      campania_id:    data.campania_id ?? null,
      fecha:          data.fecha,
      categoria:      data.categoria,
      descripcion:    data.descripcion,
      proveedor_id:   data.proveedor_id ?? null,
      monto_ars:      data.monto_ars,
      usuario_id:     user.id,
    });

  if (errCosto) return { error: errCosto.message };

  revalidatePath('/app/costos-empresa');
  revalidatePath('/app/reportes/margenes');
  return { comprobanteNumero: numero };
}

export async function eliminarCostoIndirectoEmpresa(
  costoId: string,
  comprobanteId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error: errCosto } = await supabase
    .from('costos_indirectos_empresa')
    .delete()
    .eq('id', costoId);
  if (errCosto) return { error: errCosto.message };

  await supabase.from('comprobantes_internos').delete().eq('id', comprobanteId);

  revalidatePath('/app/costos-empresa');
  revalidatePath('/app/reportes/margenes');
  return {};
}
