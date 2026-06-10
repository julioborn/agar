import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Settings, Fuel, DollarSign } from 'lucide-react';
import ConfigForm from './config-form';

async function fetchCotizBNA(): Promise<number | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.venta ?? null;
  } catch {
    return null;
  }
}

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa, rol, esSuperAdmin } = empresaData;
  const esAdmin = rol === 'admin_empresa' || esSuperAdmin;
  if (!esAdmin) redirect('/app');

  const [configRes, cotizBNA] = await Promise.all([
    supabase
      .from('configuracion_empresa')
      .select('precio_combustible, tipo_combustible, cotizacion_usd, cotizacion_usd_fecha, litros_por_uta')
      .eq('empresa_id', empresa.id)
      .maybeSingle(),
    fetchCotizBNA(),
  ]);

  const config = configRes.data;

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

      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-100">
          <Fuel className="w-4 h-4 text-[#006836]" />
          <h2 className="text-sm font-semibold text-zinc-800">Combustible y cotización USD</h2>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-5">
            El precio de combustible se usa en los costos de maquinaria.
            La cotización del dólar se aplica a todas las operaciones en moneda extranjera.
          </p>
          <ConfigForm
            empresaId={empresa.id}
            initialPrecio={config?.precio_combustible ?? 0}
            initialTipo={config?.tipo_combustible ?? 'gasoil'}
            initialCotizUsd={config?.cotizacion_usd ?? null}
            cotizBNA={cotizBNA}
            initialLitrosPorUta={config?.litros_por_uta ?? 35}
          />
        </div>
      </div>

      {/* Info sobre la tasa automática */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex gap-3">
        <DollarSign className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Cotización automática BNA</p>
          <p>
            Cuando no hay una cotización manual configurada, el sistema obtiene la tasa oficial
            del Banco Nación Argentina (dólar oficial venta) actualizada cada hora.
            {cotizBNA != null && (
              <span className="ml-1 font-semibold">
                Tasa actual: ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(cotizBNA)}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
