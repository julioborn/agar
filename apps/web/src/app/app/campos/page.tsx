import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { MapPin } from 'lucide-react';
import CamposManager from './campos-manager';
import MapaTodosCampos from './mapa-todos-campos';

export default async function CamposPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  // Un solo query: campos con lotes (id + coordenadas para el mapa)
  const { data: campos } = await supabase
    .from('campos')
    .select('id, nombre, hectareas_totales, lotes(id, nombre, hectareas, coordenadas)')
    .order('nombre');

  const total  = campos?.length ?? 0;
  const haTotal = campos?.reduce((acc, c) => acc + Number(c.hectareas_totales ?? 0), 0) ?? 0;

  // Datos para CamposManager (cards)
  const camposConLotes = (campos ?? []).map((c: any) => ({
    id:               c.id,
    nombre:           c.nombre,
    hectareas_totales: c.hectareas_totales ?? null,
    lotes_count:      Array.isArray(c.lotes) ? c.lotes.length : 0,
  }));

  // Datos para el mapa global (incluye coordenadas de lotes)
  const camposParaMapa = (campos ?? []).map((c: any) => ({
    id:     c.id,
    nombre: c.nombre,
    lotes:  (Array.isArray(c.lotes) ? c.lotes : []).map((l: any) => ({
      id:          l.id,
      nombre:      l.nombre,
      hectareas:   l.hectareas ?? 0,
      coordenadas: l.coordenadas ?? null,
    })),
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Campos</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · {total} campo{total !== 1 ? 's' : ''}
            {haTotal > 0 && ` · ${haTotal.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ha totales`}
          </p>
        </div>
      </div>

      {/* Mapa global */}
      <MapaTodosCampos campos={camposParaMapa} />

      {/* Cards + formulario */}
      <CamposManager campos={camposConLotes} empresaId={empresa.id} />
    </div>
  );
}
