import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Warehouse } from 'lucide-react';
import DepositosManager from './depositos-manager';

export default async function DepositosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa } = empresaData;

  const [depositosRes, camposRes] = await Promise.all([
    supabase.from('depositos').select('id, nombre, tipo, campo_id, campo:campos(id, nombre)').order('nombre'),
    supabase.from('campos').select('id, nombre').order('nombre'),
  ]);

  const total = depositosRes.data?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <Warehouse className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Depósitos</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {empresa.nombre} · {total} depósito{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <DepositosManager
        depositos={(depositosRes.data ?? []) as any}
        campos={camposRes.data ?? []}
        empresaId={empresa.id}
      />
    </div>
  );
}
