import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Sprout, ChevronLeft, Layers } from 'lucide-react';
import CultivosManager from './cultivos-manager';

interface Props {
  searchParams: Promise<{ lote?: string }>;
}

export default async function CultivosPage({ searchParams }: Props) {
  const { lote: defaultLoteId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const [cultivosRes, lotesRes, unidadesRes, campaniasRes] = await Promise.all([
    supabase
      .from('cultivos')
      .select(`
        id, lote_id, unidad_negocio_id, campania_id, cultivo,
        producto_final, unidad_produccion,
        fecha_siembra, fecha_cosecha_estimada, fecha_cosecha_real,
        estado, observaciones,
        lote:lotes(id, nombre, campo:campos(id, nombre)),
        unidad_negocio:unidades_negocio(id, nombre),
        campania:campanias(id, nombre)
      `)
      .order('fecha_siembra', { ascending: false }),
    supabase.from('lotes').select('id, nombre, campo:campos(id, nombre)').order('nombre'),
    supabase.from('unidades_negocio').select('id, nombre').order('nombre'),
    supabase.from('campanias').select('id, nombre').eq('activa', true).order('nombre'),
  ]);

  const cultivos = (cultivosRes.data ?? []).map((c: any) => ({
    id: c.id,
    lote_id: c.lote_id,
    unidad_negocio_id: c.unidad_negocio_id,
    campania_id: c.campania_id ?? null,
    cultivo: c.cultivo,
    producto_final: c.producto_final ?? null,
    unidad_produccion: c.unidad_produccion ?? 'kg',
    fecha_siembra: c.fecha_siembra,
    fecha_cosecha_estimada: c.fecha_cosecha_estimada,
    fecha_cosecha_real: c.fecha_cosecha_real,
    estado: c.estado,
    observaciones: c.observaciones,
    lote_nombre: c.lote?.nombre ?? '—',
    campo_nombre: c.lote?.campo?.nombre ?? '—',
    unidad_negocio_nombre: c.unidad_negocio?.nombre ?? '—',
    campania_nombre: c.campania?.nombre ?? null,
  }));

  const cultivosVisibles = defaultLoteId
    ? cultivos.filter((c) => c.lote_id === defaultLoteId)
    : cultivos;

  const lotes = (lotesRes.data ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    campo_nombre: l.campo?.nombre ?? '—',
  }));

  const loteActual = lotes.find((l) => l.id === defaultLoteId);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {loteActual ? (
        /* Vista filtrada por lote: header con contexto destacado */
        <div className="rounded-2xl bg-[#006836] px-6 py-5 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-48 opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 80% 50%, white 0%, transparent 70%)' }} />

          <Link href="/app/cultivos"
            className="inline-flex items-center gap-1 text-white/60 hover:text-white text-xs mb-3 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Todos los cultivos
          </Link>

          <div className="flex items-center gap-2.5 mb-1">
            <Layers className="w-5 h-5 text-white/70" />
            <h1 className="text-2xl font-bold tracking-tight">{loteActual.nombre}</h1>
          </div>
          <p className="text-white/60 text-sm">
            {loteActual.campo_nombre && <>{loteActual.campo_nombre} · </>}
            {empresa.nombre} · {cultivosVisibles.length} cultivo{cultivosVisibles.length !== 1 ? 's' : ''}
          </p>
        </div>
      ) : (
        /* Vista general */
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-[#006836]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Cultivos</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {empresa.nombre} · {cultivosVisibles.length} cultivo{cultivosVisibles.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      <CultivosManager
        cultivos={cultivosVisibles}
        lotes={lotes}
        unidadesNegocio={unidadesRes.data ?? []}
        campanias={campaniasRes.data ?? []}
        defaultLoteId={defaultLoteId}
      />
    </div>
  );
}
