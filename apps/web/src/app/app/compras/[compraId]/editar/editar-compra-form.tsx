'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { editarCompraCompleta } from '../../actions';

interface Item {
  id: string;
  cantidad_unidad_base: number;
  cantidad_presentacion: number | null;
  precio_unitario_moneda_original: number;
  precio_unitario_ars: number;
  subtotal_moneda_original: number;
  subtotal_ars: number;
  deposito_destino_id: string;
  producto: { id: string; nombre: string; unidad_base: string } | null;
  presentacion: { descripcion: string } | null;
  deposito_destino: { nombre: string } | null;
}

interface Compra {
  id: string;
  fecha: string;
  moneda: string;
  cotizacion_usd: number | null;
  tipo_documento: string;
  numero_factura: string | null;
  proveedor_id: string | null;
  proveedor: { nombre: string } | null;
}

interface Props {
  compraId: string;
  compra: Compra;
  items: Item[];
  proveedores: { id: string; nombre: string }[];
  depositos: { id: string; nombre: string }[];
}

const fmtNum = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const fmtArs = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

function parseNum(s: string): number {
  const t = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t))
    return parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0;
  if (t.includes(',') && !t.includes('.')) {
    const partes = t.split(',');
    if (partes.length === 2 && partes[1].length === 3) return parseFloat(t.replace(',', '')) || 0;
    return parseFloat(t.replace(',', '.')) || 0;
  }
  return parseFloat(t.replace(',', '')) || 0;
}

function fmtInput(n: number): string {
  return isNaN(n) ? '' : fmtNum.format(n);
}

const input = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40';

