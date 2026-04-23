import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Truck } from 'lucide-react';
import ProveedoresManager from './proveedores-manager';

export default async function ProveedoresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const { data: proveedores } = await supabase
    .from('proveedores').select('id, nombre, cuit, contacto').order('nombre');

  const total = proveedores?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Truck className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Proveedores</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · {total} proveedor{total !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>
      <ProveedoresManager proveedores={proveedores ?? []} empresaId={empresa.id} />
    </div>
  );
}
