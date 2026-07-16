'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, ChevronDown, ChevronUp, Layers, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useReadOnly } from '@/lib/readonly-context';
import CampoForm, { type CampoRow } from './campo-form';
import DeleteButton from '@/components/ui/delete-button';

interface CampoConLotes extends CampoRow {
  lotes_count: number;
}

interface Props {
  campos: CampoConLotes[];
  empresaId: string;
}

const numHA = (n: number | null) =>
  n != null ? n.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : null;

export default function CamposManager({ campos, empresaId }: Props) {
  const router = useRouter();
  const esLector = useReadOnly();
  const [editando, setEditando] = useState<CampoRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function handleSuccess() {
    setFormOpen(false);
    setEditando(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('campos').delete().eq('id', id);
    router.refresh();
  }

  const haTotal = campos.reduce((acc, c) => acc + Number(c.hectareas_totales ?? 0), 0);
  const lotesTotal = campos.reduce((acc, c) => acc + c.lotes_count, 0);

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Campos',   value: campos.length,  dot: 'bg-[#006836]' },
          { label: 'Lotes',    value: lotesTotal,      dot: 'bg-amber-400' },
          { label: 'Hectáreas totales', value: haTotal > 0 ? `${numHA(haTotal)} ha` : '—', dot: 'bg-blue-400' },
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

      {/* Nuevo campo (colapsable) — oculto para lector */}
      {!esLector && <div className={cn(
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
                {editando ? 'Editar campo' : 'Nuevo campo'}
              </p>
              <p className="text-xs text-zinc-400">Registrar nombre y superficie</p>
            </div>
          </div>
          {formOpen
            ? <ChevronUp className="w-4 h-4 text-zinc-400" />
            : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <CampoForm
              empresaId={empresaId}
              campoEditando={editando}
              onSuccess={handleSuccess}
              onCancel={() => { setEditando(null); setFormOpen(false); }}
            />
          </div>
        )}
      </div>}

      {/* Lista */}
      {campos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <MapPin className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay campos registrados todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {campos.map((c) => (
            <div key={c.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className="h-1 bg-[#006836]" />
              <div className="p-4 space-y-3">

                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#006836]/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-[#006836]" />
                    </div>
                    <p className="font-bold text-zinc-900 truncate">{c.nombre}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  {c.hectareas_totales != null && (
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-zinc-700">{numHA(c.hectareas_totales)}</span> ha
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-semibold text-zinc-700">{c.lotes_count}</span>
                    {' '}lote{c.lotes_count !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-50">
                  <Link
                    href={`/app/campos/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#006836] hover:underline"
                  >
                    Ver lotes <ExternalLink className="w-3 h-3" />
                  </Link>
                  {!esLector && (
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
                      <DeleteButton onDelete={() => handleDelete(c.id)} confirmLabel="Eliminar campo" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
