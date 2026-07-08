import { redirect } from 'next/navigation';
import { Sprout } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import CultivosReport from './cultivos-report';

export default async function ReporteCultivosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [cultivosRes, campaniaRes, riasRes] = await Promise.all([
    supabase
      .from('cultivos')
      .select(`
        id, cultivo, estado, producto_final,
        ingreso_bruto_ars, costo_directo_ars, margen_bruto_ars,
        campania_id,
        lote:lotes!inner(id, nombre, hectareas, campo_id, campo:campos!inner(nombre))
      `),

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),

    supabase
      .from('remitos_internos')
      .select('lote_id, total_insumos, total_labores, total_ria')
      .eq('empresa_id', empresa.id)
      .eq('estado', 'confirmado'),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Sprout className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Reporte de Cultivos</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Todos los cultivos agrupados por tipo</p>
        </div>
      </div>

      <CultivosReport
        cultivos={(cultivosRes.data ?? []) as any}
        campanias={campaniaRes.data ?? []}
        rias={(riasRes.data ?? []) as any}
      />
    </div>
  );
}
