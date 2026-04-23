import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, Barcode, Tag, Ruler, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import { cn } from '@/lib/utils';
import PresentacionesManager from './presentaciones-manager';
import { CATEGORIAS } from '../producto-form';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));
const CATEGORIA_COLOR: Record<string, string> = {
  fertilizante:   'bg-blue-100 text-blue-700',
  semilla:        'bg-green-100 text-green-700',
  agroquimico:    'bg-orange-100 text-orange-700',
  combustible:    'bg-red-100 text-red-700',
  insumo_cosecha: 'bg-purple-100 text-purple-700',
  inoculante:     'bg-teal-100 text-teal-700',
  otro:           'bg-slate-100 text-slate-600',
};

interface Props {
  params: Promise<{ productoId: string }>;
}

export default async function ProductoDetallePage({ params }: Props) {
  const { productoId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { data: producto } = await supabase
    .from('productos')
    .select('id, nombre, categoria, unidad_base, codigo_barras, codigo_interno, principio_activo, stock_minimo, requiere_trazabilidad')
    .eq('id', productoId)
    .single();

  if (!producto) notFound();

  const { data: presentaciones } = await supabase
    .from('presentaciones')
    .select('id, producto_id, descripcion, factor_a_unidad_base')
    .eq('producto_id', productoId)
    .order('descripcion');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/app/productos" className="hover:text-slate-800 transition-colors">
          Productos
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-800 font-medium">{producto.nombre}</span>
      </nav>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{producto.nombre}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
              CATEGORIA_COLOR[producto.categoria] ?? 'bg-slate-100 text-slate-600')}>
              {CATEGORIA_LABEL[producto.categoria] ?? producto.categoria}
            </span>
          </div>
        </div>
      </div>

      {/* Ficha del producto */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Datos del producto</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Ruler className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Unidad base</p>
              <p className="font-medium text-slate-800">{producto.unidad_base}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Stock mínimo</p>
              <p className="font-medium text-slate-800">
                {Number(producto.stock_minimo).toLocaleString('es-AR')} {producto.unidad_base}
              </p>
            </div>
          </div>
          {producto.codigo_barras && (
            <div className="flex items-start gap-2">
              <Barcode className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Cód. barras</p>
                <p className="font-medium text-slate-800 font-mono text-xs">{producto.codigo_barras}</p>
              </div>
            </div>
          )}
          {producto.codigo_interno && (
            <div className="flex items-start gap-2">
              <Barcode className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Cód. interno</p>
                <p className="font-medium text-slate-800 font-mono text-xs">{producto.codigo_interno}</p>
              </div>
            </div>
          )}
          {producto.principio_activo && (
            <div className="flex items-start gap-2 col-span-2">
              <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Principio activo</p>
                <p className="font-medium text-slate-800">{producto.principio_activo}</p>
              </div>
            </div>
          )}
          {producto.requiere_trazabilidad && (
            <div className="flex items-center gap-2 col-span-2">
              <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
              <p className="text-xs text-green-700 font-medium">Requiere trazabilidad de partidas</p>
            </div>
          )}
        </div>
      </div>

      {/* Presentaciones */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Presentaciones
          <span className="ml-2 text-sm font-normal text-slate-400">
            ({presentaciones?.length ?? 0})
          </span>
        </h2>
        <PresentacionesManager
          productoId={producto.id}
          unidadBase={producto.unidad_base}
          presentaciones={presentaciones ?? []}
        />
      </div>
    </div>
  );
}
