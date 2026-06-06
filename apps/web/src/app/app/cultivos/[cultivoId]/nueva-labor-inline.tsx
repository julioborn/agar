'use client';

import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp, Tractor, Truck, Pencil, Calculator, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crearLabor, crearLaborCosteo } from '../actions';
import { useCurrency } from '@/lib/currency-context';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TipoLabor  { id: string; nombre: string; }
interface Maquinaria {
  id: string; nombre: string; tipo: string; es_implemento?: boolean;
  consumo_combustible_hora: number; costo_mantenimiento_hora: number;
  valor_adquisicion: number | null; vida_util_horas: number | null;
  // Nuevos campos (mig 019)
  valor_reposicion?: number | null; valor_residual?: number;
  ancho_labor_m?: number | null; velocidad_kmh?: number | null;
  eficiencia_campo?: number; factor_carga?: number; coef_lubricantes?: number;
  costo_mano_obra_hora?: number | null; coef_rm?: number;
  uso_anual_horas?: number | null; tasa_interes_anual?: number; seguro_porcentaje?: number;
  hp?: number | null;
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

// ── Fórmula agronómica (cálculo local para preview) ──────────────────────────

function calcularCH(
  maq: Maquinaria,
  precioGasoil: number,
  overrideEficiencia?: number,
  overrideFactor?: number,
): {
  ccomb: number; club: number; cmo: number; crm: number; camort: number; cint: number; ch: number;
  consumoH: number;
} {
  const valRep  = maq.valor_reposicion ?? maq.valor_adquisicion ?? 0;
  const valRes  = maq.valor_residual ?? 0;
  const vidaH   = maq.vida_util_horas ?? 0;
  const usoAnual= maq.uso_anual_horas ?? 0;
  const tasa    = maq.tasa_interes_anual ?? 0.08;
  const coefLub = maq.coef_lubricantes ?? 0.12;
  const coefRM  = maq.coef_rm ?? 0.80;
  const seguro  = maq.seguro_porcentaje ?? 0;
  const fc      = overrideFactor ?? maq.factor_carga ?? 0.70;

  const consumoH = maq.consumo_combustible_hora > 0
    ? maq.consumo_combustible_hora
    : (maq.hp ?? 0) * 0.163 * fc;

  const ccomb  = consumoH * precioGasoil;
  const club   = ccomb * coefLub;
  const cmo    = maq.costo_mano_obra_hora ?? 0;
  const crm    = vidaH > 0 ? valRep * coefRM / vidaH : 0;
  const camort = vidaH > 0 ? (valRep - valRes) / vidaH : 0;
  const cint   = usoAnual > 0 ? ((valRep + valRes) / 2) * tasa / usoAnual : 0;
  const cseg   = usoAnual > 0 ? valRep * seguro / usoAnual : 0;
  const ch     = ccomb + club + cmo + crm + camort + cint + cseg;
  return { ccomb, club, cmo, crm, camort, cint, ch, consumoH };
}

function calcularCostoLabor(
  maq: Maquinaria,
  impl: Maquinaria | null,
  precioGasoil: number,
  unidadSalida: string,
  magnitud: number,
  overrideAncho?: number,
  overrideVelocidad?: number,
  overrideEficiencia?: number,
): { costoUnitario: number; costoTotal: number; desglose: any; cdt: number } {
  const { ch, ...compMaq } = calcularCH(maq, precioGasoil, overrideEficiencia);
  let chTotal = ch;

  if (impl) {
    const valRep  = impl.valor_reposicion ?? impl.valor_adquisicion ?? 0;
    const valRes  = impl.valor_residual ?? 0;
    const vidaH   = impl.vida_util_horas ?? 0;
    const usoAnual= impl.uso_anual_horas ?? maq.uso_anual_horas ?? 0;
    const tasa    = impl.tasa_interes_anual ?? 0.08;
    const crm_i   = vidaH > 0 ? valRep * (impl.coef_rm ?? 0.80) / vidaH : 0;
    const amort_i = vidaH > 0 ? (valRep - valRes) / vidaH : 0;
    const cint_i  = usoAnual > 0 ? ((valRep + valRes) / 2) * tasa / usoAnual : 0;
    chTotal += crm_i + amort_i + cint_i;
  }

  const ancho  = overrideAncho     ?? maq.ancho_labor_m     ?? 0;
  const veloc  = overrideVelocidad ?? maq.velocidad_kmh     ?? 0;
  const efic   = overrideEficiencia ?? maq.eficiencia_campo ?? 0.75;
  const cdt    = ancho > 0 && veloc > 0 ? (ancho * veloc * efic) / 10 : 0;

  const costoUnitario = (() => {
    switch (unidadSalida) {
      case 'ha': return cdt > 0 ? chTotal / cdt : 0;
      case 'h':  return chTotal;
      default:   return chTotal;
    }
  })();
  return { costoUnitario, costoTotal: costoUnitario * magnitud, desglose: compMaq, cdt };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const UNIDADES = [
  { value: 'ha',    label: 'por hectárea (ha)' },
  { value: 'h',     label: 'por hora (h)' },
  { value: 'tn',    label: 'por tonelada (tn)' },
  { value: 'm',     label: 'por metro (m)' },
  { value: 'unidad',label: 'por unidad' },
];

const sel = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50 bg-white';
const inp = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const lbl = 'block text-xs font-medium text-zinc-500 mb-1.5';

// ── Componente ────────────────────────────────────────────────────────────────

export default function NuevaLaborInline({
  cultivoId, tiposLabor, maquinarias, proveedores, precioCombustible, hectareasLote,
}: Props) {
  const { formatMoney } = useCurrency();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comunes
  const [tipoLaborId, setTipoLaborId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('');

  // Modo de costeo
  const [modo, setModo] = useState<'A' | 'B' | 'C'>('B');
  const [unidad, setUnidad] = useState<'ha' | 'h' | 'tn' | 'm' | 'unidad'>('ha');
  const [magnitud, setMagnitud] = useState(hectareasLote ? String(hectareasLote) : '');

  // Modo A
  const [maqId,      setMaqId]      = useState('');
  const [implId,     setImplId]     = useState('');
  const [showAdv,    setShowAdv]    = useState(false);
  const [oancho,     setOancho]     = useState('');
  const [oveloc,     setOveloc]     = useState('');
  const [oefic,      setOefic]      = useState('');

  // Modo B
  const [provId,     setProvId]     = useState('');
  const [tarifa,     setTarifa]     = useState('');
  const [flete,      setFlete]      = useState('');
  const [iva,        setIva]        = useState('');

  // Modo C
  const [costoTotal, setCostoTotal] = useState('');
  const [costoUnit,  setCostoUnit]  = useState('');
  const [justif,     setJustif]     = useState('');

  // Derived preview
  const maq  = maquinarias.find((m) => m.id === maqId && !m.es_implemento);
  const impl = maquinarias.find((m) => m.id === implId);
  const implementos = maquinarias.filter((m) => m.es_implemento);
  const tractores   = maquinarias.filter((m) => !m.es_implemento);

  const preview = useMemo(() => {
    const mag = parseFloat(magnitud || '0');
    if (modo === 'A') {
      if (!maq || mag <= 0) return null;
      return calcularCostoLabor(
        maq, impl ?? null, precioCombustible, unidad, mag,
        oancho ? parseFloat(oancho) : undefined,
        oveloc ? parseFloat(oveloc) : undefined,
        oefic  ? parseFloat(oefic)  : undefined,
      );
    }
    if (modo === 'B') {
      const t = parseFloat(tarifa || '0');
      const f = parseFloat(flete  || '0');
      const i = parseFloat(iva    || '0');
      if (t <= 0 || mag <= 0) return null;
      const cu = (t + f) * (1 + i / 100);
      return { costoUnitario: cu, costoTotal: cu * mag, desglose: null, cdt: 0 };
    }
    if (modo === 'C') {
      const ct = parseFloat(costoTotal || '0');
      const cu = parseFloat(costoUnit  || '0');
      if (ct > 0 && mag > 0) return { costoUnitario: ct / mag, costoTotal: ct, desglose: null, cdt: 0 };
      if (cu > 0 && mag > 0) return { costoUnitario: cu, costoTotal: cu * mag, desglose: null, cdt: 0 };
      return null;
    }
    return null;
  }, [modo, maq, impl, unidad, magnitud, precioCombustible, oancho, oveloc, oefic, tarifa, flete, iva, costoTotal, costoUnit]);

  function reset() {
    setTipoLaborId(''); setFecha(new Date().toISOString().slice(0, 10));
    setObservaciones(''); setModo('B'); setUnidad('ha');
    setMagnitud(hectareasLote ? String(hectareasLote) : '');
    setMaqId(''); setImplId(''); setOancho(''); setOveloc(''); setOefic('');
    setProvId(''); setTarifa(''); setFlete(''); setIva('');
    setCostoTotal(''); setCostoUnit(''); setJustif(''); setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoLaborId) { setError('Seleccioná un tipo de labor.'); return; }
    const mag = parseFloat(magnitud || '0');
    if (mag <= 0) { setError('Ingresá la magnitud aplicada (ha, horas, tn, metros, etc.).'); return; }
    setLoading(true); setError(null);

    const result = await crearLaborCosteo({
      cultivo_id:    cultivoId,
      tipo_labor_id: tipoLaborId,
      fecha,
      tipo_ejecucion: modo === 'A' || modo === 'C' ? 'propio' : 'tercero',
      observaciones: observaciones.trim() || undefined,
      modo_costeo:   `${modo}_${modo === 'A' ? 'propio' : modo === 'B' ? 'tercero' : 'manual'}` as any,
      unidad_salida: unidad,
      magnitud_aplicada: mag,
      // Modo A
      maquinaria_id:     modo === 'A' ? maqId    : undefined,
      implemento_id:     modo === 'A' && implId ? implId : undefined,
      override_ancho:    modo === 'A' && oancho ? parseFloat(oancho) : undefined,
      override_velocidad:modo === 'A' && oveloc ? parseFloat(oveloc) : undefined,
      override_eficiencia:modo === 'A' && oefic ? parseFloat(oefic) : undefined,
      // Modo B
      proveedor_id:      modo === 'B' && provId ? provId : undefined,
      precio_unitario:   modo === 'B' ? parseFloat(tarifa || '0') : undefined,
      flete_adicional_ha:modo === 'B' ? parseFloat(flete || '0') : undefined,
      iva_porcentaje:    modo === 'B' ? parseFloat(iva   || '0') : undefined,
      // Modo C
      costo_total_manual:   modo === 'C' && costoTotal ? parseFloat(costoTotal) : undefined,
      costo_unitario_manual:modo === 'C' && costoUnit  ? parseFloat(costoUnit)  : undefined,
      justificacion_modo_c: modo === 'C' ? justif : undefined,
    });

    setLoading(false);
    if (result.error) { setError(result.error); return; }
    reset(); setOpen(false);
  }

  const MODOS = [
    { id: 'A', icon: <Tractor className="w-4 h-4" />, label: 'Propio',      sub: 'Fórmula agronómica' },
    { id: 'B', icon: <Truck   className="w-4 h-4" />, label: 'Contratista', sub: 'Tarifa por unidad' },
    { id: 'C', icon: <Pencil  className="w-4 h-4" />, label: 'Manual',      sub: 'Costo directo' },
  ];

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
            <p className="text-sm font-semibold text-zinc-800">Registrar labor / servicio</p>
            <p className="text-xs text-zinc-400">Modo A (propio), B (contratista) o C (manual)</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-5 space-y-5">

          {/* Tipo + Fecha */}
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

          {/* Selector de modo A / B / C */}
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
            {MODOS.map((m) => (
              <button key={m.id} type="button" onClick={() => setModo(m.id as any)}
                className={cn('flex-1 flex flex-col items-center py-3 px-2 gap-1 transition-colors border-r border-zinc-200 last:border-r-0',
                  modo === m.id ? 'bg-[#006836] text-white' : 'text-zinc-500 hover:bg-zinc-50')}>
                {m.icon}
                <span className="text-xs font-semibold">{m.label}</span>
                <span className={cn('text-xs', modo === m.id ? 'text-white/70' : 'text-zinc-400')}>{m.sub}</span>
              </button>
            ))}
          </div>

          {/* Unidad de salida + Magnitud (común) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Unidad de salida *</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value as any)} disabled={loading} className={sel}>
                {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>
                {unidad === 'ha' ? 'Hectáreas trabajadas' : unidad === 'h' ? 'Horas trabajadas' :
                 unidad === 'tn' ? 'Toneladas procesadas' : unidad === 'm' ? 'Metros trabajados' : 'Unidades'} *
              </label>
              <input type="number" inputMode="decimal" min="0" step="0.01"
                value={magnitud} onChange={(e) => setMagnitud(e.target.value)} disabled={loading} className={inp} />
            </div>
          </div>

          {/* ── Modo A: equipo propio ────────────────────────────────── */}
          {modo === 'A' && (
            <div className="space-y-4 rounded-xl border border-zinc-100 p-4 bg-zinc-50/40">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Equipo principal (tractor) *</label>
                  <select value={maqId} onChange={(e) => setMaqId(e.target.value)} disabled={loading} className={sel}>
                    <option value="">Seleccioná…</option>
                    {tractores.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Implemento asociado (opcional)</label>
                  <select value={implId} onChange={(e) => setImplId(e.target.value)} disabled={loading} className={sel}>
                    <option value="">Sin implemento</option>
                    {implementos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>

              {maq && (
                <div className="bg-white rounded-xl border border-zinc-100 px-3 py-2">
                  <p className="text-xs text-zinc-400 mb-1">Parámetros de {maq.nombre}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                    {maq.ancho_labor_m && <span>Ancho: <strong>{maq.ancho_labor_m} m</strong></span>}
                    {maq.velocidad_kmh && <span>Velocidad: <strong>{maq.velocidad_kmh} km/h</strong></span>}
                    {maq.eficiencia_campo && <span>Eficiencia: <strong>{((maq.eficiencia_campo ?? 0.75) * 100).toFixed(0)}%</strong></span>}
                    {!maq.ancho_labor_m && !maq.velocidad_kmh && (
                      <span className="text-amber-500">Sin parámetros de CdT — costo en $/h solamente</span>
                    )}
                  </div>
                </div>
              )}

              {/* Overrides */}
              <button type="button" onClick={() => setShowAdv(!showAdv)}
                className="text-xs text-[#006836] hover:underline flex items-center gap-1">
                {showAdv ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAdv ? 'Ocultar parámetros de campo' : 'Sobreescribir parámetros de campo para esta labor'}
              </button>
              {showAdv && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>Ancho efectivo (m)</label>
                    <input type="number" min="0" step="0.1" value={oancho}
                      onChange={(e) => setOancho(e.target.value)} disabled={loading}
                      placeholder={maq?.ancho_labor_m?.toString() ?? ''} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Velocidad (km/h)</label>
                    <input type="number" min="0" step="0.1" value={oveloc}
                      onChange={(e) => setOveloc(e.target.value)} disabled={loading}
                      placeholder={maq?.velocidad_kmh?.toString() ?? ''} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Eficiencia (0–1)</label>
                    <input type="number" min="0" max="1" step="0.01" value={oefic}
                      onChange={(e) => setOefic(e.target.value)} disabled={loading}
                      placeholder={(maq?.eficiencia_campo ?? 0.75).toString()} className={inp} />
                  </div>
                </div>
              )}

              {/* Desglose preview */}
              {preview && preview.costoTotal > 0 && (
                <div className="bg-[#006836]/5 rounded-xl border border-[#006836]/10 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#006836]" />
                    <span className="text-xs font-semibold text-[#006836]">Desglose del costo (Modo A)</span>
                  </div>
                  {preview.cdt > 0 && (
                    <p className="text-xs text-zinc-500">
                      CdT: <strong>{preview.cdt.toFixed(2)} ha/h</strong> · Costo/ha: <strong>{formatMoney(preview.costoUnitario)}</strong>
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">
                    Costo horario equipo: incluye combustible, lubricantes, mano de obra, rep. y capital.
                    {!precioCombustible && <span className="text-amber-500"> (Precio gasoil no configurado)</span>}
                  </p>
                  <p className="text-base font-bold text-[#006836]">
                    Costo total estimado: {formatMoney(preview.costoTotal)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Modo B: contratista ──────────────────────────────────── */}
          {modo === 'B' && (
            <div className="space-y-3 rounded-xl border border-zinc-100 p-4 bg-zinc-50/40">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Proveedor / Contratista</label>
                  <select value={provId} onChange={(e) => setProvId(e.target.value)} disabled={loading} className={sel}>
                    <option value="">Sin especificar</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Tarifa base (${unidad}) *</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                    value={tarifa} onChange={(e) => setTarifa(e.target.value)} disabled={loading} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Flete adicional ($/ha)</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01"
                    value={flete} onChange={(e) => setFlete(e.target.value)} disabled={loading} className={inp} />
                </div>
                <div>
                  <label className={lbl}>IVA %</label>
                  <input type="number" inputMode="decimal" min="0" max="100" step="0.01"
                    value={iva} onChange={(e) => setIva(e.target.value)} disabled={loading} className={inp} />
                </div>
              </div>
              {preview && preview.costoTotal > 0 && (
                <div className="flex items-center gap-3 bg-[#006836]/5 border border-[#006836]/10 rounded-xl px-4 py-3">
                  <Calculator className="w-4 h-4 text-[#006836] shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-500">
                      Costo unitario: {formatMoney(preview.costoUnitario)}/{unidad}
                    </p>
                    <p className="text-base font-bold text-[#006836]">Total: {formatMoney(preview.costoTotal)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Modo C: manual ───────────────────────────────────────── */}
          {modo === 'C' && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Modo manual. Esta imputación quedará marcada como "costo manual / no desglosado" en los reportes.
                  Ingresá el costo total <em>o</em> el costo unitario.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Costo total ($)</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01"
                    value={costoTotal} onChange={(e) => { setCostoTotal(e.target.value); setCostoUnit(''); }}
                    disabled={loading || !!costoUnit} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className={lbl}>— o — Costo unitario (${unidad})</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01"
                    value={costoUnit} onChange={(e) => { setCostoUnit(e.target.value); setCostoTotal(''); }}
                    disabled={loading || !!costoTotal} placeholder="0.00" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Justificación / origen del valor * (obligatorio)</label>
                <textarea rows={2} value={justif} onChange={(e) => setJustif(e.target.value)}
                  disabled={loading} placeholder="ej: presupuesto de contratista, factura N° X, estimación a ojo…"
                  className={cn(inp, 'resize-none')} />
              </div>
              {preview && preview.costoTotal > 0 && (
                <div className="bg-amber-100 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-700">
                    Costo unitario: {formatMoney(preview.costoUnitario)}/{unidad} · Total: <strong>{formatMoney(preview.costoTotal)}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className={lbl}>Observaciones</label>
            <input type="text" placeholder="Opcional…"
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={loading} className={inp} />
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

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
