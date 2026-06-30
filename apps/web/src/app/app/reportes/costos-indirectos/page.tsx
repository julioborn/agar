import { redirect } from 'next/navigation';
import { ArrowLeft, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import CIReport from './ci-report';

export default async function ReportesCIPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [campoRes, empresaRes, camposRes, campaniaRes, proveedoresRes] = await Promise.all([
    supabase
      .from('costos_indirectos_campo')
      .select(`
        id, campo_id, campania_id, fecha, categoria, descripcion, monto_ars, created_at,
        campo:campos(id, nombre),
        campania:campanias(id, nombre),
        proveedor:proveedores(id, nombre),
        comprobante:comprobantes_internos(id, numero)
      `)
      .eq('empresa_id', empresa.id)
      .order('fecha', { ascending: false }),

    supabase
      .from('costos_indirectos_empresa')
      .select(`
        id, campania_id, fecha, categoria, descripcion, monto_ars, created_at,
        campania:campanias(id, nombre),
        proveedor:proveedores(id, nombre),
        comprobante:comprobantes_internos(id, numero)
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
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/reportes"
          className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
          <TrendingDown className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Reportes CI</h1>
          <p className="text-sm text-zinc-500">{empresa.nombre} · Costos indirectos de campo y empresa</p>
        </div>
      </div>

      <CIReport
        costosCampo={(campoRes.data ?? []) as any}
        costosEmpresa={(empresaRes.data ?? []) as any}
        campos={camposRes.data ?? []}
        campanias={campaniaRes.data ?? []}
        proveedores={proveedoresRes.data ?? []}
        empresaNombre={empresa.nombre}
      />
    </div>
  );
}
