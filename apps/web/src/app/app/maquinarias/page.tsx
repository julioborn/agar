import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Tractor } from 'lucide-react';
import MaquinariasLayout from './maquinarias-layout';

export default async function MaquinariasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const [{ data: maquinarias }, { data: config }] = await Promise.all([
    supabase
      .from('maquinarias')
      .select(`
        id, nombre, tipo, es_implemento, marca, modelo, anio, hp, activa,
        consumo_combustible_hora, costo_mantenimiento_hora,
        factor_carga, coef_lubricantes, costo_mano_obra_hora, coef_rm,
        ancho_labor_m, velocidad_kmh, eficiencia_campo,
        rendimiento_tn_h, velocidad_embolsado_m_h,
        valor_adquisicion, valor_reposicion, valor_residual,
        vida_util_horas, vida_util_ha, uso_anual_horas,
        tasa_interes_anual, seguro_porcentaje
      `)
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('configuracion_empresa')
      .select('precio_combustible, tipo_combustible')
      .eq('empresa_id', empresa.id)
      .maybeSingle(),
  ]);

  const precioCombustible = config?.precio_combustible ?? 0;
  const tipoCombustible   = config?.tipo_combustible ?? 'gasoil';

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Tractor className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Maquinarias</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {maquinarias?.length ?? 0} equipo{maquinarias?.length !== 1 ? 's' : ''} registrado{maquinarias?.length !== 1 ? 's' : ''}
            {precioCombustible === 0 && (
              <span className="ml-2 text-amber-500">· Configurá el precio del combustible para ver los costos</span>
            )}
          </p>
        </div>
      </div>

      <MaquinariasLayout
        maquinarias={maquinarias ?? []}
        empresaId={empresa.id}
        precioCombustible={precioCombustible}
        tipoCombustible={tipoCombustible}
      />
    </div>
  );
}
