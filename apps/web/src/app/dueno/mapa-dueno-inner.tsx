'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';

export interface LoteGlobal {
  id: string;
  nombre: string;
  hectareas: number;
  coordenadas: GeoJSON.Feature<GeoJSON.Polygon> | null;
}

export interface CampoGlobal {
  id: string;
  nombre: string;
  lotes: LoteGlobal[];
}

interface Props {
  campos: CampoGlobal[];
  onLoteClick?: (loteId: string, loteNombre: string, campoNombre: string) => void;
}

const TILE_SAT = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri',
};
const TILE_LABELS = {
  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
};
const TILE_OSM = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

const COLORES = [
  '#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6',
];

const getColor = (i: number) => COLORES[i % COLORES.length];
const ARG_CENTER: [number, number] = [-38.4, -63.6];

export default function MapaDuenoInner({ campos, onLoteClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const tileRef      = useRef<L.TileLayer | null>(null);
  const labelsRef    = useRef<L.TileLayer | null>(null);
  const campoLayers  = useRef<Map<string, L.Polygon[]>>(new Map());
  const lotePolyMap  = useRef<Map<string, { poly: L.Polygon; color: string }>>(new Map());

  const [ready,       setReady]       = useState(false);
  const [satellite,   setSatellite]   = useState(true);
  const [panelOpen,   setPanelOpen]   = useState(true);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);

  const numHa = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if ((el as any)._leaflet_id != null) delete (el as any)._leaflet_id;

    const map = L.map(el, { center: ARG_CENTER, zoom: 5, zoomControl: true });
    mapRef.current = map;

    tileRef.current   = L.tileLayer(TILE_SAT.url, { attribution: TILE_SAT.attribution, maxZoom: 19 }).addTo(map);
    labelsRef.current = L.tileLayer(TILE_LABELS.url, { maxZoom: 19, opacity: 0.8 }).addTo(map);

    const allLayers: L.Layer[] = [];

    campos.forEach((campo, idx) => {
      const color = getColor(idx);
      const layers: L.Polygon[] = [];

      campo.lotes.forEach((lote) => {
        if (!lote.coordenadas?.geometry?.coordinates?.[0]?.length) return;

        const ring   = lote.coordenadas.geometry.coordinates[0];
        const latLngs = ring.map(([lng, lat]) => L.latLng(lat, lng));

        const poly = L.polygon(latLngs, {
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2.5,
        }).addTo(map);

        poly.bindTooltip(
          `<span style="font-size:11px;font-weight:700;color:#18181b">${campo.nombre}</span><br/>
           <span style="font-size:11px;color:#52525b">${lote.nombre}</span>`,
          { permanent: false, direction: 'center', className: 'lote-map-label' },
        );

        poly.on('mouseover', () => {
          if (selectedId !== lote.id) poly.setStyle({ fillOpacity: 0.45, weight: 3 });
        });
        poly.on('mouseout', () => {
          if (selectedId !== lote.id) poly.setStyle({ fillOpacity: 0.2, weight: 2.5 });
        });
        poly.on('click', () => {
          // Resetear todos los polígonos
          lotePolyMap.current.forEach(({ poly: p, color: c }) =>
            p.setStyle({ color: c, fillColor: c, fillOpacity: 0.2, weight: 2.5 }),
          );
          // Destacar el lote seleccionado
          poly.setStyle({ color, fillColor: color, fillOpacity: 0.6, weight: 3.5 });
          setSelectedId(lote.id);
          onLoteClick?.(lote.id, lote.nombre, campo.nombre);
        });

        lotePolyMap.current.set(lote.id, { poly, color });
        layers.push(poly);
        allLayers.push(poly);
      });

      campoLayers.current.set(campo.id, layers);
    });

    if (allLayers.length > 0) {
      map.fitBounds(L.featureGroup(allLayers).getBounds(), { padding: [50, 50] });
    }

    setReady(true);

    return () => {
      map.remove();
      delete (el as any)._leaflet_id;
      mapRef.current = null;
      campoLayers.current.clear();
      lotePolyMap.current.clear();
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSatellite() {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    labelsRef.current?.remove();
    if (satellite) {
      tileRef.current   = L.tileLayer(TILE_OSM.url, { attribution: TILE_OSM.attribution, maxZoom: 19 }).addTo(map);
      labelsRef.current = null;
    } else {
      tileRef.current   = L.tileLayer(TILE_SAT.url, { attribution: TILE_SAT.attribution, maxZoom: 19 }).addTo(map);
      labelsRef.current = L.tileLayer(TILE_LABELS.url, { maxZoom: 19, opacity: 0.8 }).addTo(map);
    }
    setSatellite((s) => !s);
  }

  function flyToCampo(campoId: string) {
    const layers = campoLayers.current.get(campoId);
    if (!layers?.length || !mapRef.current) return;
    mapRef.current.fitBounds(L.featureGroup(layers).getBounds(), { padding: [60, 60] });
  }

  const lotesConPoligono = (campo: CampoGlobal) =>
    campo.lotes.filter((l) => !!l.coordenadas?.geometry?.coordinates?.[0]?.length).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={toggleSatellite}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
            satellite
              ? 'bg-slate-800 text-white border-slate-700'
              : 'bg-white text-slate-700 border-slate-300',
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          {satellite ? 'Satélite' : 'Mapa'}
        </button>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ height: 420 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {!ready && (
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-10">
            <p className="text-slate-400 text-sm">Cargando mapa…</p>
          </div>
        )}

        {ready && (
          <div
            className="absolute bottom-3 right-3 z-[800] w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
            style={{ maxHeight: panelOpen ? 380 : 'auto' }}
          >
            <button
              onClick={() => setPanelOpen((v) => !v)}
              className="w-full px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between"
            >
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Campos</p>
              {panelOpen
                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                : <ChevronUp   className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {panelOpen && (
              <div className="overflow-y-auto divide-y divide-slate-50" style={{ maxHeight: 320 }}>
                {campos.length === 0
                  ? <p className="px-3 py-4 text-xs text-slate-400 text-center">Sin campos</p>
                  : campos.map((campo, idx) => {
                    const color   = getColor(idx);
                    const conPoly = lotesConPoligono(campo);
                    return (
                      <div key={campo.id} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <button
                            onClick={() => flyToCampo(campo.id)}
                            disabled={conPoly === 0}
                            className={cn(
                              'text-xs font-semibold text-slate-700 truncate flex-1 text-left',
                              conPoly > 0 ? 'hover:text-[#006836]' : 'opacity-40 cursor-default',
                            )}
                          >
                            {campo.nombre}
                          </button>
                        </div>
                        <div className="ml-5 mt-1 space-y-0.5">
                          {campo.lotes.map((l) => (
                            <p key={l.id} className={cn(
                              'text-[11px] truncate cursor-pointer transition-colors',
                              selectedId === l.id
                                ? 'text-[#006836] font-semibold'
                                : 'text-slate-400 hover:text-slate-600',
                            )}>
                              {l.nombre}{l.hectareas ? ` · ${numHa.format(l.hectareas)} ha` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
