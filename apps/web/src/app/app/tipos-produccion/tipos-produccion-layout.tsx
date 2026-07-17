'use client';

import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp, Wheat, Trash2, Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useReadOnly } from '@/lib/readonly-context';
import { crearTipoProduccion, actualizarTipoProduccion, eliminarTipoProduccion, type GrupoProduccion } from './actions';

interface TipoProduccion {
  id: string;
  nombre: string;
  grupo: GrupoProduccion;
  unidad_medida: string;
  unidad_base: 'kg' | 'tn' | 'L' | 'unidad';
  valor_mercado: number;
  orden: number;
}
interface Props { tiposProduccion: TipoProduccion[]; empresaId: string; }

const GRUPOS: { value: GrupoProduccion; label: string }[] = [
  { value: 'grano',   label: 'Granos' },
  { value: 'semilla', label: 'Semillas' },
  { value: 'silo',    label: 'Silos' },
  { value: 'rollo',   label: 'Rollos' },
];

const GRUPO_STYLE: Record<GrupoProduccion, { dot: string; badge: string; hdr: string }> = {
  grano:   { dot: 'bg-[#006836]',  badge: 'bg-[#006836]/10 text-[#006836]', hdr: 'text-[#006836]'  },
  semilla: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700',  hdr: 'text-yellow-700' },
  silo:    { dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700',  hdr: 'text-orange-700' },
  rollo:   { dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',      hdr: 'text-blue-700'   },
};

const UNIDADES_BASE: { value: TipoProduccion['unidad_base']; label: string }[] = [
  { value: 'kg',     label: 'kg' },
  { value: 'tn',     label: 'tn' },
  { value: 'L',      label: 'L' },
  { value: 'unidad', label: 'Unidad' },
];

const DEFAULTS_POR_GRUPO: Record<GrupoProduccion, { unidadMedida: string; unidadBase: TipoProduccion['unidad_base'] }> = {
  grano:   { unidadMedida: 'TONELADA',               unidadBase: 'tn' },
  semilla: { unidadMedida: 'KG',                      unidadBase: 'kg' },
  silo:    { unidadMedida: 'Tonelada Materia Verde',  unidadBase: 'tn' },
  rollo:   { unidadMedida: 'Unidad (550 Kg)',         unidadBase: 'unidad' },
};

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';
const fmtUSD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function TiposProduccionLayout({ tiposProduccion }: Props) {
  const router = useRouter();
  const esLector = useReadOnly();

  // Nuevo
  const [formOpen, setFormOpen] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newGrupo,  setNewGrupo]  = useState<GrupoProduccion>('grano');
  const [newUnidadMedida, setNewUnidadMedida] = useState(DEFAULTS_POR_GRUPO.grano.unidadMedida);
  const [newUnidadBase,   setNewUnidadBase]   = useState<TipoProduccion['unidad_base']>(DEFAULTS_POR_GRUPO.grano.unidadBase);
  const [newValor,  setNewValor]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edición inline
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editNombre,  setEditNombre]  = useState('');
  const [editGrupo,   setEditGrupo]   = useState<GrupoProduccion>('grano');
  const [editUnidadMedida, setEditUnidadMedida] = useState('');
  const [editValor,   setEditValor]   = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Borrado
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  function handleNewGrupo(g: GrupoProduccion) {
    setNewGrupo(g);
    setNewUnidadMedida(DEFAULTS_POR_GRUPO[g].unidadMedida);
    setNewUnidadBase(DEFAULTS_POR_GRUPO[g].unidadBase);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newNombre.trim()) return;
    const valor = parseFloat(newValor || '0');
    setSaving(true); setSaveError(null);
    const res = await crearTipoProduccion({
      nombre: newNombre.trim(),
      grupo: newGrupo,
      unidadMedida: newUnidadMedida.trim(),
      unidadBase: newUnidadBase,
      valorMercado: valor,
    });
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    setNewNombre(''); setNewValor(''); setFormOpen(false);
    router.refresh();
  }

  function startEdit(t: TipoProduccion) {
    setEditId(t.id);
    setEditNombre(t.nombre);
    setEditGrupo(t.grupo);
    setEditUnidadMedida(t.unidad_medida);
    setEditValor(String(t.valor_mercado));
    setConfirmId(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !editNombre.trim()) return;
    setEditLoading(true);
    const res = await actualizarTipoProduccion(editId, {
      nombre: editNombre.trim(),
      grupo: editGrupo,
      unidadMedida: editUnidadMedida.trim(),
      valorMercado: parseFloat(editValor || '0'),
    });
    setEditLoading(false);
    if (res.error) return;
    setEditId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await eliminarTipoProduccion(id);
    setDeleting(null);
    setConfirmId(null);
    router.refresh();
  }

  const grouped = useMemo(() => {
    const map: Record<string, TipoProduccion[]> = {};
    for (const t of tiposProduccion) {
      if (!map[t.grupo]) map[t.grupo] = [];
      map[t.grupo].push(t);
    }
    return GRUPOS.filter((g) => map[g.value]?.length).map((g) => ({ ...g, items: map[g.value] }));
  }, [tiposProduccion]);

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {GRUPOS.map((g) => {
          const s = GRUPO_STYLE[g.value];
          const count = tiposProduccion.filter((t) => t.grupo === g.value).length;
          return (
            <div key={g.value} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.dot)} />
              <div>
                <p className="text-xl font-bold text-zinc-900 leading-none">{count}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{g.label}</p>
              </div>
            </div>
          );
        })}
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
              <p className="text-sm font-semibold text-zinc-800">Nuevo tipo de producción</p>
              <p className="text-xs text-zinc-400">Grano, semilla, silo, rollo…</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre *</label>
                <input type="text" placeholder="Ej: Grano Trigo" value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)} required disabled={saving} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Grupo</label>
                  <select value={newGrupo} onChange={(e) => handleNewGrupo(e.target.value as GrupoProduccion)}
                    disabled={saving} className={field}>
                    {GRUPOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Unidad base</label>
                  <select value={newUnidadBase} onChange={(e) => setNewUnidadBase(e.target.value as TipoProduccion['unidad_base'])}
                    disabled={saving} className={field}>
                    {UNIDADES_BASE.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  Etiqueta de unidad <span className="text-zinc-400 font-normal">(cómo se muestra, ej: "Tonelada Materia Verde")</span>
                </label>
                <input type="text" value={newUnidadMedida}
                  onChange={(e) => setNewUnidadMedida(e.target.value)} disabled={saving} className={field} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Valor de mercado (U$S) *</label>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" min="0" step="0.01"
                    placeholder="0.00" value={newValor}
                    onChange={(e) => setNewValor(e.target.value)} required disabled={saving}
                    className={`${field} w-32`} />
                  <span className="text-sm text-zinc-500">U$S / {newUnidadMedida || 'unidad'}</span>
                </div>
              </div>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <button type="submit" disabled={saving || !newNombre.trim() || !newValor}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors w-full justify-center">
                <Check className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Agregar'}
              </button>
            </form>
          </div>
        )}
      </div>}

      {/* Lista agrupada */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Wheat className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay tipos de producción definidos.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ value: grupoValue, label, items }) => {
            const s = GRUPO_STYLE[grupoValue];
            return (
              <div key={grupoValue} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-zinc-100 bg-zinc-50/60">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.dot)} />
                  <h2 className={cn('text-sm font-bold flex-1', s.hdr)}>{label}</h2>
                  <span className="text-xs text-zinc-400 font-medium">{items.length}</span>
                </div>

                <ul>
                  {items.map((t, idx) => {
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
                          <form onSubmit={handleEdit} className="space-y-2">
                            <input type="text" value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              disabled={editLoading}
                              className={cn(field, 'text-sm font-medium')}
                              autoFocus />
                            <div className="grid grid-cols-2 gap-2">
                              <select value={editGrupo} onChange={(e) => setEditGrupo(e.target.value as GrupoProduccion)}
                                disabled={editLoading} className={field}>
                                {GRUPOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                              </select>
                              <input type="text" value={editUnidadMedida} placeholder="Etiqueta de unidad"
                                onChange={(e) => setEditUnidadMedida(e.target.value)}
                                disabled={editLoading} className={field} />
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" inputMode="decimal" min="0" step="0.01"
                                placeholder="Valor U$S" value={editValor}
                                onChange={(e) => setEditValor(e.target.value)}
                                disabled={editLoading} className={`${field} w-32`} />
                              <span className="text-xs text-zinc-500">U$S / {editUnidadMedida || 'unidad'}</span>
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
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{t.nombre}</p>
                              <p className="text-xs text-zinc-400 mt-0.5">{t.unidad_medida}</p>
                            </div>
                            <div className="shrink-0 text-right hidden sm:block">
                              <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-semibold', s.badge)}>
                                {fmtUSD.format(t.valor_mercado)}
                              </span>
                            </div>
                            {!esLector && (
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
                            )}
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
