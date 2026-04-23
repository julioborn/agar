import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Briefcase } from 'lucide-react';
import UnidadesManager from './unidades-manager';

export default async function UnidadesNegocioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const { data: unidades } = await supabase
    .from('unidades_negocio')
    .select('id, nombre, tipo, descripcion, activa')
    .order('nombre');

  const total = unidades?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Unidades de negocio</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · {total} unidad{total !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      <UnidadesManager empresaId={empresa.id} unidades={unidades ?? []} />
    </div>
  );
}
