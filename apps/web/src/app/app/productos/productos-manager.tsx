'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Plus, ChevronDown, ChevronUp, ExternalLink, Search, X, AlertCircle, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import ProductoForm, { CATEGORIAS, type ProductoRow } from './producto-form';
import DeleteButton from '@/components/ui/delete-button';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));

const CATEGORIA_BADGE: Record<string, string> = {
  fertilizante:   'bg-blue-100 text-blue-700',
  semilla:        'bg-[#006836]/10 text-[#006836]',
  agroquimico:    'bg-orange-100 text-orange-700',
  combustible:    'bg-red-100 text-red-700',
  insumo_cosecha: 'bg-purple-100 text-purple-700',
  inoculante:     'bg-teal-100 text-teal-700',
  otro:           'bg-zinc-100 text-zinc-500',
};

const CATEGORIA_BAR: Record<string, string> = {
  fertilizante:   'bg-blue-400',
  semilla:        'bg-[#006836]',
  agroquimico:    'bg-orange-400',
  combustible:    'bg-red-400',
  insumo_cosecha: 'bg-purple-400',
  inoculante:     'bg-teal-400',
  otro:           'bg-zinc-300',
};

const CATEGORIA_DOT: Record<string, string> = {
  fertilizante:   'bg-blue-400',
  semilla:        'bg-[#006836]',
  agroquimico:    'bg-orange-400',
  combustible:    'bg-red-400',
  insumo_cosecha: 'bg-purple-400',
  inoculante:     'bg-teal-400',
  otro:           'bg-zinc-300',
};

const CATEGORIA_HDR: Record<string, string> = {
  fertilizante:   'text-blue-700',
  semilla:        'text-[#006836]',
  agroquimico:    'text-orange-700',
  combustible:    'text-red-700',
  insumo_cosecha: 'text-purple-700',
  inoculante:     'text-teal-700',
  otro:           'text-zinc-500',
};

interface Props {
  productos: ProductoRow[];
  empresaId: string;
}

