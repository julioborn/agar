'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sprout, ChevronDown, ChevronUp, Plus, ExternalLink, Filter, X, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import CultivoForm, { type CultivoRow, type LoteConCampo, type UnidadNegocio, type CampaniaTemporada } from './cultivo-form';
import DeleteButton from '@/components/ui/delete-button';

const ESTADO_BADGE: Record<string, string> = {
  planificada: 'bg-blue-100 text-blue-700',
  en_curso:    'bg-amber-100 text-amber-700',
  cosechada:   'bg-[#006836]/10 text-[#006836]',
  cancelada:   'bg-zinc-100 text-zinc-400',
};
const ESTADO_DOT: Record<string, string> = {
  planificada: 'bg-blue-400',
  en_curso:    'bg-amber-400',
  cosechada:   'bg-[#006836]',
  cancelada:   'bg-zinc-300',
};
const ESTADO_LABEL: Record<string, string> = {
  planificada: 'Planificada',
  en_curso:    'En curso',
  cosechada:   'Cosechada',
  cancelada:   'Cancelada',
};

interface CultivoConRelaciones extends CultivoRow {
  lote_nombre: string;
  campo_nombre: string;
  unidad_negocio_nombre: string;
  campania_nombre: string | null;
}

interface Props {
  cultivos: CultivoConRelaciones[];
  lotes: LoteConCampo[];
  unidadesNegocio: UnidadNegocio[];
  campanias: CampaniaTemporada[];
  defaultLoteId?: string;
}

const fmt = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function CultivosManager({ cultivos, lotes, unidadesNegocio, campanias, defaultLoteId }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState<CultivoRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [estado, setEstado] = useState('');
  const [campoNombre, setCampoNombre] = useState('');
  const [texto, setTexto] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  function handleSuccess() {
    setFormOpen(false);
    setEditando(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('cultivos').delete().eq('id', id);
    router.refresh();
  }

  const camposUnicos = useMemo(
    () => Array.from(new Set(cultivos.map((c) => c.campo_nombre))).sort(),
    [cultivos],
  );

  const filtrados = useMemo(() => {
    return cultivos.filter((c) => {
      if (estado && c.estado !== estado) return false;
      if (campoNombre && c.campo_nombre !== campoNombre) return false;
      if (texto && !c.cultivo.toLowerCase().includes(texto.toLowerCase())) return false;
      return true;
    });
  }, [cultivos, estado, campoNombre, texto]);

  const filtrosActivos = [estado, campoNombre, texto].filter(Boolean).length;

  const enCurso    = cultivos.filter((c) => c.estado === 'en_curso').length;
  const planif     = cultivos.filter((c) => c.estado === 'planificada').length;
  const cosechados = cultivos.filter((c) => c.estado === 'cosechada').length;

  return (
    <div className="space-y-5">

      {/* ── KPIs rápidos ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En curso',    value: enCurso,    dot: ESTADO_DOT.en_curso },
          { label: 'Planificados', value: planif,    dot: ESTADO_DOT.planificada },
          { label: 'Cosechados',  value: cosechados, dot: ESTADO_DOT.cosechada },
        ].map(({ label, value, dot }) => (
          <div key={label} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dot)} />
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Nuevo cultivo (colapsable) ────────────────────────────────── */}
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
                {editando ? 'Editar cultivo' : 'Nuevo cultivo'}
              </p>
              <p className="text-xs text-zinc-400">Registrar siembra o planificación</p>
            </div>
          </div>
          {formOpen
            ? <ChevronUp className="w-4 h-4 text-zinc-400" />
            : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <CultivoForm
              lotes={lotes}
              unidadesNegocio={unidadesNegocio}
              campanias={campanias}
              cultivoEditando={editando}
              defaultLoteId={defaultLoteId}
              onSuccess={handleSuccess}
              onCancel={() => { setEditando(null); setFormOpen(false); }}
            />
          </div>
        )}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Búsqueda rápida */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar cultivo…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#006836]/40 bg-white"
          />
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors',
            showFilters || filtrosActivos > 0
              ? 'border-[#006836]/40 text-[#006836] bg-[#006836]/5'
              : 'border-zinc-200 text-zinc-500 bg-white hover:bg-zinc-50',
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {filtrosActivos > 0 && (
            <span className="w-4 h-4 bg-[#006836] text-white rounded-full text-xs leading-none flex items-center justify-center">
              {filtrosActivos}
            </span>
          )}
        </button>

        {filtrosActivos > 0 && (
          <button
            onClick={() => { setEstado(''); setCampoNombre(''); setTexto(''); }}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 transition-colors"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 bg-white rounded-2xl border border-zinc-100 p-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Campo</label>
            <select value={campoNombre} onChange={(e) => setCampoNombre(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
              <option value="">Todos</option>
              {camposUnicos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
              <option value="">Todos</option>
              {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── Lista de cultivos ─────────────────────────────────────────── */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Sprout className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">
            {cultivos.length === 0 ? 'No hay cultivos registrados todavía.' : 'Sin resultados con los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((c) => (
            <div key={c.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">

              {/* Franja de color por estado */}
              <div className={cn('h-1', {
                'bg-amber-400': c.estado === 'en_curso',
                'bg-blue-400':  c.estado === 'planificada',
                'bg-[#006836]': c.estado === 'cosechada',
                'bg-zinc-200':  c.estado === 'cancelada',
              })} />

              <div className="p-4 space-y-3">
                {/* Header: nombre + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{c.cultivo}</p>
                    {c.campania_nombre && (
                      <p className="text-xs text-[#006836] font-medium mt-0.5">{c.campania_nombre}</p>
                    )}
                  </div>
                  <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', ESTADO_BADGE[c.estado] ?? 'bg-zinc-100 text-zinc-500')}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', ESTADO_DOT[c.estado])} />
                    {ESTADO_LABEL[c.estado] ?? c.estado}
                  </span>
                </div>

                {/* Campo / Lote */}
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">{c.campo_nombre}</span>
                  <span className="text-zinc-300">›</span>
                  <span>{c.lote_nombre}</span>
                </div>

                {/* Fechas */}
                <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-50">
                  <span>Siembra: <span className="text-zinc-600 font-medium">{fmt(c.fecha_siembra)}</span></span>
                  {c.fecha_cosecha_estimada && (
                    <span>Est: <span className="text-zinc-600 font-medium">{fmt(c.fecha_cosecha_estimada)}</span></span>
                  )}
                </div>

                {/* Footer: acciones */}
                <div className="flex items-center justify-between pt-1">
                  <Link
                    href={`/app/cultivos/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#006836] hover:underline"
                  >
                    Ver detalle <ExternalLink className="w-3 h-3" />
                  </Link>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditando(c); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <DeleteButton onDelete={() => handleDelete(c.id)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
