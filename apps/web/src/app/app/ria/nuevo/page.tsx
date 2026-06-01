import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect } from 'next/navigation';
import RiaForm from '../ria-form';

export default async function NuevoRiaPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: lotesRaw },
    { data: depositos },
    { data: productos },
    { data: campanias },
    { data: proveedores },
    { data: tiposLabor },
  ] = await Promise.all([
    supabase
      .from('lotes')
      .select(`
        id, nombre, hectareas,
        campo:campos!inner(id, nombre, empresa_id)
      `)
      .eq('campo.empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('depositos')
      .select('id, nombre, tipo')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('productos')
      .select('id, nombre, categoria, unidad_base')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .eq('activa', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('tipos_labor')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  // Enriquecer lotes con cultivo activo
  const lotes = (lotesRaw ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    hectareas: l.hectareas ?? 0,
    campo: l.campo ?? null,
    cultivo_activo: undefined as string | undefined,
  }));

  // Intentar obtener cultivos activos para pre-rellenar
  const loteIds = lotes.map((l) => l.id);
  if (loteIds.length > 0) {
    const { data: cultivosActivos } = await supabase
      .from('cultivos')
      .select('lote_id, cultivo')
      .in('lote_id', loteIds)
      .in('estado', ['planificada', 'en_curso'])
      .order('fecha_siembra', { ascending: false });

    if (cultivosActivos) {
      const cultivoMap = new Map<string, string>();
      for (const c of cultivosActivos) {
        if (!cultivoMap.has(c.lote_id)) cultivoMap.set(c.lote_id, c.cultivo);
      }
      for (const l of lotes) {
        l.cultivo_activo = cultivoMap.get(l.id);
      }
    }
  }

  return (
    <div className="p-6">
      <RiaForm
        mode="nuevo"
        lotes={lotes}
        depositos={depositos ?? []}
        productos={productos ?? []}
        campanias={campanias ?? []}
        proveedores={proveedores ?? []}
        tiposLabor={tiposLabor ?? []}
        empresaId={empresa.id}
        empresaNombre={empresa.nombre}
        usuarioId={user.id}
      />
    </div>
  );
}
