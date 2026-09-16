import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { redirect } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import ReferenciasPrecioManager from './referencias-precio-manager';
import { fetchPreciosPizarra } from '@/lib/precios-pizarra';

async function fetchCotizBNA(): Promise<number | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.venta ?? null;
  } catch {
    return null;
  }
}

export default async function ReferenciasPrecioPage() {
  const empresaResult = await getEmpresaActiva();
  if (!empresaResult) redirect('/login');
  const { empresa } = empresaResult;

  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [configRes, bcrPrecios, cotizBNA, ultimasRes] = await Promise.all([
    supabase
      .from('configuracion_empresa')
      .select('precio_combustible, cotizacion_usd, litros_por_uta')
      .eq('empresa_id', empresa.id)
      .maybeSingle(),
    fetchPreciosPizarra(),
    fetchCotizBNA(),
    supabase
      .from('referencias_precio')
      .select('tipo, valor, vigencia_desde')
      .eq('empresa_id', empresa.id)
      .in('tipo', ['gasoil', 'usd', 'maiz', 'sorgo', 'soja'])
      .order('vigencia_desde', { ascending: false }),
  ]);

  const config = configRes.data;

  // Última fecha registrada por tipo (para saber si falta la de hoy)
  const ultimaFechaPorTipo = new Map<string, string>();
  for (const r of ultimasRes.data ?? []) {
    if (!ultimaFechaPorTipo.has(r.tipo)) ultimaFechaPorTipo.set(r.tipo, r.vigencia_desde);
  }

  // Valores "actuales" según cada fuente en vivo (mismo criterio que el header y Configuración)
  const usdActual = config?.cotizacion_usd ?? cotizBNA ?? null;
  const candidatos: { tipo: string; nombre: string; valor: number | null; unidad: string }[] = [
    { tipo: 'gasoil', nombre: 'Gasoil / Diesel',     valor: config?.precio_combustible ?? null, unidad: '$/L' },
    { tipo: 'usd',    nombre: 'Dólar estadounidense', valor: usdActual,                          unidad: 'ARS/USD' },
    { tipo: 'maiz',   nombre: 'Maíz',                 valor: bcrPrecios?.maiz  ?? null,           unidad: 'tn' },
    { tipo: 'sorgo',  nombre: 'Sorgo',                valor: bcrPrecios?.sorgo ?? null,           unidad: 'tn' },
    { tipo: 'soja',   nombre: 'Soja',                 valor: bcrPrecios?.soja  ?? null,           unidad: 'tn' },
  ];

  // Auto-guardado: si hay un valor en vivo y no hay registro de hoy, insertar (mantiene el historial al día)
  const aInsertar = candidatos.filter((c) => c.valor != null && ultimaFechaPorTipo.get(c.tipo) !== hoy);
  if (aInsertar.length > 0) {
    const { error } = await supabase.from('referencias_precio').insert(
      aInsertar.map((c) => ({
        empresa_id:     empresa.id,
        tipo:           c.tipo,
        nombre:         c.nombre,
        valor:          c.valor!,
        unidad:         c.unidad,
        vigencia_desde: hoy,
      }))
    );
    if (error) console.error('[referencias-precio] Error auto-guardando:', error.message);
  }

  const { data: referencias } = await supabase
    .from('referencias_precio')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('tipo')
    .order('vigencia_desde', { ascending: false });

  // UTA es un valor derivado (gasoil × litros/UTA), no se guarda como referencia propia
  const litros = config?.litros_por_uta ?? null;
  const gasoilActual = config?.precio_combustible ?? null;
  const uta = gasoilActual && litros ? gasoilActual * litros : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-[#006836]/10 rounded-xl flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Referencias de Precio</h1>
          <p className="text-sm text-zinc-500">{empresa.nombre} — gasoil, mano de obra, tipo de cambio y otros índices</p>
        </div>
      </div>

      <ReferenciasPrecioManager
        referencias={(referencias as any[]) ?? []}
        empresaId={empresa.id}
        extraVigentes={uta != null ? [{ nombre: 'UTA', valor: uta, unidad: '$' }] : []}
      />
    </div>
  );
}
