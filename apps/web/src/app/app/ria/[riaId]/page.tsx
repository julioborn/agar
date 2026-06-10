import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect, notFound } from 'next/navigation';
import RiaForm from '../ria-form';

interface Props {
  params: Promise<{ riaId: string }>;
}

export default async function RiaDetailPage({ params }: Props) {
  const { riaId } = await params;

  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Cargar el RIA con sus líneas
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
      .select(`
        id, deposito_id, producto_id, cantidad, dosis_por_ha,
        costo_unitario, subtotal, observaciones,
        producto:productos(nombre, unidad_base)
      `)
      .eq('remito_id', riaId),
    supabase
      .from('remitos_labores')
      .select('*')
      .eq('remito_id', riaId),
    supabase
      .from('remitos_produccion')
      .select(`
        id, producto_id, deposito_ingreso_id, cantidad,
        humedad_porcentaje, calidad_categoria, precio_referencia,
        subtotal_valor, observaciones,
        producto:productos(nombre, unidad_base)
      `)
      .eq('remito_id', riaId),
    supabase
      .from('lotes')
      .select(`id, nombre, hectareas, campo:campos!inner(id, nombre, empresa_id)`)
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
      .order('nombre'),
    supabase
      .from('contratistas')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('tipos_labor')
      .select('id, nombre, uta_equivalencia')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('cultivos')
      .select('id, cultivo, lote_id, estado')
      .in('estado', ['planificada', 'en_curso'])
      .order('cultivo'),
  ]);

  const { data: config } = await supabase
    .from('configuracion_empresa')
    .select('precio_combustible, litros_por_uta')
    .eq('empresa_id', empresa.id)
    .maybeSingle();

  // Construir lotes con cultivo activo
  const lotes = (lotesRaw ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    hectareas: l.hectareas ?? 0,
    campo: l.campo ?? null,
    cultivo_activo: undefined as string | undefined,
  }));

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

  // Armar el riaExistente con sus líneas
  const riaExistente = {
    id: ria.id,
    numero_ria: ria.numero_ria,
    fecha: ria.fecha,
    estado: ria.estado,
    lote_id: ria.lote_id,
    campania_id: ria.campania_id ?? undefined,
    cultivo_id: ria.cultivo_id ?? undefined,
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

  // Modo: editar si está en borrador, ver si está confirmado/anulado
  const mode = ria.estado === 'borrador' ? 'editar' : 'ver';

  return (
    <div className="p-6">
      <RiaForm
        mode={mode}
        lotes={lotes}
        depositos={depositos ?? []}
        productos={productos ?? []}
        campanias={campanias ?? []}
        proveedores={[]}
        contratistas={contratistas ?? []}
        tiposLabor={(tiposLabor as any) ?? []}
        cultivosActivos={cultivosActivos ?? []}
        empresaId={empresa.id}
        empresaNombre={empresa.nombre}
        usuarioId={user.id}
        riaExistente={riaExistente}
        precioGasoil={config?.precio_combustible ?? 0}
        litrosPorUta={config?.litros_por_uta ?? 35}
      />
    </div>
  );
}
