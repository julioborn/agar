import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import RiaManager from './ria-manager';

export default async function RiaPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();

  const [{ data: riasRaw }, { data: campanias }, { data: lotes }] = await Promise.all([
    supabase
      .from('remitos_internos')
      .select(`
        id, numero_ria, fecha, estado,
        superficie_afectada, cultivo_descripcion, cultivo_id,
        total_insumos, total_labores, total_ria, costo_por_ha,
        motivo_anulacion, created_at,
        lote:lotes(id, nombre, campo:campos(nombre)),
        campania:campanias(id, nombre),
        cultivo:cultivos(id, cultivo),
        remitos_insumos(subtotal),
        remitos_labores(subtotal)
      `)
      .eq('empresa_id', empresa.id)
      .order('fecha', { ascending: false })
      .order('numero_correlativo', { ascending: false }),

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),

    supabase
      .from('lotes')
      .select('id, nombre, campo:campos!inner(nombre, empresa_id)')
      .eq('campo.empresa_id', empresa.id)
      .order('nombre'),
  ]);

  // Recalcular totales desde las líneas reales (las columnas almacenadas pueden estar desactualizadas)
  const rias = (riasRaw ?? []).map((r: any) => {
    const totalInsumos = (r.remitos_insumos ?? []).reduce((s: number, i: any) => s + Number(i.subtotal ?? 0), 0);
    const totalLabores = (r.remitos_labores ?? []).reduce((s: number, l: any) => s + Number(l.subtotal ?? 0), 0);
    const totalRia = totalInsumos + totalLabores;
    const { remitos_insumos: _i, remitos_labores: _l, ...rest } = r;
    return {
      ...rest,
      // Preferir el nombre vigente del cultivo por sobre cultivo_descripcion,
      // que es una foto fija tomada al crear el RIA (puede tener una
      // capitalización vieja si el cultivo se renombró después).
      cultivo_descripcion: r.cultivo?.cultivo ?? r.cultivo_descripcion ?? null,
      total_insumos: totalInsumos,
      total_labores: totalLabores,
      total_ria: totalRia,
      costo_por_ha: r.superficie_afectada > 0 ? totalRia / Number(r.superficie_afectada) : r.costo_por_ha,
    };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-[#006836]/10 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Remitos Internos Agrícolas</h1>
          <p className="text-sm text-zinc-500">{empresa.nombre}</p>
        </div>
      </div>

      <RiaManager
        rias={(rias as any) ?? []}
        campanias={campanias ?? []}
        lotes={(lotes as any) ?? []}
        empresaNombre={empresa.nombre}
      />
    </div>
  );
}
