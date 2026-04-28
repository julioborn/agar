'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmpresaSelector from './empresa-selector';
import LogoutButton from './logout-button';
import SidebarNav from './sidebar-nav';
import { CurrencyProvider, useCurrency } from '@/lib/currency-context';
import type { EmpresaConRol } from '@/lib/empresa-actual';

interface Props {
  children: React.ReactNode;
  userEmail: string;
  empresaActiva: EmpresaConRol;
  todasLasEmpresas: EmpresaConRol[];
  esSuperAdmin: boolean;
  esAdmin: boolean;
  usdRate: number | null;
}

function CurrencyToggle() {
  const { currency, usdRate, toggle } = useCurrency();
  if (!usdRate) return null;

  return (
    <button
      onClick={toggle}
      title={`Cambiar a ${currency === 'ARS' ? 'USD' : 'ARS'}`}
      className="flex items-center h-7 rounded-full bg-white/10 border border-white/10 p-0.5 gap-0.5 hover:bg-white/15 transition-colors"
    >
      <span className={cn(
        'px-2.5 h-full flex items-center rounded-full text-xs font-bold transition-all duration-150',
        currency === 'ARS' ? 'bg-white text-zinc-800' : 'text-white/40',
      )}>
        ARS
      </span>
      <span className={cn(
        'px-2.5 h-full flex items-center rounded-full text-xs font-bold transition-all duration-150',
        currency === 'USD' ? 'bg-amber-400 text-zinc-900' : 'text-white/40',
      )}>
        USD
      </span>
    </button>
  );
}

export default function AppShell({
  children, userEmail, empresaActiva, todasLasEmpresas, esSuperAdmin, esAdmin, usdRate,
}: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen]           = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <CurrencyProvider usdRate={usdRate}>
      <div className="flex h-screen bg-zinc-50 overflow-hidden">

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={cn(
          'fixed inset-y-0 left-0 z-30 lg:relative lg:translate-x-0 lg:z-auto transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}>
          <SidebarNav
            esSuperAdmin={esSuperAdmin}
            esAdmin={esAdmin}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(v => !v)}
          />
        </div>

        {/* Main column */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Header */}
          <header className="h-20 shrink-0 bg-zinc-950 flex items-center px-4 relative">

            {/* Izquierda: hamburger mobile */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                aria-label="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* Centro: logo */}
            <div className="fixed left-1/2 -translate-x-1/2 top-0 h-14 flex items-center gap-2.5 pointer-events-none select-none z-10">
              <Image src="/agar6.png" alt="agar" width={120} height={120} className="h-22 mt-5 w-auto" />
            </div>

            {/* Derecha: toggle moneda + logout */}
            <div className="ml-auto flex items-center gap-3 shrink-0">
              <CurrencyToggle />
              <LogoutButton />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50">
            {children}
          </main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
