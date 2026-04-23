'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import { CATEGORIAS, UNIDADES } from './constants';
export { CATEGORIAS, UNIDADES } from './constants';

export interface ProductoRow {
  id: string;
  nombre: string;
  categoria: string;
  unidad_base: string;
  codigo_barras: string | null;
  codigo_interno: string | null;
  principio_activo: string | null;
  stock_minimo: number;
  requiere_trazabilidad: boolean;
}

interface Props {
  empresaId: string;
  productoEditando: ProductoRow | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function ProductoForm({ empresaId, productoEditando, onSuccess, onCancel }: Props) {
  const [nombre,               setNombre]               = useState('');
  const [categoria,            setCategoria]            = useState('fertilizante');
  const [unidadBase,           setUnidadBase]           = useState('kg');
  const [codigoBarras,         setCodigoBarras]         = useState('');
  const [codigoInterno,        setCodigoInterno]        = useState('');
  const [principioActivo,      setPrincipioActivo]      = useState('');
  const [stockMinimo,          setStockMinimo]          = useState('0');
  const [requiereTrazabilidad, setRequiereTrazabilidad] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productoEditando) {
      setNombre(productoEditando.nombre);
      setCategoria(productoEditando.categoria);
      setUnidadBase(productoEditando.unidad_base);
      setCodigoBarras(productoEditando.codigo_barras ?? '');
      setCodigoInterno(productoEditando.codigo_interno ?? '');
      setPrincipioActivo(productoEditando.principio_activo ?? '');
      setStockMinimo(productoEditando.stock_minimo?.toString() ?? '0');
      setRequiereTrazabilidad(productoEditando.requiere_trazabilidad);
    } else {
      setNombre(''); setCategoria('fertilizante'); setUnidadBase('kg');
      setCodigoBarras(''); setCodigoInterno(''); setPrincipioActivo('');
      setStockMinimo('0'); setRequiereTrazabilidad(false);
    }
    setError(null);
  }, [productoEditando]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      nombre: nombre.trim(), categoria, unidad_base: unidadBase,
      codigo_barras: codigoBarras.trim() || null,
      codigo_interno: codigoInterno.trim() || null,
      principio_activo: principioActivo.trim() || null,
      stock_minimo: parseFloat(stockMinimo) || 0,
      requiere_trazabilidad: requiereTrazabilidad,
    };

    const { error: dbError } = productoEditando
      ? await supabase.from('productos').update(payload).eq('id', productoEditando.id)
      : await supabase.from('productos').insert({ ...payload, empresa_id: empresaId });

    setLoading(false);
    if (dbError) { setError(dbError.message); return; }
    if (!productoEditando) {
      setNombre(''); setCodigoBarras(''); setCodigoInterno('');
      setPrincipioActivo(''); setStockMinimo('0'); setRequiereTrazabilidad(false);
    }
    onSuccess();
  }

  const labelUnidad = UNIDADES.find((u) => u.value === unidadBase)?.label ?? unidadBase;
  const esEdicion = productoEditando !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del producto</label>
        <input type="text" placeholder="Ej: Urea granulada" value={nombre}
          onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
      </div>

      {/* Categoría + Unidad */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            disabled={loading} className={field}>
            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Unidad base</label>
          <select value={unidadBase} onChange={(e) => setUnidadBase(e.target.value)}
            disabled={loading} className={field}>
            {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>

      {/* Stock mínimo + Principio activo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Stock mínimo ({labelUnidad})</label>
          <input type="number" step="0.01" min="0" value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)} disabled={loading} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Principio activo</label>
          <input type="text" placeholder="Para agroquímicos" value={principioActivo}
            onChange={(e) => setPrincipioActivo(e.target.value)} disabled={loading} className={field} />
        </div>
      </div>

      {/* Códigos */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Código de barras</label>
          <input type="text" placeholder="Opcional" value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)} disabled={loading} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Código interno</label>
          <input type="text" placeholder="Opcional" value={codigoInterno}
            onChange={(e) => setCodigoInterno(e.target.value)} disabled={loading} className={field} />
        </div>
      </div>

      {/* Trazabilidad */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
        <input type="checkbox" checked={requiereTrazabilidad}
          onChange={(e) => setRequiereTrazabilidad(e.target.checked)}
          disabled={loading}
          className="w-4 h-4 rounded border-zinc-300 accent-[#006836]" />
        <span className="text-sm text-zinc-600 group-hover:text-zinc-800 transition-colors">
          Requiere trazabilidad de partidas
        </span>
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={loading || !nombre.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
          <Check className="w-4 h-4" />
          {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button type="button" onClick={onCancel}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
