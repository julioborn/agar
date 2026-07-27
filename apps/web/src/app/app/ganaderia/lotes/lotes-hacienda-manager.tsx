'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Beef, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useReadOnly } from '@/lib/readonly-context';

interface UbicacionOpcion { id: string; nombre: string; loteNombre: string; campoNombre: string; }
interface CategoriaOpcion { id: string; nombre: string; }
interface LoteHaciendaRow {
  id: string;
  nombre: string;
  etapaProductiva: string;
  origen: string;
  fechaIngreso: string;
  estado: string;
  pesoPromedioIngresoKg: number | null;
  categoriaNombre: string;
  ubicacion: string;
  cantidadAnimales: number;
}
interface Props {
  lotesHacienda: LoteHaciendaRow[];
  corrales: UbicacionOpcion[];
  potreros: UbicacionOpcion[];
  categorias: CategoriaOpcion[];
  empresaId: string;
}

const ETAPAS = [
  { value: 'cria', label: 'Cría' },
  { value: 'recria_invernada', label: 'Recría / Invernada' },
  { value: 'terminacion', label: 'Terminación' },
];
const ETAPA_BADGE: Record<string, string> = {
  cria: 'bg-purple-100 text-purple-700',
  recria_invernada: 'bg-amber-100 text-amber-700',
  terminacion: 'bg-[#006836]/10 text-[#006836]',
};
const ESTADO_BADGE: Record<string, string> = {
  activo: 'bg-[#006836]/10 text-[#006836]',
  cerrado: 'bg-zinc-100 text-zinc-500',
};

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const today = () => new Date().toISOString().slice(0, 10);

export default function LotesHaciendaManager({ lotesHacienda, corrales, potreros, categorias, empresaId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const esLector = useReadOnly();

  const [formOpen, setFormOpen] = useState(false);
  const [tipoManejo, setTipoManejo] = useState<'corral' | 'potrero'>('corral');
  const [ubicacionId, setUbicacionId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [etapaProductiva, setEtapaProductiva] = useState('recria_invernada');
  const [nombre, setNombre] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(today());
  const [origen, setOrigen] = useState<'compra' | 'cria_propia'>('compra');
  const [peso, setPeso] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ubicaciones = tipoManejo === 'corral' ? corrales : potreros;

  function resetForm() {
    setUbicacionId(''); setCategoriaId(''); setEtapaProductiva('recria_invernada');
    setNombre(''); setFechaIngreso(today()); setOrigen('compra'); setPeso(''); setObservaciones('');
    setError(null); setFormOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !ubicacionId) return;
    setSaving(true); setError(null);

    const payload = {
      empresa_id: empresaId,
      corral_id: tipoManejo === 'corral' ? ubicacionId : null,
      potrero_id: tipoManejo === 'potrero' ? ubicacionId : null,
      categoria_hacienda_id: categoriaId || null,
      etapa_productiva: etapaProductiva,
      nombre: nombre.trim(),
      fecha_ingreso: fechaIngreso,
      origen,
      peso_promedio_ingreso_kg: peso ? parseFloat(peso) : null,
      observaciones: observaciones.trim() || null,
    };

    const { data, error: dbError } = await supabase.from('lotes_hacienda').insert(payload).select('id').single();
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    resetForm();
    if (data?.id) router.push(`/app/ganaderia/lotes/${data.id}`);
    else router.refresh();
  }

  return (
    <div className="space-y-4">

      {/* Nuevo lote de hacienda — oculto para lector */}
      {!esLector && <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
        formOpen ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>
        <button type="button" onClick={() => (formOpen ? resetForm() : setFormOpen(true))}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              formOpen ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
              <Plus className={cn('w-4 h-4', formOpen ? 'text-white' : 'text-[#006836]')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">Nuevo lote de hacienda</p>
              <p className="text-xs text-zinc-400">Grupo de animales que entra junto a un corral o potrero</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tipo de manejo</label>
                <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-sm font-medium w-fit">
                  {(['corral', 'potrero'] as const).map((t) => (
                    <button key={t} type="button"
                      onClick={() => { setTipoManejo(t); setUbicacionId(''); }}
                      className={cn('px-4 py-2 transition-colors capitalize',
                        tipoManejo === t ? 'bg-[#006836] text-white' : 'text-zinc-500 hover:bg-zinc-50')}>
                      {t === 'corral' ? 'Corral (feedlot)' : 'Potrero (campo abierto)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    {tipoManejo === 'corral' ? 'Corral' : 'Potrero'}
                  </label>
                  <select value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)} required disabled={saving} className={field}>
                    <option value="">Seleccioná…</option>
                    {ubicaciones.map((u) => (
                      <option key={u.id} value={u.id}>{u.campoNombre} › {u.loteNombre} › {u.nombre}</option>
                    ))}
                  </select>
                  {ubicaciones.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No hay {tipoManejo === 'corral' ? 'corrales' : 'potreros'} cargados todavía.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Categoría</label>
                  <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={saving} className={field}>
                    <option value="">Sin especificar</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del lote</label>
                  <input type="text" placeholder="Ej: Recría Marzo 2026" value={nombre}
                    onChange={(e) => setNombre(e.target.value)} required disabled={saving} className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Etapa productiva</label>
                  <select value={etapaProductiva} onChange={(e) => setEtapaProductiva(e.target.value)} disabled={saving} className={field}>
                    {ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Fecha de ingreso</label>
                  <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} required disabled={saving} className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Origen</label>
                  <select value={origen} onChange={(e) => setOrigen(e.target.value as 'compra' | 'cria_propia')} disabled={saving} className={field}>
                    <option value="compra">Compra</option>
                    <option value="cria_propia">Cría propia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Peso promedio de ingreso (kg)</label>
                  <input type="number" min="0" step="0.1" placeholder="Opcional" value={peso}
                    onChange={(e) => setPeso(e.target.value)} disabled={saving} className={field} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Observaciones</label>
                <input type="text" placeholder="Opcional…" value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)} disabled={saving} className={field} />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving || !nombre.trim() || !ubicacionId}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
                  <Plus className="w-4 h-4" />
                  {saving ? 'Creando...' : 'Crear lote de hacienda'}
                </button>
                <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>}

      {/* Lista */}
      {lotesHacienda.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Beef className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay lotes de hacienda cargados todavía.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm divide-y divide-zinc-100">
          {lotesHacienda.map((l) => (
            <Link key={l.id} href={`/app/ganaderia/lotes/${l.id}`}
              className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-zinc-900 truncate">{l.nombre}</p>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ETAPA_BADGE[l.etapaProductiva] ?? 'bg-zinc-100 text-zinc-600')}>
                    {ETAPAS.find((e) => e.value === l.etapaProductiva)?.label ?? l.etapaProductiva}
                  </span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ESTADO_BADGE[l.estado] ?? 'bg-zinc-100 text-zinc-600')}>
                    {l.estado === 'activo' ? 'Activo' : 'Cerrado'}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-0.5 truncate">{l.ubicacion} · {l.categoriaNombre}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-zinc-800">{l.cantidadAnimales}</p>
                <p className="text-xs text-zinc-400">animales</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
