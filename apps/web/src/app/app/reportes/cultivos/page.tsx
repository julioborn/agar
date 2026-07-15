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

  // Paso 1: datos base en paralelo
  const [cultivosRaw, campaniaRes] = await Promise.all([
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
  ]);

  const cultivoIds = (cultivosRaw.data ?? []).map((c: any) => c.id);

  // Paso 2: componentes de costo desde líneas reales
  const [aplicacionesRes, laboresRes, cosechasRes, riasRes] = await Promise.all([
    cultivoIds.length
      ? supabase
          .from('aplicaciones')
          .select('cultivo_id, aplicaciones_items(costo_imputado_ars)')
          .in('cultivo_id', cultivoIds)
      : Promise.resolve({ data: [] as any[] }),

    cultivoIds.length
      ? supabase
          .from('labores')
          .select('cultivo_id, costo_total_calculado')
          .in('cultivo_id', cultivoIds)
      : Promise.resolve({ data: [] as any[] }),

    cultivoIds.length
      ? supabase
          .from('costos_cosecha')
          .select('cultivo_id, costo_total_calculado')
          .in('cultivo_id', cultivoIds)
      : Promise.resolve({ data: [] as any[] }),

    supabase
      .from('remitos_internos')
      .select('cultivo_id, remitos_insumos(subtotal), remitos_labores(subtotal)')
      .eq('empresa_id', empresa.id)
      .eq('estado', 'confirmado'),
  ]);

  // Construir mapa de costo real por cultivo_id
  const costoPorCultivo: Record<string, number> = {};

  for (const a of (aplicacionesRes.data ?? []) as any[]) {
    const sum = ((a.aplicaciones_items ?? []) as any[])
      .reduce((s: number, i: any) => s + Number(i.costo_imputado_ars ?? 0), 0);
    costoPorCultivo[a.cultivo_id] = (costoPorCultivo[a.cultivo_id] ?? 0) + sum;
  }
  for (const l of (laboresRes.data ?? []) as any[]) {
    costoPorCultivo[l.cultivo_id] = (costoPorCultivo[l.cultivo_id] ?? 0) + Number(l.costo_total_calculado ?? 0);
  }
  for (const c of (cosechasRes.data ?? []) as any[]) {
    costoPorCultivo[c.cultivo_id] = (costoPorCultivo[c.cultivo_id] ?? 0) + Number(c.costo_total_calculado ?? 0);
  }
  for (const r of (riasRes.data ?? []) as any[]) {
    if (!r.cultivo_id) continue;
    const ins = ((r.remitos_insumos ?? []) as any[]).reduce((s: number, i: any) => s + Number(i.subtotal ?? 0), 0);
    const lab = ((r.remitos_labores ?? []) as any[]).reduce((s: number, l: any) => s + Number(l.subtotal ?? 0), 0);
    costoPorCultivo[r.cultivo_id] = (costoPorCultivo[r.cultivo_id] ?? 0) + ins + lab;
  }

  // Sobrescribir costo_directo_ars con el valor calculado desde líneas reales
  const cultivos = (cultivosRaw.data ?? []).map((c: any) => ({
    ...c,
    costo_directo_ars: costoPorCultivo[c.id] ?? 0,
  }));

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
        cultivos={cultivos as any}
        campanias={campaniaRes.data ?? []}
      />
    </div>
  );
}
