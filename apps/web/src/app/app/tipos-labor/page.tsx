import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Wrench } from 'lucide-react';
import TiposLaborLayout from './tipos-labor-layout';

export default async function TiposLaborPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const { data: tiposLabor } = await supabase
    .from('tipos_labor')
    .select('id, nombre, descripcion')
    .eq('empresa_id', empresa.id)
    .order('nombre');

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tipos de Labor</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {tiposLabor?.length ?? 0} tipo{tiposLabor?.length !== 1 ? 's' : ''} definido{tiposLabor?.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <TiposLaborLayout tiposLabor={tiposLabor ?? []} empresaId={empresa.id} />
    </div>
  );
}
