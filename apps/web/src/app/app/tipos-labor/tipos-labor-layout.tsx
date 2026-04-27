'use client';

import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Wrench, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TipoLabor { id: string; nombre: string; descripcion: string | null; }
interface Props { tiposLabor: TipoLabor[]; empresaId: string; }

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function TiposLaborLayout({ tiposLabor, empresaId }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [nombre,   setNombre]   = useState('');
  const [desc,     setDesc]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true); setError(null);

    const { error: err } = await createClient().from('tipos_labor').insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      descripcion: desc.trim() || null,
    });

    setLoading(false);
    if (err) { setError(err.message); return; }
    setNombre(''); setDesc(''); setFormOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este tipo de labor?')) return;
    setDeleting(id);
    await createClient().from('tipos_labor').delete().eq('id', id);
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">

      {/* Nueva (collapsible) */}
      <div className={cn('bg-white rounded-2xl border overflow-hidden',
        formOpen ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>
        <button type="button" onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              formOpen ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
              <Plus className={cn('w-4 h-4', formOpen ? 'text-white' : 'text-[#006836]')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">Nuevo tipo de labor</p>
              <p className="text-xs text-zinc-400">Siembra, fumigación, cosecha…</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5 max-w-md space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre *</label>
                <input type="text" placeholder="Ej: Siembra directa" value={nombre}
                  onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Descripción</label>
                <input type="text" placeholder="Opcional" value={desc}
                  onChange={(e) => setDesc(e.target.value)} disabled={loading} className={field} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading || !nombre.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors w-full justify-center">
                <Check className="w-4 h-4" />
                {loading ? 'Guardando...' : 'Agregar'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        {tiposLabor.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Wrench className="w-10 h-10 text-zinc-200 mx-auto" />
            <p className="text-zinc-400 text-sm">No hay tipos de labor definidos.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {tiposLabor.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors group">
                <div className="w-7 h-7 rounded-lg bg-[#006836]/10 flex items-center justify-center shrink-0">
                  <Wrench className="w-3.5 h-3.5 text-[#006836]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{t.nombre}</p>
                  {t.descripcion && <p className="text-xs text-zinc-400 truncate">{t.descripcion}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
