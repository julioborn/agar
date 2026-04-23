import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { FlaskConical, Package } from 'lucide-react';

const TIPO_COLOR: Record<string, string> = {
  fitosanitaria: 'bg-purple-100 text-purple-700',
  fertilizacion: 'bg-blue-100 text-blue-700',
  siembra:       'bg-green-100 text-green-700',
  otro:          'bg-slate-100 text-slate-600',
};

const TIPO_LABEL: Record<string, string> = {
  fitosanitaria: 'Fitosanitaria',
  fertilizacion: 'Fertilización',
  siembra:       'Siembra',
  otro:          'Otro',
};

export default async function HistorialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  // Últimas 30 aplicaciones del usuario, con ítems
  const { data: aplicaciones } = await supabase
    .from('aplicaciones')
    .select(`
      id, fecha, tipo, observaciones,
      cultivo:cultivos!inner(
        cultivo,
        lote:lotes!inner(nombre, campo:campos!inner(nombre))
      ),
      items:aplicaciones_items(
        cantidad_retirada, cantidad_aplicada, cantidad_devuelta,
        producto:productos(nombre, unidad_base)
      )
    `)
    .eq('usuario_id', user.id)
    .order('fecha', { ascending: false })
    .limit(30);

  return (
    <div className="px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Mis aplicaciones</h1>

      {(!aplicaciones || aplicaciones.length === 0) ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <FlaskConical className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aún no registraste aplicaciones.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {aplicaciones.map((a: any) => (
            <li key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Cabecera */}
              <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[a.tipo] ?? TIPO_COLOR.otro}`}>
                      {TIPO_LABEL[a.tipo] ?? a.tipo}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 mt-1.5 text-sm">
                    {a.cultivo?.cultivo}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.cultivo?.lote?.nombre} · {a.cultivo?.lote?.campo?.nombre}
                  </p>
                  {a.observaciones && (
                    <p className="text-xs text-slate-400 mt-1 italic">{a.observaciones}</p>
                  )}
                </div>
              </div>

              {/* Ítems */}
              {a.items && a.items.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                  {a.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Package className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-600">
                        <span className="font-medium text-slate-800">{item.producto?.nombre}</span>
                        {' · '}
                        <span>{item.cantidad_retirada} {item.producto?.unidad_base} retirados</span>
                        {item.cantidad_devuelta > 0 && (
                          <span className="text-slate-400"> · {item.cantidad_devuelta} devueltos</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
