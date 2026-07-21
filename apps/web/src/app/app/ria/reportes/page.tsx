import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect } from 'next/navigation';
import { BarChart3, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ReportesManager from './reportes-manager';

export default async function ReportesPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa, todasLasEmpresas } = empresaResult;

  const supabase = await createClient();
  const empresaIds = todasLasEmpresas.map((e) => e.id);

  // Fetch all RIAs (todos los estados) de todas las empresas a las que el
  // usuario tiene acceso — el filtro por empresa se aplica del lado cliente.
  const { data: riasRaw } = await supabase
    .from('remitos_internos')
    .select(`
      id, numero_ria, fecha, estado, superficie_afectada, cultivo_descripcion, cultivo_id,
      total_insumos, total_labores, total_ria, costo_por_ha, motivo_anulacion,
      operador_id, empresa_id,
      lote:lotes(id, nombre, campo:campos(id, nombre)),
      campania:campanias(id, nombre),
      empresa:empresas(id, nombre),
      cultivo:cultivos(id, cultivo)
    `)
    .in('empresa_id', empresaIds)
    .order('fecha', { ascending: false })
    .order('numero_correlativo', { ascending: false });

  const riasBase = (riasRaw as any[]) ?? [];
  const confirmedIds = riasBase
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
      .select('id, nombre, empresa_id')
      .in('empresa_id', empresaIds)
      .order('nombre'),
  ]);

  // auth.users no es accesible vía el cliente normal — resolvemos los emails
  // de los operadores que generaron RIA con el cliente admin (server-only).
  const operadorIds = Array.from(new Set(riasBase.map((r) => r.operador_id).filter(Boolean)));
  let emailPorUsuario: Record<string, string> = {};
  if (operadorIds.length > 0) {
    const adminClient = createAdminClient();
    const { data: listado } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    emailPorUsuario = Object.fromEntries(
      (listado?.users ?? [])
        .filter((u) => operadorIds.includes(u.id))
        .map((u) => [u.id, u.email ?? '—']),
    );
  }

  // Recalcular totales desde los line items reales (columnas almacenadas pueden estar stale)
  const insumosPorRia = new Map<string, number>();
  for (const i of (insumosRes.data ?? []) as any[]) {
    insumosPorRia.set(i.remito_id, (insumosPorRia.get(i.remito_id) ?? 0) + Number(i.subtotal ?? 0));
  }
  const laboresPorRia = new Map<string, number>();
  for (const l of (laboresRes.data ?? []) as any[]) {
    laboresPorRia.set(l.remito_id, (laboresPorRia.get(l.remito_id) ?? 0) + Number(l.subtotal ?? 0));
  }

  const rias = riasBase.map((r) => {
    const totalInsumos = insumosPorRia.has(r.id)
      ? insumosPorRia.get(r.id)!
      : Number(r.total_insumos ?? 0);
    const totalLabores = laboresPorRia.has(r.id)
      ? laboresPorRia.get(r.id)!
      : Number(r.total_labores ?? 0);
    const totalRia = totalInsumos + totalLabores;
    return {
      ...r,
      // Preferir el nombre vigente del cultivo (se mantiene actualizado) por sobre
      // cultivo_descripcion, que es una foto fija tomada al crear el RIA y puede
      // haber quedado con una capitalización vieja si el cultivo se renombró después.
      cultivo_nombre: r.cultivo?.cultivo ?? r.cultivo_descripcion ?? null,
      operador_email: r.operador_id ? (emailPorUsuario[r.operador_id] ?? '—') : null,
      total_insumos: totalInsumos,
      total_labores: totalLabores,
      total_ria: totalRia,
      costo_por_ha: r.superficie_afectada > 0 ? totalRia / Number(r.superficie_afectada) : r.costo_por_ha,
    };
  });

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
          <p className="text-sm text-zinc-500">Registro completo, filtrable y exportable</p>
        </div>
      </div>

      <ReportesManager
        rias={rias}
        insumos={(insumosRes.data as any[]) ?? []}
        labores={(laboresRes.data as any[]) ?? []}
        produccion={(produccionRes.data as any[]) ?? []}
        campanias={campaniasRes.data ?? []}
        empresas={todasLasEmpresas.map((e) => ({ id: e.id, nombre: e.nombre }))}
        empresaActivaId={empresa.id}
      />
    </div>
  );
}
