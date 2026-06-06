import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import RiaForm from '@/app/app/ria/ria-form';

interface Props {
  params: Promise<{ riaId: string }>;
}

export default async function CampoRiaDetailPage({ params }: Props) {
  const { riaId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const { data: ria } = await supabase
    .from('remitos_internos')
    .select('*')
    .eq('id', riaId)
    .eq('empresa_id', empresa.id)
    .maybeSingle();

  if (!ria) notFound();

  const [
    { data: insumosRaw },
    { data: laboresRaw },
    { data: produccionRaw },
    { data: lotesRaw },
    { data: depositos },
    { data: productos },
    { data: campanias },
    { data: contratistas },
    { data: tiposLabor },
    { data: cultivosActivos },
  ] = await Promise.all([
    supabase
      .from('remitos_insumos')
      .select('id, deposito_id, producto_id, cantidad, dosis_por_ha, costo_unitario, subtotal, observaciones, producto:productos(nombre, unidad_base)')
      .eq('remito_id', riaId),
    supabase.from('remitos_labores').select('*').eq('remito_id', riaId),
    supabase
      .from('remitos_produccion')
      .select('id, producto_id, deposito_ingreso_id, cantidad, humedad_porcentaje, calidad_categoria, precio_referencia, subtotal_valor, observaciones, producto:productos(nombre, unidad_base)')
      .eq('remito_id', riaId),
    supabase
      .from('lotes')
      .select('id, nombre, hectareas, campo:campos!inner(id, nombre, empresa_id)')
      .eq('campo.empresa_id', empresa.id)
      .order('nombre'),
    supabase.from('depositos').select('id, nombre, tipo').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('productos').select('id, nombre, categoria, unidad_base').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('campanias').select('id, nombre').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('contratistas').select('id, nombre').eq('empresa_id', empresa.id).eq('activo', true).order('nombre'),
    supabase.from('tipos_labor').select('id, nombre').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('cultivos').select('id, cultivo, lote_id, estado').in('estado', ['planificada', 'en_curso']).order('cultivo'),
  ]);

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

  const riaExistente = {
    id: ria.id,
    numero_ria: ria.numero_ria,
    fecha: ria.fecha,
    estado: ria.estado,
    lote_id: ria.lote_id,
    campania_id: ria.campania_id ?? undefined,
    superficie_afectada: ria.superficie_afectada ?? undefined,
    cultivo_descripcion: ria.cultivo_descripcion ?? undefined,
    observaciones: ria.observaciones ?? undefined,
    total_insumos: ria.total_insumos,
    total_labores: ria.total_labores,
    total_ria: ria.total_ria,
    costo_por_ha: ria.costo_por_ha ?? undefined,
    insumos: (insumosRaw ?? []).map((i: any) => ({
      id: i.id,
      depositoId: i.deposito_id,
      productoId: i.producto_id,
      productoNombre: i.producto?.nombre ?? '',
      unidadBase: i.producto?.unidad_base ?? '',
      cantidad: i.cantidad,
      dosisPorHa: i.dosis_por_ha ?? undefined,
      costoUnitario: i.costo_unitario,
      subtotal: i.subtotal,
      obs: i.observaciones ?? undefined,
    })),
    labores: (laboresRaw ?? []).map((l: any) => ({
      id: l.id,
      tipoLaborId: l.tipo_labor_id ?? undefined,
      tipoLaborNombre: l.tipo_labor_nombre ?? undefined,
      descripcion: l.descripcion,
      prestadorId: l.prestador_id ?? undefined,
      prestadorNombre: l.prestador_nombre ?? undefined,
      unidadMedida: l.unidad_medida,
      cantidad: l.cantidad,
      tarifa: l.tarifa,
      subtotal: l.subtotal,
      fechaEjecucion: l.fecha_ejecucion ?? undefined,
      obs: l.observaciones ?? undefined,
    })),
    produccion: (produccionRaw ?? []).map((p: any) => ({
      id: p.id,
      productoId: p.producto_id,
      productoNombre: p.producto?.nombre ?? '',
      unidadBase: p.producto?.unidad_base ?? '',
      depositoIngresoId: p.deposito_ingreso_id,
      cantidad: p.cantidad,
      humedadPorcentaje: p.humedad_porcentaje ?? undefined,
      calidadCategoria: p.calidad_categoria ?? undefined,
      precioReferencia: p.precio_referencia ?? undefined,
      obs: p.observaciones ?? undefined,
    })),
  };

  const mode = ria.estado === 'borrador' ? 'editar' : 'ver';

  return (
    <div className="py-4">
      <RiaForm
        mode={mode}
        lotes={lotes}
        depositos={depositos ?? []}
        productos={productos ?? []}
        campanias={campanias ?? []}
        proveedores={[]}
        contratistas={contratistas ?? []}
        tiposLabor={tiposLabor ?? []}
        cultivosActivos={cultivosActivos ?? []}
        empresaId={empresa.id}
        empresaNombre={empresa.nombre}
        usuarioId={user.id}
        riaExistente={riaExistente}
        basePath="/campo/ria"
      />
    </div>
  );
}
