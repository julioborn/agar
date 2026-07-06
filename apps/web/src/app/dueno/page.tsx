import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import DuenoDashboard from './dashboard';

export default async function DuenoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa, rol } = empresaData;
  if (rol !== 'dueno') redirect('/app');

  const [camposRes, cultivosRes, riasRes, ciCampoRes, ciEmpresaRes] = await Promise.all([
    supabase
      .from('campos')
      .select('id, nombre, hectareas_totales, lotes(id, nombre, hectareas, coordenadas)')
      .eq('empresa_id', empresa.id)
      .order('nombre'),

    supabase
      .from('cultivos')
      .select(`
        id, cultivo, estado, campania_id,
        ingreso_bruto_ars, costo_directo_ars, margen_bruto_ars,
        lote:lotes!inner(id, nombre, campo_id)
      `),

    supabase
      .from('remitos_internos')
      .select('lote_id, total_insumos, total_labores, total_ria')
      .eq('empresa_id', empresa.id)
      .eq('estado', 'confirmado'),

    supabase
      .from('costos_indirectos_campo')
      .select('campo_id, monto_ars')
      .eq('empresa_id', empresa.id),

    supabase
      .from('costos_indirectos_empresa')
      .select('monto_ars')
      .eq('empresa_id', empresa.id),
  ]);

  const campos    = (camposRes.data    ?? []) as any[];
  const cultivos  = (cultivosRes.data  ?? []) as any[];
  const rias      = (riasRes.data      ?? []) as any[];
  const ciCampo   = (ciCampoRes.data   ?? []) as any[];
  const ciEmpresa = (ciEmpresaRes.data ?? []) as any[];

  // ── Métricas globales
  const haTotal = campos.reduce((acc: number, c: any) =>
    acc + Number(c.hectareas_totales ?? 0), 0);

  const costoTotalCI =
    ciCampo.reduce((acc: number, c: any) => acc + Number(c.monto_ars ?? 0), 0) +
    ciEmpresa.reduce((acc: number, c: any) => acc + Number(c.monto_ars ?? 0), 0);

  // ── RIAs agrupadas por lote_id
  const riasPorLote: Record<string, { total_insumos: number; total_labores: number; total_ria: number }> = {};
  for (const r of rias) {
    const k = r.lote_id ?? '';
    if (!k) continue;
    if (!riasPorLote[k]) riasPorLote[k] = { total_insumos: 0, total_labores: 0, total_ria: 0 };
    riasPorLote[k].total_insumos += Number(r.total_insumos ?? 0);
    riasPorLote[k].total_labores += Number(r.total_labores ?? 0);
    riasPorLote[k].total_ria     += Number(r.total_ria     ?? 0);
  }

  // ── Resultado por campo (margen bruto = ingresos - costos directos - CI de campo)
  const resultadoPorCampo = campos.map((campo: any) => {
    const cultivosDeCampo = cultivos.filter((c: any) => c.lote?.campo_id === campo.id);
    const ingreso   = cultivosDeCampo.reduce((a: number, c: any) => a + Number(c.ingreso_bruto_ars  ?? 0), 0);
    const costoDir  = cultivosDeCampo.reduce((a: number, c: any) => a + Number(c.costo_directo_ars  ?? 0), 0);
    const costoRia  = cultivosDeCampo.reduce((a: number, c: any) =>
      a + (riasPorLote[c.lote?.id ?? '']?.total_ria ?? 0), 0);
    const costoCI   = ciCampo
      .filter((ci: any) => ci.campo_id === campo.id)
      .reduce((a: number, ci: any) => a + Number(ci.monto_ars ?? 0), 0);
    const costo  = costoDir + costoRia + costoCI;
    const margen = ingreso - costo;
    return { nombre: campo.nombre, ingreso, costo, margen };
  });

  // ── Cultivos detalle (info completa por lote para el panel del mapa)
  const cultivosDetalle = cultivos.map((c: any) => ({
    id:               c.id,
    cultivo:          c.cultivo   ?? null,
    estado:           c.estado    ?? 'planificada',
    ingreso_bruto_ars: Number(c.ingreso_bruto_ars ?? 0),
    costo_directo_ars: Number(c.costo_directo_ars ?? 0),
    margen_bruto_ars:  Number(c.margen_bruto_ars  ?? 0),
    lote_id:    c.lote?.id      ?? '',
    lote_nombre: c.lote?.nombre ?? '',
    campo_id:   c.lote?.campo_id ?? '',
  }));

  // ── Datos del mapa
  const camposParaMapa = campos.map((c: any) => ({
    id:     c.id,
    nombre: c.nombre,
    lotes:  (Array.isArray(c.lotes) ? c.lotes : []).map((l: any) => ({
      id:          l.id,
      nombre:      l.nombre,
      hectareas:   Number(l.hectareas ?? 0),
      coordenadas: l.coordenadas ?? null,
    })),
  }));

  return (
    <DuenoDashboard
      empresaNombre={empresa.nombre}
      haTotal={haTotal}
      costoTotalCI={costoTotalCI}
      campos={camposParaMapa}
      cultivosDetalle={cultivosDetalle}
      riasPorLote={riasPorLote}
      resultadoPorCampo={resultadoPorCampo}
    />
  );
}
