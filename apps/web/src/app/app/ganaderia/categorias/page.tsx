import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Tag } from 'lucide-react';
import CategoriasLayout from './categorias-layout';

export default async function CategoriasHaciendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const { data: categorias } = await supabase
    .from('categorias_hacienda')
    .select('id, nombre, orden, activo')
    .eq('empresa_id', empresa.id)
    .order('orden');

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Tag className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Categorías de Hacienda</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · Lista maestra de categorías de animales</p>
        </div>
      </div>

      <CategoriasLayout categorias={categorias ?? []} empresaId={empresa.id} />
    </div>
  );
}
