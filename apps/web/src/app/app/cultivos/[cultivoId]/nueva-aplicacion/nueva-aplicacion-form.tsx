'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { crearAplicacion } from '../../actions';

interface Producto { id: string; nombre: string; unidad_base: string; }
interface Deposito { id: string; nombre: string; }
interface Props { cultivoId: string; productos: Producto[]; depositos: Deposito[]; }
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

let nextId = 1;

export default function NuevaAplicacionForm({ cultivoId, productos, depositos }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<'fitosanitaria' | 'fertilizacion' | 'siembra' | 'otro'>('fitosanitaria');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemForm[]>([
    { id: nextId++, producto_id: '', deposito_origen_id: '', cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' },
  ]);

  function addItem() {
    setItems((prev) => [...prev,
      { id: nextId++, producto_id: '', deposito_origen_id: depositos[0]?.id ?? '', cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' },
    ]);
  }
  function removeItem(id: number) { setItems((prev) => prev.filter((i) => i.id !== id)); }
  function updateItem(id: number, field: keyof ItemForm, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fecha) { setError('Ingresá la fecha de la aplicación.'); return; }
    for (const item of items) {
      if (!item.producto_id || !item.deposito_origen_id) { setError('Completá producto y depósito en todos los ítems.'); return; }
      if (!item.cantidad_retirada || Number(item.cantidad_retirada) <= 0) { setError('La cantidad retirada debe ser mayor a 0.'); return; }
    }

    setLoading(true);
    const result = await crearAplicacion({
      cultivo_id: cultivoId,
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
    router.push(`/app/cultivos/${cultivoId}`);
    router.refresh();
  }

  const productoMap = Object.fromEntries(productos.map((p) => [p.id, p]));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-700">Datos de la aplicación</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
            <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Productos aplicados</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>
            <Plus className="w-3.5 h-3.5 mr-1" />Agregar producto
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Depósito origen</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Cant. retirada</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Cant. aplicada</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Devuelta</th>
                <th className="text-right px-4 py-3 font-medium text-orange-500">Desvío</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const prod     = productoMap[item.producto_id];
                const retirada = Number(item.cantidad_retirada) || 0;
                const aplicada = Number(item.cantidad_aplicada) || retirada;
                const devuelta = Number(item.cantidad_devuelta) || 0;
                const perdida  = retirada > 0 ? Math.max(0, retirada - aplicada - devuelta) : 0;
                return (
                  <tr key={item.id} className={perdida > 0 ? 'bg-orange-50' : ''}>
                    <td className="px-4 py-3">
                      <select value={item.producto_id} onChange={(e) => updateItem(item.id, 'producto_id', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">Seleccioná…</option>
                        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={item.deposito_origen_id} onChange={(e) => updateItem(item.id, 'deposito_origen_id', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">Seleccioná…</option>
                        {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" step="0.001" value={item.cantidad_retirada}
                          onChange={(e) => { updateItem(item.id, 'cantidad_retirada', e.target.value); if (!item.cantidad_aplicada) updateItem(item.id, 'cantidad_aplicada', e.target.value); }}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0" />
                        <span className="text-xs text-slate-400">{prod?.unidad_base ?? ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" step="0.001" value={item.cantidad_aplicada}
                          onChange={(e) => updateItem(item.id, 'cantidad_aplicada', e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="= retirada" />
                        <span className="text-xs text-slate-400">{prod?.unidad_base ?? ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" step="0.001" value={item.cantidad_devuelta}
                          onChange={(e) => updateItem(item.id, 'cantidad_devuelta', e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0" />
                        <span className="text-xs text-slate-400">{prod?.unidad_base ?? ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {perdida > 0 ? (
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-orange-600">{perdida.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {prod?.unidad_base}</span>
                          <input type="text" value={item.causa_perdida} onChange={(e) => updateItem(item.id, 'causa_perdida', e.target.value)}
                            placeholder="Causa…" className="w-full rounded border border-orange-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                        </div>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-3">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>{loading ? 'Registrando…' : 'Registrar aplicación'}</Button>
        <Button type="button" variant="secondary" onClick={() => router.push(`/app/cultivos/${cultivoId}`)}>Cancelar</Button>
      </div>
    </form>
  );
}
