import { redirect } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import CostosLoteReport from './costos-lote-report';

export default async function CostosDirectosLotePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [riasRes, lotesRes, cultivosRes, campaniasRes] = await Promise.all([
    // RIAs confirmados con líneas reales embebidas
    supabase
      .from('remitos_internos')
      .select(`
        id, lote_id, cultivo_id, cultivo_descripcion,
        superficie_afectada, campania_id,
        cultivo:cultivos(id, cultivo),
        remitos_insumos(subtotal),
        remitos_labores(subtotal)
      `)
      .eq('empresa_id', empresa.id)
      .eq('estado', 'confirmado'),

    // Lotes con campo
    supabase
      .from('lotes')
      .select('id, nombre, hectareas, campo:campos!inner(id, nombre, empresa_id)')
      .eq('campo.empresa_id', empresa.id)
      .order('nombre'),

    // Cultivos activos/planificados por lote
    supabase
      .from('cultivos')
      .select('lote_id, cultivo, estado')
      .in('estado', ['planificada', 'en_curso', 'cosechada']),

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  // Mapa lote_id → info del lote
  const lotesMap = new Map<string, { nombre: string; campoNombre: string; hectareas: number | null }>();
  for (const l of (lotesRes.data ?? []) as any[]) {
    lotesMap.set(l.id, {
      nombre: l.nombre,
      campoNombre: l.campo?.nombre ?? '—',
      hectareas: l.hectareas ?? null,
    });
  }

  // Cultivo activo preferido por lote (en_curso > planificada > cosechada)
  const estadoPrioridad: Record<string, number> = { en_curso: 0, planificada: 1, cosechada: 2 };
  const cultivoActivoPorLote = new Map<string, string>();
  for (const c of (cultivosRes.data ?? []) as any[]) {
    const actual = cultivoActivoPorLote.get(c.lote_id);
    if (!actual) {
      cultivoActivoPorLote.set(c.lote_id, c.cultivo);
    } else {
      // Reemplazar si el nuevo tiene mayor prioridad
      const prioNuevo = estadoPrioridad[c.estado] ?? 99;
      // (no tenemos el estado guardado, usamos el primero en_curso que aparezca)
    }
  }

  // Construir filas por RIA (una fila por RIA con costos > 0)
  const riasData: {
    loteId: string;
    loteNombre: string;
    campoNombre: string;
    hectareas: number | null;
    cultivoActivo: string | null;
    campaniaId: string | null;
    tieneCultivo: boolean;
    cultivoDescripcion: string | null;
    totalInsumos: number;
    totalLabores: number;
  }[] = [];

  for (const ria of (riasRes.data ?? []) as any[]) {
    const loteInfo = lotesMap.get(ria.lote_id);
    if (!loteInfo) continue;

    const totalInsumos = (ria.remitos_insumos ?? []).reduce(
      (s: number, i: any) => s + Number(i.subtotal ?? 0), 0,
    );
    const totalLabores = (ria.remitos_labores ?? []).reduce(
      (s: number, l: any) => s + Number(l.subtotal ?? 0), 0,
    );

    if (totalInsumos === 0 && totalLabores === 0) continue;

    riasData.push({
      loteId: ria.lote_id,
      loteNombre: loteInfo.nombre,
      campoNombre: loteInfo.campoNombre,
      hectareas: loteInfo.hectareas,
      cultivoActivo: cultivoActivoPorLote.get(ria.lote_id) ?? null,
      campaniaId: ria.campania_id ?? null,
      tieneCultivo: !!(ria.cultivo_id || ria.cultivo_descripcion),
      // Preferir el nombre vigente del cultivo (ya normalizado a mayúsculas) por
      // sobre cultivo_descripcion, que es una foto fija tomada al crear el RIA.
      cultivoDescripcion: ria.cultivo?.cultivo ?? ria.cultivo_descripcion ?? null,
      totalInsumos,
      totalLabores,
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Costos Directos por Lote</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · Insumos + labores de todos los RIAs confirmados por lote
          </p>
        </div>
      </div>

      <CostosLoteReport
        rias={riasData}
        campanias={campaniasRes.data ?? []}
      />
    </div>
  );
}
