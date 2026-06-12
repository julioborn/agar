import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Package, Sprout } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';

const REPORTS = [
  {
    href: '/app/reportes/margenes',
    title: 'Márgenes',
    description: 'Márgenes brutos por lote, campo y empresa. Vista cruzada por tipo de cultivo.',
    icon: BarChart3,
    iconColor: 'text-[#006836]',
    iconBg: 'bg-[#006836]/10',
    accent: 'group-hover:border-[#006836]/30',
  },
  {
    href: '/app/reportes/insumos-labores',
    title: 'Insumos y Labores',
    description: 'Uso acumulado de cada insumo y labor en todos los lotes de la empresa.',
    icon: Package,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    accent: 'group-hover:border-amber-300',
  },
  {
    href: '/app/reportes/produccion',
    title: 'Producción',
    description: 'Producción por cultivo, rendimiento por lote y promedio por hectárea.',
    icon: Sprout,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    accent: 'group-hover:border-blue-300',
  },
];

export default async function ReportesHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');
  const { empresa } = empresaData;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Reportes</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{empresa.nombre} — seleccioná el reporte que querés ver</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className={`group block bg-white border border-zinc-100 rounded-2xl p-6 hover:shadow-md transition-all ${r.accent}`}
          >
            <div className={`w-11 h-11 rounded-xl ${r.iconBg} flex items-center justify-center mb-4`}>
              <r.icon className={`w-5 h-5 ${r.iconColor}`} />
            </div>
            <h2 className="font-semibold text-zinc-900 text-base mb-1.5">{r.title}</h2>
            <p className="text-sm text-zinc-500 leading-relaxed">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
