import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import ReferenciasPrecioManager from './referencias-precio-manager';

export default async function ReferenciasPrecioPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();

  const { data: referencias } = await supabase
    .from('referencias_precio')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('tipo')
    .order('vigencia_desde', { ascending: false });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-[#006836]/10 rounded-xl flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Referencias de Precio</h1>
          <p className="text-sm text-zinc-500">{empresa.nombre} — gasoil, mano de obra, tipo de cambio y otros índices</p>
        </div>
      </div>

      <ReferenciasPrecioManager
        referencias={(referencias as any[]) ?? []}
        empresaId={empresa.id}
      />
    </div>
  );
}
