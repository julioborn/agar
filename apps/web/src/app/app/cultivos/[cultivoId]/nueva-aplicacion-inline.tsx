'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crearAplicacion } from '../actions';

interface Producto { id: string; nombre: string; unidad_base: string; }
interface Deposito { id: string; nombre: string; }

interface Props {
  cultivoId: string;
  productos: Producto[];
  depositos: Deposito[];
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

const TIPO_COLOR: Record<string, string> = {
  fitosanitaria: 'bg-orange-100 text-orange-700',
  fertilizacion: 'bg-blue-100 text-blue-700',
  siembra:       'bg-[#006836]/10 text-[#006836]',
  otro:          'bg-zinc-100 text-zinc-600',
};

let _nextId = 1;
function newItem(depositoId = ''): ItemForm {
  return { id: _nextId++, producto_id: '', deposito_origen_id: depositoId, cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' };
}

export default function NuevaAplicacionInline({ cultivoId, productos, depositos, todayISO }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fecha, setFecha] = useState(todayISO);
  const [tipo, setTipo] = useState<'fitosanitaria' | 'fertilizacion' | 'siembra' | 'otro'>('fitosanitaria');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemForm[]>([newItem(depositos[0]?.id ?? '')]);

  function addItem() { setItems((p) => [...p, newItem(depositos[0]?.id ?? '')]); }
  function removeItem(id: number) { setItems((p) => p.filter((i) => i.id !== id)); }
  function update(id: number, field: keyof ItemForm, value: string) {
    setItems((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  function reset() {
    setFecha(todayISO);
    setTipo('fitosanitaria');
    setObservaciones('');
    setItems([newItem(depositos[0]?.id ?? '')]);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fecha) { setError('Ingresá la fecha.'); return; }
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
    reset();
    setOpen(false);
    router.refresh();
  }

  const productoMap = Object.fromEntries(productos.map((p) => [p.id, p]));

  return (
    <div className={cn(
      'bg-white rounded-2xl border overflow-hidden transition-all',
      open ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100',
    )}>
      {/* Header / trigger */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) reset(); }}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
            open ? 'bg-[#006836] text-white' : 'bg-[#006836]/10',
          )}>
            <FlaskConical className={cn('w-4 h-4', open ? 'text-white' : 'text-[#006836]')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Registrar aplicación</p>
            <p className="text-xs text-zinc-400">Fitosanitaria, fertilización, siembra…</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-400" />
          : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {/* Form expandido */}
      {open && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-5 space-y-5">

          {/* Cabecera: fecha, tipo, observaciones */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Observaciones</label>
              <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Opcional…"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40" />
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Productos</p>
              <button type="button" onClick={addItem}
                className="inline-flex items-center gap-1 text-xs text-[#006836] font-medium hover:underline">
                <Plus className="w-3.5 h-3.5" /> Agregar producto
              </button>
            </div>

            {items.map((item) => {
              const prod = productoMap[item.producto_id];
              const retirada = Number(item.cantidad_retirada) || 0;
              const aplicada = Number(item.cantidad_aplicada) || retirada;
              const devuelta = Number(item.cantidad_devuelta) || 0;
              const perdida = retirada > 0 ? Math.max(0, retirada - aplicada - devuelta) : 0;

              return (
                <div key={item.id} className={cn(
                  'rounded-xl border p-4 space-y-3',
                  perdida > 0 ? 'border-orange-200 bg-orange-50/30' : 'border-zinc-100 bg-zinc-50/50',
                )}>
                  {/* Fila 1: producto + depósito */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Producto</label>
                      <select value={item.producto_id} onChange={(e) => update(item.id, 'producto_id', e.target.value)}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white">
                        <option value="">Seleccioná…</option>
                        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Depósito origen</label>
                      <select value={item.deposito_origen_id} onChange={(e) => update(item.id, 'deposito_origen_id', e.target.value)}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white">
                        <option value="">Seleccioná…</option>
                        {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Fila 2: cantidades */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Retirado {prod && <span className="text-zinc-300">({prod.unidad_base})</span>}</label>
                      <input type="number" min="0" step="0.001" placeholder="0" value={item.cantidad_retirada}
                        onChange={(e) => { update(item.id, 'cantidad_retirada', e.target.value); if (!item.cantidad_aplicada) update(item.id, 'cantidad_aplicada', e.target.value); }}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Aplicado</label>
                      <input type="number" min="0" step="0.001" placeholder="= retirado" value={item.cantidad_aplicada}
                        onChange={(e) => update(item.id, 'cantidad_aplicada', e.target.value)}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Devuelto</label>
                      <input type="number" min="0" step="0.001" placeholder="0" value={item.cantidad_devuelta}
                        onChange={(e) => update(item.id, 'cantidad_devuelta', e.target.value)}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white" />
                    </div>
                  </div>

                  {/* Desvío + eliminar */}
                  <div className="flex items-center justify-between">
                    {perdida > 0 ? (
                      <div className="flex items-center gap-2 flex-1 mr-3">
                        <span className="text-xs font-semibold text-orange-600">
                          Desvío: {perdida.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {prod?.unidad_base}
                        </span>
                        <input type="text" value={item.causa_perdida} onChange={(e) => update(item.id, 'causa_perdida', e.target.value)}
                          placeholder="Causa del desvío…"
                          className="flex-1 text-xs border border-orange-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white" />
                      </div>
                    ) : <span />}
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(item.id)}
                        className="text-zinc-300 hover:text-red-400 transition-colors p-1 ml-auto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Acciones */}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
              <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-1', TIPO_COLOR[tipo])}>
                {TIPOS.find(t => t.value === tipo)?.label}
              </span>
              {loading ? 'Registrando…' : 'Confirmar aplicación'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
