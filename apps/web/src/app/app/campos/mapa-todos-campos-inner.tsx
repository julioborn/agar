'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import { Search, Locate, Layers, X, ChevronDown, ChevronUp } from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

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
}

// ── Tiles ────────────────────────────────────────────────────────────────────

const TILE_SAT = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri &mdash; Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
};
const TILE_LABELS = {
  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
};
const TILE_OSM = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

// Paleta de colores por campo (se reutiliza si hay más campos que colores)
const COLORES_CAMPO = [
  '#22c55e', // verde
  '#3b82f6', // azul
  '#f59e0b', // ámbar
  '#ef4444', // rojo
  '#8b5cf6', // violeta
  '#06b6d4', // cyan
  '#ec4899', // rosa
  '#84cc16', // lima
  '#f97316', // naranja
  '#14b8a6', // teal
];

const getColorCampo = (i: number) => COLORES_CAMPO[i % COLORES_CAMPO.length];

const ARG_CENTER: [number, number] = [-38.4, -63.6];
const ARG_ZOOM = 5;

// ── Componente ────────────────────────────────────────────────────────────────

export default function MapaTodosCamposInner({ campos }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const tileRef      = useRef<L.TileLayer | null>(null);
  const labelsRef    = useRef<L.TileLayer | null>(null);
  // campoId → lista de layers de sus lotes
  const campoLayers  = useRef<Map<string, L.Polygon[]>>(new Map());

  const [ready,     setReady]     = useState(false);
  const [satellite, setSatellite] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  // Geocoder
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<any[]>([]);
  const [geocoding,   setGeocoding]   = useState(false);
  const [showResults, setShowResults] = useState(false);

  // ── Init mapa ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if ((el as any)._leaflet_id != null) delete (el as any)._leaflet_id;

    const map = L.map(el, { center: ARG_CENTER, zoom: ARG_ZOOM, zoomControl: true });
    mapRef.current = map;

    tileRef.current  = L.tileLayer(TILE_SAT.url, { attribution: TILE_SAT.attribution, maxZoom: 19 }).addTo(map);
    labelsRef.current = L.tileLayer(TILE_LABELS.url, { maxZoom: 19, opacity: 0.8 }).addTo(map);

    const allLayers: L.Layer[] = [];

    campos.forEach((campo, campoIdx) => {
      const color = getColorCampo(campoIdx);
      const layers: L.Polygon[] = [];

      campo.lotes.forEach((lote) => {
        if (!lote.coordenadas?.geometry?.coordinates?.[0]?.length) return;

        const ring = lote.coordenadas.geometry.coordinates[0];
        const latLngs = ring.map(([lng, lat]) => L.latLng(lat, lng));

        const poly = L.polygon(latLngs, {
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2.5,
        }).addTo(map);

        poly.bindTooltip(
          `<span style="font-size:11px;font-weight:700;color:#18181b">${campo.nombre}</span><br/><span style="font-size:11px;color:#52525b">${lote.nombre}</span>`,
          { permanent: false, direction: 'center', className: 'lote-map-label' },
        );

        poly.bindPopup(`
          <div style="min-width:180px;padding:2px 0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
              <p style="font-weight:700;font-size:13px;color:#18181b;margin:0;">${campo.nombre}</p>
            </div>
            <p style="font-size:12px;color:#52525b;margin:0 0 4px;">Lote: <strong>${lote.nombre}</strong></p>
            ${lote.hectareas ? `<p style="font-size:12px;color:#52525b;margin:0 0 8px;">${lote.hectareas.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha</p>` : ''}
            <a href="/app/campos/${campo.id}"
               style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#006836;text-decoration:none;">
              Ver lotes del campo →
            </a>
          </div>
        `, { closeButton: true, maxWidth: 220 });

        // Highlight on hover
        poly.on('mouseover', () => poly.setStyle({ fillOpacity: 0.45, weight: 3 }));
        poly.on('mouseout',  () => poly.setStyle({ fillOpacity: 0.2,  weight: 2.5 }));

        layers.push(poly);
        allLayers.push(poly);
      });

      campoLayers.current.set(campo.id, layers);
    });

    // Fit bounds a todos los polígonos
    if (allLayers.length > 0) {
      map.fitBounds(L.featureGroup(allLayers).getBounds(), { padding: [50, 50] });
    }

    setReady(true);

    return () => {
      map.remove();
      delete (el as any)._leaflet_id;
      mapRef.current = null;
      tileRef.current = null;
      labelsRef.current = null;
      campoLayers.current.clear();
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle tile ──────────────────────────────────────────────────────────────

  function toggleSatellite() {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    labelsRef.current?.remove();
    if (satellite) {
      tileRef.current  = L.tileLayer(TILE_OSM.url, { attribution: TILE_OSM.attribution, maxZoom: 19 }).addTo(map);
      labelsRef.current = null;
    } else {
      tileRef.current  = L.tileLayer(TILE_SAT.url, { attribution: TILE_SAT.attribution, maxZoom: 19 }).addTo(map);
      labelsRef.current = L.tileLayer(TILE_LABELS.url, { maxZoom: 19, opacity: 0.8 }).addTo(map);
    }
    setSatellite((s) => !s);
  }

  // ── Fly to campo ─────────────────────────────────────────────────────────────

  function flyToCampo(campoId: string) {
    const map = mapRef.current;
    if (!map) return;
    const layers = campoLayers.current.get(campoId);
    if (!layers?.length) return;
    map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [60, 60] });
  }

  // ── Geocoder ─────────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!query.trim() || !mapRef.current) return;
    setGeocoding(true);
    setShowResults(false);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6`,
        { headers: { 'Accept-Language': 'es' } },
      );
      setResults(await res.json());
      setShowResults(true);
    } catch { /* silencioso */ }
    setGeocoding(false);
  }

  function flyTo(r: any) {
    mapRef.current?.flyTo([parseFloat(r.lat), parseFloat(r.lon)], 14);
    setQuery(r.display_name.split(',').slice(0, 2).join(', '));
    setShowResults(false);
  }

  function locateMe() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      mapRef.current!.flyTo([coords.latitude, coords.longitude], 15);
    });
  }

  // ── Conteo de lotes con polígono por campo ────────────────────────────────────

  const lotesConPoligono = (campo: CampoGlobal) =>
    campo.lotes.filter((l) => !!l.coordenadas?.geometry?.coordinates?.[0]?.length).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Controles superiores */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-slate-700">Mapa general de campos y lotes</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSatellite}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
              satellite
                ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            {satellite ? 'Satélite' : 'Mapa'}
          </button>
        </div>
      </div>

      {/* Contenedor mapa */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ height: 560 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {!ready && (
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-10">
            <p className="text-slate-400 text-sm">Cargando mapa…</p>
          </div>
        )}

        {ready && (
          <>
            {/* Geocoder */}
            <div className="absolute top-3 left-14 z-[800] w-72">
              <div className="bg-white rounded-lg shadow-md border border-slate-200">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Buscar localidad, departamento…"
                    className="flex-1 text-sm outline-none text-slate-800 placeholder-slate-400 bg-transparent"
                  />
                  {geocoding
                    ? <span className="w-4 h-4 border-2 border-slate-200 border-t-green-400 rounded-full animate-spin shrink-0" />
                    : <button onClick={handleSearch} className="text-xs font-medium text-green-700 hover:text-green-900 shrink-0">Ir</button>
                  }
                </div>
                {showResults && (
                  <div className="border-t border-slate-100 max-h-52 overflow-y-auto">
                    {results.length > 0
                      ? results.map((r, i) => (
                        <button key={i} onClick={() => flyTo(r)}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0 leading-snug">
                          {r.display_name}
                        </button>
                      ))
                      : <p className="px-3 py-2 text-xs text-slate-400">Sin resultados</p>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Mi ubicación */}
            <div className="absolute top-3 right-3 z-[800]">
              <button
                onClick={locateMe}
                title="Usar mi ubicación"
                className="bg-white rounded-lg shadow-md border border-slate-200 p-2 hover:bg-slate-50 transition-colors"
              >
                <Locate className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* Panel campos */}
            <div
              className="absolute bottom-3 right-3 z-[800] w-60 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
              style={{ maxHeight: panelOpen ? 400 : 'auto' }}
            >
              <button
                onClick={() => setPanelOpen((v) => !v)}
                className="w-full px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Campos</p>
                {panelOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronUp   className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {panelOpen && (
                <div className="overflow-y-auto divide-y divide-slate-50" style={{ maxHeight: 350 }}>
                  {campos.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-slate-400 text-center">Sin campos registrados</p>
                  ) : (
                    campos.map((campo, idx) => {
                      const color = getColorCampo(idx);
                      const conPoly = lotesConPoligono(campo);
                      return (
                        <div key={campo.id} className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/50"
                              style={{ backgroundColor: color }}
                            />
                            <button
                              onClick={() => flyToCampo(campo.id)}
                              disabled={conPoly === 0}
                              className={cn(
                                'text-xs font-semibold text-slate-700 truncate flex-1 text-left transition-colors',
                                conPoly > 0 ? 'hover:text-[#006836]' : 'opacity-50 cursor-default',
                              )}
                              title={conPoly > 0 ? `Centrar en ${campo.nombre}` : 'Sin lotes en mapa'}
                            >
                              {campo.nombre}
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 ml-5 mt-0.5">
                            {conPoly} / {campo.lotes.length} lote{campo.lotes.length !== 1 ? 's' : ''} en mapa
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Imágenes © Esri &nbsp;·&nbsp;
        Tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">OpenStreetMap</a> contributors
      </p>
    </div>
  );
}
