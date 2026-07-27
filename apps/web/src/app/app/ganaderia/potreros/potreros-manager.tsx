'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Rows3, Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useReadOnly } from '@/lib/readonly-context';
import DeleteButton from '@/components/ui/delete-button';

interface LoteOpcion { id: string; nombre: string; campoNombre: string; }
interface Potrero { id: string; lote_id: string; nombre: string; superficie_ha: number | null; capacidad_cabezas: number | null; activo: boolean; }
interface Props { lotes: LoteOpcion[]; potreros: Potrero[]; empresaId: string; }

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function PotrerosManager({ lotes, potreros, empresaId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const esLector = useReadOnly();

  const [loteId, setLoteId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [superficie, setSuperficie] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const potrerosDelLote = useMemo(
    () => potreros.filter((p) => p.lote_id === loteId),
    [potreros, loteId],
  );

  function resetForm() {
    setEditId(null); setNombre(''); setSuperficie(''); setCapacidad(''); setError(null); setFormOpen(false);
  }

  function startEdit(p: Potrero) {
    setEditId(p.id);
    setNombre(p.nombre);
    setSuperficie(p.superficie_ha != null ? String(p.superficie_ha) : '');
    setCapacidad(p.capacidad_cabezas != null ? String(p.capacidad_cabezas) : '');
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !loteId) return;
    setSaving(true); setError(null);

    const payload = {
      nombre: nombre.trim(),
      superficie_ha: superficie ? parseFloat(superficie) : null,
      capacidad_cabezas: capacidad ? parseFloat(capacidad) : null,
    };

    const { error: dbError } = editId
      ? await supabase.from('potreros').update(payload).eq('id', editId)
      : await supabase.from('potreros').insert({ ...payload, lote_id: loteId, empresa_id: empresaId });

    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    resetForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from('potreros').delete().eq('id', id);
    router.refresh();
  }

  return (
    <div className="space-y-4">

      {/* Selector de lote */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Lote</label>
        <select
          value={loteId}
          onChange={(e) => { setLoteId(e.target.value); resetForm(); }}
          className={field}
        >
          <option value="">Seleccioná un lote…</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>{l.campoNombre} › {l.nombre}</option>
          ))}
        </select>
      </div>

      {!loteId ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Rows3 className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">Seleccioná un lote para ver o crear sus potreros.</p>
        </div>
      ) : (
        <>
          {/* Nuevo / editar potrero — oculto para lector */}
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
                  <p className="text-sm font-semibold text-zinc-800">{editId ? 'Editar potrero' : 'Nuevo potrero'}</p>
                  <p className="text-xs text-zinc-400">Nombre, superficie y capacidad</p>
                </div>
              </div>
              {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {formOpen && (
              <div className="border-t border-zinc-100 p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del potrero</label>
                      <input type="text" placeholder="Ej: Potrero X1" value={nombre}
                        onChange={(e) => setNombre(e.target.value)} required disabled={saving} className={field} autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">Superficie (ha)</label>
                      <input type="number" min="0" step="0.01" placeholder="Opcional" value={superficie}
                        onChange={(e) => setSuperficie(e.target.value)} disabled={saving} className={field} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">Capacidad (cabezas)</label>
                      <input type="number" min="0" step="1" placeholder="Opcional" value={capacidad}
                        onChange={(e) => setCapacidad(e.target.value)} disabled={saving} className={field} />
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <div className="flex items-center gap-3">
                    <button type="submit" disabled={saving || !nombre.trim()}
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
                      <Check className="w-4 h-4" />
                      {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear potrero'}
                    </button>
                    <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>}

          {/* Lista de potreros */}
          {potrerosDelLote.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center space-y-3">
              <Rows3 className="w-10 h-10 text-zinc-200 mx-auto" />
              <p className="text-zinc-400 text-sm">Este lote todavía no tiene potreros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {potrerosDelLote.map((p) => (
                <div key={p.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
                  <div className="h-1 bg-lime-500" />
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-lime-50 flex items-center justify-center shrink-0">
                        <Rows3 className="w-4 h-4 text-lime-600" />
                      </div>
                      <p className="font-bold text-zinc-900 truncate">{p.nombre}</p>
                    </div>
                    <div className="text-sm text-zinc-500 space-y-0.5">
                      <p>{p.superficie_ha != null ? <><span className="font-semibold text-zinc-700">{p.superficie_ha}</span> ha</> : 'Sin superficie definida'}</p>
                      {p.capacidad_cabezas != null && (
                        <p><span className="font-semibold text-zinc-700">{p.capacidad_cabezas}</span> cabezas de capacidad</p>
                      )}
                    </div>
                    {!esLector && (
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(p)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <DeleteButton onDelete={() => handleDelete(p.id)} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
