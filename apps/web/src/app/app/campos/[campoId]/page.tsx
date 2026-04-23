import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, MapPin, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import LotesManager from './lotes-manager';
import MapaCampo from './mapa-campo';

interface Props {
  params: Promise<{ campoId: string }>;
}

export default async function LotesPage({ params }: Props) {
  const { campoId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { data: campo } = await supabase
    .from('campos')
    .select('id, nombre, hectareas_totales, centro_lat, centro_lng, zoom')
    .eq('id', campoId)
    .single();

  if (!campo) notFound();

  const { data: lotes } = await supabase
    .from('lotes')
    .select('id, campo_id, nombre, hectareas, coordenadas')
    .eq('campo_id', campoId)
    .order('nombre');

  const totalLotes = lotes?.length ?? 0;
  const haLotes = (lotes ?? []).reduce((acc, l) => acc + Number(l.hectareas ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Banner */}
      <div className="rounded-2xl bg-[#006836] px-6 py-5 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-48 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 50%, white 0%, transparent 70%)' }} />

        <Link href="/app/campos"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white text-xs mb-3 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Campos
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <MapPin className="w-5 h-5 text-white/70" />
          <h1 className="text-2xl font-bold tracking-tight">{campo.nombre}</h1>
        </div>
        <p className="text-white/60 text-sm">
          {campo.hectareas_totales != null && (
            <>{Number(campo.hectareas_totales).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ha declaradas · </>
          )}
          {totalLotes} lote{totalLotes !== 1 ? 's' : ''} registrado{totalLotes !== 1 ? 's' : ''}
        </p>

        {/* KPIs en el banner */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/10">
          {[
            { label: 'Ha declaradas', value: campo.hectareas_totales != null ? `${Number(campo.hectareas_totales).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ha` : '—' },
            { label: 'Ha en lotes', value: haLotes > 0 ? `${haLotes.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ha` : '—' },
            { label: 'Lotes', value: totalLotes.toString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-white/40 text-xs">{label}</p>
              <p className="text-white font-semibold text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lotes */}
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-[#006836]" />
        <h2 className="text-sm font-semibold text-zinc-500 tracking-wider">Lotes</h2>
      </div>

      <LotesManager campoId={campo.id} lotes={lotes ?? []} />

      {/* Mapa */}
      <div className="pt-2">
        <MapaCampo
          campo={{
            id:         campo.id,
            nombre:     campo.nombre,
            centro_lat: campo.centro_lat ?? null,
            centro_lng: campo.centro_lng ?? null,
            zoom:       campo.zoom ?? null,
          }}
          lotes={(lotes ?? []).map((l: any) => ({
            id:          l.id,
            nombre:      l.nombre,
            hectareas:   l.hectareas,
            coordenadas: l.coordenadas ?? null,
          }))}
        />
      </div>
    </div>
  );
}
