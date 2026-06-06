'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const TIPOS_SUGERIDOS = [
  { tipo: 'gasoil',         nombre: 'Gasoil / Diesel',         unidad: '$/L' },
  { tipo: 'lubricantes',    nombre: 'Aceites y lubricantes',    unidad: '$/L' },
  { tipo: 'mano_obra_hora', nombre: 'Mano de obra operario',   unidad: '$/h' },
  { tipo: 'usd',            nombre: 'Dólar estadounidense',     unidad: 'ARS/USD' },
  { tipo: 'quintal_soja',   nombre: 'Quintal soja',            unidad: '$/qq' },
  { tipo: 'quintal_maiz',   nombre: 'Quintal maíz',            unidad: '$/qq' },
  { tipo: 'quintal_trigo',  nombre: 'Quintal trigo',            unidad: '$/qq' },
];

interface Referencia {
  id: string;
  tipo: string;
  nombre: string;
  valor: number;
  unidad: string;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  observaciones: string | null;
}

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
const today = () => new Date().toISOString().split('T')[0];

const inp = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40';
const lbl = 'block text-xs font-medium text-zinc-500 mb-1.5';

interface Props {
  referencias: Referencia[];
  empresaId: string;
}

export default function ReferenciasPrecioManager({ referencias: initial, empresaId }: Props) {
  const router = useRouter();
  const [referencias, setReferencias] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [tipo,      setTipo]      = useState('gasoil');
  const [tipoCustom,setTipoCustom]= useState('');
  const [nombre,    setNombre]    = useState('Gasoil / Diesel');
  const [valor,     setValor]     = useState('');
  const [unidad,    setUnidad]    = useState('$/L');
  const [desde,     setDesde]     = useState(today());
  const [hasta,     setHasta]     = useState('');
  const [obs,       setObs]       = useState('');

  const tipoFinal = tipo === '__custom__' ? tipoCustom : tipo;

  // Group by tipo
  const grupos = useMemo(() => {
    const map = new Map<string, { nombre: string; unidad: string; items: Referencia[] }>();
    for (const r of referencias) {
      const g = map.get(r.tipo);
      if (g) { g.items.push(r); }
      else { map.set(r.tipo, { nombre: r.nombre, unidad: r.unidad, items: [r] }); }
    }
    return Array.from(map.entries()).map(([tipo, g]) => ({ tipo, ...g }));
  }, [referencias]);

  // Current vigente per tipo
  const vigentes = useMemo(() => {
    const todayStr = today();
    const map = new Map<string, Referencia>();
    for (const r of referencias) {
      if (r.vigencia_desde <= todayStr && (!r.vigencia_hasta || r.vigencia_hasta >= todayStr)) {
        const existing = map.get(r.tipo);
        if (!existing || r.vigencia_desde > existing.vigencia_desde) {
          map.set(r.tipo, r);
        }
      }
    }
    return map;
  }, [referencias]);

  function resetForm() {
    setTipo('gasoil'); setTipoCustom(''); setNombre('Gasoil / Diesel');
    setValor(''); setUnidad('$/L'); setDesde(today()); setHasta(''); setObs('');
    setEditingId(null); setError('');
  }

  function handleTipoSelect(t: string) {
    setTipo(t);
    if (t !== '__custom__') {
      const s = TIPOS_SUGERIDOS.find((x) => x.tipo === t);
      if (s) { setNombre(s.nombre); setUnidad(s.unidad); }
    }
  }

  function handleEdit(r: Referencia) {
    setEditingId(r.id);
    setTipo(TIPOS_SUGERIDOS.some((s) => s.tipo === r.tipo) ? r.tipo : '__custom__');
    setTipoCustom(r.tipo);
    setNombre(r.nombre); setValor(String(r.valor)); setUnidad(r.unidad);
    setDesde(r.vigencia_desde); setHasta(r.vigencia_hasta ?? ''); setObs(r.observaciones ?? '');
    setShowForm(true); setExpandedTipo(r.tipo);
  }

  async function handleSave() {
    if (!tipoFinal || !valor || !nombre || !desde) { setError('Completá los campos obligatorios.'); return; }
    setLoading(true); setError('');
    const sb = createClient();
    const payload = {
      empresa_id:     empresaId,
      tipo:           tipoFinal,
      nombre:         nombre.trim(),
      valor:          parseFloat(valor),
      unidad:         unidad.trim(),
      vigencia_desde: desde,
      vigencia_hasta: hasta || null,
      observaciones:  obs.trim() || null,
    };

    if (editingId) {
      const { error: e } = await sb.from('referencias_precio').update(payload).eq('id', editingId);
      if (e) { setError(e.message); setLoading(false); return; }
      setReferencias((prev) => prev.map((r) => r.id === editingId ? { ...r, ...payload } : r));
    } else {
      const { data, error: e } = await sb.from('referencias_precio').insert(payload).select().single();
      if (e) { setError(e.message); setLoading(false); return; }
      setReferencias((prev) => [data as Referencia, ...prev]);
    }
    setLoading(false);
    resetForm();
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta referencia de precio?')) return;
    await createClient().from('referencias_precio').delete().eq('id', id);
    setReferencias((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Vigentes en tarjetas */}
      {vigentes.size > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Valores vigentes hoy</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from(vigentes.entries()).map(([tipo, r]) => (
              <div key={tipo} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 shadow-sm">
                <p className="text-lg font-bold text-zinc-900 leading-none">{num.format(r.valor)}</p>
                <p className="text-xs text-[#006836] font-medium mt-0.5">{r.unidad}</p>
                <p className="text-xs text-zinc-400 mt-1 truncate">{r.nombre}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón agregar */}
      <div className="flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] hover:bg-[#005228] text-white text-xs font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm && !editingId ? 'Cancelar' : 'Nueva referencia'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">
            {editingId ? 'Editar referencia' : 'Agregar referencia de precio'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Tipo *</label>
              <select value={tipo} onChange={(e) => handleTipoSelect(e.target.value)} className={inp}>
                {TIPOS_SUGERIDOS.map((s) => (
                  <option key={s.tipo} value={s.tipo}>{s.nombre} ({s.unidad})</option>
                ))}
                <option value="__custom__">Otro (personalizado)</option>
              </select>
            </div>
            {tipo === '__custom__' && (
              <div>
                <label className={lbl}>Clave interna del tipo *</label>
                <input type="text" value={tipoCustom} onChange={(e) => setTipoCustom(e.target.value)}
                  placeholder="ej: repuestos_hora" className={inp} />
              </div>
            )}
            <div>
              <label className={lbl}>Nombre visible *</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Unidad *</label>
              <input type="text" value={unidad} onChange={(e) => setUnidad(e.target.value)}
                placeholder="$/L, $/h, ARS/USD…" className={inp} />
            </div>
            <div>
              <label className={lbl}>Valor *</label>
              <input type="number" step="0.0001" min="0" value={valor}
                onChange={(e) => setValor(e.target.value)} placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className={lbl}>Vigencia desde *</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Vigencia hasta (opcional)</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Observaciones</label>
            <input type="text" value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Fuente del dato, notas…" className={inp} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
              <Check className="w-4 h-4" />
              {loading ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar'}
            </button>
            <button onClick={() => { resetForm(); setShowForm(false); }}
              className="px-4 py-2 text-sm text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Historial agrupado por tipo */}
      {grupos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center text-sm text-zinc-400 shadow-sm">
          Sin referencias cargadas. Usá "Nueva referencia" para agregar gasoil, mano de obra u otros precios.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
          <div className="divide-y divide-zinc-100">
            {grupos.map(({ tipo, nombre: gNombre, unidad: gUnidad, items }) => {
              const vigente = vigentes.get(tipo);
              const isOpen = expandedTipo === tipo;
              return (
                <div key={tipo}>
                  <button
                    type="button"
                    onClick={() => setExpandedTipo(isOpen ? null : tipo)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-800">{gNombre}</p>
                        <p className="text-xs text-zinc-400">{items.length} registro{items.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {vigente && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#006836]">{num.format(vigente.valor)}</p>
                          <p className="text-xs text-zinc-400">{gUnidad} · vigente</p>
                        </div>
                      )}
                      {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-zinc-50 bg-zinc-50/40 px-4 py-3">
                      <div className="rounded-xl border border-zinc-100 overflow-hidden bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-zinc-50 border-b border-zinc-100">
                            <tr>
                              {['Valor', 'Unidad', 'Vigencia desde', 'Vigencia hasta', 'Observaciones', ''].map((h) => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-zinc-500">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {items.map((r) => (
                              <tr key={r.id} className="hover:bg-zinc-50">
                                <td className="px-3 py-2 font-bold text-zinc-900">{num.format(r.valor)}</td>
                                <td className="px-3 py-2 text-zinc-600">{r.unidad}</td>
                                <td className="px-3 py-2 text-zinc-600">{fmt(r.vigencia_desde)}</td>
                                <td className="px-3 py-2 text-zinc-500">{r.vigencia_hasta ? fmt(r.vigencia_hasta) : '—'}</td>
                                <td className="px-3 py-2 text-zinc-400 max-w-xs truncate">{r.observaciones ?? '—'}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleEdit(r)}
                                      className="p-1 text-zinc-400 hover:text-[#006836] transition-colors">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(r.id)}
                                      className="p-1 text-zinc-400 hover:text-red-500 transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
