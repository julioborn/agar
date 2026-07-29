import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import RemitoGanaderoForm from '../remito-ganadero-form';

export default async function NuevoRemitoGanaderoPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: lotesHaciendaRaw }, { data: depositos }, { data: productos }] = await Promise.all([
    supabase
      .from('lotes_hacienda')
      .select(`
        id, nombre, estado,
        corral:corrales(nombre, lote:lotes(nombre, campo:campos(nombre))),
        potrero:potreros(nombre, lote:lotes(nombre, campo:campos(nombre)))
      `)
      .eq('empresa_id', empresa.id)
      .eq('estado', 'activo')
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

  return (
    <div className="p-6">
      <RemitoGanaderoForm
        mode="nuevo"
        lotesHacienda={lotesHacienda}
        depositos={depositos ?? []}
        productos={(productos as any) ?? []}
        empresaId={empresa.id}
      />
    </div>
  );
}
