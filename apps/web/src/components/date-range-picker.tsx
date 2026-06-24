'use client';

import { useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { es } from 'react-day-picker/locale/es';
import 'react-day-picker/style.css';
import { Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  desde: string; // 'YYYY-MM-DD' o ''
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  className?: string;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromISO(s: string): Date | undefined {
  return s ? new Date(s + 'T00:00:00') : undefined;
}
function fmtCorto(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Selector de rango de fechas en un solo campo (estilo reserva de vuelos/hoteles):
// se abre un calendario, se elige fecha de inicio y de fin, y se confirma con "Aplicar".
export default function DateRangePicker({ desde, hasta, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    desde || hasta ? { from: fromISO(desde), to: fromISO(hasta) } : undefined,
  );

  function abrir() {
    setDraft(desde || hasta ? { from: fromISO(desde), to: fromISO(hasta) } : undefined);
    setOpen(true);
  }

  function aplicar() {
    onChange(draft?.from ? toISO(draft.from) : '', draft?.to ? toISO(draft.to) : '');
    setOpen(false);
  }

  function limpiar() {
    setDraft(undefined);
    onChange('', '');
    setOpen(false);
  }

  const activo = !!(desde || hasta);
  const label = desde && hasta
    ? `${fmtCorto(desde)} – ${fmtCorto(hasta)}`
    : desde
    ? `Desde ${fmtCorto(desde)}`
    : hasta
    ? `Hasta ${fmtCorto(hasta)}`
    : 'Todas las fechas';

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={cn(
          'w-full text-sm border rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors',
          activo
            ? 'border-[#006836]/40 text-[#006836] bg-[#006836]/5'
            : 'border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50',
          className,
        )}
      >
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-sm max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-zinc-700">Seleccionar fechas</p>
              <button onClick={() => setOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <DayPicker
              mode="range"
              selected={draft}
              onSelect={setDraft}
              locale={es}
              numberOfMonths={1}
              defaultMonth={draft?.from ?? new Date()}
              className="mx-auto"
              style={{ '--rdp-accent-color': '#006836', '--rdp-accent-background-color': 'rgba(0,104,54,0.12)' } as React.CSSProperties}
            />

            <div className="flex items-center justify-between gap-2 mt-2 pt-3 border-t border-zinc-100">
              <button onClick={limpiar} className="text-xs text-zinc-400 hover:text-red-500">
                Limpiar
              </button>
              <button
                onClick={aplicar}
                className="px-4 py-1.5 bg-[#006836] hover:bg-[#005228] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
