import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import AplicarForm from './aplicar-form';

interface Props {
  searchParams: Promise<{ cultivo?: string }>;
}

export default async function AplicarPage({ searchParams }: Props) {
  const { cultivo: cultivoPreseleccionado } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  // Cultivos activos: planificados y en curso
  const { data: cultivos } = await supabase
    .from('cultivos')
    .select(`
      id, cultivo, lote_id,
      lote:lotes!inner(id, nombre, campo:campos!inner(nombre))
    `)
    .in('estado', ['planificada', 'en_curso'])
    .order('cultivo');

  // Depósitos de la empresa
  const { data: depositos } = await supabase
    .from('depositos')
    .select('id, nombre')
    .order('nombre');

  // Stock por producto (la tabla `stock` tiene una fila por depósito+producto)
  const { data: stockRows } = await supabase
    .from('stock')
    .select('producto_id, cantidad_actual')
    .gt('cantidad_actual', 0);

  // Sumar stock total por producto
  const stockPorProducto: Record<string, number> = {};
  for (const s of stockRows ?? []) {
    stockPorProducto[s.producto_id] = (stockPorProducto[s.producto_id] ?? 0) + Number(s.cantidad_actual);
  }

  // Todos los productos, filtramos en memoria los que tienen stock > 0
  const { data: productosRaw } = await supabase
    .from('productos')
    .select('id, nombre, unidad_base')
    .order('nombre');

  const productos = (productosRaw ?? [])
    .filter((p: any) => (stockPorProducto[p.id] ?? 0) > 0)
    .map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      unidad_base: p.unidad_base,
      stock_actual: stockPorProducto[p.id] ?? 0,
    }));

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-900 mb-6">Nueva aplicación</h1>
      <AplicarForm
        cultivos={(cultivos ?? []).map((c: any) => ({
          id: c.id,
          lote_id: c.lote_id ?? c.lote?.id ?? '',
          lote_nombre: c.lote?.nombre ?? '',
          campo_nombre: c.lote?.campo?.nombre ?? '',
          cultivo_nombre: c.cultivo,
          label: `${c.cultivo} — ${c.lote?.nombre} (${c.lote?.campo?.nombre})`,
        }))}
        depositos={depositos ?? []}
        productos={productos}
        cultivoPreseleccionado={cultivoPreseleccionado ?? null}
      />
    </div>
  );
}
