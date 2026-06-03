import { redirect } from 'next/navigation';
import { Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import ImportarStockForm from './importar-stock-form';

export default async function ImportarStockPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const [prodRes, depRes, provRes] = await Promise.all([
    supabase.from('productos').select('id, nombre, categoria, unidad_base, principio_activo').order('nombre'),
    supabase.from('depositos').select('id, nombre').order('nombre'),
    supabase.from('proveedores').select('id, nombre').eq('empresa_id', empresaData.empresa.id).order('nombre'),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Cargar stock desde archivo</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Subí un Excel o PDF con productos y cantidades · {empresaData.empresa.nombre}
          </p>
        </div>
      </div>

      <ImportarStockForm
        productos={prodRes.data ?? []}
        depositos={depRes.data ?? []}
        proveedores={provRes.data ?? []}
      />
    </div>
  );
}
