'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FlaskConical, ClipboardList } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/campo',          label: 'Inicio',   Icon: Home },
  { href: '/campo/aplicar',  label: 'Aplicar',  Icon: FlaskConical },
  { href: '/campo/historial', label: 'Historial', Icon: ClipboardList },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== '/campo' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 min-h-[56px] text-xs font-medium transition-colors ${
              active ? 'text-green-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? 'stroke-green-700' : ''}`} strokeWidth={active ? 2.5 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
