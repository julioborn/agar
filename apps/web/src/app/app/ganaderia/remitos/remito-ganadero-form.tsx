'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle, Package, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useCurrency } from '@/lib/currency-context';
import {
  saveRemitoGanaderoBorrador, confirmarRemitoGanadero, anularRemitoGanadero, eliminarRemitoGanadero,
} from './actions';

export interface LoteHaciendaOpcion { id: string; nombre: string; ubicacion: string; }
export interface DepositoOpcion { id: string; nombre: string; }
export interface ProductoOpcion { id: string; nombre: string; categoria: string; unidad_base: string; rubro: string; }

export interface InsumoGanaderoLine {
  _id: string;
  depositoId: string;
  productoId: string;
  cantidad: string;
  costoUnitario: string;
  subtotal: number;
  obs: string;
  productoNombre: string;
  unidadBase: string;
  stockDisponible: number | null;
  sinPrecioCompra: boolean;
}

export interface RemitoGanaderoExistente {
  id: string;
  numero_rig: string;
  fecha: string;
  estado: string;
  lote_hacienda_id: string;
  observaciones?: string;
  total_insumos: number;
  insumos: {
    id: string; depositoId: string; productoId: string;
    productoNombre: string; unidadBase: string;
    cantidad: number; costoUnitario: number; subtotal: number; obs?: string;
  }[];
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  lotesHacienda: LoteHaciendaOpcion[];
  depositos: DepositoOpcion[];
  productos: ProductoOpcion[];
  empresaId: string;
  remitoExistente?: RemitoGanaderoExistente;
}

const CATEGORIA_LABEL: Record<string, string> = {
  veterinario: 'Veterinario', nucleo_proteico: 'Núcleo proteico', sal_mineral: 'Sal mineral', produccion: 'Producción propia',
};

let _lineCounter = 0;
const nextId = () => `lg-${++_lineCounter}`;
const today = () => new Date().toISOString().split('T')[0];
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const calc = (cant: string, costo: string) => Math.round(parseFloat(cant || '0') * parseFloat(costo || '0') * 100) / 100;

