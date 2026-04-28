'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type Currency = 'ARS' | 'USD';

interface CurrencyCtx {
  currency: Currency;
  usdRate: number | null;
  toggle: () => void;
  formatMoney: (ars: number | null) => string;
}

const Ctx = createContext<CurrencyCtx>({
  currency: 'ARS',
  usdRate: null,
  toggle: () => {},
  formatMoney: () => '—',
});

const fmtARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtUSD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function CurrencyProvider({ children, usdRate }: { children: React.ReactNode; usdRate: number | null }) {
  const [currency, setCurrency] = useState<Currency>('ARS');

  useEffect(() => {
    const v = localStorage.getItem('agro_currency') as Currency | null;
    if (v === 'ARS' || v === 'USD') setCurrency(v);
  }, []);

  function toggle() {
    if (!usdRate) return;
    setCurrency(c => {
      const next: Currency = c === 'ARS' ? 'USD' : 'ARS';
      localStorage.setItem('agro_currency', next);
      return next;
    });
  }

  function formatMoney(ars: number | null): string {
    if (ars == null) return '—';
    if (currency === 'USD' && usdRate && usdRate > 0) return fmtUSD.format(ars / usdRate);
    return fmtARS.format(ars);
  }

  return (
    <Ctx.Provider value={{ currency, usdRate, toggle, formatMoney }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrency() {
  return useContext(Ctx);
}

export function Money({ ars, className }: { ars: number | null; className?: string }) {
  const { formatMoney } = useCurrency();
  return <span className={className}>{formatMoney(ars)}</span>;
}
