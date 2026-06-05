import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect } from 'next/navigation';
import { BarChart3, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ReportesManager from './reportes-manager';

export default async function ReportesPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();

  // Fetch all RIAs (todos los estados) con lote + campo + campaña
  const { data: riasRaw } = await supabase
    .from('remitos_internos')
    .select(`
      id, numero_ria, fecha, estado, superficie_afectada, cultivo_descripcion,
      total_insumos, total_labores, total_ria, costo_por_ha, motivo_anulacion,
      lote:lotes(id, nombre, campo:campos(id, nombre)),
      campania:campanias(id, nombre)
    `)
    .eq('empresa_id', empresa.id)
    .order('fecha', { ascending: false })
    .order('numero_correlativo', { ascending: false });

  const rias = (riasRaw as any[]) ?? [];
  const confirmedIds = rias
    .filter((r) => r.estado === 'confirmado')
    .map((r) => r.id as string);

  // Fetch line items solo para RIAs confirmados
  const [insumosRes, laboresRes, produccionRes, campaniasRes] = await Promise.all([
    confirmedIds.length > 0
      ? supabase
          .from('remitos_insumos')
          .select(`
            remito_id, cantidad, costo_unitario, subtotal,
            producto:productos(id, nombre, unidad_base, categoria),
            deposito:depositos(id, nombre)
          `)
          .in('remito_id', confirmedIds)
      : { data: [] },

    confirmedIds.length > 0
      ? supabase
          .from('remitos_labores')
          .select(`
            remito_id, tipo_labor_nombre, descripcion, prestador_nombre,
            unidad_medida, cantidad, tarifa, subtotal, fecha_ejecucion
          `)
          .in('remito_id', confirmedIds)
      : { data: [] },

    confirmedIds.length > 0
      ? supabase
          .from('remitos_produccion')
          .select(`
            remito_id, cantidad, humedad_porcentaje, precio_referencia, subtotal_valor,
            producto:productos(id, nombre, unidad_base),
            deposito_ingreso:depositos!deposito_ingreso_id(id, nombre)
          `)
          .in('remito_id', confirmedIds)
      : { data: [] },

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/ria"
          className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-10 h-10 bg-[#006836]/10 rounded-xl flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Reportes RIA</h1>
          <p className="text-sm text-zinc-500">{empresa.nombre}</p>
        </div>
      </div>

      <ReportesManager
        rias={rias}
        insumos={(insumosRes.data as any[]) ?? []}
        labores={(laboresRes.data as any[]) ?? []}
        produccion={(produccionRes.data as any[]) ?? []}
        campanias={campaniasRes.data ?? []}
        empresaNombre={empresa.nombre}
      />
    </div>
  );
}
