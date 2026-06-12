import { redirect } from 'next/navigation';
import { Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import InsumosLaboresReport from './insumos-labores-report';

export default async function InsumosLaboresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  // RIAs confirmados con lote + campo
  const { data: riasRaw } = await supabase
    .from('remitos_internos')
    .select(`
      id, lote_id, superficie_afectada, cultivo_descripcion, campania_id,
      lote:lotes(nombre, campo:campos(nombre))
    `)
    .eq('empresa_id', empresa.id)
    .eq('estado', 'confirmado');

  const rias = (riasRaw ?? []) as any[];
  const confirmedIds = rias.map((r) => r.id as string);

  const [insumosRes, laboresRes, campaniasRes] = await Promise.all([
    confirmedIds.length > 0
      ? supabase
          .from('remitos_insumos')
          .select('remito_id, cantidad, costo_unitario, subtotal, producto:productos(id, nombre, unidad_base, categoria)')
          .in('remito_id', confirmedIds)
      : Promise.resolve({ data: [] }),

    confirmedIds.length > 0
      ? supabase
          .from('remitos_labores')
          .select('remito_id, tipo_labor_nombre, descripcion, cantidad, tarifa, subtotal, unidad_medida, prestador_nombre')
          .in('remito_id', confirmedIds)
      : Promise.resolve({ data: [] }),

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Package className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Insumos y Labores</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Uso acumulado en RIAs confirmados</p>
        </div>
      </div>

      <InsumosLaboresReport
        rias={rias}
        insumos={(insumosRes.data ?? []) as any[]}
        labores={(laboresRes.data ?? []) as any[]}
        campanias={campaniasRes.data ?? []}
      />
    </div>
  );
}
