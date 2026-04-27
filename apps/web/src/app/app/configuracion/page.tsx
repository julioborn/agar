import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Settings, Fuel } from 'lucide-react';
import ConfigForm from './config-form';

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa, rol, esSuperAdmin } = empresaData;
  const esAdmin = rol === 'admin_empresa' || esSuperAdmin;
  if (!esAdmin) redirect('/app');

  const { data: config } = await supabase
    .from('configuracion_empresa')
    .select('precio_combustible, tipo_combustible')
    .eq('empresa_id', empresa.id)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Configuración</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre}</p>
        </div>
      </div>

      {/* Combustible */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-100">
          <Fuel className="w-4 h-4 text-[#006836]" />
          <h2 className="text-sm font-semibold text-zinc-800">Precio de combustible</h2>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-4">
            Este precio se usa globalmente para calcular el costo de funcionamiento
            de cada maquinaria. Actualizarlo afecta todos los cálculos futuros.
          </p>
          <ConfigForm
            empresaId={empresa.id}
            initialPrecio={config?.precio_combustible ?? 0}
            initialTipo={config?.tipo_combustible ?? 'gasoil'}
          />
        </div>
      </div>
    </div>
  );
}
