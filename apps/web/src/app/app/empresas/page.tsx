import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Building2, Plus, ChevronDown } from 'lucide-react';
import CrearEmpresaForm from './crear-empresa-form';
import EmpresasLayout from './empresas-layout';

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();

  if (!empresaData?.esSuperAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">Acceso denegado</h2>
        <p className="text-sm text-zinc-500">
          Solo el super administrador puede gestionar empresas.
        </p>
      </div>
    );
  }

  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, nombre, cuit, moneda_base, logo_url, fecha_alta')
    .order('fecha_alta', { ascending: false });

  const total = empresas?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Empresas</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {total} empresa{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <EmpresasLayout empresas={empresas ?? []} />
    </div>
  );
}
