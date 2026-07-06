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

export default function MapaDueno({ campos }: { campos: CampoGlobal[] }) {
  return <MapaDuenoInner campos={campos} />;
}
