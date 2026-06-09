import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { createClient } from '@/lib/supabase/server';

// Ruta de uso único — crear usuario toto@agar.com
// Solo funciona si hay una sesión de admin activa

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const empresaData = await getEmpresaActiva();
    if (!empresaData) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 401 });

    const { rol, empresa } = empresaData;
    if (rol !== 'admin_empresa' && rol !== 'super_admin') {
      return NextResponse.json({ error: 'Sin permisos de admin' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const email    = 'toto@agar.com';
    const password = 'toto123campo';

    // Crear o actualizar el usuario
    const { data: lista } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existente = lista?.users?.find((u) => u.email === email);

    let usuarioId: string;

    if (existente) {
      usuarioId = existente.id;
      await adminClient.auth.admin.updateUserById(usuarioId, { password, email_confirm: true });
    } else {
      const { data: nuevo, error } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error || !nuevo?.user) return NextResponse.json({ error: error?.message ?? 'No se pudo crear' }, { status: 500 });
      usuarioId = nuevo.user.id;
    }

    // Vincular a la empresa con rol contador
    const { error: errVinc } = await adminClient
      .from('usuarios_empresas')
      .upsert(
        { usuario_id: usuarioId, empresa_id: empresa.id, rol: 'contador' },
        { onConflict: 'usuario_id,empresa_id' },
      );

    if (errVinc) return NextResponse.json({ error: errVinc.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      mensaje: 'Usuario creado / actualizado',
      email,
      rol: 'contador',
      empresa: empresa.nombre,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
