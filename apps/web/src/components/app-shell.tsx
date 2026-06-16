'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmpresaSelector from './empresa-selector';
import LogoutButton from './logout-button';
import SidebarNav from './sidebar-nav';
import { CurrencyProvider, useCurrency } from '@/lib/currency-context';
import { createClient } from '@/lib/supabase/client';
import type { EmpresaConRol } from '@/lib/empresa-actual';
import PriceTicker, { type TickerData } from './price-ticker';

interface Props {
  children: React.ReactNode;
  userEmail: string;
  empresaActiva: EmpresaConRol;
  todasLasEmpresas: EmpresaConRol[];
  esSuperAdmin: boolean;
  esAdmin: boolean;
  usdRate: number | null;
  tickerData: TickerData;
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
  children, userEmail, empresaActiva, todasLasEmpresas, esSuperAdmin, esAdmin, usdRate, tickerData,
}: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen, setSidebarOpen]           = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Cuando la PWA vuelve al primer plano (visibilitychange visible),
  // verificamos que la sesión siga activa y la renovamos si es necesario.
  // Cubre el caso de app suspendida por mucho tiempo sin ser matada.
  useEffect(() => {
    const supabase = createClient();

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Intentamos renovar antes de forzar login
        const { data } = await supabase.auth.refreshSession();
        if (!data.session) {
          router.push('/login');
        } else {
          router.refresh(); // sincronizar estado del servidor con nuevas cookies
        }
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') checkSession();
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [router]);

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
          <header
            className="shrink-0 bg-zinc-950"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {/* Barra principal */}
            <div className="h-14 flex items-center px-3 gap-2">

              {/* Izquierda: hamburger + logo (mobile) */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Abrir menú"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <Link href="/app" className="lg:hidden">
                  <Image src="/agar-final.png" alt="AGAR" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                </Link>
              </div>

              {/* Centro: logo desktop */}
              <div className="flex-1 hidden lg:flex justify-center">
                <Link href="/app">
                  <Image src="/agar-final.png" alt="AGAR" width={44} height={44} className="h-10 w-10 rounded-full object-cover" />
                </Link>
              </div>

              {/* Spacer mobile */}
              <div className="flex-1 lg:hidden" />

              {/* Derecha: toggle moneda + logout */}
              <div className="flex items-center gap-2 shrink-0">
                <CurrencyToggle />
                <LogoutButton />
              </div>
            </div>

            {/* Ticker de precios */}
            <PriceTicker data={tickerData} />
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50">
            {children}
          </main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
