'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { crearAplicacion } from '../../actions';

interface Producto {
  id: string;
  nombre: string;
  unidad_base: string;
}

interface Deposito {
  id: string;
  nombre: string;
}

interface Props {
  campaniaId: string;
  productos: Producto[];
  depositos: Deposito[];
  /** producto_id:deposito_id → precio_unitario_ars */
  preciosMap: Record<string, number>;
  /** producto_id → precio más reciente (sin importar depósito) */
  preciosPorProducto: Record<string, number>;
  todayISO: string;
}

interface ItemForm {
  id: number;
  producto_id: string;
  deposito_origen_id: string;
  cantidad_retirada: string;
  cantidad_aplicada: string;
  cantidad_devuelta: string;
  causa_perdida: string;
}

const TIPOS = [
  { value: 'fitosanitaria', label: 'Fitosanitaria' },
  { value: 'fertilizacion', label: 'Fertilización' },
  { value: 'siembra',       label: 'Siembra' },
  { value: 'otro',          label: 'Otro' },
] as const;

const arsFormat = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

let nextId = 1;

export default function NuevaAplicacionForm({
  campaniaId, productos, depositos, preciosMap, preciosPorProducto, todayISO,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fecha, setFecha] = useState(todayISO);
  const [tipo, setTipo] = useState<'fitosanitaria' | 'fertilizacion' | 'siembra' | 'otro'>('fitosanitaria');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemForm[]>([
    { id: nextId++, producto_id: '', deposito_origen_id: depositos[0]?.id ?? '', cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' },
  ]);

  function getPrecio(productoId: string, depositoId: string): number | null {
    if (productoId && depositoId) {
      const key = `${productoId}:${depositoId}`;
      if (key in preciosMap) return preciosMap[key];
    }
    if (productoId && productoId in preciosPorProducto) return preciosPorProducto[productoId];
    return null;
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: nextId++, producto_id: '', deposito_origen_id: depositos[0]?.id ?? '', cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' },
    ]);
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: number, field: keyof ItemForm, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fecha) { setError('Ingresá la fecha de la aplicación.'); return; }
    if (items.length === 0) { setError('Agregá al menos un ítem.'); return; }

    for (const item of items) {
      if (!item.producto_id || !item.deposito_origen_id) {
        setError('Completá producto y depósito en todos los ítems.');
        return;
      }
      if (!item.cantidad_retirada || Number(item.cantidad_retirada) <= 0) {
        setError('La cantidad retirada debe ser mayor a 0 en todos los ítems.');
        return;
      }
    }

    setLoading(true);
    const result = await crearAplicacion({
      campania_id: campaniaId,
      fecha,
      tipo,
      observaciones: observaciones.trim() || undefined,
      items: items.map((i) => ({
        producto_id: i.producto_id,
        deposito_origen_id: i.deposito_origen_id,
        cantidad_retirada: Number(i.cantidad_retirada),
        cantidad_aplicada: Number(i.cantidad_aplicada) || Number(i.cantidad_retirada),
        cantidad_devuelta: Number(i.cantidad_devuelta) || 0,
        causa_perdida: i.causa_perdida.trim() || undefined,
      })),
    });
    setLoading(false);

    if (result.error) { setError(result.error); return; }
    router.push(`/app/cultivos/${campaniaId}`);
    router.refresh();
  }

  const productoMap = Object.fromEntries(productos.map((p) => [p.id, p]));

  // Total estimado de todos los ítems
  const totalEstimado = items.reduce((acc, item) => {
    const precio = getPrecio(item.producto_id, item.deposito_origen_id);
    const aplicada = Number(item.cantidad_aplicada) || Number(item.cantidad_retirada) || 0;
    return acc + (precio ?? 0) * aplicada;
  }, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cabecera */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-700">Datos de la aplicación</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {fecha === todayISO && (
              <p className="text-xs text-slate-400 mt-1">Hoy</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Productos aplicados</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>
            <Plus className="w-3.5 h-3.5 mr-1" />Agregar producto
          </Button>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const prod     = productoMap[item.producto_id];
            const retirada = Number(item.cantidad_retirada) || 0;
            const aplicada = Number(item.cantidad_aplicada) || retirada;
            const devuelta = Number(item.cantidad_devuelta) || 0;
            const perdida  = retirada > 0 ? Math.max(0, retirada - aplicada - devuelta) : 0;
            const precio   = getPrecio(item.producto_id, item.deposito_origen_id);
            const costoRetirado  = precio != null ? precio * retirada : null;
            const costoAplicado  = precio != null ? precio * aplicada : null;
            const costoPerdida   = precio != null ? precio * perdida : null;

            return (
              <div key={item.id} className={`p-4 space-y-3 ${perdida > 0 ? 'bg-orange-50' : ''}`}>
                {/* Fila 1: selects */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Producto</label>
                    <select
                      value={item.producto_id}
                      onChange={(e) => updateItem(item.id, 'producto_id', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Seleccioná…</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Depósito origen</label>
                    <select
                      value={item.deposito_origen_id}
                      onChange={(e) => updateItem(item.id, 'deposito_origen_id', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Seleccioná…</option>
                      {depositos.map((d) => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Precio de referencia */}
                {item.producto_id && (
                  <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${precio != null ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'}`}>
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    {precio != null
                      ? <>Último precio de compra: <strong>{arsFormat.format(precio)}/{prod?.unidad_base ?? 'u'}</strong>{!preciosMap[`${item.producto_id}:${item.deposito_origen_id}`] && item.deposito_origen_id ? ' (otro depósito)' : ''}</>
                      : 'Sin compras registradas para este producto — se usará precio $0'}
                  </div>
                )}

                {/* Fila 2: cantidades */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Cant. retirada</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" step="0.001"
                        value={item.cantidad_retirada}
                        onChange={(e) => {
                          updateItem(item.id, 'cantidad_retirada', e.target.value);
                          if (!item.cantidad_aplicada) {
                            updateItem(item.id, 'cantidad_aplicada', e.target.value);
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                      />
                      <span className="text-xs text-slate-400 shrink-0">{prod?.unidad_base ?? ''}</span>
                    </div>
                    {costoRetirado != null && retirada > 0 && (
                      <p className="text-xs text-slate-500 mt-1">{arsFormat.format(costoRetirado)}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Cant. aplicada</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" step="0.001"
                        value={item.cantidad_aplicada}
                        onChange={(e) => updateItem(item.id, 'cantidad_aplicada', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="= retirada"
                      />
                      <span className="text-xs text-slate-400 shrink-0">{prod?.unidad_base ?? ''}</span>
                    </div>
                    {costoAplicado != null && aplicada > 0 && (
                      <p className="text-xs text-green-700 font-medium mt-1">{arsFormat.format(costoAplicado)}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Devuelta</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" step="0.001"
                        value={item.cantidad_devuelta}
                        onChange={(e) => updateItem(item.id, 'cantidad_devuelta', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                      />
                      <span className="text-xs text-slate-400 shrink-0">{prod?.unidad_base ?? ''}</span>
                    </div>
                  </div>
                </div>

                {/* Desvío */}
                {perdida > 0 && (
                  <div className="bg-orange-100 rounded-lg px-3 py-2 space-y-1.5">
                    <p className="text-xs font-semibold text-orange-700">
                      Desvío: {perdida.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {prod?.unidad_base}
                      {costoPerdida != null && <> · {arsFormat.format(costoPerdida)}</>}
                    </p>
                    <input
                      type="text"
                      value={item.causa_perdida}
                      onChange={(e) => updateItem(item.id, 'causa_perdida', e.target.value)}
                      placeholder="Causa del desvío (derrame, evaporación…)"
                      className="w-full rounded border border-orange-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                )}

                {/* Eliminar ítem */}
                {items.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />Quitar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total estimado */}
        {totalEstimado > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
            <span className="text-sm text-slate-600">
              Costo total estimado: <strong className="text-slate-900 text-base">{arsFormat.format(totalEstimado)}</strong>
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Registrando…' : 'Registrar aplicación'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/app/cultivos/${campaniaId}`)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
