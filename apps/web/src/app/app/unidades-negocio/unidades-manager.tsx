'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import UnidadForm, { type UnidadRow } from './unidad-form';
import DeleteButton from '@/components/ui/delete-button';

const TIPO_LABEL: Record<string, string> = {
  agricultura: 'Agricultura',
  ganaderia:   'Ganadería',
  tambo:       'Tambo',
  apicultura:  'Apicultura',
  forestal:    'Forestal',
  otro:        'Otro',
};

const TIPO_BAR: Record<string, string> = {
  agricultura: 'bg-[#006836]',
  ganaderia:   'bg-amber-500',
  tambo:       'bg-blue-500',
  apicultura:  'bg-yellow-500',
  forestal:    'bg-teal-500',
  otro:        'bg-zinc-400',
};

const TIPO_BADGE: Record<string, string> = {
  agricultura: 'bg-[#006836]/10 text-[#006836]',
  ganaderia:   'bg-amber-100 text-amber-700',
  tambo:       'bg-blue-100 text-blue-700',
  apicultura:  'bg-yellow-100 text-yellow-700',
  forestal:    'bg-teal-100 text-teal-700',
  otro:        'bg-zinc-100 text-zinc-600',
};

interface Props { empresaId: string; unidades: UnidadRow[] }

export default function UnidadesManager({ empresaId, unidades }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState<UnidadRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function handleSuccess() { setFormOpen(false); setEditando(null); router.refresh(); }
  async function handleDelete(id: string) {
    await createClient().from('unidades_negocio').delete().eq('id', id);
    router.refresh();
  }

  const activas   = unidades.filter((u) => u.activa).length;
  const inactivas = unidades.filter((u) => !u.activa).length;
  const tiposMas  = Object.entries(
    unidades.reduce<Record<string, number>>((acc, u) => { acc[u.tipo] = (acc[u.tipo] ?? 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 2);

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{unidades.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Total</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{activas}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Activas</p>
          </div>
        </div>
        {inactivas > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-zinc-300" />
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{inactivas}</p>
              <p className="text-xs text-zinc-400 mt-0.5">Inactivas</p>
            </div>
          </div>
        )}
        {tiposMas.map(([tipo, count]) => (
          <div key={tipo} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', TIPO_BAR[tipo] ?? 'bg-zinc-300')} />
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{count}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{TIPO_LABEL[tipo] ?? tipo}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Nueva unidad */}
      <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
        formOpen ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>
        <button type="button" onClick={() => { setFormOpen((v) => !v); setEditando(null); }}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              formOpen ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
              <Plus className={cn('w-4 h-4', formOpen ? 'text-white' : 'text-[#006836]')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">{editando ? 'Editar unidad' : 'Nueva unidad'}</p>
              <p className="text-xs text-zinc-400">Nombre, tipo y estado</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <UnidadForm empresaId={empresaId} unidadEditando={editando}
              onSuccess={handleSuccess} onCancel={() => { setEditando(null); setFormOpen(false); }} />
          </div>
        )}
      </div>

      {/* Grid */}
      {unidades.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Briefcase className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay unidades de negocio registradas todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {unidades.map((u) => (
            <div key={u.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className={cn('h-1', TIPO_BAR[u.tipo] ?? 'bg-zinc-300')} />
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#006836]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Briefcase className="w-4 h-4 text-[#006836]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{u.nombre}</p>
                    {u.descripcion && (
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{u.descripcion}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                    TIPO_BADGE[u.tipo] ?? 'bg-zinc-100 text-zinc-600')}>
                    {TIPO_LABEL[u.tipo] ?? u.tipo}
                  </span>
                  <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                    u.activa ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400')}>
                    {u.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <div className="flex items-center justify-end pt-1 border-t border-zinc-50">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditando(u); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="Editar">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <DeleteButton onDelete={() => handleDelete(u.id)} />
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
