'use client';

export interface TickerData {
  dolar:  number | null;
  maiz:   number | null;
  sorgo:  number | null;
  soja:   number | null;
  gasoil: number | null;
  uta:    number | null;
}

export default function PriceTicker({ data }: { data: TickerData }) {
  const items = [
    { label: 'Dólar BNA', value: data.dolar,  decimals: 2, unit: '',    color: 'text-amber-400'   },
    { label: 'Maíz',      value: data.maiz,   decimals: 0, unit: '/tn', color: 'text-yellow-300'  },
    { label: 'Sorgo',     value: data.sorgo,  decimals: 0, unit: '/tn', color: 'text-orange-300'  },
    { label: 'Soja',      value: data.soja,   decimals: 0, unit: '/tn', color: 'text-emerald-400' },
    { label: 'Gasoil',    value: data.gasoil, decimals: 3, unit: '/L',  color: 'text-blue-300'    },
    { label: 'UTA',       value: data.uta,    decimals: 0, unit: '',    color: 'text-violet-300'  },
  ].filter(i => i.value != null) as { label: string; value: number; decimals: number; unit: string; color: string }[];

  if (items.length === 0) return null;

  const formatted = items.map(i => ({
    label: i.label,
    value: `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: i.decimals, maximumFractionDigits: i.decimals }).format(i.value)}${i.unit}`,
    color: i.color,
  }));

  const doubled = [...formatted, ...formatted];

  return (
    <div className="h-7 bg-zinc-900 border-t border-white/[0.06] overflow-hidden flex items-center">
      <div
        className="flex items-center whitespace-nowrap will-change-transform"
        style={{ animation: `ticker-scroll ${items.length * 5}s linear infinite` }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {item.label}
            </span>
            <span className={`text-[11px] font-bold ${item.color}`}>
              {item.value}
            </span>
            <span className="text-zinc-700 ml-1 text-xs">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
