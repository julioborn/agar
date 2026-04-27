'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, MapPin, Package, Archive, Warehouse,
  ShoppingCart, Truck, Sprout, Briefcase, Building2,
  Users, Calendar, ChevronRight, Menu, Wheat,
  Tractor, Wrench, Settings,
} from 'lucide-react';

const navItems = [
  { href: '/app',                  label: 'Inicio',              icon: LayoutDashboard, exact: true },
  { href: '/app/campos',           label: 'Campos y Lotes',      icon: MapPin },
  { href: '/app/cultivos',         label: 'Cultivos',            icon: Sprout },
  { href: '/app/produccion',       label: 'Producción',          icon: Wheat },
  { href: '/app/campanias',        label: 'Campañas',            icon: Calendar },
  { href: '/app/maquinarias',      label: 'Maquinarias',         icon: Tractor },
  { href: '/app/tipos-labor',      label: 'Tipos de Labor',      icon: Wrench },
  { href: '/app/productos',        label: 'Productos',           icon: Package },
  { href: '/app/depositos',        label: 'Depósitos',           icon: Archive },
  { href: '/app/stock',            label: 'Stock',               icon: Warehouse },
  { href: '/app/compras',          label: 'Compras',             icon: ShoppingCart },
  { href: '/app/proveedores',      label: 'Proveedores',         icon: Truck },
  { href: '/app/unidades-negocio', label: 'Unidades de negocio', icon: Briefcase },
  { href: '/app/configuracion',    label: 'Configuración',       icon: Settings },
];

const adminItems = [
  { href: '/app/empresas', label: 'Empresas', icon: Building2 },
];

interface Props {
  esSuperAdmin: boolean;
  esAdmin?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function SidebarNav({ esSuperAdmin, esAdmin = false, collapsed = false, onToggleCollapse }: Props) {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside className={cn(
      'h-full bg-zinc-950 flex flex-col transition-all duration-200 ease-in-out',
      collapsed ? 'w-16' : 'w-60',
    )}>
      {/* Logo + toggle */}
      <div className={cn(
        'h-20 flex items-center border-b border-white/5 shrink-0 gap-2',
        collapsed ? 'justify-center px-2' : 'px-3 justify-between',
      )}>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-[#006836] text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}

        {(esAdmin || esSuperAdmin) && (
          <Link
            href="/app/usuarios"
            title={collapsed ? 'Usuarios' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive('/app/usuarios')
                ? 'bg-[#006836] text-white'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white',
            )}
          >
            <Users className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Usuarios</span>}
          </Link>
        )}

        {esSuperAdmin && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Admin</p>
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-white/5" />}
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive(href)
                    ? 'bg-[#006836] text-white'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            ))}
          </>
        )}
      </nav>

    </aside>
  );
}
