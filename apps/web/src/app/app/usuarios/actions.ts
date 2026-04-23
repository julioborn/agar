'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmpresaActiva } from '@/lib/empresa-actual';

type RolUsuario = 'super_admin' | 'admin_empresa' | 'contador' | 'encargado_campo';

async function assertAdmin() {
  const empresaData = await getEmpresaActiva();
  if (!empresaData) throw new Error('Sin sesión');
  const { rol, empresa } = empresaData;
  if (rol !== 'admin_empresa' && rol !== 'super_admin') throw new Error('Sin permisos');
  return { empresa, rol };
}

/** Crea el usuario con email + contraseña directamente, sin necesitar email de confirmación */
export async function crearUsuario(
  email: string,
  password: string,
  rolNuevo: RolUsuario,
): Promise<{ error?: string }> {
  try {
    const { empresa } = await assertAdmin();
    const adminClient = createAdminClient();

    // Verificar si el usuario ya existe
    const { data: lista } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existente = lista?.users?.find((u) => u.email === email);

    let usuarioId: string;

    if (existente) {
      // Ya existe: aseguramos que tenga el email confirmado y actualizamos contraseña
      usuarioId = existente.id;
      await adminClient.auth.admin.updateUserById(usuarioId, {
        password,
        email_confirm: true,
      });
    } else {
      // Crear usuario nuevo con contraseña
      const { data: nuevo, error: errCreate } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (errCreate || !nuevo?.user) {
        return { error: errCreate?.message ?? 'No se pudo crear el usuario.' };
      }
      usuarioId = nuevo.user.id;

      // Forzar confirmación de email independientemente de la config del proyecto
      await adminClient.auth.admin.updateUserById(usuarioId, {
        email_confirm: true,
      });
    }

    // Vincular a la empresa (upsert para no fallar si ya estaba)
    const { error: errVinc } = await adminClient
      .from('usuarios_empresas')
      .upsert(
        { usuario_id: usuarioId, empresa_id: empresa.id, rol: rolNuevo },
        { onConflict: 'usuario_id,empresa_id' }
      );

    if (errVinc) return { error: errVinc.message };

    revalidatePath('/app/usuarios');
    return {};
  } catch (e: any) {
    return { error: e.message ?? 'Error inesperado' };
  }
}

export async function actualizarRol(
  usuarioId: string,
  rolNuevo: RolUsuario,
): Promise<{ error?: string }> {
  try {
    const { empresa } = await assertAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from('usuarios_empresas')
      .update({ rol: rolNuevo })
      .eq('usuario_id', usuarioId)
      .eq('empresa_id', empresa.id);

    if (error) return { error: error.message };
    revalidatePath('/app/usuarios');
    return {};
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function eliminarUsuario(usuarioId: string): Promise<{ error?: string }> {
  try {
    const { empresa } = await assertAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from('usuarios_empresas')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('empresa_id', empresa.id);

    if (error) return { error: error.message };
    revalidatePath('/app/usuarios');
    return {};
  } catch (e: any) {
    return { error: e.message };
  }
}
