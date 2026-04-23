import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { MapPin } from 'lucide-react';
import CamposManager from './campos-manager';

export default async function CamposPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const { data: campos } = await supabase
    .from('campos')
    .select('id, nombre, hectareas_totales, lotes(id)')
    .order('nombre');

  const total = campos?.length ?? 0;
  const haTotal = campos?.reduce((acc, c) => acc + Number(c.hectareas_totales ?? 0), 0) ?? 0;

  const camposConLotes = (campos ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    hectareas_totales: c.hectareas_totales ?? null,
    lotes_count: Array.isArray(c.lotes) ? c.lotes.length : 0,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
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

      <CamposManager campos={camposConLotes} empresaId={empresa.id} />
    </div>
  );
}
