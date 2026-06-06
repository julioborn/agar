'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  empresaId: string;
  onSuccess: () => void;
}

const TIPOS = [
  'tractor', 'cosechadora', 'sembradora', 'pulverizadora',
  'acoplado', 'rastra', 'subsolador', 'implemento', 'otro',
];

const f = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const l = 'block text-xs font-medium text-zinc-500 mb-1.5';
const sec = 'border-t border-zinc-100 pt-4';
const secTitle = 'text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3';

export default function MaquinariaForm({ empresaId, onSuccess }: Props) {
  // Identificación
  const [nombre,    setNombre]    = useState('');
  const [tipo,      setTipo]      = useState('tractor');
  const [esImpl,    setEsImpl]    = useState(false);
  const [marca,     setMarca]     = useState('');
  const [modelo,    setModelo]    = useState('');
  const [anio,      setAnio]      = useState('');
  const [hp,        setHp]        = useState('');

  // Costos directos básicos
  const [consumo,     setConsumo]     = useState('');  // l/h
  const [factorCarga, setFactorCarga] = useState('0.70');
  const [coefLub,     setCoefLub]     = useState('0.12');
  const [cmoHora,     setCmoHora]     = useState('');  // $/h operario
  const [coefRM,      setCoefRM]      = useState('0.80');

  // Parámetros operativos (para CdT)
  const [anchoM,      setAnchoM]      = useState('');
  const [velocidad,   setVelocidad]   = useState('');
  const [eficiencia,  setEficiencia]  = useState('0.75');
  const [rendTnH,     setRendTnH]     = useState('');  // para cosecha
  const [velocEmb,    setVelocEmb]    = useState('');  // para embolsado

  // Capital
  const [valorAdq,    setValorAdq]    = useState('');
  const [valorRep,    setValorRep]    = useState('');
  const [valorRes,    setValorRes]    = useState('0');
  const [vidaHoras,   setVidaHoras]   = useState('');
  const [vidaHa,      setVidaHa]      = useState('');
  const [usoAnual,    setUsoAnual]    = useState('');
  const [tasaInt,     setTasaInt]     = useState('0.08');
  const [seguroPct,   setSeguroPct]   = useState('0');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [showAdv, setShowAdv] = useState(false);

  // Preview del costo horario
  const previewCH = (() => {
    const combHora = parseFloat(consumo || '0');
    // precio gasoil no disponible en form, omitimos en preview
    const crm   = parseFloat(valorRep || valorAdq || '0') * parseFloat(coefRM) / Math.max(parseFloat(vidaHoras || '1'), 1);
    const amort = (parseFloat(valorRep || valorAdq || '0') - parseFloat(valorRes)) / Math.max(parseFloat(vidaHoras || '1'), 1);
    const cint  = ((parseFloat(valorRep || valorAdq || '0') + parseFloat(valorRes)) / 2) * parseFloat(tasaInt) / Math.max(parseFloat(usoAnual || '1'), 1);
    const cmo   = parseFloat(cmoHora || '0');
    return crm + amort + cint + cmo;
  })();

  const previewCDT = (() => {
    const a = parseFloat(anchoM || '0');
    const v = parseFloat(velocidad || '0');
    const e = parseFloat(eficiencia);
    if (a <= 0 || v <= 0) return null;
    return (a * v * e) / 10;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true); setError(null);

    const { error: err } = await createClient().from('maquinarias').insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      tipo,
      es_implemento:         esImpl,
      marca:                 marca.trim()  || null,
      modelo:                modelo.trim() || null,
      anio:                  anio          ? Number(anio)       : null,
      hp:                    hp            ? Number(hp)         : null,
      consumo_combustible_hora: consumo    ? Number(consumo)    : 0,
      factor_carga:          Number(factorCarga),
      coef_lubricantes:      Number(coefLub),
      costo_mano_obra_hora:  cmoHora       ? Number(cmoHora)    : null,
      coef_rm:               Number(coefRM),
      ancho_labor_m:         anchoM        ? Number(anchoM)     : null,
      velocidad_kmh:         velocidad     ? Number(velocidad)  : null,
      eficiencia_campo:      Number(eficiencia),
      rendimiento_tn_h:      rendTnH       ? Number(rendTnH)    : null,
      velocidad_embolsado_m_h: velocEmb   ? Number(velocEmb)   : null,
      valor_adquisicion:     valorAdq      ? Number(valorAdq)   : null,
      valor_reposicion:      valorRep      ? Number(valorRep)   : null,
      valor_residual:        Number(valorRes),
      vida_util_horas:       vidaHoras     ? Number(vidaHoras)  : null,
      vida_util_ha:          vidaHa        ? Number(vidaHa)     : null,
      uso_anual_horas:       usoAnual      ? Number(usoAnual)   : null,
      tasa_interes_anual:    Number(tasaInt),
      seguro_porcentaje:     Number(seguroPct),
    });

    setLoading(false);
    if (err) { setError(err.message); return; }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Identificación */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={l}>Nombre / identificación *</label>
          <input type="text" placeholder="Ej: John Deere 8R 340" value={nombre}
            onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={f} />
        </div>
        <div>
          <label className={l}>Tipo *</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={loading} className={f}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
            <input type="checkbox" checked={esImpl} onChange={(e) => setEsImpl(e.target.checked)}
              className="rounded border-zinc-300 text-[#006836] focus:ring-[#006836]" />
            Es implemento (sin motor propio)
          </label>
        </div>
        {!esImpl && (
          <div>
            <label className={l}>HP</label>
            <input type="number" min="0" placeholder="340" value={hp}
              onChange={(e) => setHp(e.target.value)} disabled={loading} className={f} />
          </div>
        )}
        <div>
          <label className={l}>Marca</label>
          <input type="text" placeholder="John Deere" value={marca}
            onChange={(e) => setMarca(e.target.value)} disabled={loading} className={f} />
        </div>
        <div>
          <label className={l}>Modelo</label>
          <input type="text" placeholder="8R 340" value={modelo}
            onChange={(e) => setModelo(e.target.value)} disabled={loading} className={f} />
        </div>
        <div>
          <label className={l}>Año</label>
          <input type="number" min="1950" max="2099" placeholder="2022" value={anio}
            onChange={(e) => setAnio(e.target.value)} disabled={loading} className={f} />
        </div>
      </div>

      {/* Parámetros operativos */}
      {!esImpl && (
        <div className={sec}>
          <p className={secTitle}>Parámetros operativos (fórmula CdT)</p>
          <p className="text-xs text-zinc-400 mb-3">Usados para convertir costo horario → costo por hectárea/tonelada.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={l}>Consumo combustible (L/h)</label>
              <input type="number" inputMode="decimal" min="0" step="0.1" placeholder="18.0" value={consumo}
                onChange={(e) => setConsumo(e.target.value)} disabled={loading} className={f} />
              {!consumo && hp && (
                <p className="text-xs text-zinc-400 mt-1">
                  Estimado: {(0.163 * parseFloat(hp) * parseFloat(factorCarga)).toFixed(1)} L/h (HP × 0,163 × Fc)
                </p>
              )}
            </div>
            <div>
              <label className={l}>Factor de carga (0–1)</label>
              <input type="number" inputMode="decimal" min="0" max="1" step="0.01" value={factorCarga}
                onChange={(e) => setFactorCarga(e.target.value)} disabled={loading} className={f} />
              <p className="text-xs text-zinc-400 mt-1">Laboreo: 0.8 · Pulv.: 0.4</p>
            </div>
            <div>
              <label className={l}>Ancho de labor efectivo (m)</label>
              <input type="number" inputMode="decimal" min="0" step="0.1" placeholder="3.2" value={anchoM}
                onChange={(e) => setAnchoM(e.target.value)} disabled={loading} className={f} />
            </div>
            <div>
              <label className={l}>Velocidad de trabajo (km/h)</label>
              <input type="number" inputMode="decimal" min="0" step="0.1" placeholder="6.0" value={velocidad}
                onChange={(e) => setVelocidad(e.target.value)} disabled={loading} className={f} />
            </div>
            <div>
              <label className={l}>Eficiencia de campo (0–1)</label>
              <input type="number" inputMode="decimal" min="0" max="1" step="0.01" value={eficiencia}
                onChange={(e) => setEficiencia(e.target.value)} disabled={loading} className={f} />
              <p className="text-xs text-zinc-400 mt-1">Siembra: 0.65 · Laboreo: 0.80</p>
            </div>
            {previewCDT != null && (
              <div className="flex items-end pb-2">
                <p className="text-xs text-[#006836] font-medium">
                  CdT estimada: <span className="font-bold">{previewCDT.toFixed(2)} ha/h</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Para cosecha / embolsado */}
      {(tipo === 'cosechadora' || tipo === 'otro') && (
        <div className={sec}>
          <p className={secTitle}>Cosecha y embolsado</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={l}>Rendimiento de cosecha (tn/h)</label>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={rendTnH}
                onChange={(e) => setRendTnH(e.target.value)} disabled={loading} className={f} />
            </div>
            <div>
              <label className={l}>Velocidad de embolsado (m/h)</label>
              <input type="number" inputMode="decimal" min="0" step="1" value={velocEmb}
                onChange={(e) => setVelocEmb(e.target.value)} disabled={loading} className={f} />
            </div>
          </div>
        </div>
      )}

      {/* Costos directos */}
      <div className={sec}>
        <p className={secTitle}>Costos directos ($/hora)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={l}>Coef. lubricantes (fracción sobre comb.)</label>
            <input type="number" inputMode="decimal" min="0" max="1" step="0.01" value={coefLub}
              onChange={(e) => setCoefLub(e.target.value)} disabled={loading} className={f} />
            <p className="text-xs text-zinc-400 mt-1">Típico: 0.10–0.15</p>
          </div>
          <div>
            <label className={l}>Costo mano de obra operario ($/h)</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="800.00" value={cmoHora}
              onChange={(e) => setCmoHora(e.target.value)} disabled={loading} className={f} />
          </div>
          <div>
            <label className={l}>Coef. rep. y mantenimiento (sobre vida útil)</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={coefRM}
              onChange={(e) => setCoefRM(e.target.value)} disabled={loading} className={f} />
            <p className="text-xs text-zinc-400 mt-1">Tractor: 0.80 · Implemento: 0.50–1.20</p>
          </div>
        </div>
      </div>

      {/* Capital */}
      <div className={sec}>
        <p className={secTitle}>Valor y capital</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={l}>Valor de reposición ($ a nuevo)</label>
            <input type="number" inputMode="decimal" min="0" placeholder="0" value={valorRep}
              onChange={(e) => setValorRep(e.target.value)} disabled={loading} className={f} />
          </div>
          <div>
            <label className={l}>Valor de adquisición ($ real pagado)</label>
            <input type="number" inputMode="decimal" min="0" placeholder="0" value={valorAdq}
              onChange={(e) => setValorAdq(e.target.value)} disabled={loading} className={f} />
          </div>
          <div>
            <label className={l}>Valor residual al fin de vida útil ($)</label>
            <input type="number" inputMode="decimal" min="0" placeholder="0" value={valorRes}
              onChange={(e) => setValorRes(e.target.value)} disabled={loading} className={f} />
          </div>
          <div>
            <label className={l}>Vida útil (horas)</label>
            <input type="number" min="0" placeholder="12000" value={vidaHoras}
              onChange={(e) => setVidaHoras(e.target.value)} disabled={loading} className={f} />
          </div>
          <div>
            <label className={l}>Vida útil (hectáreas) — alternativa</label>
            <input type="number" min="0" placeholder="" value={vidaHa}
              onChange={(e) => setVidaHa(e.target.value)} disabled={loading} className={f} />
          </div>
          <div>
            <label className={l}>Uso anual (horas/año)</label>
            <input type="number" min="0" placeholder="600" value={usoAnual}
              onChange={(e) => setUsoAnual(e.target.value)} disabled={loading} className={f} />
          </div>
          <div>
            <label className={l}>Tasa de interés anual (decimal)</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={tasaInt}
              onChange={(e) => setTasaInt(e.target.value)} disabled={loading} className={f} />
            <p className="text-xs text-zinc-400 mt-1">Ej: 0.08 = 8% anual</p>
          </div>
          <div>
            <label className={l}>Seguro (% sobre valor de reposición)</label>
            <input type="number" inputMode="decimal" min="0" step="0.001" value={seguroPct}
              onChange={(e) => setSeguroPct(e.target.value)} disabled={loading} className={f} />
          </div>
        </div>

        {previewCH > 0 && (
          <div className="mt-3 bg-[#006836]/5 rounded-xl px-4 py-2.5 border border-[#006836]/10">
            <p className="text-xs text-[#006836]">
              Costo horario estimado (sin combustible): <span className="font-bold">
                ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(previewCH)}/h
              </span>
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button type="submit" disabled={loading || !nombre.trim()}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors w-full justify-center">
        <Check className="w-4 h-4" />
        {loading ? 'Guardando...' : 'Agregar maquinaria'}
      </button>
    </form>
  );
}
