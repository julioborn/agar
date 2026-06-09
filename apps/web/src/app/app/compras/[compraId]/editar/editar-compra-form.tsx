'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { corregirItemsCompra } from '../../actions';

interface Item {
  id: string;
  cantidad_unidad_base: number;
  cantidad_presentacion: number | null;
  precio_unitario_moneda_original: number;
  precio_unitario_ars: number;
  subtotal_moneda_original: number;
  subtotal_ars: number;
  producto: { id: string; nombre: string; unidad_base: string } | null;
  presentacion: { descripcion: string } | null;
  deposito_destino: { nombre: string } | null;
}

interface Props {
  compraId: string;
  moneda: string;
  items: Item[];
}

const fmtNum = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const num = (n: number, d = 4) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n);
const fmtArs = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

// Formatea un número para mostrar en el input (formato argentino, sin ceros finales)
function fmtInput(n: number | string): string {
  const v = Number(n);
  return isNaN(v) ? String(n) : fmtNum.format(v);
}

// Parsea número argentino (coma = decimal, punto = miles) o inglés
function parseCantidad(s: string): number {
  const t = s.trim();
  // Formato argentino con punto de miles y coma decimal: 1.234,56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    return parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Solo coma como decimal (100,5 → 100.5), a menos que sea separador de miles (100,000)
  if (t.includes(',') && !t.includes('.')) {
    const partes = t.split(',');
    if (partes.length === 2 && partes[1].length === 3) return parseFloat(t.replace(',', '')) || 0;
    return parseFloat(t.replace(',', '.')) || 0;
  }
  return parseFloat(t.replace(',', '')) || 0;
}

export default function EditarCompraForm({ compraId, moneda, items }: Props) {
  const router = useRouter();

  const [cantidades, setCantidades] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, fmtInput(i.cantidad_unidad_base)]))
  );
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok?: boolean; error?: string } | null>(null);

  function handleChange(id: string, val: string) {
    setCantidades((prev) => ({ ...prev, [id]: val }));
    setResultado(null);
  }

  async function handleGuardar() {
    setGuardando(true);
    setResultado(null);

    const correcciones = items
      .map((item) => ({
        id: item.id,
        cantidad_unidad_base: parseCantidad(cantidades[item.id] ?? String(item.cantidad_unidad_base)),
      }))
      .filter((c) => c.cantidad_unidad_base > 0);

    const result = await corregirItemsCompra(correcciones);

    setGuardando(false);
    if (result.error) {
      setResultado({ error: result.error });
    } else {
      setResultado({ ok: true });
      setTimeout(() => router.push(`/app/compras/${compraId}`), 1200);
    }
  }

  return (
    <div className="space-y-4">
      {resultado?.error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {resultado.error}
        </div>
      )}
      {resultado?.ok && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Ítems corregidos. El stock se actualizó automáticamente.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Depósito</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Precio unit.</th>
                <th className="text-center px-4 py-3 font-medium text-orange-500">Cantidad (editable)</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Subtotal est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {items.map((item) => {
                const cantActual = parseCantidad(cantidades[item.id] ?? '');
                const subtotalEst = cantActual * Number(item.precio_unitario_ars);
                const cambiado = cantActual !== item.cantidad_unidad_base;

                return (
                  <tr key={item.id} className={cn('transition-colors', cambiado ? 'bg-amber-50' : 'hover:bg-zinc-50')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-800">{item.producto?.nombre}</p>
                      {item.presentacion && (
                        <p className="text-xs text-zinc-400">{item.presentacion.descripcion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{item.deposito_destino?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-zinc-600 text-xs">
                      {num(item.precio_unitario_moneda_original)} {moneda}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cantidades[item.id] ?? ''}
                          onChange={(e) => handleChange(item.id, e.target.value)}
                          className={cn(
                            'w-24 text-center text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1',
                            cambiado
                              ? 'border-amber-400 bg-amber-50 focus:ring-amber-400/40'
                              : 'border-zinc-200 focus:ring-[#006836]/40'
                          )}
                        />
                        <span className="text-xs text-zinc-400 shrink-0">{item.producto?.unidad_base}</span>
                      </div>
                      {cambiado && (
                        <p className="text-center text-xs text-zinc-400 mt-0.5">
                          antes: {num(item.cantidad_unidad_base)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-700">
                      {cantActual > 0 ? fmtArs.format(subtotalEst) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
