import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShoppingCart, Plus, FileUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import ComprasManager from './compras-manager';

export default async function ComprasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const [comprasRes, provRes] = await Promise.all([
    supabase
      .from('compras')
      .select('id, fecha, tipo_documento, numero_factura, moneda, cotizacion_usd, total_moneda_original, total_en_ars, estado, proveedor:proveedores(id, nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('proveedores').select('id, nombre').order('nombre'),
  ]);

  const compras = (comprasRes.data ?? []).map((c: any) => ({
    id: c.id, fecha: c.fecha, tipo_documento: c.tipo_documento ?? 'factura',
    numero_factura: c.numero_factura,
    moneda: c.moneda, cotizacion_usd: c.cotizacion_usd,
    total_moneda_original: c.total_moneda_original, total_en_ars: c.total_en_ars,
    estado: c.estado, proveedor_nombre: c.proveedor?.nombre ?? '',
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-[#006836]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Compras</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {empresa.nombre} · {compras.length} compra{compras.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/compras/importar"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#006836] text-[#006836] text-sm font-semibold rounded-xl hover:bg-[#006836]/5 transition-colors">
            <FileUp className="w-4 h-4" /> Importar factura
          </Link>
          <Link href="/app/compras/nueva"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] transition-colors">
            <Plus className="w-4 h-4" /> Nueva compra
          </Link>
        </div>
      </div>

      <ComprasManager
        compras={compras}
        proveedores={provRes.data ?? []}
        empresaNombre={empresa.nombre}
        esAdmin={user.email === 'juliobornes10@gmail.com'}
      />
    </div>
  );
}
