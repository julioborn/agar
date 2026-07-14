import { redirect } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import MargenesReport from './margenes-report';

export default async function MargenesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [camposRes, cultivosRes, costosIndCampoRes, costosIndEmpresaRes, campaniaRes, riasRes] = await Promise.all([
    supabase
      .from('campos')
      .select('id, nombre, hectareas_totales')
      .eq('empresa_id', empresa.id)
      .order('nombre'),

    supabase
      .from('cultivos')
      .select(`
        id, cultivo, estado, producto_final,
        ingreso_bruto_ars, costo_directo_ars, margen_bruto_ars,
        campania_id,
        lote:lotes!inner(id, nombre, campo_id)
      `),

    supabase
      .from('costos_indirectos_campo')
      .select('id, campo_id, campania_id, fecha, categoria, descripcion, monto_ars, comprobante:comprobantes_internos(numero)')
      .eq('empresa_id', empresa.id),

    supabase
      .from('costos_indirectos_empresa')
      .select('id, campania_id, fecha, categoria, descripcion, monto_ars, comprobante:comprobantes_internos(numero)')
      .eq('empresa_id', empresa.id),

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),

    // Costos de RIAs confirmados — se matchea por cultivo_id en el componente
    supabase
      .from('remitos_internos')
      .select('cultivo_id, lote_id, total_insumos, total_labores, total_ria')
      .eq('empresa_id', empresa.id)
      .eq('estado', 'confirmado'),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Reporte de Márgenes</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Jerarquía Lote → Campo → Empresa</p>
        </div>
      </div>

      <MargenesReport
        empresaNombre={empresa.nombre}
        campos={(camposRes.data ?? []) as any}
        cultivos={(cultivosRes.data ?? []) as any}
        costosIndCampo={(costosIndCampoRes.data ?? []) as any}
        costosIndEmpresa={(costosIndEmpresaRes.data ?? []) as any}
        campanias={campaniaRes.data ?? []}
        rias={(riasRes.data ?? []) as any}
      />
    </div>
  );
}
