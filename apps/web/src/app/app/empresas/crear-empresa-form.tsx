'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function CrearEmpresaForm() {
  const router = useRouter();
  const [nombre,  setNombre]  = useState('');
  const [cuit,    setCuit]    = useState('');
  const [moneda,  setMoneda]  = useState('ARS');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exito,   setExito]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !cuit.trim()) return;
    setLoading(true); setError(null);

    const { error: insertError } = await createClient()
      .from('empresas')
      .insert({ nombre: nombre.trim(), cuit: cuit.trim(), moneda_base: moneda });

    setLoading(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'Ya existe una empresa con ese CUIT.' : insertError.message);
      return;
    }

    setExito(true);
    setNombre(''); setCuit(''); setMoneda('ARS');
    setTimeout(() => { setExito(false); router.refresh(); }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre</label>
        <input type="text" placeholder="Canciani SA" value={nombre}
          onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">CUIT</label>
        <input type="text" placeholder="30-12345678-9" value={cuit}
          onChange={(e) => setCuit(e.target.value)} required disabled={loading} className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Moneda base</label>
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} disabled={loading} className={field}>
          <option value="ARS">ARS — Pesos argentinos</option>
          <option value="USD">USD — Dólares</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {exito && (
        <p className="text-xs text-[#006836] flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Empresa creada correctamente.
        </p>
      )}
      <button type="submit" disabled={loading || !nombre.trim() || !cuit.trim()}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors w-full justify-center">
        <Check className="w-4 h-4" />
        {loading ? 'Guardando...' : 'Crear empresa'}
      </button>
    </form>
  );
}
