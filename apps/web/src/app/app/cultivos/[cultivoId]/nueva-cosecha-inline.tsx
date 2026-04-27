'use client';

import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp, Tractor, Truck, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crearCostoCosecha } from '../actions';

interface Maquinaria {
  id: string; nombre: string; tipo: string;
  consumo_combustible_hora: number;
  costo_mantenimiento_hora: number;
  valor_adquisicion: number | null;
  vida_util_horas: number | null;
}
interface Proveedor { id: string; nombre: string; }

interface Props {
  cultivoId: string;
  maquinarias: Maquinaria[];
  proveedores: Proveedor[];
  precioCombustible: number;
  hectareasLote: number | null;
  produccionTotalKg: number | null;
}

const sel = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50 bg-white';
const inp = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const lbl = 'block text-xs font-medium text-zinc-500 mb-1.5';
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function costoHora(m: Maquinaria, precioCombustible: number) {
  const combust = m.consumo_combustible_hora * precioCombustible;
  const mant    = m.costo_mantenimiento_hora;
  const amort   = m.valor_adquisicion && m.vida_util_horas
    ? m.valor_adquisicion / m.vida_util_horas : 0;
  return combust + mant + amort;
}

const MODALIDADES = [
  { value: 'por_ha',       label: 'Por hectárea' },
  { value: 'por_tonelada', label: 'Por tonelada' },
  { value: 'total',        label: 'Total fijo' },
] as const;

