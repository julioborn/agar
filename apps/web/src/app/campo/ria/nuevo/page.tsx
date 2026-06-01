import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
    { data: proveedores },
    { data: tiposLabor },
  ] = await Promise.all([
    supabase
      .from('lotes')
      .select('id, nombre, hectareas, campo:campos!inner(id, nombre, empresa_id)')
      .eq('campo.empresa_id', empresa.id)
      .order('nombre'),
    supabase.from('depositos').select('id, nombre, tipo').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('productos').select('id, nombre, categoria, unidad_base').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('campanias').select('id, nombre').eq('empresa_id', empresa.id).eq('activa', true).order('nombre'),
    supabase.from('proveedores').select('id, nombre').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('tipos_labor').select('id, nombre').eq('empresa_id', empresa.id).order('nombre'),
  ]);

  const lotes = (lotesRaw ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    hectareas: l.hectareas ?? 0,
    campo: l.campo ?? null,
    cultivo_activo: undefined as string | undefined,
  }));

  if (lotes.length > 0) {
    const { data: cultivosActivos } = await supabase
      .from('cultivos')
      .select('lote_id, cultivo')
      .in('lote_id', lotes.map((l) => l.id))
      .in('estado', ['planificada', 'en_curso'])
      .order('fecha_siembra', { ascending: false });

    if (cultivosActivos) {
      const map = new Map<string, string>();
      for (const c of cultivosActivos) {
        if (!map.has(c.lote_id)) map.set(c.lote_id, c.cultivo);
      }
      for (const l of lotes) l.cultivo_activo = map.get(l.id);
    }
  }

  return (
    <div className="py-4">
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
        basePath="/campo/ria"
      />
    </div>
  );
}
