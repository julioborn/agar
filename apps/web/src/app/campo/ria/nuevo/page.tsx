import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import RiaForm from '@/app/app/ria/ria-form';

export default async function CampoRiaNuevoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [
    { data: lotesRaw },
    { data: depositos },
    { data: productos },
    { data: campanias },
    { data: contratistas },
    { data: tiposLabor },
    { data: cultivosActivos },
    { data: tiposCultivo },
  ] = await Promise.all([
    supabase
      .from('lotes')
      .select('id, nombre, hectareas, campo:campos!inner(id, nombre, empresa_id)')
      .eq('campo.empresa_id', empresa.id)
      .order('nombre'),
    supabase.from('depositos').select('id, nombre, tipo').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('productos').select('id, nombre, categoria, unidad_base').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('campanias').select('id, nombre').eq('empresa_id', empresa.id).eq('activa', true).order('nombre'),
    supabase.from('contratistas').select('id, nombre').eq('empresa_id', empresa.id).eq('activo', true).order('nombre'),
    supabase.from('tipos_labor').select('id, nombre').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('cultivos').select('id, cultivo, lote_id, estado').in('estado', ['planificada', 'en_curso']).order('cultivo'),
    createAdminClient().from('tipos_cultivo').select('id, nombre').eq('empresa_id', empresa.id).order('nombre'),
  ]);

  // Enriquecer lotes con cultivo activo para auto-fill
  const cultivoMap = new Map<string, string>();
  for (const c of cultivosActivos ?? []) {
    if (!cultivoMap.has(c.lote_id)) cultivoMap.set(c.lote_id, c.cultivo);
  }
  const lotes = (lotesRaw ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    hectareas: l.hectareas ?? 0,
    campo: l.campo ?? null,
    cultivo_activo: cultivoMap.get(l.id),
  }));

  return (
    <div className="py-4">
      <RiaForm
        mode="nuevo"
        lotes={lotes}
        depositos={depositos ?? []}
        productos={productos ?? []}
        campanias={campanias ?? []}
        proveedores={[]}
        contratistas={contratistas ?? []}
        tiposLabor={tiposLabor ?? []}
        cultivosActivos={cultivosActivos ?? []}
        tiposCultivo={tiposCultivo ?? []}
        empresaId={empresa.id}
        empresaNombre={empresa.nombre}
        usuarioId={user.id}
        basePath="/campo/ria"
      />
    </div>
  );
}
