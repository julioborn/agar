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
  const { rol, esSuperAdmin } = empresaData;
  if (!esSuperAdmin && rol !== 'admin_empresa') redirect(`/app/compras/${compraId}`);

  const { data: compra } = await supabase
    .from('compras')
    .select('id, numero_factura, fecha, moneda, cotizacion_usd, tipo_documento, proveedor_id, proveedor:proveedores(nombre)')
    .eq('id', compraId)
    .single();

  if (!compra) notFound();

  const [{ data: items }, { data: proveedores }, { data: depositos }] = await Promise.all([
    supabase
      .from('compras_items')
      .select(`
        id,
        cantidad_unidad_base,
        cantidad_presentacion,
        precio_unitario_moneda_original,
        precio_unitario_ars,
        subtotal_moneda_original,
        subtotal_ars,
        deposito_destino_id,
        producto:productos(id, nombre, unidad_base),
        presentacion:presentaciones(descripcion),
        deposito_destino:depositos!deposito_destino_id(nombre)
      `)
      .eq('compra_id', compraId)
      .order('id'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('empresa_id', empresaData.empresa.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('depositos')
      .select('id, nombre')
      .eq('empresa_id', empresaData.empresa.id)
      .order('nombre'),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Editar factura · {(compra as any).numero_factura ?? compra.fecha}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Modificá cabecera e ítems. El stock se recalcula automáticamente al guardar.
        </p>
      </div>

      <EditarCompraForm
        compraId={compraId}
        compra={compra as any}
        items={(items ?? []) as any}
        proveedores={proveedores ?? []}
        depositos={depositos ?? []}
      />
    </div>
  );
}
