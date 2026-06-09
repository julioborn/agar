import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, FileText, Truck, Calendar, DollarSign, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { cn } from '@/lib/utils';

interface Props {
  params: Promise<{ compraId: string }>;
}

export default async function CompraDetallePage({ params }: Props) {
  const { compraId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { data: compra } = await supabase
    .from('compras')
    .select('*, proveedor:proveedores(nombre)')
    .eq('id', compraId)
    .single();

  if (!compra) notFound();

  const { data: items } = await supabase
    .from('compras_items')
    .select(`
      id,
      cantidad_presentacion,
      cantidad_unidad_base,
      precio_unitario_moneda_original,
      precio_unitario_ars,
      subtotal_moneda_original,
      subtotal_ars,
      producto:productos(nombre, unidad_base),
      presentacion:presentaciones(descripcion),
      deposito_destino:depositos!deposito_destino_id(nombre)
    `)
    .eq('compra_id', compraId);

  const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
  const num = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(n);

  const fechaDisplay = new Date(compra.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/app/compras" className="hover:text-slate-800 transition-colors">Compras</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-800 font-medium">
          {compra.numero_factura ?? fechaDisplay}
        </span>
      </nav>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {compra.numero_factura ? `Factura ${compra.numero_factura}` : `Compra del ${fechaDisplay}`}
          </h1>
          <span className={cn('mt-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium',
            compra.estado === 'confirmada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
            {compra.estado}
          </span>
        </div>
        <Link
          href={`/app/compras/${compraId}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Corregir ítems
        </Link>
      </div>

      {/* Cabecera de la compra */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Fecha</p>
              <p className="font-medium text-slate-800">{fechaDisplay}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Truck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Proveedor</p>
              <p className="font-medium text-slate-800">
                {(compra.proveedor as any)?.nombre ?? <span className="text-slate-400">—</span>}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Moneda</p>
              <p className="font-medium text-slate-800">
                {compra.moneda}
                {compra.moneda === 'USD' && compra.cotizacion_usd && (
                  <span className="text-slate-400 font-normal ml-1">@ {compra.cotizacion_usd}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">N° Factura</p>
              <p className="font-medium text-slate-800">{compra.numero_factura ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Ítems ({items?.length ?? 0})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Presentación</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Cantidad</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">
                  Precio unit. {compra.moneda}
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Depósito</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Subtotal ARS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(items ?? []).map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.producto?.nombre}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.presentacion?.descripcion ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {item.cantidad_presentacion != null
                      ? `${num(item.cantidad_presentacion)} × ${item.presentacion?.descripcion}`
                      : null}
                    <span className="block text-xs text-slate-400">
                      {num(item.cantidad_unidad_base)} {item.producto?.unidad_base}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {num(item.precio_unitario_moneda_original)} {compra.moneda}
                    {compra.moneda === 'USD' && (
                      <span className="block text-xs text-slate-400">
                        {ars.format(item.precio_unitario_ars)} ARS
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{(item.deposito_destino as any)?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {ars.format(item.subtotal_ars)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-6 text-sm">
          {compra.moneda === 'USD' && compra.total_moneda_original != null && (
            <span className="text-slate-500">
              Total USD: <strong className="text-slate-700">
                {num(compra.total_moneda_original)}
              </strong>
            </span>
          )}
          <span className="text-slate-600">
            Total ARS: <strong className="text-lg text-slate-900">
              {compra.total_en_ars != null ? ars.format(compra.total_en_ars) : '—'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
