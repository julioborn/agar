import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import RemitoGanaderoForm from '../remito-ganadero-form';

interface Props {
  params: Promise<{ remitoId: string }>;
}

export default async function RemitoGanaderoDetallePage({ params }: Props) {
  const { remitoId } = await params;

  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: remito } = await supabase
    .from('remitos_ganaderos')
    .select('*')
    .eq('id', remitoId)
    .eq('empresa_id', empresa.id)
    .maybeSingle();

  if (!remito) notFound();

  const [
    { data: insumosRaw },
    { data: lotesHaciendaRaw },
    { data: depositos },
    { data: productos },
  ] = await Promise.all([
    supabase
      .from('remitos_ganaderos_insumos')
      .select('id, deposito_id, producto_id, cantidad, costo_unitario, subtotal, observaciones, producto:productos(nombre, unidad_base)')
      .eq('remito_id', remitoId),
    supabase
      .from('lotes_hacienda')
      .select(`
        id, nombre, estado,
        corral:corrales(nombre, lote:lotes(nombre, campo:campos(nombre))),
        potrero:potreros(nombre, lote:lotes(nombre, campo:campos(nombre)))
      `)
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase.from('depositos').select('id, nombre, tipo').eq('empresa_id', empresa.id).order('nombre'),
    supabase.from('productos').select('id, nombre, categoria, unidad_base, rubro').eq('empresa_id', empresa.id).order('nombre'),
  ]);

  const lotesHacienda = (lotesHaciendaRaw ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    ubicacion: l.corral
      ? `${l.corral.lote?.campo?.nombre ?? '—'} › ${l.corral.lote?.nombre ?? '—'} › Corral ${l.corral.nombre}`
      : l.potrero
        ? `${l.potrero.lote?.campo?.nombre ?? '—'} › ${l.potrero.lote?.nombre ?? '—'} › Potrero ${l.potrero.nombre}`
        : 'Sin ubicación',
  }));

  const remitoExistente = {
    id: remito.id,
    numero_rig: remito.numero_rig,
    fecha: remito.fecha,
    estado: remito.estado,
    lote_hacienda_id: remito.lote_hacienda_id,
    observaciones: remito.observaciones ?? undefined,
    total_insumos: remito.total_insumos,
    insumos: (insumosRaw ?? []).map((i: any) => ({
      id: i.id,
      depositoId: i.deposito_id,
      productoId: i.producto_id,
      productoNombre: i.producto?.nombre ?? '',
      unidadBase: i.producto?.unidad_base ?? '',
      cantidad: i.cantidad,
      costoUnitario: i.costo_unitario,
      subtotal: i.subtotal,
      obs: i.observaciones ?? undefined,
    })),
  };

  const mode = remito.estado === 'borrador' ? 'editar' : 'ver';

  return (
    <div className="p-6">
      <RemitoGanaderoForm
        mode={mode}
        lotesHacienda={lotesHacienda}
        depositos={depositos ?? []}
        productos={(productos as any) ?? []}
        empresaId={empresa.id}
        remitoExistente={remitoExistente}
      />
    </div>
  );
}
