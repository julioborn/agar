import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

// La raíz siempre redirige: si hay sesión va al app, si no al login.
// Esto es especialmente importante para la PWA instalada en mobile.
export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { rol, todasLasEmpresas } = empresaData;
  const tieneRolAdmin = todasLasEmpresas.some(
    (e) => e.rol === 'super_admin' || e.rol === 'admin_empresa' || e.rol === 'contador',
  );

  if (rol === 'encargado_campo' && !tieneRolAdmin) redirect('/campo');
  redirect('/app');
}