export default function NuevaCosechaInline({
  cultivoId, maquinarias, proveedores, precioCombustible, hectareasLote, produccionTotalKg,
}: Props) {
  const [open,       setOpen]       = useState(false);
  const [fecha,      setFecha]      = useState(new Date().toISOString().slice(0, 10));
  const [ejecucion,  setEjecucion]  = useState<'propio' | 'tercero'>('tercero');
  const [maqId,      setMaqId]      = useState('');
  const [horas,      setHoras]      = useState('');
  const [provId,     setProvId]     = useState('');
  const [modalidad,  setModalidad]  = useState<'por_ha' | 'por_tonelada' | 'total'>('por_ha');
  const [precio,     setPrecio]     = useState('');
  const [hectareas,  setHectareas]  = useState(hectareasLote ? String(hectareasLote) : '');
  const [toneladas,  setToneladas]  = useState(produccionTotalKg ? String(produccionTotalKg / 1000) : '');
  const [obs,        setObs]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const costoEstimado = useMemo(() => {
    if (ejecucion === 'propio') {
      const maq = maquinarias.find((m) => m.id === maqId);
      if (!maq || !horas) return null;
      return costoHora(maq, precioCombustible) * Number(horas);
    }
    if (!precio) return null;
    if (modalidad === 'por_ha')       return Number(precio) * Number(hectareas || 0);
    if (modalidad === 'por_tonelada') return Number(precio) * Number(toneladas || 0);
    return Number(precio);
  }, [ejecucion, maqId, horas, precio, modalidad, hectareas, toneladas, maquinarias, precioCombustible]);

  function reset() {
    setFecha(new Date().toISOString().slice(0, 10));
    setEjecucion('tercero'); setMaqId(''); setHoras('');
    setProvId(''); setModalidad('por_ha'); setPrecio('');
    setHectareas(hectareasLote ? String(hectareasLote) : '');
    setToneladas(produccionTotalKg ? String(produccionTotalKg / 1000) : '');
    setObs(''); setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const result = await crearCostoCosecha({
      cultivo_id:    cultivoId,
      fecha,
      tipo_ejecucion: ejecucion,
      observaciones: obs.trim() || undefined,
      maquinaria_id:       ejecucion === 'propio'   ? maqId           : undefined,
      horas_trabajadas:    ejecucion === 'propio'   ? Number(horas)   : undefined,
      proveedor_id:        ejecucion === 'tercero' && provId ? provId : undefined,
      modalidad_cobro:     ejecucion === 'tercero'  ? modalidad       : undefined,
      precio_unitario:     ejecucion === 'tercero'  ? Number(precio)  : undefined,
      hectareas_trabajadas:ejecucion === 'tercero' && modalidad === 'por_ha'       ? Number(hectareas)  : undefined,
      toneladas_trabajadas:ejecucion === 'tercero' && modalidad === 'por_tonelada' ? Number(toneladas)  : undefined,
    });

    setLoading(false);
    if (result.error) { setError(result.error); return; }
    reset(); setOpen(false);
  }

  return (
    <div className={cn('bg-white rounded-2xl border overflow-hidden',
      open ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
            open ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
            <Plus className={cn('w-4 h-4', open ? 'text-white' : 'text-[#006836]')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Registrar costo de cosecha</p>
            <p className="text-xs text-zinc-400">Cosechadora propia o servicio de contratista</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-5 space-y-4">
          <div>
            <label className={lbl}>Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={loading} className={inp} />
          </div>

          {/* Toggle Propio / Tercero */}
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-sm font-medium">
            {(['propio', 'tercero'] as const).map((op) => (
              <button key={op} type="button" onClick={() => setEjecucion(op)}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors',
                  ejecucion === op ? 'bg-[#006836] text-white' : 'text-zinc-500 hover:bg-zinc-50')}>
                {op === 'propio' ? <Tractor className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                {op === 'propio' ? 'Cosechadora propia' : 'Contratista'}
              </button>
            ))}
          </div>

          {ejecucion === 'propio' ? (
            <div className="space-y-3">
              <div>
                <label className={lbl}>Cosechadora *</label>
                <select value={maqId} onChange={(e) => setMaqId(e.target.value)} disabled={loading} className={sel}>
                  <option value="">Seleccioná…</option>
                  {maquinarias.filter((m) => m.tipo === 'cosechadora' || true).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} — {ars.format(costoHora(m, precioCombustible))}/h
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Horas trabajadas *</label>
                <input type="number" inputMode="decimal" min="0" step="0.5" placeholder="0.0"
                  value={horas} onChange={(e) => setHoras(e.target.value)} disabled={loading} className={inp} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={lbl}>Contratista</label>
                <select value={provId} onChange={(e) => setProvId(e.target.value)} disabled={loading} className={sel}>
                  <option value="">Sin especificar</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              {/* Selector de modalidad */}
              <div>
                <label className={lbl}>Modalidad de cobro</label>
                <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-sm">
                  {MODALIDADES.map((m) => (
                    <button key={m.value} type="button" onClick={() => setModalidad(m.value)}
                      className={cn('flex-1 py-2 transition-colors text-xs',
                        modalidad === m.value ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-50')}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>
                    {modalidad === 'por_ha' ? 'Precio por ha ($) *' :
                     modalidad === 'por_tonelada' ? 'Precio por tn ($) *' : 'Precio total ($) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                    <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                      value={precio} onChange={(e) => setPrecio(e.target.value)} disabled={loading}
                      className={`${inp} pl-7`} />
                  </div>
                </div>
                {modalidad === 'por_ha' && (
                  <div>
                    <label className={lbl}>Hectáreas *</label>
                    <input type="number" inputMode="decimal" min="0" step="0.1"
                      value={hectareas} onChange={(e) => setHectareas(e.target.value)} disabled={loading} className={inp} />
                  </div>
                )}
                {modalidad === 'por_tonelada' && (
                  <div>
                    <label className={lbl}>Toneladas *</label>
                    <input type="number" inputMode="decimal" min="0" step="0.001"
                      value={toneladas} onChange={(e) => setToneladas(e.target.value)} disabled={loading} className={inp} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className={lbl}>Observaciones</label>
            <input type="text" placeholder="Opcional…" value={obs}
              onChange={(e) => setObs(e.target.value)} disabled={loading} className={inp} />
          </div>

          {costoEstimado !== null && costoEstimado > 0 && (
            <div className="flex items-center gap-3 bg-[#006836]/5 border border-[#006836]/15 rounded-xl px-4 py-3">
              <Calculator className="w-4 h-4 text-[#006836] shrink-0" />
              <div>
                <p className="text-xs text-zinc-500">Costo estimado de la cosecha</p>
                <p className="text-lg font-bold text-[#006836]">{ars.format(costoEstimado)}</p>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
              {loading ? 'Guardando…' : 'Registrar costo'}
            </button>
            <button type="button" onClick={() => { reset(); setOpen(false); }}
              className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-xl transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
