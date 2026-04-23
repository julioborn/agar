'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Warehouse, Plus, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import DepositoForm, { TIPOS_DEPOSITO, type DepositoRow } from './deposito-form';
import DeleteButton from '@/components/ui/delete-button';

const TIPO_LABEL = Object.fromEntries(TIPOS_DEPOSITO.map((t) => [t.value, t.label]));

interface CampoOpcion { id: string; nombre: string }
interface Props { depositos: DepositoRow[]; campos: CampoOpcion[]; empresaId: string }

export default function DepositosManager({ depositos, campos, empresaId }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState<DepositoRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function handleSuccess() { setFormOpen(false); setEditando(null); router.refresh(); }
  async function handleDelete(id: string) {
    await createClient().from('depositos').delete().eq('id', id);
    router.refresh();
  }

  const centrales  = depositos.filter((d) => d.tipo === 'central').length;
  const galpones   = depositos.filter((d) => d.tipo === 'galpon_campo').length;

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Depósitos', value: depositos.length, dot: 'bg-[#006836]' },
          { label: 'Centrales',   value: centrales,  dot: 'bg-blue-400' },
          { label: 'Galpones',    value: galpones,   dot: 'bg-amber-400' },
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

      {/* Nuevo depósito */}
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
              <p className="text-sm font-semibold text-zinc-800">{editando ? 'Editar depósito' : 'Nuevo depósito'}</p>
              <p className="text-xs text-zinc-400">Central o galpón de campo</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <DepositoForm empresaId={empresaId} campos={campos} depositoEditando={editando}
              onSuccess={handleSuccess} onCancel={() => { setEditando(null); setFormOpen(false); }} />
          </div>
        )}
      </div>

      {/* Grid */}
      {depositos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Warehouse className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay depósitos registrados todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {depositos.map((dep) => (
            <div key={dep.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className={cn('h-1', dep.tipo === 'central' ? 'bg-blue-400' : 'bg-amber-400')} />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                      <Warehouse className="w-4 h-4 text-zinc-500" />
                    </div>
                    <p className="font-bold text-zinc-900 truncate">{dep.nombre}</p>
                  </div>
                  <span className={cn('shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
                    dep.tipo === 'central' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}>
                    {TIPO_LABEL[dep.tipo] ?? dep.tipo}
                  </span>
                </div>

                {dep.campo && (
                  <p className="flex items-center gap-1 text-xs text-zinc-500">
                    <MapPin className="w-3 h-3 text-zinc-400" /> {dep.campo.nombre}
                  </p>
                )}

                <div className="flex items-center justify-end pt-1 border-t border-zinc-50">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditando(dep); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="Editar">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <DeleteButton onDelete={() => handleDelete(dep.id)} />
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
