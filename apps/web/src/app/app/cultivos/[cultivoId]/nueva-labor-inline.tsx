'use client';

import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp, Tractor, Truck, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crearLabor } from '../actions';

interface TipoLabor  { id: string; nombre: string; }
interface Maquinaria {
  id: string; nombre: string; tipo: string;
  consumo_combustible_hora: number;
  costo_mantenimiento_hora: number;
  valor_adquisicion: number | null;
  vida_util_horas: number | null;
}
interface Proveedor  { id: string; nombre: string; }

interface Props {
  cultivoId: string;
  tiposLabor: TipoLabor[];
  maquinarias: Maquinaria[];
  proveedores: Proveedor[];
  precioCombustible: number;
  hectareasLote: number | null;
}

const sel = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50 bg-white';
const inp = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const lbl = 'block text-xs font-medium text-zinc-500 mb-1.5';
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function costoHoraMaquinaria(m: Maquinaria, precioCombustible: number) {
  const combust = m.consumo_combustible_hora * precioCombustible;
  const mant    = m.costo_mantenimiento_hora;
  const amort   = m.valor_adquisicion && m.vida_util_horas
    ? m.valor_adquisicion / m.vida_util_horas : 0;
  return combust + mant + amort;
}

export default function NuevaLaborInline({
  cultivoId, tiposLabor, maquinarias, proveedores, precioCombustible, hectareasLote,
}: Props) {
  const [open,          setOpen]          = useState(false);
  const [tipoLaborId,   setTipoLaborId]   = useState('');
  const [fecha,         setFecha]         = useState(new Date().toISOString().slice(0, 10));
  const [ejecucion,     setEjecucion]     = useState<'propio' | 'tercero'>('propio');
  const [maquinariaId,  setMaquinariaId]  = useState('');
  const [horas,         setHoras]         = useState('');
  const [proveedorId,   setProveedorId]   = useState('');
  const [modalidad,     setModalidad]     = useState<'por_ha' | 'total'>('por_ha');
  const [precio,        setPrecio]        = useState('');
  const [hectareas,     setHectareas]     = useState(hectareasLote ? String(hectareasLote) : '');
  const [observaciones, setObservaciones] = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Preview de costo en tiempo real
  const costoEstimado = useMemo(() => {
    if (ejecucion === 'propio') {
      const maq = maquinarias.find((m) => m.id === maquinariaId);
      if (!maq || !horas) return null;
      return costoHoraMaquinaria(maq, precioCombustible) * Number(horas);
    } else {
      if (!precio) return null;
      return modalidad === 'por_ha'
        ? Number(precio) * Number(hectareas || 0)
        : Number(precio);
    }
  }, [ejecucion, maquinariaId, horas, precio, modalidad, hectareas, maquinarias, precioCombustible]);

  function reset() {
    setTipoLaborId(''); setFecha(new Date().toISOString().slice(0, 10));
    setEjecucion('propio'); setMaquinariaId(''); setHoras('');
    setProveedorId(''); setModalidad('por_ha');
    setPrecio(''); setHectareas(hectareasLote ? String(hectareasLote) : '');
    setObservaciones(''); setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoLaborId) { setError('Seleccioná un tipo de labor.'); return; }
    setLoading(true); setError(null);

    const result = await crearLabor({
      cultivo_id: cultivoId,
      tipo_labor_id: tipoLaborId,
      fecha,
      tipo_ejecucion: ejecucion,
      observaciones: observaciones.trim() || undefined,
      maquinaria_id:       ejecucion === 'propio' ? maquinariaId   : undefined,
      horas_trabajadas:    ejecucion === 'propio' ? Number(horas)  : undefined,
      proveedor_id:        ejecucion === 'tercero' && proveedorId ? proveedorId : undefined,
      modalidad_cobro:     ejecucion === 'tercero' ? modalidad      : undefined,
      precio_unitario:     ejecucion === 'tercero' ? Number(precio) : undefined,
      hectareas_trabajadas:ejecucion === 'tercero' && modalidad === 'por_ha' ? Number(hectareas) : undefined,
    });

    setLoading(false);
    if (result.error) { setError(result.error); return; }
    reset(); setOpen(false);
  }

  return (
    <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
      open ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>

      {/* Toggle */}
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
            open ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
            <Plus className={cn('w-4 h-4', open ? 'text-white' : 'text-[#006836]')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Registrar labor</p>
            <p className="text-xs text-zinc-400">Equipo propio o servicio de tercero</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-5 space-y-4">

          {/* Tipo de labor + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo de labor *</label>
              <select value={tipoLaborId} onChange={(e) => setTipoLaborId(e.target.value)} disabled={loading} className={sel}>
                <option value="">Seleccioná…</option>
                {tiposLabor.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={loading} className={inp} />
            </div>
          </div>

          {/* Toggle Propio / Tercero */}
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-sm font-medium">
            {(['propio', 'tercero'] as const).map((op) => (
              <button
                key={op} type="button"
                onClick={() => setEjecucion(op)}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors',
                  ejecucion === op
                    ? 'bg-[#006836] text-white'
                    : 'text-zinc-500 hover:bg-zinc-50')}
              >
                {op === 'propio' ? <Tractor className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                {op === 'propio' ? 'Equipo propio' : 'Servicio tercero'}
              </button>
            ))}
          </div>

          {/* Campos según tipo */}
          {ejecucion === 'propio' ? (
            <div className="space-y-3">
              <div>
                <label className={lbl}>Maquinaria *</label>
                <select value={maquinariaId} onChange={(e) => setMaquinariaId(e.target.value)} disabled={loading} className={sel}>
                  <option value="">Seleccioná…</option>
                  {maquinarias.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} — {ars.format(costoHoraMaquinaria(m, precioCombustible))}/h
                    </option>
                  ))}
                </select>
                {maquinarias.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">No hay maquinarias registradas. Agregá una en el módulo Maquinarias.</p>
                )}
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
                <label className={lbl}>Proveedor del servicio</label>
                <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={loading} className={sel}>
                  <option value="">Sin especificar</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Modalidad de cobro</label>
                <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-sm">
                  {(['por_ha', 'total'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setModalidad(m)}
                      className={cn('flex-1 py-2 transition-colors',
                        modalidad === m ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-50')}>
                      {m === 'por_ha' ? 'Por hectárea' : 'Total fijo'}
                    </button>
                  ))}
                </div>
              </div>
              <div className={cn('grid gap-3', modalidad === 'por_ha' ? 'grid-cols-2' : 'grid-cols-1')}>
                <div>
                  <label className={lbl}>{modalidad === 'por_ha' ? 'Precio por ha ($) *' : 'Precio total ($) *'}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                    <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                      value={precio} onChange={(e) => setPrecio(e.target.value)} disabled={loading}
                      className={`${inp} pl-7`} />
                  </div>
                </div>
                {modalidad === 'por_ha' && (
                  <div>
                    <label className={lbl}>Hectáreas trabajadas *</label>
                    <input type="number" inputMode="decimal" min="0" step="0.1"
                      value={hectareas} onChange={(e) => setHectareas(e.target.value)} disabled={loading} className={inp} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className={lbl}>Observaciones</label>
            <input type="text" placeholder="Opcional…"
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={loading} className={inp} />
          </div>

          {/* Preview de costo */}
          {costoEstimado !== null && costoEstimado > 0 && (
            <div className="flex items-center gap-3 bg-[#006836]/5 border border-[#006836]/15 rounded-xl px-4 py-3">
              <Calculator className="w-4 h-4 text-[#006836] shrink-0" />
              <div>
                <p className="text-xs text-zinc-500">Costo estimado de esta labor</p>
                <p className="text-lg font-bold text-[#006836]">{ars.format(costoEstimado)}</p>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={loading || !tipoLaborId}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
              {loading ? 'Guardando…' : 'Registrar labor'}
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
