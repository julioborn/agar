import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Wheat } from 'lucide-react';
import ProduccionManager from './produccion-manager';

export default async function ProduccionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const [cultivosRes, campaniasRes, camposRes] = await Promise.all([
    supabase
      .from('cultivos')
      .select(`
        id, cultivo, estado,
        producto_final, unidad_produccion,
        fecha_siembra, fecha_cosecha_real,
        produccion_total_kg, rendimiento_kg_ha,
        precio_venta_ars, ingreso_bruto_ars,
        costo_directo_ars, margen_bruto_ars,
        lote:lotes(id, nombre, hectareas, campo:campos(id, nombre)),
        unidad_negocio:unidades_negocio(id, nombre),
        campania:campanias(id, nombre)
      `)
      .order('fecha_siembra', { ascending: false }),
    supabase.from('campanias').select('id, nombre').order('nombre'),
    supabase.from('campos').select('id, nombre').order('nombre'),
  ]);

  const cultivos = (cultivosRes.data ?? []).map((c: any) => ({
    id: c.id,
    cultivo: c.cultivo,
    estado: c.estado,
    producto_final: c.producto_final ?? null,
    unidad_produccion: c.unidad_produccion ?? 'kg',
    campo_nombre: c.lote?.campo?.nombre ?? '—',
    lote_nombre: c.lote?.nombre ?? '—',
    lote_hectareas: c.lote?.hectareas ?? null,
    campania_nombre: c.campania?.nombre ?? null,
    unidad_negocio_nombre: c.unidad_negocio?.nombre ?? '—',
    fecha_siembra: c.fecha_siembra,
    fecha_cosecha_real: c.fecha_cosecha_real,
    produccion_total: c.produccion_total_kg ?? null,
    rendimiento_por_ha: c.rendimiento_kg_ha ?? null,
    precio_venta_ars: c.precio_venta_ars ?? null,
    ingreso_bruto_ars: c.ingreso_bruto_ars ?? null,
    costo_directo_ars: c.costo_directo_ars,
    margen_bruto_ars: c.margen_bruto_ars,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Wheat className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Producción</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · {cultivos.length} cultivo{cultivos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <ProduccionManager
        cultivos={cultivos}
        campanias={campaniasRes.data ?? []}
        campos={camposRes.data ?? []}
        empresaNombre={empresa.nombre}
      />
    </div>
  );
}
