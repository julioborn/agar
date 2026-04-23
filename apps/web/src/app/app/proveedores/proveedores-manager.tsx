'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import ProveedorForm, { type ProveedorRow } from './proveedor-form';
import DeleteButton from '@/components/ui/delete-button';

interface Props { proveedores: ProveedorRow[]; empresaId: string }

export default function ProveedoresManager({ proveedores, empresaId }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState<ProveedorRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function handleSuccess() { setFormOpen(false); setEditando(null); router.refresh(); }
  async function handleDelete(id: string) {
    await createClient().from('proveedores').delete().eq('id', id);
    router.refresh();
  }

  return (
    <div className="space-y-5">

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{proveedores.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Proveedores</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">
              {proveedores.filter((p) => p.cuit).length}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">Con CUIT</p>
          </div>
        </div>
      </div>

      {/* Nuevo proveedor */}
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
              <p className="text-sm font-semibold text-zinc-800">{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</p>
              <p className="text-xs text-zinc-400">Nombre, CUIT y datos de contacto</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <ProveedorForm empresaId={empresaId} editando={editando}
              onSuccess={handleSuccess} onCancel={() => { setEditando(null); setFormOpen(false); }} />
          </div>
        )}
      </div>

      {/* Grid */}
      {proveedores.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center space-y-3">
          <Truck className="w-10 h-10 text-zinc-200 mx-auto" />
          <p className="text-zinc-400 text-sm">No hay proveedores registrados todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {proveedores.map((p) => (
            <div key={p.id} className="group bg-white rounded-2xl border border-zinc-100 hover:border-[#006836]/25 hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className="h-1 bg-[#006836]" />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#006836]/10 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-[#006836]" />
                  </div>
                  <p className="font-bold text-zinc-900 truncate">{p.nombre}</p>
                </div>

                <div className="space-y-1 text-xs text-zinc-500">
                  {p.cuit && <p>CUIT: <span className="font-mono text-zinc-700">{p.cuit}</span></p>}
                  {p.contacto && <p className="truncate">{p.contacto}</p>}
                  {!p.cuit && !p.contacto && <p className="text-zinc-300">Sin datos adicionales</p>}
                </div>

                <div className="flex items-center justify-end pt-1 border-t border-zinc-50">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditando(p); setFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="Editar">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <DeleteButton onDelete={() => handleDelete(p.id)} />
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
