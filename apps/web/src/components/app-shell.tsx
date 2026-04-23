'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmpresaSelector from './empresa-selector';
import LogoutButton from './logout-button';
import SidebarNav from './sidebar-nav';
import type { EmpresaConRol } from '@/lib/empresa-actual';

interface Props {
  children: React.ReactNode;
  userEmail: string;
  empresaActiva: EmpresaConRol;
  todasLasEmpresas: EmpresaConRol[];
  esSuperAdmin: boolean;
  esAdmin: boolean;
}

export default function AppShell({
  children, userEmail, empresaActiva, todasLasEmpresas, esSuperAdmin, esAdmin,
}: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen]           = useState(false);   // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);   // desktop collapse

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
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
        <header className="h-20 shrink-0 bg-zinc-900 flex items-center px-4 relative">

          {/* Izquierda: hamburger mobile + empresa */}
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
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5  pointer-events-none select-none">
            <Image src="/agar2.png" alt="agar" width={140} height={115}/>
          </div>

          {/* Derecha: email + logout */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {/* <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-500 text-xs hidden sm:inline shrink-0">Empresa</span>
              <EmpresaSelector empresas={todasLasEmpresas} empresaActivaId={empresaActiva.id} />
            </div> */}
            {/* <span className="hidden md:block text-xs text-zinc-500 max-w-[180px] truncate">{userEmail}</span> */}
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50">
          {children}
        </main>
      </div>
    </div>
  );
}
