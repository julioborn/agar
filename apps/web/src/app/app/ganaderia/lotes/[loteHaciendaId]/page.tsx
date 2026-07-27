import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { ArrowLeft, Beef } from 'lucide-react';
import AnimalesManager from './animales-manager';

interface Props {
  params: Promise<{ loteHaciendaId: string }>;
}

const ETAPA_LABEL: Record<string, string> = {
  cria: 'Cría',
  recria_invernada: 'Recría / Invernada',
  terminacion: 'Terminación',
};

export default async function LoteHaciendaDetallePage({ params }: Props) {
  const { loteHaciendaId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [{ data: loteRaw }, { data: categorias }, { data: animales }] = await Promise.all([
    supabase
      .from('lotes_hacienda')
      .select(`
        id, nombre, etapa_productiva, origen, fecha_ingreso, estado, peso_promedio_ingreso_kg, observaciones,
        categoria:categorias_hacienda(id, nombre),
        corral:corrales(nombre, lote:lotes(nombre, campo:campos(nombre))),
        potrero:potreros(nombre, lote:lotes(nombre, campo:campos(nombre)))
      `)
      .eq('id', loteHaciendaId)
      .eq('empresa_id', empresa.id)
      .maybeSingle(),
    supabase
      .from('categorias_hacienda')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('orden'),
    supabase
      .from('animales')
      .select('id, caravana, categoria:categorias_hacienda(nombre), sexo, fecha_nacimiento, peso_ingreso_kg, estado, observaciones, created_at')
      .eq('lote_hacienda_id', loteHaciendaId)
      .order('created_at', { ascending: false }),
  ]);

  if (!loteRaw) notFound();
  const lote = loteRaw as any;

  const ubicacion = lote.corral
    ? `${lote.corral.lote?.campo?.nombre ?? '—'} › ${lote.corral.lote?.nombre ?? '—'} › Corral ${lote.corral.nombre}`
    : lote.potrero
      ? `${lote.potrero.lote?.campo?.nombre ?? '—'} › ${lote.potrero.lote?.nombre ?? '—'} › Potrero ${lote.potrero.nombre}`
      : 'Sin ubicación';

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/app/ganaderia/lotes"
          className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-10 h-10 bg-[#006836]/10 rounded-xl flex items-center justify-center shrink-0">
          <Beef className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{lote.nombre}</h1>
          <p className="text-sm text-zinc-500">{ubicacion}</p>
        </div>
      </div>

      {/* Ficha */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-zinc-400">Etapa productiva</p>
            <p className="text-sm font-semibold text-zinc-800 mt-0.5">{ETAPA_LABEL[lote.etapa_productiva] ?? lote.etapa_productiva}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Categoría</p>
            <p className="text-sm font-semibold text-zinc-800 mt-0.5">{lote.categoria?.nombre ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Origen</p>
            <p className="text-sm font-semibold text-zinc-800 mt-0.5">{lote.origen === 'compra' ? 'Compra' : 'Cría propia'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Fecha de ingreso</p>
            <p className="text-sm font-semibold text-zinc-800 mt-0.5">{lote.fecha_ingreso}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Peso promedio de ingreso</p>
            <p className="text-sm font-semibold text-zinc-800 mt-0.5">
              {lote.peso_promedio_ingreso_kg != null ? `${lote.peso_promedio_ingreso_kg} kg` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Estado</p>
            <p className="text-sm font-semibold text-zinc-800 mt-0.5">{lote.estado === 'activo' ? 'Activo' : 'Cerrado'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Animales</p>
            <p className="text-sm font-semibold text-zinc-800 mt-0.5">{animales?.length ?? 0}</p>
          </div>
        </div>
        {lote.observaciones && (
          <p className="text-sm text-zinc-500 mt-4 pt-4 border-t border-zinc-50">{lote.observaciones}</p>
        )}
      </div>

      <AnimalesManager
        loteHaciendaId={loteHaciendaId}
        empresaId={empresa.id}
        categoriaDefaultId={lote.categoria?.id ?? ''}
        categorias={categorias ?? []}
        animales={(animales as any) ?? []}
      />
    </div>
  );
}
