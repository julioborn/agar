import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import AppShell from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa, rol, esSuperAdmin, todasLasEmpresas } = empresaData;

  if (rol === 'encargado_campo') redirect('/campo');

  return (
    <AppShell
      userEmail={user.email ?? ''}
      empresaActiva={empresa}
      todasLasEmpresas={todasLasEmpresas}
      esSuperAdmin={esSuperAdmin}
      esAdmin={rol === 'admin_empresa'}
    >
      {children}
    </AppShell>
  );
}
