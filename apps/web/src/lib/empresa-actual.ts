import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export interface EmpresaConRol {
  id: string;
  nombre: string;
  cuit: string;
  moneda_base: string;
  rol: string;
  logo_url?: string;
}

export interface EmpresaActivaResult {
  empresa: EmpresaConRol;
  rol: string;
  esSuperAdmin: boolean;
  todasLasEmpresas: EmpresaConRol[];
}

type VinculacionRow = {
  rol: string;
  empresa: {
    id: string;
    nombre: string;
    cuit: string;
    moneda_base: string;
    logo_url?: string;
  } | null;
};

export async function getEmpresaActiva(): Promise<EmpresaActivaResult | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // El .eq es necesario: para super_admin la política RLS devuelve TODAS las
  // filas de usuarios_empresas, pero acá solo queremos las del usuario actual.
  const { data } = await supabase
    .from('usuarios_empresas')
    .select('rol, empresa:empresas(id, nombre, cuit, moneda_base, logo_url)')
    .eq('usuario_id', user.id);

  const vinculaciones = (data ?? []) as unknown as VinculacionRow[];
  const todasLasEmpresas: EmpresaConRol[] = vinculaciones
    .filter((v) => v.empresa !== null)
    .map((v) => ({ ...(v.empresa as EmpresaConRol), rol: v.rol }));

  if (todasLasEmpresas.length === 0) return null;

  const cookieStore = await cookies();
  const empresaActivaId = cookieStore.get('agro_empresa_id')?.value;

  const empresa =
    todasLasEmpresas.find((e) => e.id === empresaActivaId) ?? todasLasEmpresas[0];

  const esSuperAdmin = todasLasEmpresas.some((e) => e.rol === 'super_admin');

  return { empresa, rol: empresa.rol, esSuperAdmin, todasLasEmpresas };
}
