import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import AppShell from '@/components/app-shell';

async function fetchUsdRate(empresaId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('configuracion_empresa')
    .select('cotizacion_usd')
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (data?.cotizacion_usd) return data.cotizacion_usd;

  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', { next: { revalidate: 3600 } });
    if (res.ok) {
      const d = await res.json();
      return (d as any).venta ?? null;
    }
  } catch {}

  return null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa, rol, esSuperAdmin, todasLasEmpresas } = empresaData;

  if (rol === 'encargado_campo') redirect('/campo');

  const usdRate = await fetchUsdRate(empresa.id);

  return (
    <AppShell
      userEmail={user.email ?? ''}
      empresaActiva={empresa}
      todasLasEmpresas={todasLasEmpresas}
      esSuperAdmin={esSuperAdmin}
      esAdmin={rol === 'admin_empresa'}
      usdRate={usdRate}
    >
      {children}
    </AppShell>
  );
}
