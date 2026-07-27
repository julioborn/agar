'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Tag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useReadOnly } from '@/lib/readonly-context';
import DeleteButton from '@/components/ui/delete-button';

interface CategoriaOpcion { id: string; nombre: string; }
interface Animal {
  id: string;
  caravana: string;
  categoria: { nombre: string } | null;
  sexo: string | null;
  fecha_nacimiento: string | null;
  peso_ingreso_kg: number | null;
  estado: string;
  observaciones: string | null;
}
interface Props {
  loteHaciendaId: string;
  empresaId: string;
  categoriaDefaultId: string;
  categorias: CategoriaOpcion[];
  animales: Animal[];
}

const ESTADO_BADGE: Record<string, string> = {
  activo: 'bg-[#006836]/10 text-[#006836]',
  vendido: 'bg-blue-100 text-blue-700',
  muerto: 'bg-red-100 text-red-600',
  trasladado: 'bg-amber-100 text-amber-700',
};
const ESTADO_LABEL: Record<string, string> = {
  activo: 'Activo', vendido: 'Vendido', muerto: 'Muerto', trasladado: 'Trasladado',
};

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const today = () => new Date().toISOString().slice(0, 10);

export default function AnimalesManager({ loteHaciendaId, empresaId, categoriaDefaultId, categorias, animales }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const esLector = useReadOnly();

  const [formOpen, setFormOpen] = useState(false);
  const [caravanasTexto, setCaravanasTexto] = useState('');
  const [categoriaId, setCategoriaId] = useState(categoriaDefaultId);
  const [sexo, setSexo] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [pesoIngreso, setPesoIngreso] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const caravanas = Array.from(new Set(
    caravanasTexto.split(/[\n,;]+/).map((c) => c.trim()).filter(Boolean),
  ));

  function resetForm() {
    setCaravanasTexto(''); setCategoriaId(categoriaDefaultId); setSexo('');
    setFechaNacimiento(''); setPesoIngreso(''); setError(null); setFormOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (caravanas.length === 0) return;
    setSaving(true); setError(null);

    const payload = caravanas.map((caravana) => ({
      empresa_id: empresaId,
      lote_hacienda_id: loteHaciendaId,
      caravana,
      categoria_hacienda_id: categoriaId || null,
      sexo: sexo || null,
      fecha_nacimiento: fechaNacimiento || null,
      peso_ingreso_kg: pesoIngreso ? parseFloat(pesoIngreso) : null,
    }));

    const { error: dbError } = await supabase.from('animales').insert(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    resetForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from('animales').delete().eq('id', id);
    router.refresh();
  }

  return (
    <div className="space-y-4">

      {/* Alta masiva — oculto para lector */}
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
              <p className="text-sm font-semibold text-zinc-800">Agregar animales</p>
              <p className="text-xs text-zinc-400">Pegá una lista de caravanas, una por línea</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  Números de caravana <span className="text-zinc-400 font-normal">(uno por línea)</span>
                </label>
                <textarea
                  value={caravanasTexto}
                  onChange={(e) => setCaravanasTexto(e.target.value)}
                  disabled={saving}
                  rows={6}
                  placeholder={'AR 123456789\nAR 123456790\nAR 123456791'}
                  className={`${field} font-mono`}
                />
                <p className="text-xs text-zinc-400 mt-1">{caravanas.length} caravana{caravanas.length !== 1 ? 's' : ''} detectada{caravanas.length !== 1 ? 's' : ''}</p>
              </div>

              <p className="text-xs font-medium text-zinc-500">Datos comunes para todos los animales de esta carga:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Categoría</label>
                  <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={saving} className={field}>
                    <option value="">Sin especificar</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Sexo</label>
                  <select value={sexo} onChange={(e) => setSexo(e.target.value)} disabled={saving} className={field}>
                    <option value="">Sin especificar</option>
                    <option value="macho">Macho</option>
                    <option value="hembra">Hembra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Peso de ingreso (kg)</label>
                  <input type="number" min="0" step="0.1" placeholder="Opcional" value={pesoIngreso}
                    onChange={(e) => setPesoIngreso(e.target.value)} disabled={saving} className={field} />
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving || caravanas.length === 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
                  <Check className="w-4 h-4" />
                  {saving ? 'Guardando...' : `Agregar ${caravanas.length || ''} animal${caravanas.length === 1 ? '' : 'es'}`}
                </button>
                <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>}

      {/* Lista de animales */}
      {animales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Tag className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">Este lote todavía no tiene animales cargados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Caravana</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Sexo</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Peso ingreso</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {animales.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-2.5 font-mono text-zinc-800">{a.caravana}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{a.categoria?.nombre ?? '—'}</td>
                  <td className="px-4 py-2.5 text-zinc-600 capitalize">{a.sexo ?? '—'}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{a.peso_ingreso_kg != null ? `${a.peso_ingreso_kg} kg` : '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ESTADO_BADGE[a.estado] ?? 'bg-zinc-100 text-zinc-600')}>
                      {ESTADO_LABEL[a.estado] ?? a.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!esLector && <DeleteButton onDelete={() => handleDelete(a.id)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
