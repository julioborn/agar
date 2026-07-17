import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Wheat } from 'lucide-react';
import TiposProduccionLayout from './tipos-produccion-layout';

export default async function TiposProduccionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const { data: tiposProduccion } = await supabase
    .from('tipos_produccion')
    .select('id, nombre, grupo, unidad_medida, unidad_base, valor_mercado, orden')
    .eq('empresa_id', empresa.id)
    .order('orden');

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Wheat className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tipos de Producción</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {tiposProduccion?.length ?? 0} tipo{tiposProduccion?.length !== 1 ? 's' : ''} definido{tiposProduccion?.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <TiposProduccionLayout
        tiposProduccion={(tiposProduccion as any) ?? []}
        empresaId={empresa.id}
      />
    </div>
  );
}
