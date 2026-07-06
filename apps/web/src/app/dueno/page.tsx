import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import DuenoDashboard from './dashboard';

export default async function DuenoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa, rol } = empresaData;
  if (rol !== 'dueno') redirect('/app');

  const [camposRes, cultivosRes, ciCampoRes, ciEmpresaRes, campaniaRes] = await Promise.all([
    supabase
      .from('campos')
      .select('id, nombre, hectareas_totales, lotes(id, nombre, hectareas, coordenadas)')
      .eq('empresa_id', empresa.id)
      .order('nombre'),

    // Los cultivos se filtran via lotes → campos → empresa_id gracias a RLS
    supabase
      .from('cultivos')
      .select('id, cultivo, estado, campania_id, lote:lotes!inner(id, nombre, campo_id)'),

    supabase
      .from('costos_indirectos_campo')
      .select('monto_ars')
      .eq('empresa_id', empresa.id),

    supabase
      .from('costos_indirectos_empresa')
      .select('monto_ars')
      .eq('empresa_id', empresa.id),

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  const campos = (camposRes.data ?? []) as any[];
  const cultivos = (cultivosRes.data ?? []) as any[];

  const haTotal = campos.reduce((acc, c) => acc + Number(c.hectareas_totales ?? 0), 0);
  const costoTotalCI =
    (ciCampoRes.data ?? []).reduce((acc: number, c: any) => acc + Number(c.monto_ars), 0) +
    (ciEmpresaRes.data ?? []).reduce((acc: number, c: any) => acc + Number(c.monto_ars), 0);

  const camposParaMapa = campos.map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    lotes: (Array.isArray(c.lotes) ? c.lotes : []).map((l: any) => ({
      id: l.id,
      nombre: l.nombre,
      hectareas: l.hectareas ?? 0,
      coordenadas: l.coordenadas ?? null,
    })),
  }));

  const camposStats = campos.map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    hectareas: Number(c.hectareas_totales ?? 0),
  }));

  return (
    <DuenoDashboard
      empresaNombre={empresa.nombre}
      haTotal={haTotal}
      costoTotalCI={costoTotalCI}
      campos={camposParaMapa}
      camposStats={camposStats}
      cultivos={cultivos}
      campanias={campaniaRes.data ?? []}
    />
  );
}
