import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import Link from 'next/link';
import { FileText, Plus, ChevronRight } from 'lucide-react';

const ESTADO_STYLE: Record<string, string> = {
  borrador:   'bg-amber-100 text-amber-700',
  confirmado: 'bg-[#006836]/10 text-[#006836]',
  anulado:    'bg-red-100 text-red-600',
};
const ESTADO_LABEL: Record<string, string> = {
  borrador:   'Borrador',
  confirmado: 'Confirmado',
  anulado:    'Anulado',
};

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default async function CampoRiaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const { data: riasRaw } = await supabase
    .from('remitos_internos')
    .select(`
      id, numero_ria, fecha, estado,
      cultivo_descripcion, superficie_afectada,
      total_insumos, total_labores, total_ria,
      lote:lotes(nombre, campo:campos(nombre)),
      campania:campanias(nombre),
      remitos_insumos(subtotal),
      remitos_labores(subtotal)
    `)
    .eq('empresa_id', empresa.id)
    .order('fecha', { ascending: false })
    .order('numero_correlativo', { ascending: false })
    .limit(50);

  // Recalcular totales desde las líneas reales
  const rias = (riasRaw ?? []).map((r: any) => {
    const totalInsumos = (r.remitos_insumos ?? []).reduce((s: number, i: any) => s + Number(i.subtotal ?? 0), 0);
    const totalLabores = (r.remitos_labores ?? []).reduce((s: number, l: any) => s + Number(l.subtotal ?? 0), 0);
    const { remitos_insumos: _i, remitos_labores: _l, ...rest } = r;
    return { ...rest, total_insumos: totalInsumos, total_labores: totalLabores, total_ria: totalInsumos + totalLabores };
  });

  const pendientes = (rias ?? []).filter((r: any) => r.estado === 'borrador').length;

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Mis remitos</h1>
          {pendientes > 0 && (
            <p className="text-xs text-amber-600 mt-0.5 font-medium">
              {pendientes} borrador{pendientes > 1 ? 'es' : ''} pendiente{pendientes > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link
          href="/campo/ria/nuevo"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl active:bg-[#004020] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </Link>
      </div>

      {(!rias || rias.length === 0) ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
          <FileText className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm mb-4">No hay remitos todavía.</p>
          <Link
            href="/campo/ria/nuevo"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl"
          >
            <Plus className="w-4 h-4" /> Crear primer remito
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {(rias as any[]).map((r) => (
            <li key={r.id}>
              <Link
                href={`/campo/ria/${r.id}`}
                className="flex items-center bg-white rounded-2xl border border-zinc-200 px-4 py-4 gap-3 active:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-zinc-800">{r.numero_ria}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_STYLE[r.estado] ?? ''}`}>
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 mt-1 truncate">
                    {r.lote?.campo?.nombre && <span className="text-zinc-400">{r.lote.campo.nombre} › </span>}
                    {r.lote?.nombre ?? '—'}
                    {r.cultivo_descripcion && <span className="text-zinc-400"> · {r.cultivo_descripcion}</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-zinc-400">{fmt(r.fecha)}</span>
                    {r.total_ria > 0 && (
                      <span className="text-xs font-semibold text-zinc-700">${num.format(r.total_ria)}</span>
                    )}
                    {r.superficie_afectada && (
                      <span className="text-xs text-zinc-400">{r.superficie_afectada} ha</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
