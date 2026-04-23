'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface ProveedorRow {
  id: string; nombre: string; cuit: string | null; contacto: string | null;
}

interface Props {
  empresaId: string; editando: ProveedorRow | null;
  onSuccess: () => void; onCancel: () => void;
}

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function ProveedorForm({ empresaId, editando, onSuccess, onCancel }: Props) {
  const [nombre,   setNombre]   = useState('');
  const [cuit,     setCuit]     = useState('');
  const [contacto, setContacto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNombre(editando?.nombre ?? '');
    setCuit(editando?.cuit ?? '');
    setContacto(editando?.contacto ?? '');
    setError(null);
  }, [editando]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true); setError(null);

    const payload = { nombre: nombre.trim(), cuit: cuit.trim() || null, contacto: contacto.trim() || null };
    const { error: dbError } = editando
      ? await createClient().from('proveedores').update(payload).eq('id', editando.id)
      : await createClient().from('proveedores').insert({ ...payload, empresa_id: empresaId });

    setLoading(false);
    if (dbError) { setError(dbError.message); return; }
    if (!editando) { setNombre(''); setCuit(''); setContacto(''); }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre del proveedor</label>
        <input type="text" placeholder="Ej: AgroInsumos SA" value={nombre}
          onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">CUIT</label>
          <input type="text" placeholder="30-12345678-9" value={cuit}
            onChange={(e) => setCuit(e.target.value)} disabled={loading} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Contacto</label>
          <input type="text" placeholder="Email o teléfono" value={contacto}
            onChange={(e) => setContacto(e.target.value)} disabled={loading} className={field} />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading || !nombre.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
          <Check className="w-4 h-4" />
          {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
