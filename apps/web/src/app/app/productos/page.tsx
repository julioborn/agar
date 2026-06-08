import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Package } from 'lucide-react';
import ProductosManager from './productos-manager';

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, nombre_factura, categoria, unidad_base, codigo_barras, codigo_interno, principio_activo, stock_minimo, requiere_trazabilidad')
    .order('categoria')
    .order('nombre');

  const total = productos?.length ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Productos</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · {total} producto{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <ProductosManager productos={productos ?? []} empresaId={empresa.id} />
    </div>
  );
}
