import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { FileText, Sprout, ChevronRight, Clock } from 'lucide-react';

const TZ = 'America/Argentina/Buenos_Aires';

export default async function CampoHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  const hoy = new Date().toLocaleDateString('es-AR', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
  });

  const [{ data: cultivos }, { data: riasRecientes }] = await Promise.all([
    supabase
      .from('cultivos')
      .select('id, cultivo, fecha_siembra, estado, lote:lotes!inner(nombre, campo:campos!inner(nombre))')
      .in('estado', ['planificada', 'en_curso'])
      .order('fecha_siembra', { ascending: false }),

    supabase
      .from('remitos_internos')
      .select('id, numero_ria, fecha, estado, cultivo_descripcion, lote:lotes(nombre), cultivo:cultivos(cultivo)')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  // Preferir el nombre vigente del cultivo (ya normalizado a mayúsculas) por
  // sobre cultivo_descripcion, que es una foto fija tomada al crear el RIA.
  const riasRec = (riasRecientes ?? []).map((r: any) => ({
    ...r,
    cultivo_descripcion: r.cultivo?.cultivo ?? r.cultivo_descripcion ?? null,
  }));

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

  return (
    <div className="px-4 py-5 space-y-5">

      {/* Saludo */}
      <div>
        <p className="text-zinc-400 text-sm capitalize">{hoy}</p>
        <h1 className="text-xl font-bold text-zinc-900 mt-0.5">Bienvenido</h1>
      </div>

      {/* Acción principal */}
      <Link
        href="/campo/ria/nuevo"
        className="flex items-center gap-4 w-full bg-[#006836] hover:bg-[#005228] active:bg-[#004020] text-white rounded-2xl px-5 py-4 transition-colors shadow-sm"
      >
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <FileText className="w-6 h-6" strokeWidth={1.8} />
        </div>
        <div className="text-left">
          <p className="font-bold text-base leading-tight">Nuevo remito</p>
          <p className="text-white/70 text-sm mt-0.5">Insumos, labores, cosecha…</p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/50 ml-auto shrink-0" />
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-200 px-4 py-3.5">
          <p className="text-2xl font-bold text-zinc-900">{cultivos?.length ?? 0}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Cultivos activos</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 px-4 py-3.5">
          <p className="text-2xl font-bold text-zinc-900">
            {riasRec.filter((r) => r.estado === 'borrador').length}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">Borradores pendientes</p>
        </div>
      </div>

      {/* Últimos remitos */}
      {riasRec.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              Últimos remitos
            </h2>
            <Link href="/campo/ria" className="text-xs text-[#006836] font-medium">Ver todos</Link>
          </div>
          <ul className="space-y-2">
            {riasRec.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/campo/ria/${r.id}`}
                  className="flex items-center bg-white rounded-xl border border-zinc-200 px-4 py-3 gap-3 active:bg-zinc-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-700">{r.numero_ria}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        r.estado === 'confirmado' ? 'bg-[#006836]/10 text-[#006836]' :
                        r.estado === 'anulado' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {r.estado === 'confirmado' ? 'Confirmado' : r.estado === 'anulado' ? 'Anulado' : 'Borrador'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 truncate mt-0.5">
                      {r.lote?.nombre ?? '—'}
                      {r.cultivo_descripcion ? ` · ${r.cultivo_descripcion}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">{fmt(r.fecha)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cultivos activos */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 text-[#006836]" />
            Cultivos activos
          </h2>
          <span className="text-xs text-zinc-400">{cultivos?.length ?? 0} activos</span>
        </div>

        {(!cultivos || cultivos.length === 0) ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center">
            <p className="text-zinc-400 text-sm">No hay cultivos activos.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {(cultivos as any[]).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campo/ria/nuevo`}
                  className="flex items-center bg-white rounded-xl border border-zinc-200 px-4 py-3.5 gap-3 active:bg-zinc-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#006836]/10 flex items-center justify-center shrink-0">
                    <Sprout className="w-4 h-4 text-[#006836]" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 text-sm truncate">{c.cultivo}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {c.lote?.nombre} · {c.lote?.campo?.nombre}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.estado === 'en_curso' ? 'bg-[#006836]/10 text-[#006836]' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {c.estado === 'en_curso' ? 'En curso' : 'Planificada'}
                    </span>
                    <p className="text-xs text-zinc-400 mt-1">Siembra: {fmt(c.fecha_siembra)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
