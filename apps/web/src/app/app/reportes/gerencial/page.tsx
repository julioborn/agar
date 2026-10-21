import { redirect } from 'next/navigation';
import { Gauge } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import InformeGerencialReport from './informe-gerencial-report';

export default async function InformeGerencialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [riasRes, campaniasRes] = await Promise.all([
    supabase
      .from('remitos_internos')
      .select(`
        id, fecha, lote_id, campania_id, cultivo_id, cultivo_descripcion, superficie_afectada,
        lote:lotes(nombre, hectareas, campo:campos(nombre)),
        campania:campanias(nombre),
        cultivo:cultivos(cultivo)
      `)
      .eq('empresa_id', empresa.id)
      .eq('estado', 'confirmado'),
    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  const rias = (riasRes.data ?? []) as any[];
  const riaIds = rias.map((r) => r.id);

  const [insumosRes, laboresRes, produccionRes] = await Promise.all([
    riaIds.length
      ? supabase
          .from('remitos_insumos')
          .select('remito_id, cantidad, costo_unitario, subtotal, producto:productos(id, nombre, categoria, unidad_base)')
          .in('remito_id', riaIds)
      : Promise.resolve({ data: [] as any[] }),
    riaIds.length
      ? supabase
          .from('remitos_labores')
          .select('remito_id, tipo_labor_nombre, descripcion, cantidad, tarifa, subtotal, unidad_medida')
          .in('remito_id', riaIds)
      : Promise.resolve({ data: [] as any[] }),
    riaIds.length
      ? supabase
          .from('remitos_produccion')
          .select('remito_id, cantidad, subtotal_valor, precio_referencia, producto:productos(nombre)')
          .in('remito_id', riaIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Informe Gerencial</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Vista consolidada para directores</p>
        </div>
      </div>

      <InformeGerencialReport
        rias={rias}
        insumos={(insumosRes.data ?? []) as any[]}
        labores={(laboresRes.data ?? []) as any[]}
        produccion={(produccionRes.data ?? []) as any[]}
        campanias={campaniasRes.data ?? []}
        empresaNombre={empresa.nombre}
      />
    </div>
  );
}
