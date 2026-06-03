import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Sprout, ChevronRight, FlaskConical, FileText } from 'lucide-react';

export default async function CampoHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { data: cultivos } = await supabase
    .from('cultivos')
    .select(`
      id, cultivo, fecha_siembra, estado,
      lote:lotes!inner(nombre, campo:campos!inner(nombre))
    `)
    .in('estado', ['planificada', 'en_curso'])
    .order('fecha_siembra', { ascending: false });

  const hoy = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Saludo */}
      <div>
        <p className="text-zinc-500 text-sm capitalize">{hoy}</p>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/campo/aplicar"
          className="block bg-[#006836] hover:bg-[#005228] active:bg-[#004020] text-white rounded-2xl p-4 text-center transition-colors shadow-sm"
        >
          <FlaskConical className="w-7 h-7 mx-auto mb-2" strokeWidth={1.8} />
          <span className="text-sm font-semibold">Registrar aplicación</span>
          <p className="text-white/70 text-xs mt-0.5">Fitosanitaria, fert., siembra…</p>
        </Link>
        <Link
          href="/campo/ria/nuevo"
          className="block bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-white rounded-2xl p-4 text-center transition-colors shadow-sm"
        >
          <FileText className="w-7 h-7 mx-auto mb-2" strokeWidth={1.8} />
          <span className="text-sm font-semibold">Nuevo remito</span>
          <p className="text-white/70 text-xs mt-0.5">Insumos, labores, cosecha…</p>
        </Link>
      </div>

      {/* Cultivos activos */}
      <div>
        <h2 className="text-base font-semibold text-zinc-700 mb-3 flex items-center gap-2">
          <Sprout className="w-4 h-4 text-[#006836]" />
          Cultivos activos
          <span className="ml-auto text-xs font-normal text-zinc-400">{cultivos?.length ?? 0} activos</span>
        </h2>

        {(!cultivos || cultivos.length === 0) ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center">
            <p className="text-zinc-400 text-sm">No hay cultivos activos.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cultivos.map((c: any) => (
              <li key={c.id}>
                <Link
                  href={`/campo/aplicar?cultivo=${c.id}`}
                  className="flex items-center bg-white rounded-xl border border-zinc-200 px-4 py-4 gap-3 active:bg-zinc-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 text-base truncate">{c.cultivo}</p>
                    <p className="text-sm text-zinc-500 truncate mt-0.5">
                      {(c.lote as any)?.nombre} · {(c.lote as any)?.campo?.nombre}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
                      <span>Siembra: {new Date(c.fecha_siembra + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${c.estado === 'en_curso' ? 'bg-[#006836]/10 text-[#006836]' : 'bg-amber-100 text-amber-700'}`}>
                        {c.estado === 'en_curso' ? 'En curso' : 'Planificada'}
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-300 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
