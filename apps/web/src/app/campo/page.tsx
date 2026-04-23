import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { Sprout, ChevronRight, FlaskConical } from 'lucide-react';

export default async function CampoHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  // Cultivos activos: planificados y en curso
  const { data: cultivos } = await supabase
    .from('cultivos')
    .select(`
      id, cultivo, fecha_siembra, estado,
      lote:lotes!inner(nombre, campo:campos!inner(nombre))
    `)
    .in('estado', ['planificada', 'en_curso'])
    .order('fecha_siembra', { ascending: false });

  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Saludo */}
      <div>
        <p className="text-slate-500 text-sm capitalize">{hoy}</p>
      </div>

      {/* Botón principal */}
      <Link
        href="/campo/aplicar"
        className="block w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl p-5 text-center transition-colors shadow-sm"
      >
        <FlaskConical className="w-8 h-8 mx-auto mb-2" strokeWidth={1.8} />
        <span className="text-lg font-semibold">Registrar aplicación</span>
        <p className="text-green-100 text-sm mt-1">Fitosanitaria, fertilización, siembra…</p>
      </Link>

      {/* Campañas en curso */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Sprout className="w-4 h-4 text-green-600" />
          Cultivos activos
          <span className="ml-auto text-xs font-normal text-slate-400">{cultivos?.length ?? 0} activos</span>
        </h2>

        {(!cultivos || cultivos.length === 0) ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-slate-400 text-sm">No hay cultivos activos.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cultivos.map((c: any) => (
              <li key={c.id}>
                <Link
                  href={`/campo/aplicar?cultivo=${c.id}`}
                  className="flex items-center bg-white rounded-xl border border-slate-200 px-4 py-4 gap-3 active:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-base truncate">{c.cultivo}</p>
                    <p className="text-sm text-slate-500 truncate mt-0.5">
                      {(c.lote as any)?.nombre} · {(c.lote as any)?.campo?.nombre}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>Siembra: {new Date(c.fecha_siembra + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${c.estado === 'en_curso' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.estado === 'en_curso' ? 'En curso' : 'Planificada'}
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
