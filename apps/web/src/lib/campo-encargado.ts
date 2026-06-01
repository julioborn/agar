import { createClient } from '@/lib/supabase/server';

export interface CampoEncargadoResult {
  usuarioId: string;
  email: string;
  empresaId: string;
  empresaNombre: string;
  campoId: string | null;
  campoNombre: string | null;
  campoHectareas: number | null;
  rol: string;
}

export async function getCampoEncargado(): Promise<CampoEncargadoResult | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('usuarios_empresas')
    .select(`
      rol, empresa_id, campo_id_asignado,
      empresa:empresas(id, nombre),
      campo:campos(id, nombre, hectareas_totales)
    `)
    .eq('usuario_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const emp = data.empresa as any;
  const campo = data.campo as any;

  return {
    usuarioId: user.id,
    email: user.email ?? '',
    empresaId: emp?.id ?? data.empresa_id,
    empresaNombre: emp?.nombre ?? '',
    campoId: campo?.id ?? data.campo_id_asignado ?? null,
    campoNombre: campo?.nombre ?? null,
    campoHectareas: campo?.hectareas_totales ?? null,
    rol: data.rol,
  };
}