function ProductoCard({
  p,
  onEdit,
  onDelete,
}: {
  p: ProductoRow;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className={cn('h-1', CATEGORIA_BAR[p.categoria] ?? 'bg-zinc-200')} />
      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-zinc-900 leading-snug">{p.nombre}</p>
            {p.principio_activo && (
              <p className="text-xs text-zinc-400 mt-0.5 truncate">{p.principio_activo}</p>
            )}
            {p.nombre_factura && (
              <p className="text-xs text-zinc-300 mt-0.5 truncate" title={p.nombre_factura}>
                🧾 {p.nombre_factura}
              </p>
            )}
          </div>
          <span className={cn('shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
            CATEGORIA_BADGE[p.categoria] ?? 'bg-zinc-100 text-zinc-500')}>
            {CATEGORIA_LABEL[p.categoria] ?? p.categoria}
          </span>
        </div>

        {/* Info row */}
        <div className="flex items-center flex-wrap gap-2 text-xs text-zinc-400">
          <span className="font-mono bg-zinc-50 px-2 py-0.5 rounded-md text-zinc-600 border border-zinc-100">
            {p.unidad_base}
          </span>
          {p.codigo_interno && (
            <span className="bg-zinc-50 px-2 py-0.5 rounded-md border border-zinc-100">
              {p.codigo_interno}
            </span>
          )}
          {p.stock_minimo > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <TriangleAlert className="w-3 h-3" />
              Min {p.stock_minimo} {p.unidad_base}
            </span>
          )}
          {p.requiere_trazabilidad && (
            <span className="text-violet-600 font-medium">Trazabilidad</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-50">
          <Link
            href={`/app/productos/${p.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#006836] hover:underline"
          >
            Presentaciones <ExternalLink className="w-3 h-3" />
          </Link>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              title="Editar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <DeleteButton onDelete={onDelete} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductosManager({ productos, empresaId }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState<ProductoRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleSuccess() {
    setFormOpen(false);
    setEditando(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) {
      setDeleteError('No se puede eliminar este producto porque tiene stock, compras u otros registros asociados.');
      return;
    }
    router.refresh();
  }

  // Counts per category (antes de filtro de texto)
  const countsByCat = useMemo(() => {
    const c: Record<string, number> = {};
    productos.forEach((p) => { c[p.categoria] = (c[p.categoria] ?? 0) + 1; });
    return c;
  }, [productos]);

  // Filtered by active tab + text search
  const filtrados = useMemo(() => productos.filter((p) => {
    if (activeTab && p.categoria !== activeTab) return false;
    if (texto && !p.nombre.toLowerCase().includes(texto.toLowerCase()) &&
      !p.principio_activo?.toLowerCase().includes(texto.toLowerCase())) return false;
    return true;
  }), [productos, activeTab, texto]);

  // Grouped (only when showing all tabs)
  const grouped = useMemo(() => {
    if (activeTab) return null;
    const map: Record<string, ProductoRow[]> = {};
    for (const p of filtrados) {
      if (!map[p.categoria]) map[p.categoria] = [];
      map[p.categoria].push(p);
    }
    return CATEGORIAS.map((c) => ({ ...c, items: map[c.value] ?? [] })).filter((g) => g.items.length > 0);
  }, [filtrados, activeTab]);

  // KPI: top 3 categories
  const topCategorias = useMemo(() => {
    return Object.entries(countsByCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [countsByCat]);

  const categoriasConProductos = CATEGORIAS.filter((c) => (countsByCat[c.value] ?? 0) > 0);

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{productos.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Productos totales</p>
          </div>
        </div>
        {topCategorias.map(([cat, count]) => (
          <div key={cat} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', CATEGORIA_DOT[cat] ?? 'bg-zinc-300')} />
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{count}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{CATEGORIA_LABEL[cat] ?? cat}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Error de borrado */}
      {deleteError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Nuevo producto (colapsable) */}
      <div className={cn(
        'bg-white rounded-2xl border overflow-hidden transition-all',
        formOpen ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100',
      )}>
        <button
          type="button"
          onClick={() => { setFormOpen((v) => !v); setEditando(null); }}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              formOpen ? 'bg-[#006836]' : 'bg-[#006836]/10',
            )}>
              <Plus className={cn('w-4 h-4', formOpen ? 'text-white' : 'text-[#006836]')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">
                {editando ? 'Editar producto' : 'Nuevo producto'}
              </p>
              <p className="text-xs text-zinc-400">Registrar insumo, semilla, agroquimico…</p>
            </div>
          </div>
          {formOpen
            ? <ChevronUp className="w-4 h-4 text-zinc-400" />
            : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <ProductoForm
              empresaId={empresaId}
              productoEditando={editando}
              onSuccess={handleSuccess}
              onCancel={() => { setEditando(null); setFormOpen(false); }}
            />
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o principio activo…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full pl-8 pr-9 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white"
        />
        {texto && (
          <button onClick={() => setTexto('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs de categoria */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('')}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border',
            !activeTab
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400',
          )}
        >
          Todos
          <span className={cn('px-1.5 py-0.5 rounded-full text-xs leading-none',
            !activeTab ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500')}>
            {productos.length}
          </span>
        </button>
        {categoriasConProductos.map((c) => {
          const active = activeTab === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setActiveTab(active ? '' : c.value)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border',
                active
                  ? `${CATEGORIA_BADGE[c.value]} border-transparent`
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400',
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', CATEGORIA_DOT[c.value])} />
              {c.label}
              <span className={cn('px-1.5 py-0.5 rounded-full text-xs leading-none',
                active ? 'bg-black/10' : 'bg-zinc-100 text-zinc-500')}>
                {countsByCat[c.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid / Vista agrupada */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">
            {productos.length === 0
              ? 'No hay productos registrados todavia.'
              : 'Sin resultados con los filtros aplicados.'}
          </p>
        </div>
      ) : grouped ? (
        /* Vista agrupada por categoria */
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.value}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', CATEGORIA_DOT[g.value] ?? 'bg-zinc-300')} />
                <h2 className={cn('text-sm font-bold', CATEGORIA_HDR[g.value] ?? 'text-zinc-600')}>{g.label}</h2>
                <span className="text-xs text-zinc-400">{g.items.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.items.map((p) => (
                  <ProductoCard
                    key={p.id}
                    p={p}
                    onEdit={() => { setEditando(p); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    onDelete={() => handleDelete(p.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vista plana (tab especifico activo) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((p) => (
            <ProductoCard
              key={p.id}
              p={p}
              onEdit={() => { setEditando(p); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
