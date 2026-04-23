import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Users } from 'lucide-react';
import UsuariosManager, { type UsuarioRow } from './usuarios-manager';

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { rol, empresa } = empresaData;
  if (rol !== 'admin_empresa' && rol !== 'super_admin') redirect('/app');

  const { data: vinculaciones } = await supabase
    .from('usuarios_empresas')
    .select('usuario_id, rol')
    .eq('empresa_id', empresa.id);

  const adminClient = createAdminClient();
  const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const authMap = Object.fromEntries(
    (authData?.users ?? []).map((u) => [u.id, { email: u.email ?? '', confirmado: !!u.confirmed_at }])
  );

  const usuarios: UsuarioRow[] = (vinculaciones ?? []).map((v: any) => ({
    usuario_id: v.usuario_id,
    email:      authMap[v.usuario_id]?.email ?? '(sin email)',
    rol:        v.rol,
    confirmado: authMap[v.usuario_id]?.confirmado ?? false,
  }));

  const total = usuarios.length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Usuarios</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · {total} usuario{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <UsuariosManager usuarios={usuarios} miUsuarioId={user.id} />
    </div>
  );
}
