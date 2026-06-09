import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import EditarCompraForm from './editar-compra-form';

interface Props {
  params: Promise<{ compraId: string }>;
}

export default async function EditarCompraPage({ params }: Props) {
  const { compraId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { data: compra } = await supabase
    .from('compras')
    .select('id, numero_factura, fecha, moneda, proveedor:proveedores(nombre)')
    .eq('id', compraId)
    .single();

  if (!compra) notFound();

  const { data: items } = await supabase
    .from('compras_items')
    .select(`
      id,
      cantidad_unidad_base,
      cantidad_presentacion,
      precio_unitario_moneda_original,
      precio_unitario_ars,
      subtotal_moneda_original,
      subtotal_ars,
      producto:productos(id, nombre, unidad_base),
      presentacion:presentaciones(descripcion),
      deposito_destino:depositos!deposito_destino_id(nombre)
    `)
    .eq('compra_id', compraId)
    .order('id');

  const fechaDisplay = new Date((compra as any).fecha + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Corregir ítems · {(compra as any).numero_factura ?? fechaDisplay}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {((compra as any).proveedor as any)?.nombre ?? '—'} · Modificá las cantidades y guardá para actualizar el stock automáticamente.
        </p>
      </div>

      <EditarCompraForm
        compraId={compraId}
        moneda={(compra as any).moneda}
        items={(items ?? []) as any}
      />
    </div>
  );
}
