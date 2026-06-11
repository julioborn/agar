'use client';

import { useState } from 'react';
import { Check, RefreshCw, Fuel, CircleDollarSign, Tractor, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface HistorialItem { id: string; valor: number; vigencia_desde: string; observaciones: string | null; }

interface Props {
  empresaId: string;
  initialPrecio: number;
  initialTipo: string;
  initialCotizUsd: number | null;
  cotizBNA: number | null;
  initialLitrosPorUta: number;
  historialGasoil: HistorialItem[];
}

const TIPOS_COMBUSTIBLE = [
  { value: 'gasoil', label: 'Gasoil' },
  { value: 'nafta',  label: 'Nafta' },
  { value: 'gnc',    label: 'GNC (m³)' },
];

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function ConfigForm({ empresaId, initialPrecio, initialTipo, initialCotizUsd, cotizBNA, initialLitrosPorUta, historialGasoil }: Props) {
  // — Combustible —
  const [precio,       setPrecio]      = useState(initialPrecio > 0 ? String(initialPrecio) : '');
  const [tipo,         setTipo]        = useState(initialTipo);
  const [historial,    setHistorial]   = useState<HistorialItem[]>(historialGasoil);
  const [savingComb,   setSavingComb]  = useState(false);
  const [savedComb,    setSavedComb]   = useState(false);
  const [errorComb,    setErrorComb]   = useState<string | null>(null);

  // — UTA —
  const [litrosUta,    setLitrosUta]   = useState(initialLitrosPorUta > 0 ? String(initialLitrosPorUta) : '35');
  const [savingUta,    setSavingUta]   = useState(false);
  const [savedUta,     setSavedUta]    = useState(false);
  const [errorUta,     setErrorUta]    = useState<string | null>(null);

  // — Cotización USD —
  const [cotizUsd,     setCotizUsd]    = useState(initialCotizUsd ? String(initialCotizUsd) : '');
  const [savingCotiz,  setSavingCotiz] = useState(false);
  const [savedCotiz,   setSavedCotiz]  = useState(false);
  const [errorCotiz,   setErrorCotiz]  = useState<string | null>(null);

  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

  async function handleSaveCombustible(e: React.FormEvent) {
    e.preventDefault();
    if (!precio || Number(precio) <= 0) { setErrorComb('Ingresá un precio válido.'); return; }
    setSavingComb(true); setErrorComb(null);

    const sb = createClient();
    const precioNum = Number(precio);
    const hoy = new Date().toISOString().slice(0, 10);

    const { error: err } = await sb
      .from('configuracion_empresa')
      .upsert({ empresa_id: empresaId, precio_combustible: precioNum, tipo_combustible: tipo }, { onConflict: 'empresa_id' });

    if (!err) {
      // Guardar en historial solo si cambió el precio
      if (precioNum !== initialPrecio) {
        const { data: nuevo } = await sb.from('referencias_precio').insert({
          empresa_id:     empresaId,
          tipo:           'gasoil',
          nombre:         'Gasoil',
          valor:          precioNum,
          unidad:         'L',
          vigencia_desde: hoy,
        }).select('id, valor, vigencia_desde, observaciones').single();
        if (nuevo) setHistorial((prev) => [nuevo as HistorialItem, ...prev]);
      }
    }

    setSavingComb(false);
    if (err) { setErrorComb(err.message); return; }
    setSavedComb(true);
    setTimeout(() => setSavedComb(false), 2500);
  }

  async function handleSaveUta(e: React.FormEvent) {
    e.preventDefault();
    const litros = Number(litrosUta);
    if (!litrosUta || litros <= 0) { setErrorUta('Ingresá un valor válido mayor a 0.'); return; }
    setSavingUta(true); setErrorUta(null);

    const { error: err } = await createClient()
      .from('configuracion_empresa')
      .upsert({ empresa_id: empresaId, litros_por_uta: litros }, { onConflict: 'empresa_id' });

    setSavingUta(false);
    if (err) { setErrorUta(err.message); return; }
    setSavedUta(true);
    setTimeout(() => setSavedUta(false), 2500);
  }

  async function handleSaveCotizacion(e: React.FormEvent) {
    e.preventDefault();
    setSavingCotiz(true); setErrorCotiz(null);

    const cotizVal = cotizUsd && Number(cotizUsd) > 0 ? Number(cotizUsd) : null;

    const { error: err } = await createClient()
      .from('configuracion_empresa')
      .upsert({
        empresa_id: empresaId,
        cotizacion_usd: cotizVal,
        cotizacion_usd_fecha: cotizVal ? new Date().toISOString().slice(0, 10) : null,
      }, { onConflict: 'empresa_id' });

    setSavingCotiz(false);
    if (err) { setErrorCotiz(err.message); return; }
    setSavedCotiz(true);
    setTimeout(() => setSavedCotiz(false), 2500);
  }

  const fmtFecha = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row gap-5 items-start">

      {/* ── Combustible ─────────────────────────────────────────────── */}
      <form onSubmit={handleSaveCombustible} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden w-full max-w-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Fuel className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Combustible</p>
            <p className="text-xs text-zinc-400">Tipo y precio por litro / m³</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo de combustible</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={savingComb} className={field}>
              {TIPOS_COMBUSTIBLE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Precio por litro / m³</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
              <input
                type="number" inputMode="decimal" min="0" step="0.001"
                value={precio} onChange={(e) => setPrecio(e.target.value)}
                placeholder="0.000" disabled={savingComb}
                className={`${field} pl-7`}
              />
            </div>
          </div>

          {errorComb && <p className="text-xs text-red-500">{errorComb}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit" disabled={savingComb || !precio}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              {savingComb ? 'Guardando...' : 'Guardar'}
            </button>
            {savedComb && (
              <span className="text-xs text-[#006836] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Guardado
              </span>
            )}
          </div>
        </div>
      </form>

      {/* ── Historial gasoil ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex-1 min-w-[220px]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Historial gasoil</p>
            <p className="text-xs text-zinc-400">{historial.length} registro{historial.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="divide-y divide-zinc-50 max-h-64 overflow-y-auto">
          {historial.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-6">Sin historial todavía.</p>
          ) : (
            historial.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-zinc-400">{fmtFecha(h.vigencia_desde)}</span>
                <span className="text-sm font-semibold text-zinc-800">${num.format(Number(h.valor))}</span>
              </div>
            ))
          )}
        </div>
      </div>

      </div>{/* cierra flex row */}

      {/* ── Valor UTA ───────────────────────────────────────────────── */}
      <form onSubmit={handleSaveUta} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="w-8 h-8 rounded-lg bg-[#006836]/10 flex items-center justify-center">
            <Tractor className="w-4 h-4 text-[#006836]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Valor UTA</p>
            <p className="text-xs text-zinc-400">Litros de gasoil equivalentes a 1 Unidad de Trabajo Agrícola</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              1 UTA = ? litros de gasoil
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="decimal" min="0.1" step="0.1"
                value={litrosUta} onChange={(e) => setLitrosUta(e.target.value)}
                placeholder="35" disabled={savingUta}
                className={`${field} w-32`}
              />
              <span className="text-sm text-zinc-500">litros / UTA</span>
            </div>
          </div>

          {Number(litrosUta) > 0 && Number(precio) > 0 && (
            <div className="rounded-lg bg-[#006836]/5 border border-[#006836]/15 px-3 py-2 text-xs text-[#006836]">
              <span className="font-medium">Costo por UTA:</span>{' '}
              {num.format(Number(litrosUta))} L × ${num.format(Number(precio))}/L ={' '}
              <strong>${num.format(Number(litrosUta) * Number(precio))}/UTA</strong>
            </div>
          )}

          {errorUta && <p className="text-xs text-red-500">{errorUta}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit" disabled={savingUta || !litrosUta}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              {savingUta ? 'Guardando...' : 'Guardar'}
            </button>
            {savedUta && (
              <span className="text-xs text-[#006836] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Guardado
              </span>
            )}
          </div>
        </div>
      </form>

      {/* ── Cotización USD ──────────────────────────────────────────── */}
      <form onSubmit={handleSaveCotizacion} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <CircleDollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Cotización USD</p>
            <p className="text-xs text-zinc-400">ARS por 1 dólar · manual o BNA automático</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-zinc-400">
            Si la dejás vacía, el sistema usa la tasa oficial BNA publicada automáticamente.
          </p>

          {cotizBNA != null && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700">
              <RefreshCw className="w-3 h-3 shrink-0" />
              Tasa BNA actual: <strong>${num.format(cotizBNA)}</strong>
              <button
                type="button"
                onClick={() => setCotizUsd(String(cotizBNA))}
                className="ml-auto underline hover:no-underline"
              >
                Usar esta
              </button>
            </div>
          )}

          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
              <input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={cotizUsd} onChange={(e) => setCotizUsd(e.target.value)}
                placeholder={cotizBNA ? `BNA: ${num.format(cotizBNA)}` : 'Ej: 1450,00'}
                disabled={savingCotiz}
                className={`${field} pl-7`}
              />
            </div>
            {cotizUsd && Number(cotizUsd) > 0 && (
              <button
                type="button"
                onClick={() => setCotizUsd('')}
                className="text-xs text-zinc-400 hover:text-red-500 mt-1 transition-colors"
              >
                Limpiar → volver a usar BNA automático
              </button>
            )}
          </div>

          {errorCotiz && <p className="text-xs text-red-500">{errorCotiz}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit" disabled={savingCotiz}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              {savingCotiz ? 'Guardando...' : 'Guardar'}
            </button>
            {savedCotiz && (
              <span className="text-xs text-[#006836] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Guardado
              </span>
            )}
          </div>
        </div>
      </form>

    </div>
  );
}
