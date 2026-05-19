'use client';

import dynamic from 'next/dynamic';
import type { CampoGlobal } from './mapa-todos-campos-inner';

const MapaTodosCamposInner = dynamic(() => import('./mapa-todos-campos-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[560px] bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Cargando mapa…</p>
    </div>
  ),
});

interface Props {
  campos: CampoGlobal[];
}

export default function MapaTodosCampos({ campos }: Props) {
  return <MapaTodosCamposInner campos={campos} />;
}
