import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { BarChart2 } from 'lucide-react';
import StockManager from './stock-manager';

export default async function StockPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const [{ data: rawStock }, { data: ultimasCompras }] = await Promise.all([
    supabase
      .from('stock')
      .select(`
        id,
        cantidad_actual,
        producto:productos(id, nombre, categoria, unidad_base, stock_minimo),
        deposito:depositos(id, nombre)
      `)
      .order('cantidad_actual', { ascending: false }),
    supabase
      .from('compras_items')
      .select('producto_id, precio_unitario_ars, compra:compras!inner(fecha)')
      .order('fecha', { referencedTable: 'compras', ascending: false }),
  ]);

  // Precio de la última compra por producto (la primera aparición = la más reciente)
  const precioUltimo: Record<string, number> = {};
  for (const item of ultimasCompras ?? []) {
    if (!precioUltimo[(item as any).producto_id]) {
      precioUltimo[(item as any).producto_id] = Number((item as any).precio_unitario_ars ?? 0);
    }
  }

  const stockRows = (rawStock ?? []).map((r: any) => ({
    id: r.id,
    cantidad_actual: r.cantidad_actual ?? 0,
    producto_id: r.producto?.id ?? '',
    producto_nombre: r.producto?.nombre ?? '—',
    producto_categoria: r.producto?.categoria ?? '',
    producto_unidad_base: r.producto?.unidad_base ?? '',
    producto_stock_minimo: r.producto?.stock_minimo ?? 0,
    deposito_id: r.deposito?.id ?? '',
    deposito_nombre: r.deposito?.nombre ?? '—',
    precio_ultimo: precioUltimo[r.producto?.id ?? ''] ?? null,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Stock</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · se actualiza automáticamente al registrar compras y aplicaciones
          </p>
        </div>
      </div>

      <StockManager stockRows={stockRows} empresaNombre={empresa.nombre} />
    </div>
  );
}
