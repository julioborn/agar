'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Pencil, Check, X, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import DeleteButton from '@/components/ui/delete-button';

interface CampaniaRow {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activa: boolean;
  observaciones: string | null;
}

interface Props { campanias: CampaniaRow[]; empresaId: string }

const EMPTY: Omit<CampaniaRow, 'id'> = { nombre: '', fecha_inicio: null, fecha_fin: null, activa: true, observaciones: null };

export default function CampaniasManager({ campanias, empresaId }: Props) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | 'nueva' | null>(null);
  const [form, setForm] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '', activa: true, observaciones: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  function startNew() {
    setEditId('nueva');
    setForm({ nombre: '', fecha_inicio: '', fecha_fin: '', activa: true, observaciones: '' });
    setError('');
  }

  function startEdit(c: CampaniaRow) {
    setEditId(c.id);
    setForm({ nombre: c.nombre, fecha_inicio: c.fecha_inicio ?? '', fecha_fin: c.fecha_fin ?? '', activa: c.activa, observaciones: c.observaciones ?? '' });
    setError('');
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setLoading(true);
    const supabase = createClient();
    const payload = {
      nombre: form.nombre.trim(),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      activa: form.activa,
      observaciones: form.observaciones.trim() || null,
    };

    let err;
    if (editId === 'nueva') {
      ({ error: err } = await supabase.from('campanias').insert({ ...payload, empresa_id: empresaId }));
    } else {
      ({ error: err } = await supabase.from('campanias').update(payload).eq('id', editId!));
    }
    setLoading(false);
    if (err) { setError(err.message); return; }
    setEditId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('campanias').delete().eq('id', id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={startNew}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />Nueva campaña
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Fila de nueva campaña */}
        {editId === 'nueva' && (
          <div className="px-5 py-4 border-b border-green-100 bg-green-50 space-y-3">
            <p className="text-sm font-semibold text-green-800">Nueva campaña</p>
            <FormRow form={form} setForm={setForm} error={error} loading={loading} onSave={handleSave} onCancel={() => setEditId(null)} />
          </div>
        )}

        {campanias.length === 0 && editId !== 'nueva' ? (
          <div className="p-10 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-slate-400 text-sm">No hay campañas registradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Inicio</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Fin</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Estado</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campanias.map((c) => (
                <Fragment key={c.id}>
                  <tr className={editId === c.id ? 'bg-green-50' : 'hover:bg-slate-50'}>
                    <td className="px-5 py-3 font-semibold text-slate-800">{c.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{fmt(c.fecha_inicio)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{fmt(c.fecha_fin)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.activa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.activa ? 'Activa' : 'Cerrada'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(c)}
                          className="text-slate-400 hover:text-slate-700 p-1 transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <DeleteButton onDelete={() => handleDelete(c.id)} />
                      </div>
                    </td>
                  </tr>
                  {editId === c.id && (
                    <tr key={`${c.id}-edit`}>
                      <td colSpan={5} className="px-5 py-4 bg-green-50 border-b border-green-100">
                        <FormRow form={form} setForm={setForm} error={error} loading={loading} onSave={handleSave} onCancel={() => setEditId(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FormRow({ form, setForm, error, loading, onSave, onCancel }: {
  form: any; setForm: any; error: string; loading: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
          <input value={form.nombre} onChange={(e) => setForm((f: any) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: 2025/2026" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicio</label>
          <input type="date" value={form.fecha_inicio} onChange={(e) => setForm((f: any) => ({ ...f, fecha_inicio: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha fin</label>
          <input type="date" value={form.fecha_fin} onChange={(e) => setForm((f: any) => ({ ...f, fecha_fin: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.activa} onChange={(e) => setForm((f: any) => ({ ...f, activa: e.target.checked }))}
            className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
          Campaña activa
        </label>
        <input value={form.observaciones} onChange={(e) => setForm((f: any) => ({ ...f, observaciones: e.target.value }))}
          placeholder="Observaciones (opcional)" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={loading}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <Check className="w-3.5 h-3.5" />{loading ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
          <X className="w-3.5 h-3.5" />Cancelar
        </button>
      </div>
    </div>
  );
}
