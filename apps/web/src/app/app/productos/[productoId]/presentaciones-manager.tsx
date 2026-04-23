'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import PresentacionForm, { type PresentacionRow } from './presentacion-form';
import DeleteButton from '@/components/ui/delete-button';

interface Props {
  productoId: string;
  unidadBase: string;
  presentaciones: PresentacionRow[];
}

export default function PresentacionesManager({ productoId, unidadBase, presentaciones }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState<PresentacionRow | null>(null);

  function handleSuccess() {
    setEditando(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('presentaciones').delete().eq('id', id);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tabla */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
        {presentaciones.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No hay presentaciones registradas para este producto.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Factor</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {presentaciones.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    'transition-colors',
                    editando?.id === p.id ? 'bg-green-50' : 'hover:bg-slate-50'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{p.descripcion}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {Number(p.factor_a_unidad_base).toLocaleString('es-AR', {
                      maximumFractionDigits: 4,
                    })}{' '}
                    <span className="text-slate-400 text-xs">{unidadBase}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditando((prev) => (prev?.id === p.id ? null : p))}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors',
                          editando?.id === p.id
                            ? 'bg-green-100 text-green-700'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        )}
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </button>
                      <DeleteButton onDelete={() => handleDelete(p.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel formulario */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <PresentacionForm
          productoId={productoId}
          unidadBase={unidadBase}
          presentacionEditando={editando}
          onSuccess={handleSuccess}
          onCancel={() => setEditando(null)}
        />
      </div>
    </div>
  );
}
