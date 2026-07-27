import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Fence } from 'lucide-react';
import CorralesManager from './corrales-manager';

export default async function CorralesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const [{ data: lotesRaw }, { data: corrales }] = await Promise.all([
    supabase
      .from('lotes')
      .select('id, nombre, campo:campos!inner(id, nombre, empresa_id)')
      .eq('campo.empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('corrales')
      .select('id, lote_id, nombre, capacidad_cabezas, activo')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
  ]);

  const lotes = (lotesRaw ?? []).map((l: any) => ({
    id: l.id,
    nombre: l.nombre,
    campoNombre: l.campo?.nombre ?? '—',
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Fence className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Corrales</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Uso intensivo (feedlot)</p>
        </div>
      </div>

      <CorralesManager lotes={lotes} corrales={corrales ?? []} empresaId={empresa.id} />
    </div>
  );
}
