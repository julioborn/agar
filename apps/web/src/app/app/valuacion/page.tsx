import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect } from 'next/navigation';
import { Scale } from 'lucide-react';
import ValuacionManager from './valuacion-manager';

export default async function ValuacionPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();

  const [
    { data: configuraciones },
    { data: precios },
    { data: productos },
    { data: stockData },
  ] = await Promise.all([
    supabase
      .from('config_valuacion')
      .select('*, producto:productos(id, nombre, categoria), ')
      .eq('empresa_id', empresa.id)
      .order('created_at'),

    supabase
      .from('precios_reposicion')
      .select('*, producto:productos(id, nombre, unidad_base, categoria)')
      .eq('empresa_id', empresa.id)
      .order('vigencia_desde', { ascending: false }),

    supabase
      .from('productos')
      .select('id, nombre, categoria, unidad_base')
      .eq('empresa_id', empresa.id)
      .order('nombre'),

    // Valuación comparativa via RPC (fn_valuacion_stock)
    supabase.rpc('fn_valuacion_stock', { p_empresa_id: empresa.id }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-[#006836]/10 rounded-xl flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Valuación de Insumos</h1>
          <p className="text-sm text-zinc-500">{empresa.nombre} — criterios de imputación y valuación de stock</p>
        </div>
      </div>

      <ValuacionManager
        configuraciones={(configuraciones as any[]) ?? []}
        precios={(precios as any[]) ?? []}
        productos={(productos as any[]) ?? []}
        stockValuacion={(stockData as any[]) ?? []}
        empresaId={empresa.id}
      />
    </div>
  );
}
