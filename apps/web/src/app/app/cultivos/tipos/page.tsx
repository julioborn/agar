import { redirect } from 'next/navigation';
import { Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import TiposManager from './tipos-manager';

export default async function TiposCultivoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const { data: tipos } = await supabase
    .from('tipos_cultivo')
    .select('id, nombre')
    .eq('empresa_id', empresa.id)
    .order('nombre');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Layers className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tipos de Cultivo</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Lista maestra de cultivos permitidos</p>
        </div>
      </div>

      <TiposManager tipos={tipos ?? []} />
    </div>
  );
}
