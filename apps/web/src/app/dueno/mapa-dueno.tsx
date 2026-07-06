'use client';

import dynamic from 'next/dynamic';
import type { CampoGlobal } from './mapa-dueno-inner';

const MapaDuenoInner = dynamic(() => import('./mapa-dueno-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Cargando mapa…</p>
    </div>
  ),
});

interface Props {
  campos: CampoGlobal[];
  onLoteClick?: (loteId: string, loteNombre: string, campoNombre: string) => void;
}

export default function MapaDueno({ campos, onLoteClick }: Props) {
  return <MapaDuenoInner campos={campos} onLoteClick={onLoteClick} />;
}
