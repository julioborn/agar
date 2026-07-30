'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Sprout, Package, ShoppingCart, MapPin, Warehouse, FileUp, FileText,
  Beef, Fence, Rows3, Tag, BarChart3, ChevronDown, TrendingUp,
} from 'lucide-react';

interface QuickLink {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  primary?: boolean;
}

interface Props { esLector: boolean }

export default function AccesosRapidos({ esLector }: Props) {
  const [seccion, setSeccion] = useState<'agricultura' | 'ganaderia' | null>(null);

  const agricultura: QuickLink[] = [
    ...(!esLector ? [{ href: '/app/ria/nuevo', title: 'Nuevo RIA', subtitle: 'Remito interno agrícola', icon: FileText, primary: true }] : []),
    ...(!esLector ? [{ href: '/app/compras/importar', title: 'Importar factura', subtitle: 'PDF o Excel con IA', icon: FileUp }] : []),
    ...(!esLector ? [{ href: '/app/compras/nueva', title: 'Registrar compra', subtitle: 'Carga manual', icon: ShoppingCart }] : []),
    { href: '/app/cultivos', title: 'Cultivos', subtitle: 'Ver campañas', icon: Sprout },
    { href: '/app/campos', title: 'Campos', subtitle: 'Lotes y mapas', icon: MapPin },
    ...(!esLector ? [{ href: '/app/stock', title: 'Stock', subtitle: 'Inventario actual', icon: Warehouse }] : []),
    ...(!esLector ? [{ href: '/app/productos', title: 'Productos', subtitle: 'Catálogo e insumos', icon: Package }] : []),
  ];

  const ganaderia: QuickLink[] = [
    ...(!esLector ? [{ href: '/app/ganaderia/remitos/nuevo', title: 'Nuevo remito', subtitle: 'Remito interno ganadero', icon: FileText, primary: true }] : []),
    { href: '/app/ganaderia/lotes', title: 'Lotes de hacienda', subtitle: 'Rodeos y estado', icon: Beef },
    { href: '/app/ganaderia/corrales', title: 'Corrales', subtitle: 'Feedlot / intensivo', icon: Fence },
    { href: '/app/ganaderia/potreros', title: 'Potreros', subtitle: 'Campo abierto', icon: Rows3 },
    { href: '/app/ganaderia/categorias', title: 'Categorías', subtitle: 'Clasificación de hacienda', icon: Tag },
    { href: '/app/ganaderia/remitos', title: 'Remitos ganaderos', subtitle: 'Historial', icon: FileText },
  ];

  const links = seccion === 'agricultura' ? agricultura : seccion === 'ganaderia' ? ganaderia : [];
  const acento = seccion === 'ganaderia' ? 'carne' : 'green';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-[#006836]" />
        <h2 className="text-md font-semibold text-zinc-500 tracking-wider">Accesos rápidos</h2>
      </div>

      {/* Selector Agricultura / Ganadería */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSeccion(seccion === 'agricultura' ? null : 'agricultura')}
          className={cn(
            'flex items-center gap-3 sm:gap-4 rounded-2xl border p-4 sm:p-5 transition-all duration-200 text-left',
            seccion === 'agricultura'
              ? 'bg-gradient-to-br from-[#004d24] to-[#006836] border-[#006836] shadow-lg shadow-[#006836]/20'
              : 'bg-white border-zinc-100 hover:border-[#006836]/30 hover:shadow-md',
          )}
        >
          <div className={cn('w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0', seccion === 'agricultura' ? 'bg-white/15' : 'bg-[#006836]/10')}>
            <Sprout className={cn('w-5 h-5 sm:w-6 sm:h-6', seccion === 'agricultura' ? 'text-white' : 'text-[#006836]')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('font-bold text-sm sm:text-base', seccion === 'agricultura' ? 'text-white' : 'text-zinc-800')}>Agricultura</p>
            <p className={cn('text-xs mt-0.5 truncate', seccion === 'agricultura' ? 'text-white/60' : 'text-zinc-400')}>Cultivos, RIA, stock e insumos</p>
          </div>
          <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', seccion === 'agricultura' ? 'text-white rotate-180' : 'text-zinc-300')} />
        </button>

        <button
          type="button"
          onClick={() => setSeccion(seccion === 'ganaderia' ? null : 'ganaderia')}
          className={cn(
            'flex items-center gap-3 sm:gap-4 rounded-2xl border p-4 sm:p-5 transition-all duration-200 text-left',
            seccion === 'ganaderia'
              ? 'bg-gradient-to-br from-[#7a2020] to-[#a83a3a] border-[#7a2020] shadow-lg shadow-[#7a2020]/25'
              : 'bg-white border-zinc-100 hover:border-[#a83a3a]/30 hover:shadow-md',
          )}
        >
          <div className={cn('w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0', seccion === 'ganaderia' ? 'bg-white/15' : 'bg-[#a83a3a]/10')}>
            <Beef className={cn('w-5 h-5 sm:w-6 sm:h-6', seccion === 'ganaderia' ? 'text-white' : 'text-[#a83a3a]')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('font-bold text-sm sm:text-base', seccion === 'ganaderia' ? 'text-white' : 'text-zinc-800')}>Ganadería</p>
            <p className={cn('text-xs mt-0.5 truncate', seccion === 'ganaderia' ? 'text-white/60' : 'text-zinc-400')}>Corrales, potreros y rodeos</p>
          </div>
          <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', seccion === 'ganaderia' ? 'text-white rotate-180' : 'text-zinc-300')} />
        </button>
      </div>

      {/* Opciones de la sección elegida */}
      {seccion && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={cn('group', link.primary && 'col-span-2 sm:col-span-1')}>
              <div className={cn(
                'rounded-2xl border p-5 flex flex-col justify-between h-full transition-all duration-200',
                link.primary
                  ? acento === 'green'
                    ? 'bg-[#006836] border-[#006836] hover:bg-[#005228] shadow-sm'
                    : 'bg-[#a83a3a] border-[#a83a3a] hover:bg-[#8f2f2f] shadow-sm'
                  : cn(
                      'bg-white border-zinc-100 hover:shadow-sm',
                      acento === 'green' ? 'hover:border-[#006836]/30' : 'hover:border-[#a83a3a]/30',
                    ),
              )}>
                <link.icon className={cn('w-5 h-5', link.primary ? 'text-white' : acento === 'green' ? 'text-[#006836]' : 'text-[#a83a3a]')} />
                <div className="mt-6">
                  <p className={cn('font-semibold text-sm', link.primary ? 'text-white' : 'text-zinc-800')}>{link.title}</p>
                  <p className={cn('text-xs mt-0.5', link.primary ? 'text-white/60' : 'text-zinc-400')}>{link.subtitle}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Reportes: acceso persistente para el rol de solo lectura */}
      {esLector && (
        <Link href="/app/reportes" className="group block mt-3">
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-4 hover:border-[#006836]/30 hover:shadow-sm transition-all duration-200">
            <div className="w-9 h-9 rounded-xl bg-[#006836]/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-[#006836]" />
            </div>
            <div>
              <p className="text-zinc-800 font-semibold text-sm">Reportes</p>
              <p className="text-zinc-400 text-xs mt-0.5">Márgenes y análisis</p>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
