'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { crearCompra } from '../actions';

interface Proveedor { id: string; nombre: string; }
interface Producto  { id: string; nombre: string; unidad_base: string; }
interface Presentacion { id: string; producto_id: string; descripcion: string; factor_a_unidad_base: number; }
interface Deposito  { id: string; nombre: string; }

interface ItemDraft {
  _id: string;
  producto_id: string;
  presentacion_id: string;
  cantidad: string;
  precio_unitario: string;
  deposito_id: string;
}

interface Props {
  proveedores: Proveedor[];
  productos: Producto[];
  presentaciones: Presentacion[];
  depositos: Deposito[];
}

function uid() { return Math.random().toString(36).slice(2); }

function itemVacio(): ItemDraft {
  return { _id: uid(), producto_id: '', presentacion_id: '', cantidad: '', precio_unitario: '', deposito_id: '' };
}

export default function NuevaCompraForm({ proveedores, productos, presentaciones, depositos }: Props) {
  const router = useRouter();

  // Cabecera
  const [proveedorId, setProveedorId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [nroFactura, setNroFactura] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [cotizacion, setCotizacion] = useState('');

  // Ítems
  const [items, setItems] = useState<ItemDraft[]>([itemVacio()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── helpers de cálculo ──────────────────────────────────────────────────────
  function getPresentaciones(productoId: string) {
    return presentaciones.filter((p) => p.producto_id === productoId);
  }

  function calcularItem(item: ItemDraft) {
    const producto = productos.find((p) => p.id === item.producto_id);
    const presentacion = presentaciones.find((p) => p.id === item.presentacion_id);
    const cantNum = parseFloat(item.cantidad) || 0;
    const precioNum = parseFloat(item.precio_unitario) || 0;
    const cotizNum = parseFloat(cotizacion) || 1;

    const cantidad_unidad_base = presentacion
      ? cantNum * Number(presentacion.factor_a_unidad_base)
      : cantNum;

    const precio_ars = moneda === 'USD' ? precioNum * cotizNum : precioNum;
    const subtotal_orig = cantNum * precioNum;
    const subtotal_ars = moneda === 'USD' ? subtotal_orig * cotizNum : subtotal_orig;

    return { producto, presentacion, cantidad_unidad_base, precio_ars, subtotal_orig, subtotal_ars };
  }

  const totales = items.reduce(
    (acc, item) => {
      const { subtotal_orig, subtotal_ars } = calcularItem(item);
      return { orig: acc.orig + subtotal_orig, ars: acc.ars + subtotal_ars };
    },
    { orig: 0, ars: 0 }
  );

  // ── manejo de ítems ─────────────────────────────────────────────────────────
  function updateItem(id: string, field: keyof ItemDraft, value: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item._id !== id) return item;
        // Si cambia el producto, resetear presentación
        if (field === 'producto_id') return { ...item, producto_id: value, presentacion_id: '' };
        return { ...item, [field]: value };
      })
    );
  }

  function removeItem(id: string) {
    if (items.length === 1) return; // al menos un ítem
    setItems((prev) => prev.filter((i) => i._id !== id));
  }

  // ── submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (moneda === 'USD' && (!cotizacion || parseFloat(cotizacion) <= 0)) {
      setError('Ingresá la cotización del dólar.');
      return;
    }
    for (const item of items) {
      if (!item.producto_id)     { setError('Todos los ítems deben tener un producto.'); return; }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) { setError('La cantidad de cada ítem debe ser mayor a cero.'); return; }
      if (!item.precio_unitario || parseFloat(item.precio_unitario) <= 0) { setError('El precio unitario de cada ítem debe ser mayor a cero.'); return; }
      if (!item.deposito_id)     { setError('Seleccioná el depósito de destino para cada ítem.'); return; }
    }

    setLoading(true);
    const cotizNum = parseFloat(cotizacion) || null;

    const itemsData = items.map((item) => {
      const presentacion = presentaciones.find((p) => p.id === item.presentacion_id);
      const cantNum = parseFloat(item.cantidad);
      const precioNum = parseFloat(item.precio_unitario);
      const cotizReal = cotizNum ?? 1;

      const cantidad_unidad_base = presentacion
        ? cantNum * Number(presentacion.factor_a_unidad_base)
        : cantNum;

      const precio_ars = moneda === 'USD' ? precioNum * cotizReal : precioNum;
      const subtotal_orig = cantNum * precioNum;
      const subtotal_ars = moneda === 'USD' ? subtotal_orig * cotizReal : subtotal_orig;

      return {
        producto_id: item.producto_id,
        presentacion_id: item.presentacion_id || null,
        cantidad_presentacion: presentacion ? cantNum : null,
        cantidad_unidad_base,
        precio_unitario_moneda_original: precioNum,
        precio_unitario_ars: precio_ars,
        subtotal_moneda_original: subtotal_orig,
        subtotal_ars,
        deposito_destino_id: item.deposito_id,
      };
    });

    const result = await crearCompra({
      proveedor_id: proveedorId || null,
      fecha,
      numero_factura: nroFactura || null,
      moneda,
      cotizacion_usd: moneda === 'USD' ? cotizNum : null,
      total_moneda_original: totales.orig,
      total_en_ars: totales.ars,
      items: itemsData,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push(`/app/compras/${result.compraId}`);
    }
  }

  const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
  const num = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(n);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Cabecera ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Cabecera</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Proveedor</label>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50">
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <Input id="comp-fecha" label="Fecha" type="date" value={fecha}
            onChange={(e) => setFecha(e.target.value)} required disabled={loading} />

          <Input id="comp-nro" label="N° de factura" placeholder="Opcional"
            value={nroFactura} onChange={(e) => setNroFactura(e.target.value)} disabled={loading} />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')} disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50">
              <option value="ARS">ARS — Pesos</option>
              <option value="USD">USD — Dólares</option>
            </select>
          </div>

          {moneda === 'USD' && (
            <Input id="comp-cotiz" label="Cotización USD (1 USD = X ARS)" type="number" step="0.01" min="0.01"
              placeholder="Ej: 1050" value={cotizacion}
              onChange={(e) => setCotizacion(e.target.value)} required disabled={loading} />
          )}
        </div>
      </div>

      {/* ── Ítems ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Productos comprados</h2>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => setItems((prev) => [...prev, itemVacio()])} disabled={loading}>
            <Plus className="w-3 h-3 mr-1" />Agregar producto
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[200px]">Producto</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[150px]">Presentación</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[90px]">Cantidad</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[80px]">Unid. base</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[110px]">
                  Precio unit. {moneda === 'USD' ? '(USD)' : '(ARS)'}
                </th>
                {moneda === 'USD' && (
                  <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[90px]">P. unit ARS</th>
                )}
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[160px]">Depósito destino</th>
                <th className="text-right px-3 py-2.5 font-medium text-slate-500 w-[110px]">Subtotal ARS</th>
                <th className="w-[36px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const { producto, cantidad_unidad_base, precio_ars, subtotal_ars } = calcularItem(item);
                const presOpciones = getPresentaciones(item.producto_id);

                return (
                  <tr key={item._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <select value={item.producto_id}
                        onChange={(e) => updateItem(item._id, 'producto_id', e.target.value)}
                        disabled={loading}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50">
                        <option value="">Seleccionar...</option>
                        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={item.presentacion_id}
                        onChange={(e) => updateItem(item._id, 'presentacion_id', e.target.value)}
                        disabled={loading || presOpciones.length === 0}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50">
                        <option value="">
                          {presOpciones.length === 0 ? 'Sin presentaciones' : 'Unidad base'}
                        </option>
                        {presOpciones.map((p) => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" placeholder="0"
                        value={item.cantidad}
                        onChange={(e) => updateItem(item._id, 'cantidad', e.target.value)}
                        disabled={loading}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50" />
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {item.producto_id && parseFloat(item.cantidad) > 0
                        ? `${num(cantidad_unidad_base)} ${producto?.unidad_base ?? ''}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" placeholder="0.00"
                        value={item.precio_unitario}
                        onChange={(e) => updateItem(item._id, 'precio_unitario', e.target.value)}
                        disabled={loading}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50" />
                    </td>
                    {moneda === 'USD' && (
                      <td className="px-3 py-2 text-slate-500 text-xs">
                        {precio_ars > 0 ? ars.format(precio_ars) : '—'}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <select value={item.deposito_id}
                        onChange={(e) => updateItem(item._id, 'deposito_id', e.target.value)}
                        disabled={loading}
                        className={cn('w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50',
                          !item.deposito_id ? 'border-amber-300 bg-amber-50' : 'border-slate-300')}>
                        <option value="">Seleccionar...</option>
                        {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-medium text-slate-700">
                      {subtotal_ars > 0 ? ars.format(subtotal_ars) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeItem(item._id)} disabled={loading || items.length === 1}
                        className="text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-6 text-sm">
          {moneda === 'USD' && (
            <span className="text-slate-500">
              Total USD: <strong className="text-slate-700">{num(totales.orig)}</strong>
            </span>
          )}
          <span className="text-slate-600">
            Total ARS: <strong className="text-lg text-slate-900">{ars.format(totales.ars)}</strong>
          </span>
        </div>
      </div>

      {/* ── Error y submit ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" disabled={loading}
          onClick={() => router.push('/app/compras')}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} size="lg">
          {loading ? 'Registrando...' : 'Registrar compra'}
        </Button>
      </div>
    </form>
  );
}
