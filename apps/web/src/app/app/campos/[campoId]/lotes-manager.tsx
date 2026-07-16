'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Plus, ChevronDown, ChevronUp, Sprout, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import LoteForm, { type LoteRow } from './lote-form';
import DeleteButton from '@/components/ui/delete-button';
import { useReadOnly } from '@/lib/readonly-context';

interface Props {
  campoId: string;
  lotes: LoteRow[];
}

const PAGE_SIZE = 6;

const numHA = (n: number) =>
  Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default function LotesManager({ campoId, lotes }: Props) {
  const router = useRouter();
  const esLector = useReadOnly();
  const [editando, setEditando] = useState<LoteRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pagina, setPagina] = useState(0);

  function handleSuccess() {
    setFormOpen(false);
    setEditando(null);
    router.refresh();
  }

  async function handleDelete(loteId: string) {
    const supabase = createClient();
    await supabase.from('lotes').delete().eq('id', loteId);
    router.refresh();
  }

  const haTotalLotes = lotes.reduce((acc, l) => acc + Number(l.hectareas ?? 0), 0);
  const totalPaginas = Math.ceil(lotes.length / PAGE_SIZE);
  const lotesEnPagina = lotes.slice(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">

      {/* Nuevo lote (colapsable) — oculto para lector */}
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
                {editando ? 'Editar lote' : 'Nuevo lote'}
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
            <LoteForm
              campoId={campoId}
              loteEditando={editando}
              onSuccess={handleSuccess}
              onCancel={() => { setEditando(null); setFormOpen(false); }}
            />
          </div>
        )}
      </div>}

      {/* Lista de lotes */}
      {lotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center space-y-3">
          <Layers className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay lotes registrados para este campo.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lotesEnPagina.map((lote) => (
              <div key={lote.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
                <div className="h-1 bg-amber-400" />
                <div className="p-4 space-y-3">

                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="font-bold text-zinc-900 truncate">{lote.nombre}</p>
                  </div>

                  {/* Hectáreas */}
                  <p className="text-sm text-zinc-500">
                    <span className="font-semibold text-zinc-700">{numHA(lote.hectareas)}</span> ha
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-50">
                    <Link
                      href={`/app/cultivos?lote=${lote.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#006836] hover:underline"
                    >
                      <Sprout className="w-3 h-3" /> Ver cultivos
                    </Link>
                    {!esLector && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditando(lote); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <DeleteButton onDelete={() => handleDelete(lote.id)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl border border-zinc-100 px-4 py-2.5 shadow-sm">
              <span className="text-xs text-zinc-400">
                Lotes {pagina * PAGE_SIZE + 1}–{Math.min((pagina + 1) * PAGE_SIZE, lotes.length)} de {lotes.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  disabled={pagina === 0}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPaginas }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPagina(i)}
                    className={`w-7 h-7 text-xs rounded-lg font-medium transition-colors ${
                      i === pagina
                        ? 'bg-[#006836] text-white'
                        : 'text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                  disabled={pagina === totalPaginas - 1}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Total ha */}
          {lotes.length > 1 && (
            <div className="bg-white rounded-2xl border border-zinc-100 px-5 py-3 flex justify-between items-center text-sm shadow-sm">
              <span className="text-zinc-500 font-medium">Total hectáreas en lotes</span>
              <span className="font-bold text-zinc-800">
                {haTotalLotes.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
