'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { crearAplicacion } from './actions';

interface Cultivo  { id: string; label: string; }
interface Deposito { id: string; nombre: string; }
interface Producto { id: string; nombre: string; unidad_base: string; stock_actual: number; }

interface Props {
  cultivos: Cultivo[];
  depositos: Deposito[];
  productos: Producto[];
  cultivoPreseleccionado: string | null;
}

interface ItemForm {
  key: number;
  producto_id: string;
  deposito_id: string;
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

const select = 'w-full rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#006836]/40';
const input  = 'w-full rounded-xl border border-zinc-200 px-3 py-3 text-base text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#006836]/40';

let keyCounter = 1;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AplicarForm({ cultivos, depositos, productos, cultivoPreseleccionado }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  const [cultivoId,     setCultivoId]     = useState(cultivoPreseleccionado ?? '');
  const [fecha,         setFecha]         = useState(todayISO());
  const [tipo,          setTipo]          = useState<'fitosanitaria' | 'fertilizacion' | 'siembra' | 'otro'>('fitosanitaria');
  const [observaciones, setObservaciones] = useState('');

  const [items, setItems] = useState<ItemForm[]>([
    { key: keyCounter++, producto_id: '', deposito_id: depositos[0]?.id ?? '', cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' },
  ]);

  const productoMap = Object.fromEntries(productos.map((p) => [p.id, p]));

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: keyCounter++, producto_id: '', deposito_id: depositos[0]?.id ?? '', cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: number, field: keyof ItemForm, value: string) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, [field]: value } : i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!cultivoId)       { setError('Seleccioná un cultivo.'); return; }
    if (!fecha)           { setError('Ingresá la fecha.'); return; }
    if (items.length === 0) { setError('Agregá al menos un producto.'); return; }

    for (const item of items) {
      if (!item.producto_id)  { setError('Seleccioná un producto en todos los ítems.'); return; }
      if (!item.deposito_id)  { setError('Seleccioná un depósito en todos los ítems.'); return; }
      if (!item.cantidad_retirada || Number(item.cantidad_retirada) <= 0) {
        setError('La cantidad retirada debe ser mayor a 0.'); return;
      }
    }

    setLoading(true);
    const result = await crearAplicacion({
      cultivo_id: cultivoId,
      fecha,
      tipo,
      observaciones: observaciones.trim() || undefined,
      items: items.map((i) => {
        const retirada = Number(i.cantidad_retirada);
        const aplicada = Number(i.cantidad_aplicada) || retirada;
        const devuelta = Number(i.cantidad_devuelta)  || 0;
        return {
          producto_id:        i.producto_id,
          deposito_origen_id: i.deposito_id,
          cantidad_retirada:  retirada,
          cantidad_aplicada:  aplicada,
          cantidad_devuelta:  devuelta,
          causa_perdida:      i.causa_perdida.trim() || undefined,
        };
      }),
    });
    setLoading(false);

    if (result.error) { setError(result.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#006836]/10 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-[#006836]" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900">¡Aplicación registrada!</h2>
          <p className="text-zinc-500 text-sm mt-1">El stock se actualizó correctamente.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              setDone(false);
              setItems([{ key: keyCounter++, producto_id: '', deposito_id: depositos[0]?.id ?? '', cantidad_retirada: '', cantidad_aplicada: '', cantidad_devuelta: '0', causa_perdida: '' }]);
              setObservaciones('');
            }}
            className="w-full bg-[#006836] hover:bg-[#005228] text-white font-semibold py-3.5 rounded-xl text-base transition-colors"
          >
            Nueva aplicación
          </button>
          <button
            onClick={() => router.push('/campo')}
            className="w-full bg-white border border-zinc-200 text-zinc-700 font-semibold py-3.5 rounded-xl text-base transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cultivo */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Cultivo *</label>
          <select value={cultivoId} onChange={(e) => setCultivoId(e.target.value)} className={select}>
            <option value="">Seleccioná un cultivo…</option>
            {cultivos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={select} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Tipo *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={select}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Observaciones</label>
          <input
            type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Opcional…" className={select}
          />
        </div>
      </div>

      {/* Productos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-700">Productos aplicados</h2>
          <button
            type="button" onClick={addItem}
            className="flex items-center gap-1.5 text-[#006836] text-sm font-semibold py-1.5 px-3 rounded-lg bg-[#006836]/10 hover:bg-[#006836]/15 active:bg-[#006836]/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>

        {items.map((item, idx) => {
          const prod    = productoMap[item.producto_id];
          const unidad  = prod?.unidad_base ?? '';
          const retirada = Number(item.cantidad_retirada) || 0;
          const aplicada = Number(item.cantidad_aplicada) || 0;
          const devuelta = Number(item.cantidad_devuelta)  || 0;
          const perdida  = retirada > 0 ? Math.max(0, retirada - (aplicada || retirada) - devuelta) : 0;

          return (
            <div key={item.key} className={`bg-white rounded-2xl border p-4 space-y-3 ${perdida > 0 ? 'border-orange-300' : 'border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Producto {idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.key)} className="text-zinc-400 hover:text-red-500 p-1 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1.5">Producto *</label>
                <select value={item.producto_id} onChange={(e) => updateItem(item.key, 'producto_id', e.target.value)} className={select}>
                  <option value="">Seleccioná…</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.stock_actual} {p.unidad_base})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1.5">Depósito origen *</label>
                <select value={item.deposito_id} onChange={(e) => updateItem(item.key, 'deposito_id', e.target.value)} className={select}>
                  <option value="">Seleccioná…</option>
                  {depositos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Retirado {unidad && `(${unidad})`} *</label>
                  <input type="number" inputMode="decimal" min="0" step="0.001"
                    value={item.cantidad_retirada} onChange={(e) => updateItem(item.key, 'cantidad_retirada', e.target.value)}
                    placeholder="0" className={input} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Aplicado {unidad && `(${unidad})`}</label>
                  <input type="number" inputMode="decimal" min="0" step="0.001"
                    value={item.cantidad_aplicada} onChange={(e) => updateItem(item.key, 'cantidad_aplicada', e.target.value)}
                    placeholder="= retirado" className={input} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Devuelto {unidad && `(${unidad})`}</label>
                  <input type="number" inputMode="decimal" min="0" step="0.001"
                    value={item.cantidad_devuelta} onChange={(e) => updateItem(item.key, 'cantidad_devuelta', e.target.value)}
                    placeholder="0" className={input} />
                </div>
              </div>

              {perdida > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-semibold text-orange-700">
                    ⚠ Desvío: {perdida.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {unidad} no justificados
                  </p>
                  <p className="text-xs text-orange-600">Se imputará como pérdida al costo del lote. Informá la causa:</p>
                  <input
                    type="text" value={item.causa_perdida}
                    onChange={(e) => updateItem(item.key, 'causa_perdida', e.target.value)}
                    placeholder="Ej: derrame, evaporación, calibración…"
                    className="w-full rounded-xl border border-orange-300 px-3 py-2.5 text-sm text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="w-full bg-[#006836] hover:bg-[#005228] active:bg-[#004020] disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-lg transition-colors shadow-sm"
      >
        {loading ? 'Registrando…' : 'Registrar aplicación'}
      </button>

      <button
        type="button" onClick={() => router.push('/campo')}
        className="w-full bg-white border border-zinc-200 text-zinc-600 font-semibold py-3.5 rounded-2xl text-base transition-colors"
      >
        Cancelar
      </button>
    </form>
  );
}
