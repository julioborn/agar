'use client';

import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp, Wrench, Trash2, Check, X, Search, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TipoLabor { id: string; nombre: string; descripcion: string | null; }
interface Props { tiposLabor: TipoLabor[]; empresaId: string; }

const CATEGORIAS_LABOR = [
  'Laboreo', 'Siembra', 'Aplicacion', 'Fertilizacion', 'Cosecha',
  'Pos-cosecha', 'Logistica', 'Suelo', 'Riego', 'Pasturas',
  'Transporte', 'Monitoreo', 'Planificacion', 'Mantenimiento',
];

const CAT_STYLE: Record<string, { dot: string; badge: string; hdr: string }> = {
  'Laboreo':       { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',    hdr: 'text-amber-700'  },
  'Siembra':       { dot: 'bg-[#006836]',  badge: 'bg-[#006836]/10 text-[#006836]', hdr: 'text-[#006836]'  },
  'Aplicacion':    { dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',      hdr: 'text-blue-700'   },
  'Fertilizacion': { dot: 'bg-teal-400',   badge: 'bg-teal-100 text-teal-700',      hdr: 'text-teal-700'   },
  'Cosecha':       { dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700',  hdr: 'text-orange-700' },
  'Pos-cosecha':   { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700',  hdr: 'text-yellow-700' },
  'Logistica':     { dot: 'bg-purple-400', badge: 'bg-purple-100 text-purple-700',  hdr: 'text-purple-700' },
  'Suelo':         { dot: 'bg-stone-400',  badge: 'bg-stone-100 text-stone-700',    hdr: 'text-stone-700'  },
  'Riego':         { dot: 'bg-cyan-400',   badge: 'bg-cyan-100 text-cyan-700',      hdr: 'text-cyan-700'   },
  'Pasturas':      { dot: 'bg-lime-500',   badge: 'bg-lime-100 text-lime-700',      hdr: 'text-lime-700'   },
  'Transporte':    { dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-700',    hdr: 'text-slate-700'  },
  'Monitoreo':     { dot: 'bg-indigo-400', badge: 'bg-indigo-100 text-indigo-700',  hdr: 'text-indigo-700' },
  'Planificacion': { dot: 'bg-violet-400', badge: 'bg-violet-100 text-violet-700',  hdr: 'text-violet-700' },
  'Mantenimiento': { dot: 'bg-red-400',    badge: 'bg-red-100 text-red-700',        hdr: 'text-red-700'    },
};
const DEF_STYLE = { dot: 'bg-zinc-300', badge: 'bg-zinc-100 text-zinc-600', hdr: 'text-zinc-500' };

function parseCat(desc: string | null) { return desc?.split(' . ')[0]?.trim() ?? 'Sin categoria'; }
function parseEtapa(desc: string | null) { return desc?.split(' . ')[1]?.trim() ?? ''; }
function buildDesc(cat: string, etapa: string) {
  const c = cat.trim(); const e = etapa.trim();
  if (c && e) return `${c} . ${e}`;
  return c || e || null;
}

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function TiposLaborLayout({ tiposLabor, empresaId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // New form
  const [formOpen, setFormOpen] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newCat,    setNewCat]    = useState('Siembra');
  const [newEtapa,  setNewEtapa]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Inline edit
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editNombre,  setEditNombre]  = useState('');
  const [editCat,     setEditCat]     = useState('');
  const [editEtapa,   setEditEtapa]   = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  // Filter
  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newNombre.trim()) return;
    setSaving(true); setSaveError(null);
    const { error } = await supabase.from('tipos_labor').insert({
      empresa_id: empresaId,
      nombre: newNombre.trim(),
      descripcion: buildDesc(newCat, newEtapa),
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setNewNombre(''); setNewEtapa(''); setNewCat('Siembra'); setFormOpen(false);
    router.refresh();
  }

  function startEdit(t: TipoLabor) {
    setEditId(t.id);
    setEditNombre(t.nombre);
    setEditCat(parseCat(t.descripcion));
    setEditEtapa(parseEtapa(t.descripcion));
    setConfirmId(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !editNombre.trim()) return;
    setEditLoading(true);
    await supabase.from('tipos_labor').update({
      nombre: editNombre.trim(),
      descripcion: buildDesc(editCat, editEtapa),
    }).eq('id', editId);
    setEditLoading(false);
    setEditId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase.from('tipos_labor').delete().eq('id', id);
    setDeleting(null);
    setConfirmId(null);
    router.refresh();
  }

  // Categories for filter pills (derived from data)
  const allCats = useMemo(() => {
    const set = new Set(tiposLabor.map((t) => parseCat(t.descripcion)));
    return CATEGORIAS_LABOR.filter((c) => set.has(c)).concat(
      [...set].filter((c) => !CATEGORIAS_LABOR.includes(c))
    );
  }, [tiposLabor]);

  // Filtered + grouped
  const filtered = useMemo(() => tiposLabor.filter((t) => {
    if (filterCat && parseCat(t.descripcion) !== filterCat) return false;
    if (search && !t.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tiposLabor, filterCat, search]);

  const grouped = useMemo(() => {
    const map: Record<string, TipoLabor[]> = {};
    for (const t of filtered) {
      const cat = parseCat(t.descripcion);
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    }
    const ordered = CATEGORIAS_LABOR.filter((c) => map[c]).map((c) => ({ cat: c, items: map[c] }));
    const extra = Object.keys(map).filter((c) => !CATEGORIAS_LABOR.includes(c)).map((c) => ({ cat: c, items: map[c] }));
    return [...ordered, ...extra];
  }, [filtered]);

  // KPI: top categories
  const topCats = useMemo(() => {
    const counts: Record<string, number> = {};
    tiposLabor.forEach((t) => { const c = parseCat(t.descripcion); counts[c] = (counts[c] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [tiposLabor]);

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{tiposLabor.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Tipos de labor</p>
          </div>
        </div>
        {topCats.map(([cat, count]) => {
          const s = CAT_STYLE[cat] ?? DEF_STYLE;
          return (
            <div key={cat} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.dot)} />
              <div>
                <p className="text-xl font-bold text-zinc-900 leading-none">{count}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{cat}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nuevo (colapsable) */}
      <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
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
              <p className="text-xs text-zinc-400">Siembra, aplicacion, cosecha…</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre *</label>
                <input type="text" placeholder="Ej: Siembra directa de soja" value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)} required disabled={saving} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Categoria</label>
                  <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
                    disabled={saving} className={field}>
                    {CATEGORIAS_LABOR.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="Otra">Otra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Etapa / epoca</label>
                  <input type="text" placeholder="Ej: Oct / Nov" value={newEtapa}
                    onChange={(e) => setNewEtapa(e.target.value)} disabled={saving} className={field} />
                </div>
              </div>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <button type="submit" disabled={saving || !newNombre.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors w-full justify-center">
                <Check className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Agregar'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Busqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input type="text" placeholder="Buscar labor…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white" />
      </div>

      {/* Pills de categoria */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setFilterCat('')}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
            !filterCat
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400',
          )}
        >
          Todas
        </button>
        {allCats.map((cat) => {
          const s = CAT_STYLE[cat] ?? DEF_STYLE;
          const active = filterCat === cat;
          return (
            <button key={cat} onClick={() => setFilterCat(active ? '' : cat)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                active ? `${s.badge} border-transparent` : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400',
              )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Lista agrupada */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Wrench className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">
            {tiposLabor.length === 0 ? 'No hay tipos de labor definidos.' : 'Sin resultados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ cat, items }) => {
            const s = CAT_STYLE[cat] ?? DEF_STYLE;
            return (
              <div key={cat} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                {/* Header de categoria */}
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-zinc-100 bg-zinc-50/60">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.dot)} />
                  <h2 className={cn('text-sm font-bold flex-1', s.hdr)}>{cat}</h2>
                  <span className="text-xs text-zinc-400 font-medium">{items.length}</span>
                </div>

                {/* Items */}
                <ul>
                  {items.map((t, idx) => {
                    const etapa = parseEtapa(t.descripcion);
                    const isEditing = editId === t.id;
                    const isConfirming = confirmId === t.id;

                    return (
                      <li key={t.id}
                        className={cn(
                          'px-5 transition-colors group',
                          idx !== items.length - 1 && 'border-b border-zinc-50',
                          isEditing ? 'bg-blue-50/40 py-3' : 'py-3 hover:bg-zinc-50/60',
                        )}>

                        {isEditing ? (
                          /* Inline edit form */
                          <form onSubmit={handleEdit} className="space-y-2">
                            <input type="text" value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              disabled={editLoading}
                              className={cn(field, 'text-sm font-medium')}
                              autoFocus />
                            <div className="grid grid-cols-2 gap-2">
                              <select value={editCat} onChange={(e) => setEditCat(e.target.value)}
                                disabled={editLoading} className={field}>
                                {CATEGORIAS_LABOR.map((c) => <option key={c} value={c}>{c}</option>)}
                                <option value="Otra">Otra</option>
                              </select>
                              <input type="text" value={editEtapa} placeholder="Etapa / epoca"
                                onChange={(e) => setEditEtapa(e.target.value)}
                                disabled={editLoading} className={field} />
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="submit" disabled={editLoading || !editNombre.trim()}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#006836] text-white text-xs font-semibold rounded-lg hover:bg-[#005228] disabled:opacity-50 transition-colors">
                                <Check className="w-3 h-3" />
                                {editLoading ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button type="button" onClick={() => setEditId(null)}
                                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                                Cancelar
                              </button>
                            </div>
                          </form>
                        ) : isConfirming ? (
                          /* Delete confirm inline */
                          <div className="flex items-center gap-3">
                            <p className="text-sm text-zinc-600 flex-1">
                              ¿Eliminar <span className="font-semibold">{t.nombre}</span>?
                            </p>
                            <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                              className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                              {deleting === t.id ? 'Eliminando…' : 'Eliminar'}
                            </button>
                            <button onClick={() => setConfirmId(null)}
                              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          /* Normal row */
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{t.nombre}</p>
                              {etapa && (
                                <p className="text-xs text-zinc-400 mt-0.5">{etapa}</p>
                              )}
                            </div>
                            {etapa && (
                              <span className={cn('shrink-0 hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-medium', s.badge)}>
                                {etapa}
                              </span>
                            )}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => startEdit(t)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setConfirmId(t.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
