'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const UNIDADES = [
  { value: 'kg',           label: 'Kilogramos (kg)' },
  { value: 'tn',           label: 'Toneladas (tn)' },
  { value: 'm3',           label: 'Metros cúbicos (m³)' },
  { value: 'bolsa_silaje', label: 'Bolsas de silaje' },
  { value: 'fardo',        label: 'Fardos' },
  { value: 'litro',        label: 'Litros (L)' },
  { value: 'unidad',       label: 'Unidades' },
];

interface Props {
  cultivoId: string;
  productoFinalActual: string | null;
  unidadActual: string;
}

export default function ConfigProduccionForm({ cultivoId, productoFinalActual, unidadActual }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [productoFinal, setProductoFinal] = useState(productoFinalActual ?? '');
  const [unidad, setUnidad] = useState(unidadActual ?? 'kg');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const yaConfigurado = !!productoFinalActual;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { error: err } = await supabase
      .from('cultivos')
      .update({ producto_final: productoFinal.trim() || null, unidad_produccion: unidad })
      .eq('id', cultivoId);

    setSaving(false);
    if (err) { setError(err.message); return; }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className={cn(
      'bg-white rounded-2xl border overflow-hidden transition-all',
      open ? 'border-zinc-300 shadow-sm' : 'border-zinc-100',
    )}>
      {/* Header / trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
            open ? 'bg-zinc-800 text-white' : 'bg-zinc-100',
          )}>
            <Settings2 className={cn('w-4 h-4', open ? 'text-white' : 'text-zinc-500')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800">Configuración de producción</p>
            <p className="text-xs text-zinc-400">
              {yaConfigurado
                ? <span className="text-[#006836] font-medium">{productoFinalActual} · {unidadActual}</span>
                : 'Definir producto final y unidad de medida'}
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-400" />
          : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {/* Form expandido */}
      {open && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Producto final</label>
              <input
                type="text"
                placeholder="Ej: Soja grano, Silaje de maíz, Trigo pan…"
                value={productoFinal}
                onChange={(e) => setProductoFinal(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Unidad de medida</label>
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-zinc-800 text-white text-sm font-semibold rounded-xl hover:bg-zinc-900 disabled:opacity-50 transition-colors">
              {saved
                ? <><Check className="w-4 h-4" /> Guardado</>
                : saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
