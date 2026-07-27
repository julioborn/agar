import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Beef } from 'lucide-react';
import LotesHaciendaManager from './lotes-hacienda-manager';

export default async function LotesHaciendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [
    { data: corralesRaw },
    { data: potrerosRaw },
    { data: categorias },
    { data: lotesHaciendaRaw },
  ] = await Promise.all([
    supabase
      .from('corrales')
      .select('id, nombre, lote:lotes(id, nombre, campo:campos(nombre))')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('potreros')
      .select('id, nombre, lote:lotes(id, nombre, campo:campos(nombre))')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('categorias_hacienda')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('orden'),
    supabase
      .from('lotes_hacienda')
      .select(`
        id, nombre, etapa_productiva, origen, fecha_ingreso, estado, peso_promedio_ingreso_kg,
        categoria:categorias_hacienda(nombre),
        corral:corrales(nombre, lote:lotes(nombre, campo:campos(nombre))),
        potrero:potreros(nombre, lote:lotes(nombre, campo:campos(nombre))),
        animales(count)
      `)
      .eq('empresa_id', empresa.id)
      .order('fecha_ingreso', { ascending: false }),
  ]);

  const corrales = (corralesRaw ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    loteNombre: c.lote?.nombre ?? '—',
    campoNombre: c.lote?.campo?.nombre ?? '—',
  }));
  const potreros = (potrerosRaw ?? []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    loteNombre: p.lote?.nombre ?? '—',
    campoNombre: p.lote?.campo?.nombre ?? '—',
  }));

  const lotesHacienda = (lotesHaciendaRaw ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    etapaProductiva: l.etapa_productiva,
    origen: l.origen,
    fechaIngreso: l.fecha_ingreso,
    estado: l.estado,
    pesoPromedioIngresoKg: l.peso_promedio_ingreso_kg,
    categoriaNombre: l.categoria?.nombre ?? '—',
    ubicacion: l.corral
      ? `${l.corral.lote?.campo?.nombre ?? '—'} › ${l.corral.lote?.nombre ?? '—'} › Corral ${l.corral.nombre}`
      : l.potrero
        ? `${l.potrero.lote?.campo?.nombre ?? '—'} › ${l.potrero.lote?.nombre ?? '—'} › Potrero ${l.potrero.nombre}`
        : 'Sin ubicación',
    cantidadAnimales: l.animales?.[0]?.count ?? 0,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Beef className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Lotes de Hacienda</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · {lotesHacienda.length} lote{lotesHacienda.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <LotesHaciendaManager
        lotesHacienda={lotesHacienda}
        corrales={corrales}
        potreros={potreros}
        categorias={categorias ?? []}
        empresaId={empresa.id}
      />
    </div>
  );
}
