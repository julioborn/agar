import { redirect } from 'next/navigation';
import { Sprout } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import ProduccionReport from './produccion-report';

export default async function ProduccionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const { data: riasRaw } = await supabase
    .from('remitos_internos')
    .select(`
      id, lote_id, superficie_afectada, cultivo_descripcion, cultivo_id, campania_id,
      lote:lotes(nombre, campo:campos(nombre)),
      cultivo:cultivos(id, cultivo)
    `)
    .eq('empresa_id', empresa.id)
    .eq('estado', 'confirmado');

  // Preferir el nombre vigente del cultivo (ya normalizado a mayúsculas) por
  // sobre cultivo_descripcion, que es una foto fija tomada al crear el RIA.
  const rias = ((riasRaw ?? []) as any[]).map((r) => ({
    ...r,
    cultivo_descripcion: r.cultivo?.cultivo ?? r.cultivo_descripcion ?? null,
  }));
  const confirmedIds = rias.map((r) => r.id as string);

  const [produccionRes, campaniasRes] = await Promise.all([
    confirmedIds.length > 0
      ? supabase
          .from('remitos_produccion')
          .select(`
            remito_id, cantidad, humedad_porcentaje, precio_referencia, subtotal_valor,
            producto:productos(nombre, unidad_base)
          `)
          .in('remito_id', confirmedIds)
      : Promise.resolve({ data: [] }),

    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Sprout className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Producción</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Producción registrada en RIAs confirmados</p>
        </div>
      </div>

      <ProduccionReport
        rias={rias}
        produccion={(produccionRes.data ?? []) as any[]}
        campanias={campaniasRes.data ?? []}
      />
    </div>
  );
}
