'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  stats?: { label: string; value: React.ReactNode }[];
  borderColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleCard({
  icon, iconBg, title, subtitle, badge, stats, borderColor = 'border-zinc-100', defaultOpen = false, children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('bg-white rounded-2xl border shadow-sm overflow-hidden', borderColor)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-zinc-50/60 transition-colors"
      >
        <div className={cn('flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0', iconBg)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-zinc-800">{title}</span>
            {badge}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
          {!open && stats && stats.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-1.5">
              {stats.map(s => (
                <span key={s.label} className="text-xs text-zinc-500">
                  <span className="text-zinc-300">{s.label}:</span> {s.value}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-zinc-100">
          {children}
        </div>
      )}
    </div>
  );
}
