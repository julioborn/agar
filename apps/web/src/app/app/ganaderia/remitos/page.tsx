import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { FileText } from 'lucide-react';
import RemitosGanaderosManager from './remitos-ganaderos-manager';

export default async function RemitosGanaderosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const { data: remitosRaw } = await supabase
    .from('remitos_ganaderos')
    .select(`
      id, numero_rig, fecha, estado, total_insumos, observaciones,
      lote_hacienda:lotes_hacienda(
        nombre,
        corral:corrales(nombre, lote:lotes(nombre, campo:campos(nombre))),
        potrero:potreros(nombre, lote:lotes(nombre, campo:campos(nombre)))
      )
    `)
    .eq('empresa_id', empresa.id)
    .order('fecha', { ascending: false })
    .order('numero_correlativo', { ascending: false });

  const remitos = (remitosRaw ?? []).map((r: any) => {
    const lh = r.lote_hacienda;
    const ubicacion = lh?.corral
      ? `${lh.corral.lote?.campo?.nombre ?? '—'} › ${lh.corral.lote?.nombre ?? '—'} › Corral ${lh.corral.nombre}`
      : lh?.potrero
        ? `${lh.potrero.lote?.campo?.nombre ?? '—'} › ${lh.potrero.lote?.nombre ?? '—'} › Potrero ${lh.potrero.nombre}`
        : 'Sin ubicación';
    return {
      id: r.id,
      numero_rig: r.numero_rig,
      fecha: r.fecha,
      estado: r.estado,
      total_insumos: r.total_insumos,
      loteHaciendaNombre: lh?.nombre ?? '—',
      ubicacion,
    };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Remitos Ganaderos</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} · {remitos.length} remito{remitos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <RemitosGanaderosManager remitos={remitos} />
    </div>
  );
}