export default function RemitoGanaderoForm({ mode, lotesHacienda, depositos, productos, empresaId, remitoExistente }: Props) {
  const router = useRouter();
  const { formatMoney } = useCurrency();
  const esReadOnly = mode === 'ver';

  const [fecha, setFecha] = useState(remitoExistente?.fecha ?? today());
  const [loteHaciendaId, setLoteHaciendaId] = useState(remitoExistente?.lote_hacienda_id ?? '');
  const [observaciones, setObservaciones] = useState(remitoExistente?.observaciones ?? '');
  const [insumos, setInsumos] = useState<InsumoGanaderoLine[]>(() =>
    (remitoExistente?.insumos ?? []).map((i) => ({
      _id: nextId(),
      depositoId: i.depositoId, productoId: i.productoId,
      cantidad: i.cantidad.toString(), costoUnitario: i.costoUnitario.toString(), subtotal: i.subtotal,
      obs: i.obs ?? '', productoNombre: i.productoNombre, unidadBase: i.unidadBase,
      stockDisponible: null, sinPrecioCompra: false,
    })),
  );

  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [anularOpen, setAnularOpen] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  const productosGanaderos = productos.filter((p) => p.rubro === 'ganaderia' || p.categoria === 'produccion');
  const gruposProducto = Array.from(new Set(productosGanaderos.map((p) => p.categoria)));

  const fetchStock = useCallback(async (depositoId: string, productoId: string, lineId: string) => {
    if (!depositoId || !productoId) return;
    const sb = createClient();
    const { data } = await sb.from('stock').select('cantidad_actual')
      .eq('deposito_id', depositoId).eq('producto_id', productoId).maybeSingle();
    setInsumos((prev) => prev.map((i) => i._id === lineId ? { ...i, stockDisponible: data?.cantidad_actual ?? 0 } : i));
  }, []);

  const fetchLastCost = useCallback(async (productoId: string, lineId: string) => {
    if (!productoId) return;
    const sb = createClient();
    const { data: precio } = await sb.rpc('fn_precio_ultima_compra', { p_producto_id: productoId, p_empresa_id: empresaId });
    setInsumos((prev) => prev.map((i) => {
      if (i._id !== lineId) return i;
      if (precio != null) {
        const cost = precio.toString();
        return { ...i, costoUnitario: cost, subtotal: calc(i.cantidad, cost), sinPrecioCompra: false };
      }
      return { ...i, sinPrecioCompra: true };
    }));
  }, [empresaId]);

  function addInsumo() {
    setInsumos((p) => [{
      _id: nextId(), depositoId: '', productoId: '', cantidad: '', costoUnitario: '', subtotal: 0, obs: '',
      productoNombre: '', unidadBase: '', stockDisponible: null, sinPrecioCompra: false,
    }, ...p]);
  }
  function removeInsumo(id: string) { setInsumos((p) => p.filter((i) => i._id !== id)); }
  function updateInsumo<K extends keyof InsumoGanaderoLine>(id: string, key: K, val: InsumoGanaderoLine[K]) {
    setInsumos((prev) => prev.map((i) => {
      if (i._id !== id) return i;
      const updated = { ...i, [key]: val };
      if (key === 'cantidad' || key === 'costoUnitario') {
        updated.subtotal = calc(
          key === 'cantidad' ? val as string : i.cantidad,
          key === 'costoUnitario' ? val as string : i.costoUnitario,
        );
      }
      return updated;
    }));
  }
  function handleInsumoProducto(id: string, productoId: string) {
    const prod = productos.find((p) => p.id === productoId);
    setInsumos((prev) => prev.map((i) => i._id === id ? {
      ...i, productoId, productoNombre: prod?.nombre ?? '', unidadBase: prod?.unidad_base ?? '',
      stockDisponible: null, sinPrecioCompra: false,
    } : i));
    if (productoId) {
      fetchLastCost(productoId, id);
      const line = insumos.find((i) => i._id === id);
      if (line?.depositoId) fetchStock(line.depositoId, productoId, id);
    }
  }
  function handleInsumoDeposito(id: string, depositoId: string) {
    updateInsumo(id, 'depositoId', depositoId);
    const line = insumos.find((i) => i._id === id);
    if (line?.productoId && depositoId) fetchStock(depositoId, line.productoId, id);
  }

  const totalInsumos = insumos.reduce((acc, i) => acc + i.subtotal, 0);

  function validate(requiereLineas = false) {
    if (!loteHaciendaId) return 'Debe seleccionar un lote de hacienda.';
    if (!fecha) return 'La fecha es obligatoria.';
    if (requiereLineas && insumos.length === 0) return 'Agregá al menos un insumo antes de guardar el borrador.';
    for (const i of insumos) {
      if (!i.depositoId) return 'Cada insumo debe tener un depósito seleccionado.';
      if (!i.productoId) return 'Cada insumo debe tener un producto seleccionado.';
      if (!i.cantidad || parseFloat(i.cantidad) <= 0) return 'La cantidad de cada insumo debe ser mayor a cero.';
    }
    return null;
  }

  function buildPayload() {
    return {
      remitoId: remitoExistente?.id,
      fecha, loteHaciendaId, observaciones: observaciones.trim() || undefined,
      insumos: insumos.map((i) => ({
        depositoId: i.depositoId, productoId: i.productoId,
        cantidad: parseFloat(i.cantidad), costoUnitario: parseFloat(i.costoUnitario || '0'),
        subtotal: i.subtotal, observaciones: i.obs || undefined,
      })),
    };
  }

  async function handleSaveDraft() {
    const err = validate(true);
    if (err) { setErrorMsg(err); return; }
    setErrorMsg(''); setSaving(true);
    const result = await saveRemitoGanaderoBorrador(buildPayload());
    setSaving(false);
    if (result.error) { setErrorMsg(result.error); return; }
    if (result.remitoId && !remitoExistente) router.push(`/app/ganaderia/remitos/${result.remitoId}`);
    else router.refresh();
  }

  async function handleConfirm() {
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    if (insumos.length === 0) { setErrorMsg('El remito no tiene insumos. Agregue al menos una línea.'); return; }
    setErrorMsg(''); setConfirming(true);
    const saveResult = await saveRemitoGanaderoBorrador(buildPayload());
    if (saveResult.error) { setConfirming(false); setErrorMsg(saveResult.error); return; }
    const idParaConfirmar = remitoExistente?.id ?? saveResult.remitoId;
    if (!idParaConfirmar) { setConfirming(false); setErrorMsg('No se pudo determinar el remito a confirmar.'); return; }
    const result = await confirmarRemitoGanadero(idParaConfirmar);
    setConfirming(false);
    if (result.error) { setErrorMsg(result.error); return; }
    router.push(`/app/ganaderia/remitos/${idParaConfirmar}`);
    router.refresh();
  }

  async function handleAnular() {
    if (!remitoExistente) return;
    setAnulando(true);
    const result = await anularRemitoGanadero(remitoExistente.id, motivoAnulacion);
    setAnulando(false);
    if (result.error) { setErrorMsg(result.error); return; }
    setAnularOpen(false);
    router.refresh();
  }

  async function handleEliminar() {
    if (!remitoExistente) return;
    if (!confirm('¿Eliminar este remito ganadero? Esta acción no se puede deshacer.')) return;
    const result = await eliminarRemitoGanadero(remitoExistente.id);
    if (result.error) { setErrorMsg(result.error); return; }
    router.push('/app/ganaderia/remitos');
  }

  const inputCls = (error = false) => cn(
    'w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1',
    error ? 'border-red-300 focus:ring-red-400' : 'border-zinc-200 focus:ring-[#006836]/40',
    esReadOnly && 'bg-zinc-50 text-zinc-500',
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/app/ganaderia/remitos" className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">
            {remitoExistente ? remitoExistente.numero_rig : 'Nuevo Remito Ganadero'}
          </h1>
          <p className="text-sm text-zinc-500">
            {mode === 'ver' ? 'Solo lectura' : mode === 'editar' ? 'Editando borrador' : 'Consumo de insumos imputado a un lote de hacienda'}
          </p>
        </div>
      </div>

      {/* ── CABECERA ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={esReadOnly} className={inputCls()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Lote de hacienda *</label>
            <select value={loteHaciendaId} onChange={(e) => setLoteHaciendaId(e.target.value)}
              disabled={esReadOnly || mode === 'editar'} className={inputCls(!loteHaciendaId)}>
              <option value="">Seleccioná…</option>
              {lotesHacienda.map((l) => (
                <option key={l.id} value={l.id}>{l.ubicacion} · {l.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
            disabled={esReadOnly} rows={2} placeholder="Opcional…" className={cn(inputCls(), 'resize-none')} />
        </div>
      </div>

      {/* ── INSUMOS ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-700">Insumos consumidos</h2>
            <span className="text-xs text-zinc-400">({insumos.length})</span>
          </div>
          {!esReadOnly && (
            <button type="button" onClick={addInsumo}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#006836] hover:underline">
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          )}
        </div>

        {insumos.length === 0 ? (
          <div className="text-center py-6 text-sm text-zinc-400">
            {esReadOnly ? 'Sin insumos registrados.' : 'Sin insumos. Usá "Agregar" para sumar uno.'}
          </div>
        ) : (
          <div className="space-y-3">
            {insumos.map((ins) => (
              <div key={ins._id} className="border border-zinc-100 rounded-xl p-3 space-y-3 bg-zinc-50/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Depósito origen *</label>
                    <select value={ins.depositoId} onChange={(e) => handleInsumoDeposito(ins._id, e.target.value)}
                      disabled={esReadOnly} className={inputCls(!ins.depositoId && !esReadOnly)}>
                      <option value="">Seleccioná…</option>
                      {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Producto *</label>
                    <select value={ins.productoId} onChange={(e) => handleInsumoProducto(ins._id, e.target.value)}
                      disabled={esReadOnly} className={inputCls(!ins.productoId && !esReadOnly)}>
                      <option value="">Seleccioná…</option>
                      {ins.productoId && !productosGanaderos.some((p) => p.id === ins.productoId) && (
                        <option value={ins.productoId}>{ins.productoNombre || 'Producto sin catalogar'}</option>
                      )}
                      {gruposProducto.map((cat) => (
                        <optgroup key={cat} label={CATEGORIA_LABEL[cat] ?? cat}>
                          {productosGanaderos.filter((p) => p.categoria === cat).map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">
                      Cantidad * {ins.unidadBase && <span className="text-zinc-400">({ins.unidadBase})</span>}
                    </label>
                    <input type="number" step="0.01" min="0" value={ins.cantidad}
                      onChange={(e) => updateInsumo(ins._id, 'cantidad', e.target.value)}
                      disabled={esReadOnly} className={inputCls(!ins.cantidad && !esReadOnly)} />
                    {ins.stockDisponible != null && (
                      <p className={cn('text-xs mt-1', ins.stockDisponible < parseFloat(ins.cantidad || '0') ? 'text-red-500 font-medium' : 'text-zinc-400')}>
                        Stock disponible: {num.format(ins.stockDisponible)} {ins.unidadBase}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Costo unitario $</label>
                    <input type="number" step="0.01" min="0" value={ins.costoUnitario}
                      onChange={(e) => updateInsumo(ins._id, 'costoUnitario', e.target.value)}
                      disabled={esReadOnly} className={inputCls()} />
                    {ins.sinPrecioCompra && (
                      <p className="text-xs text-amber-600 mt-1">Sin compras registradas — ingresá el costo manual.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Subtotal</label>
                    <p className="text-sm font-semibold text-zinc-800 px-2.5 py-1.5">${num.format(ins.subtotal)}</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500 mb-1">Observaciones</label>
                    <input type="text" value={ins.obs} onChange={(e) => updateInsumo(ins._id, 'obs', e.target.value)}
                      disabled={esReadOnly} placeholder="Opcional…" className={inputCls()} />
                  </div>
                  {!esReadOnly && (
                    <button type="button" onClick={() => removeInsumo(ins._id)}
                      className="mt-5 p-1.5 text-zinc-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 mt-3 border-t border-zinc-50">
          <span className="text-sm font-semibold text-zinc-700">
            Total: <span className="text-[#006836]">{formatMoney(totalInsumos)}</span>
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── ACCIONES ──────────────────────────────────────────────────────── */}
      {!esReadOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleSaveDraft} disabled={saving || confirming}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-semibold rounded-xl hover:bg-zinc-50 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar borrador
          </button>
          <button type="button" onClick={handleConfirm} disabled={saving || confirming}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {confirming ? 'Confirmando…' : 'Confirmar remito'}
          </button>
          {remitoExistente && (
            <button type="button" onClick={handleEliminar}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-red-500 text-sm font-medium hover:bg-red-50 rounded-xl transition-colors">
              <Trash2 className="w-4 h-4" /> Eliminar borrador
            </button>
          )}
        </div>
      )}

      {mode === 'ver' && remitoExistente?.estado === 'confirmado' && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          {!anularOpen ? (
            <button type="button" onClick={() => setAnularOpen(true)}
              className="text-sm font-medium text-red-500 hover:underline">
              Anular remito
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-zinc-700">Motivo de anulación</p>
              <input type="text" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Ej: error de carga, devolución, etc." className={inputCls()} />
              <div className="flex gap-2">
                <button type="button" onClick={handleAnular} disabled={anulando}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {anulando ? 'Anulando…' : 'Confirmar anulación'}
                </button>
                <button type="button" onClick={() => setAnularOpen(false)} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
