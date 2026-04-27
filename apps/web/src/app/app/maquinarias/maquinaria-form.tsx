'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  empresaId: string;
  onSuccess: () => void;
}

const TIPOS = [
  'tractor', 'cosechadora', 'sembradora', 'pulverizadora',
  'acoplado', 'rastra', 'subsolador', 'implemento', 'otro',
];

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const label = 'block text-xs font-medium text-zinc-500 mb-1.5';

export default function MaquinariaForm({ empresaId, onSuccess }: Props) {
  const [nombre,    setNombre]    = useState('');
  const [tipo,      setTipo]      = useState('tractor');
  const [marca,     setMarca]     = useState('');
  const [modelo,    setModelo]    = useState('');
  const [anio,      setAnio]      = useState('');
  const [hp,        setHp]        = useState('');
  const [consumo,   setConsumo]   = useState('');
  const [mantHora,  setMantHora]  = useState('');
  const [valor,     setValor]     = useState('');
  const [vidaUtil,  setVidaUtil]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true); setError(null);

    const { error: err } = await createClient().from('maquinarias').insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      tipo,
      marca:  marca.trim()  || null,
      modelo: modelo.trim() || null,
      anio:   anio  ? Number(anio)  : null,
      hp:     hp    ? Number(hp)    : null,
      consumo_combustible_hora: consumo  ? Number(consumo)  : 0,
      costo_mantenimiento_hora: mantHora ? Number(mantHora) : 0,
      valor_adquisicion:        valor    ? Number(valor)    : null,
      vida_util_horas:          vidaUtil ? Number(vidaUtil) : null,
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
          <label className={label}>Nombre / identificación *</label>
          <input type="text" placeholder="Ej: John Deere 8R 340" value={nombre}
            onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
        </div>
        <div>
          <label className={label}>Tipo *</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={loading} className={field}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>HP</label>
          <input type="number" min="0" placeholder="340" value={hp}
            onChange={(e) => setHp(e.target.value)} disabled={loading} className={field} />
        </div>
        <div>
          <label className={label}>Marca</label>
          <input type="text" placeholder="John Deere" value={marca}
            onChange={(e) => setMarca(e.target.value)} disabled={loading} className={field} />
        </div>
        <div>
          <label className={label}>Modelo</label>
          <input type="text" placeholder="8R 340" value={modelo}
            onChange={(e) => setModelo(e.target.value)} disabled={loading} className={field} />
        </div>
        <div>
          <label className={label}>Año</label>
          <input type="number" min="1950" max="2099" placeholder="2022" value={anio}
            onChange={(e) => setAnio(e.target.value)} disabled={loading} className={field} />
        </div>
      </div>

      {/* Costos operativos */}
      <div className="border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Costos operativos</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Consumo combustible (L/h) *</label>
            <input type="number" inputMode="decimal" min="0" step="0.1" placeholder="18.0" value={consumo}
              onChange={(e) => setConsumo(e.target.value)} disabled={loading} className={field} />
          </div>
          <div>
            <label className={label}>Costo mantenimiento ($/h) *</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="500.00" value={mantHora}
              onChange={(e) => setMantHora(e.target.value)} disabled={loading} className={field} />
          </div>
        </div>
      </div>

      {/* Amortización */}
      <div className="border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Amortización (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Valor de adquisición ($)</label>
            <input type="number" inputMode="decimal" min="0" placeholder="0" value={valor}
              onChange={(e) => setValor(e.target.value)} disabled={loading} className={field} />
          </div>
          <div>
            <label className={label}>Vida útil (horas)</label>
            <input type="number" min="0" placeholder="12000" value={vidaUtil}
              onChange={(e) => setVidaUtil(e.target.value)} disabled={loading} className={field} />
          </div>
        </div>
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
