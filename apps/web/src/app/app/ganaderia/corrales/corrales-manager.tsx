'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Fence, Check, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useReadOnly } from '@/lib/readonly-context';
import DeleteButton from '@/components/ui/delete-button';

interface LoteOpcion { id: string; nombre: string; campoNombre: string; }
interface Corral { id: string; lote_id: string; nombre: string; capacidad_cabezas: number | null; activo: boolean; }
interface Props { lotes: LoteOpcion[]; corrales: Corral[]; empresaId: string; }

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function CorralesManager({ lotes, corrales, empresaId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const esLector = useReadOnly();

  const [loteId, setLoteId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const corralesDelLote = useMemo(
    () => corrales.filter((c) => c.lote_id === loteId),
    [corrales, loteId],
  );

  function resetForm() {
    setEditId(null); setNombre(''); setCapacidad(''); setError(null); setFormOpen(false);
  }

  function startEdit(c: Corral) {
    setEditId(c.id);
    setNombre(c.nombre);
    setCapacidad(c.capacidad_cabezas != null ? String(c.capacidad_cabezas) : '');
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !loteId) return;
    setSaving(true); setError(null);

    const payload = {
      nombre: nombre.trim(),
      capacidad_cabezas: capacidad ? parseFloat(capacidad) : null,
    };

    const { error: dbError } = editId
      ? await supabase.from('corrales').update(payload).eq('id', editId)
      : await supabase.from('corrales').insert({ ...payload, lote_id: loteId, empresa_id: empresaId });

    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    resetForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from('corrales').delete().eq('id', id);
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
          <Fence className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">Seleccioná un lote para ver o crear sus corrales.</p>
        </div>
      ) : (
        <>
          {/* Nuevo / editar corral — oculto para lector */}
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
                  <p className="text-sm font-semibold text-zinc-800">{editId ? 'Editar corral' : 'Nuevo corral'}</p>
                  <p className="text-xs text-zinc-400">Nombre y capacidad de cabezas</p>
                </div>
              </div>
              {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {formOpen && (
              <div className="border-t border-zinc-100 p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del corral</label>
                      <input type="text" placeholder="Ej: Corral 3" value={nombre}
                        onChange={(e) => setNombre(e.target.value)} required disabled={saving} className={field} autoFocus />
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
                      {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear corral'}
                    </button>
                    <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>}

          {/* Lista de corrales */}
          {corralesDelLote.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center space-y-3">
              <Fence className="w-10 h-10 text-zinc-200 mx-auto" />
              <p className="text-zinc-400 text-sm">Este lote todavía no tiene corrales.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {corralesDelLote.map((c) => (
                <div key={c.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
                  <div className="h-1 bg-orange-400" />
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                        <Fence className="w-4 h-4 text-orange-500" />
                      </div>
                      <p className="font-bold text-zinc-900 truncate">{c.nombre}</p>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {c.capacidad_cabezas != null
                        ? <><span className="font-semibold text-zinc-700">{c.capacidad_cabezas}</span> cabezas de capacidad</>
                        : 'Sin capacidad definida'}
                    </p>
                    {!esLector && (
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(c)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <DeleteButton onDelete={() => handleDelete(c.id)} />
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
