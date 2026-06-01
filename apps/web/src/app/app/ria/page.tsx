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

  const [{ data: rias }, { data: campanias }, { data: lotes }] = await Promise.all([
    supabase
      .from('remitos_internos')
      .select(`
        id, numero_ria, fecha, estado,
        superficie_afectada, cultivo_descripcion,
        total_insumos, total_labores, total_ria, costo_por_ha,
        motivo_anulacion, created_at,
        lote:lotes(id, nombre, campo:campos(nombre)),
        campania:campanias(id, nombre)
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
