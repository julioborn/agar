import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import NuevaAplicacionForm from './nueva-aplicacion-form';

interface Props {
  params: Promise<{ cultivoId: string }>;
}

export default async function NuevaAplicacionPage({ params }: Props) {
  const { cultivoId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { data: cultivo } = await supabase
    .from('cultivos')
    .select('id, cultivo, estado, lote:lotes(nombre)')
    .eq('id', cultivoId)
    .single();

  if (!cultivo) notFound();

  const [prodRes, depRes] = await Promise.all([
    supabase.from('productos').select('id, nombre, unidad_base').order('nombre'),
    supabase.from('depositos').select('id, nombre').order('nombre'),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/app/cultivos" className="hover:text-slate-800 transition-colors">Cultivos</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/app/cultivos/${cultivoId}`} className="hover:text-slate-800 transition-colors">
          {cultivo.cultivo}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-800 font-medium">Nueva aplicación</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva aplicación</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cultivo: <span className="font-medium">{cultivo.cultivo}</span>
          {(cultivo.lote as any)?.nombre && (
            <> · Lote: <span className="font-medium">{(cultivo.lote as any).nombre}</span></>
          )}
        </p>
      </div>

      <NuevaAplicacionForm
        cultivoId={cultivoId}
        productos={prodRes.data ?? []}
        depositos={depRes.data ?? []}
      />
    </div>
  );
}
