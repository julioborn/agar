'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, MapPin, Package, Archive, Warehouse,
  ShoppingCart, Truck, Sprout, Briefcase, Building2,
  Users, Menu, Wheat,
  Tractor, Wrench, Settings, Building, Landmark, BarChart3,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// ── Estructura de navegación ───────────────────────────────────────────────────

const navSections: NavSection[] = [
  {
    label: 'Estructura',
    items: [
      { href: '/app/campos',      label: 'Campos y Lotes', icon: MapPin },
      { href: '/app/maquinarias', label: 'Maquinaria',     icon: Tractor },
    ],
  },
  {
    label: 'Insumos',
    items: [
      { href: '/app/depositos',   label: 'Depósitos',   icon: Archive },
      { href: '/app/proveedores', label: 'Proveedores', icon: Truck },
      { href: '/app/productos',   label: 'Productos',   icon: Package },
      { href: '/app/compras',     label: 'Compras',     icon: ShoppingCart },
      { href: '/app/stock',       label: 'Stock',       icon: Warehouse },
    ],
  },
  {
    label: 'Costos directos',
    items: [
      { href: '/app/cultivos',    label: 'Cultivos', icon: Sprout },
      { href: '/app/tipos-labor', label: 'Labores',  icon: Wrench },
    ],
  },
  {
    label: 'Costos Indirectos',
    items: [
      { href: '/app/costos-campo',   label: 'Costos de Campo',   icon: Building },
      { href: '/app/costos-empresa', label: 'Costos de empresa', icon: Landmark },
    ],
  },
  {
    label: 'Ingresos',
    items: [
      { href: '/app/produccion', label: 'Producción', icon: Wheat },
    ],
  },
  {
    label: 'Reportes',
    items: [
      { href: '/app/reportes/margenes', label: 'Reporte de márgenes', icon: BarChart3 },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { href: '/app/unidades-negocio', label: 'Unidades de Negocios',     icon: Briefcase },
      { href: '/app/configuracion',    label: 'Configuración de precios', icon: Settings },
    ],
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  esSuperAdmin: boolean;
  esAdmin?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function SidebarNav({
  esSuperAdmin,
  esAdmin = false,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const linkClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
      collapsed && 'justify-center px-0',
      active
        ? 'bg-[#006836] text-white'
        : 'text-zinc-400 hover:bg-white/5 hover:text-white',
    );

  return (
    <aside
      className={cn(
        'h-full bg-zinc-950 flex flex-col transition-all duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Toggle */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-white/5 shrink-0',
          collapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto overflow-x-hidden">

        {/* Inicio — sin grupo */}
        <Link
          href="/app"
          title={collapsed ? 'Inicio' : undefined}
          className={linkClass(isActive('/app', true))}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="truncate">Inicio</span>}
        </Link>

        {/* Secciones agrupadas */}
        {navSections.map((section, sIdx) => (
          <div key={section.label} className={cn('mt-4', sIdx === 0 && 'mt-3')}>
            {/* Encabezado de sección */}
            {!collapsed ? (
              <p className="px-3 mb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest select-none">
                {section.label}
              </p>
            ) : (
              <div className="my-2 mx-3 border-t border-white/5" />
            )}

            {/* Items de la sección */}
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={linkClass(isActive(href, exact))}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Usuarios (admin / superadmin) */}
        {(esAdmin || esSuperAdmin) && (
          <div className="mt-4">
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest select-none">
                Administración
              </p>
            )}
            {collapsed && <div className="my-2 mx-3 border-t border-white/5" />}

            <div className="space-y-0.5">
              <Link
                href="/app/usuarios"
                title={collapsed ? 'Usuarios' : undefined}
                className={linkClass(isActive('/app/usuarios'))}
              >
                <Users className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">Usuarios</span>}
              </Link>

              {esSuperAdmin && (
                <Link
                  href="/app/empresas"
                  title={collapsed ? 'Empresas' : undefined}
                  className={linkClass(isActive('/app/empresas'))}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">Empresas</span>}
                </Link>
              )}
            </div>
          </div>
        )}

      </nav>
    </aside>
  );
}