export default function EditarCompraForm({ compraId, compra, items, proveedores, depositos }: Props) {
  const router = useRouter();

  // — Cabecera —
  const [fecha,         setFecha]         = useState(compra.fecha);
  const [proveedorId,   setProveedorId]   = useState(compra.proveedor_id ?? '');
  const [tipoDoc,       setTipoDoc]       = useState(compra.tipo_documento);
  const [numFactura,    setNumFactura]    = useState(compra.numero_factura ?? '');
  const [cotizUsd,      setCotizUsd]      = useState(compra.cotizacion_usd ? String(compra.cotizacion_usd) : '');

  // — Ítems: precio y cantidad editables por fila —
  const [precios,    setPrecios]    = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, fmtInput(i.precio_unitario_moneda_original)]))
  );
  const [cantidades, setCantidades] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, fmtInput(i.cantidad_unidad_base)]))
  );
  const [depositos_,  setDepositos_]  = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.deposito_destino_id]))
  );

  const [guardando,  setGuardando]  = useState(false);
  const [resultado,  setResultado]  = useState<{ ok?: boolean; error?: string } | null>(null);

  const esUsd = compra.moneda === 'USD';
  const cotiz = parseNum(cotizUsd) || compra.cotizacion_usd || 1;

  function precioArs(itemId: string, precioOrig: number): number {
    return esUsd ? precioOrig * cotiz : precioOrig;
  }

  function subtotalFila(itemId: string): number {
    const precio = parseNum(precios[itemId] ?? '0');
    const cant   = parseNum(cantidades[itemId] ?? '0');
    return precioArs(itemId, precio) * cant;
  }

  const totalArs = items.reduce((s, i) => s + subtotalFila(i.id), 0);

  async function handleGuardar() {
    setGuardando(true);
    setResultado(null);

    const itemsPayload = items.map((i) => {
      const precioOrig = parseNum(precios[i.id] ?? '0');
      const cant       = parseNum(cantidades[i.id] ?? '0');
      const pArs       = precioArs(i.id, precioOrig);
      return {
        id: i.id,
        cantidad_unidad_base: cant,
        precio_unitario_moneda_original: precioOrig,
        precio_unitario_ars: pArs,
        deposito_destino_id: depositos_[i.id] ?? i.deposito_destino_id,
      };
    });

    const result = await editarCompraCompleta(
      compraId,
      {
        proveedor_id: proveedorId || null,
        fecha,
        tipo_documento: tipoDoc as 'factura' | 'remito',
        numero_factura: numFactura || null,
        cotizacion_usd: esUsd ? parseNum(cotizUsd) || null : null,
      },
      itemsPayload,
    );

    setGuardando(false);
    if (result.error) {
      setResultado({ error: result.error });
    } else {
      setResultado({ ok: true });
      setTimeout(() => router.push(`/app/compras/${compraId}`), 1200);
    }
  }

  return (
    <div className="space-y-5">

      {resultado?.error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {resultado.error}
        </div>
      )}
      {resultado?.ok && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Factura actualizada. El stock se recalculó automáticamente.
        </div>
      )}

      {/* ── Cabecera ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">Cabecera</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Proveedor</label>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={input}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo de documento</label>
            <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className={input}>
              <option value="factura">Factura</option>
              <option value="remito">Remito</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">N° Factura / Remito</label>
            <input
              type="text"
              value={numFactura}
              onChange={(e) => setNumFactura(e.target.value)}
              placeholder="Ej: 0001-00001234"
              className={input}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Moneda <span className="text-zinc-400 font-normal">(no editable)</span>
            </label>
            <div className={cn(input, 'bg-zinc-50 text-zinc-500 cursor-not-allowed')}>
              {compra.moneda}
            </div>
          </div>

          {esUsd && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Cotización USD</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={cotizUsd}
                onChange={(e) => setCotizUsd(e.target.value)}
                placeholder="Ej: 1450.00"
                className={input}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Ítems ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Ítems</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Depósito</th>
                <th className="text-center px-4 py-3 font-medium text-amber-600">Cantidad</th>
                <th className="text-center px-4 py-3 font-medium text-amber-600">
                  Precio unit. {compra.moneda}
                </th>
                {esUsd && (
                  <th className="text-right px-4 py-3 font-medium text-zinc-400 text-xs">$/ARS</th>
                )}
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Subtotal ARS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {items.map((item) => {
                const precioOrig = parseNum(precios[item.id] ?? '');
                const cant       = parseNum(cantidades[item.id] ?? '');
                const pArs       = precioArs(item.id, precioOrig);
                const sub        = pArs * cant;

                const precioChanged  = Math.abs(precioOrig - item.precio_unitario_moneda_original) > 0.001;
                const cantChanged    = Math.abs(cant - item.cantidad_unidad_base) > 0.001;
                const deposChanged   = depositos_[item.id] !== item.deposito_destino_id;
                const changed = precioChanged || cantChanged || deposChanged;

                return (
                  <tr key={item.id} className={cn('transition-colors', changed ? 'bg-amber-50' : 'hover:bg-zinc-50')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-800">{item.producto?.nombre}</p>
                      {item.presentacion && (
                        <p className="text-xs text-zinc-400">{item.presentacion.descripcion}</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={depositos_[item.id]}
                        onChange={(e) => setDepositos_((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className={cn(
                          'w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1',
                          deposChanged
                            ? 'border-amber-400 bg-amber-50 focus:ring-amber-400/40'
                            : 'border-zinc-200 focus:ring-[#006836]/40',
                        )}
                      >
                        {depositos.map((d) => (
                          <option key={d.id} value={d.id}>{d.nombre}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cantidades[item.id] ?? ''}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className={cn(
                            'w-24 text-center text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1',
                            cantChanged
                              ? 'border-amber-400 bg-amber-50 focus:ring-amber-400/40'
                              : 'border-zinc-200 focus:ring-[#006836]/40',
                          )}
                        />
                        <span className="text-xs text-zinc-400 shrink-0">{item.producto?.unidad_base}</span>
                      </div>
                      {cantChanged && (
                        <p className="text-center text-xs text-zinc-400 mt-0.5">
                          antes: {fmtInput(item.cantidad_unidad_base)}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={precios[item.id] ?? ''}
                          onChange={(e) => setPrecios((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className={cn(
                            'w-32 text-center text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1',
                            precioChanged
                              ? 'border-amber-400 bg-amber-50 focus:ring-amber-400/40'
                              : 'border-zinc-200 focus:ring-[#006836]/40',
                          )}
                        />
                        <span className="text-xs text-zinc-400">{compra.moneda}</span>
                      </div>
                      {precioChanged && (
                        <p className="text-center text-xs text-zinc-400 mt-0.5">
                          antes: {fmtInput(item.precio_unitario_moneda_original)}
                        </p>
                      )}
                    </td>

                    {esUsd && (
                      <td className="px-4 py-3 text-right text-xs text-zinc-400">
                        {precioOrig > 0 ? fmtArs.format(pArs) : '—'}
                      </td>
                    )}

                    <td className="px-4 py-3 text-right font-medium text-zinc-700">
                      {cant > 0 && precioOrig > 0 ? fmtArs.format(sub) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                <td colSpan={esUsd ? 5 : 4} className="px-4 py-3 text-right text-sm font-semibold text-zinc-600">
                  Total ARS
                </td>
                <td className="px-4 py-3 text-right text-base font-bold text-zinc-900">
                  {fmtArs.format(totalArs)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Acciones ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href={`/app/compras/${compraId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver sin guardar
        </Link>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] transition-colors disabled:opacity-50"
        >
          {guardando ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {guardando ? 'Guardando…' : 'Guardar y actualizar stock'}
        </button>
      </div>
    </div>
  );
}
