import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import AppShell from '@/components/app-shell';
import type { TickerData } from '@/components/price-ticker';
import { fetchPreciosPizarra } from '@/lib/precios-pizarra';

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

async function fetchTickerExtras(empresaId: string): Promise<Omit<TickerData, 'dolar'>> {
  const supabase = await createClient();
  const [maizR, sorgoR, sojaR, configR, bcr] = await Promise.all([
    supabase.from('referencias_precio').select('valor').eq('empresa_id', empresaId).eq('tipo', 'maiz').order('vigencia_desde', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('referencias_precio').select('valor').eq('empresa_id', empresaId).eq('tipo', 'sorgo').order('vigencia_desde', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('referencias_precio').select('valor').eq('empresa_id', empresaId).eq('tipo', 'soja').order('vigencia_desde', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('configuracion_empresa').select('precio_combustible, litros_por_uta').eq('empresa_id', empresaId).maybeSingle(),
    fetchPreciosPizarra(),
  ]);
  const gasoil = configR.data?.precio_combustible ?? null;
  const litros = configR.data?.litros_por_uta ?? null;
  // BCR en vivo tiene prioridad: la DB puede tener un registro viejo (no necesariamente de hoy).
  return {
    maiz:   bcr?.maiz  ?? maizR.data?.valor  ?? null,
    sorgo:  bcr?.sorgo ?? sorgoR.data?.valor ?? null,
    soja:   bcr?.soja  ?? sojaR.data?.valor  ?? null,
    gasoil,
    uta: gasoil && litros ? gasoil * litros : null,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa, rol, esSuperAdmin, todasLasEmpresas } = empresaData;

  // Dueño → dashboard visual dedicado (sin acceso a operaciones)
  if (rol === 'dueno') redirect('/dueno');

  // Lector → bloquear rutas de escritura/gestión por URL directa
  if (rol === 'lector') {
    const heads = await headers();
    const pathname = heads.get('x-pathname') ?? '';
    const LECTOR_BLOQUEADAS = [
      '/app/campanias', '/app/maquinarias', '/app/depositos',
      '/app/proveedores', '/app/productos', '/app/compras',
      '/app/stock', '/app/referencias-precio', '/app/valuacion',
      '/app/unidades-negocio', '/app/configuracion',
      '/app/usuarios', '/app/empresas',
    ];
    const bloqueada = LECTOR_BLOQUEADAS.some(
      (p) => pathname === p || pathname.startsWith(p + '/'),
    );
    // RIA: bloquear lista y detalle individual, pero NO /app/ria/reportes
    const riaBlockeada =
      pathname === '/app/ria' ||
      (pathname.startsWith('/app/ria/') && !pathname.startsWith('/app/ria/reportes'));
    if (bloqueada || riaBlockeada) redirect('/app');
  }

  // Solo redirigir al campo si el usuario NO tiene ningún rol administrativo en ninguna empresa
  const tieneRolAdmin = todasLasEmpresas.some(
    (e) => e.rol === 'super_admin' || e.rol === 'admin_empresa' || e.rol === 'contador',
  );
  if (rol === 'encargado_campo' && !tieneRolAdmin) redirect('/campo');

  const [usdRate, tickerExtras] = await Promise.all([
    fetchUsdRate(empresa.id),
    fetchTickerExtras(empresa.id),
  ]);

  const tickerData: TickerData = { dolar: usdRate, ...tickerExtras };

  return (
    <AppShell
      userEmail={user.email ?? ''}
      empresaActiva={empresa}
      todasLasEmpresas={todasLasEmpresas}
      esSuperAdmin={esSuperAdmin}
      esAdmin={rol === 'admin_empresa'}
      esLector={rol === 'lector'}
      esContador={rol === 'contador'}
      usdRate={usdRate}
      tickerData={tickerData}
    >
      {children}
    </AppShell>
  );
}
