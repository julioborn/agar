import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import CampaniasManager from './campanias-manager';

export default async function CampaniasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const { data: campanias } = await supabase
    .from('campanias')
    .select('id, nombre, fecha_inicio, fecha_fin, activa, observaciones')
    .order('nombre', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Campañas</h1>
        <p className="text-sm text-slate-500 mt-1">
          {empresa.nombre} · Períodos agrícolas (ej: 2025/2026, 2026/2027)
        </p>
      </div>
      <CampaniasManager campanias={campanias ?? []} empresaId={empresa.id} />
    </div>
  );
}
