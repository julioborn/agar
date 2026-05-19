import { redirect } from 'next/navigation';
import { Building } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import CostosCampoManager from './costos-campo-manager';

export default async function CostosCampoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [costosRes, camposRes, campaniaRes, provRes] = await Promise.all([
    supabase
      .from('costos_indirectos_campo')
      .select(`
        id, campo_id, campania_id, fecha, categoria, descripcion, monto_ars, created_at,
        campo:campos(id, nombre),
        campania:campanias(id, nombre),
        proveedor:proveedores(id, nombre),
        comprobante:comprobantes_internos(id, numero, usuario_id)
      `)
      .eq('empresa_id', empresa.id)
      .order('fecha', { ascending: false }),
    supabase
      .from('campos')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('campanias')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Building className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Costos Indirectos de Campo</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · {costosRes.data?.length ?? 0} registro{(costosRes.data?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <CostosCampoManager
        costos={(costosRes.data ?? []) as any}
        campos={camposRes.data ?? []}
        campanias={campaniaRes.data ?? []}
        proveedores={provRes.data ?? []}
      />
    </div>
  );
}
