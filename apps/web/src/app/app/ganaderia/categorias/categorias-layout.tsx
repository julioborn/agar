'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Tag, Trash2, Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useReadOnly } from '@/lib/readonly-context';

interface CategoriaHacienda {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}
interface Props { categorias: CategoriaHacienda[]; empresaId: string; }

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function CategoriasLayout({ categorias, empresaId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const esLector = useReadOnly();

  const [formOpen, setFormOpen] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newNombre.trim()) return;
    setSaving(true); setSaveError(null);
    const orden = (categorias[categorias.length - 1]?.orden ?? 0) + 1;
    const { error } = await supabase.from('categorias_hacienda').insert({
      empresa_id: empresaId,
      nombre: newNombre.trim().toUpperCase(),
      orden,
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setNewNombre(''); setFormOpen(false);
    router.refresh();
  }

  function startEdit(c: CategoriaHacienda) {
    setEditId(c.id);
    setEditNombre(c.nombre);
    setConfirmId(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !editNombre.trim()) return;
    setEditLoading(true);
    await supabase.from('categorias_hacienda').update({ nombre: editNombre.trim().toUpperCase() }).eq('id', editId);
    setEditLoading(false);
    setEditId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase.from('categorias_hacienda').delete().eq('id', id);
    setDeleting(null);
    setConfirmId(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">

      {/* KPI */}
      <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm w-fit">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
        <div>
          <p className="text-xl font-bold text-zinc-900 leading-none">{categorias.length}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Categorías</p>
        </div>
      </div>

      {/* Nuevo (colapsable) — oculto para lector */}
      {!esLector && <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
        formOpen ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>
        <button type="button" onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              formOpen ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
              <Plus className={cn('w-4 h-4', formOpen ? 'text-white' : 'text-[#006836]')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">Nueva categoría</p>
              <p className="text-xs text-zinc-400">Ternero/a, Novillo, Vaquillona…</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <form onSubmit={handleCreate} className="flex gap-2">
              <input type="text" placeholder="Ej: NOVILLO" value={newNombre}
                onChange={(e) => setNewNombre(e.target.value.toUpperCase())} required disabled={saving}
                className={`${field} uppercase`} autoFocus />
              <button type="submit" disabled={saving || !newNombre.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors shrink-0">
                <Check className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Agregar'}
              </button>
            </form>
            {saveError && <p className="text-xs text-red-500 mt-2">{saveError}</p>}
          </div>
        )}
      </div>}

      {/* Lista */}
      {categorias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Tag className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay categorías de hacienda definidas.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm divide-y divide-zinc-100">
          {categorias.map((c) => {
            const isEditing = editId === c.id;
            const isConfirming = confirmId === c.id;
            return (
              <div key={c.id} className="px-5 py-3 group">
                {isEditing ? (
                  <form onSubmit={handleEdit} className="flex items-center gap-2">
                    <input type="text" value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value.toUpperCase())}
                      disabled={editLoading} className={`${field} flex-1 uppercase`} autoFocus />
                    <button type="submit" disabled={editLoading || !editNombre.trim()}
                      className="p-1.5 rounded-lg text-[#006836] hover:bg-[#006836]/10 transition-colors disabled:opacity-50">
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setEditId(null)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : isConfirming ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-zinc-600 flex-1">
                      ¿Eliminar <span className="font-semibold">{c.nombre}</span>?
                    </p>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                      className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                      {deleting === c.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                    <button onClick={() => setConfirmId(null)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="flex-1 text-sm font-medium text-zinc-800">{c.nombre}</p>
                    {!esLector && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(c)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmId(c.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
