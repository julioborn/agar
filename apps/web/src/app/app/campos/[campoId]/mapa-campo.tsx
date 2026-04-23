'use client';

import dynamic from 'next/dynamic';

// Leaflet requiere window/document → carga solo en cliente
const MapaCampoInner = dynamic(() => import('./mapa-campo-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Cargando mapa…</p>
    </div>
  ),
});

export default MapaCampoInner;
