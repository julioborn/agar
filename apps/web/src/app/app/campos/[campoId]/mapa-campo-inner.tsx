'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Search, Locate, Pencil, Trash2, X, MapPin,
  CheckCircle, Layers, Upload, AlertCircle,
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LoteConCoords {
  id: string;
  nombre: string;
  hectareas: number;
  coordenadas: GeoJSON.Feature<GeoJSON.Polygon> | null;
}

export interface CampoConCentro {
  id: string;
  nombre: string;
  centro_lat: number | null;
  centro_lng: number | null;
  zoom: number | null;
}

interface ImportedPolygon {
  idx: number;
  nombre: string;
  geo: GeoJSON.Feature<GeoJSON.Polygon>;
  asignadoA: string; // loteId o '' (sin asignar)
}

interface Props {
  campo: CampoConCentro;
  lotes: LoteConCoords[];
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

// ── Colores para lotes ────────────────────────────────────────────────────────

const COLORES = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const getColor = (i: number) => COLORES[i % COLORES.length];

const ARG_CENTER: [number, number] = [-38.4, -63.6];
const ARG_ZOOM = 5;

// ── Helpers GeoJSON ───────────────────────────────────────────────────────────

function extractPolygons(
  raw: GeoJSON.GeoJSON,
  sourceName = 'Polígono',
): Array<{ nombre: string; geo: GeoJSON.Feature<GeoJSON.Polygon> }> {
  const out: Array<{ nombre: string; geo: GeoJSON.Feature<GeoJSON.Polygon> }> = [];

  function push(feat: GeoJSON.Feature, geom: GeoJSON.Polygon) {
    out.push({
      nombre: (feat.properties?.name ?? feat.properties?.Name ?? sourceName) as string,
      geo: { type: 'Feature', properties: feat.properties ?? {}, geometry: geom },
    });
  }

  function processFeature(feat: GeoJSON.Feature) {
    if (!feat.geometry) return;
    if (feat.geometry.type === 'Polygon') {
      push(feat, feat.geometry);
    } else if (feat.geometry.type === 'MultiPolygon') {
      feat.geometry.coordinates.forEach((coords, i) => {
        push(
          { ...feat, properties: { ...feat.properties, name: `${feat.properties?.name ?? sourceName} ${i + 1}` } },
          { type: 'Polygon', coordinates: coords },
        );
      });
    }
  }

  if (raw.type === 'FeatureCollection') {
    raw.features.forEach(processFeature);
  } else if (raw.type === 'Feature') {
    processFeature(raw as GeoJSON.Feature);
  } else if (raw.type === 'Polygon') {
    out.push({ nombre: sourceName, geo: { type: 'Feature', properties: {}, geometry: raw as GeoJSON.Polygon } });
  }

  return out;
}

async function parseFile(
  file: File,
): Promise<Array<{ nombre: string; geo: GeoJSON.Feature<GeoJSON.Polygon> }>> {
  const name = file.name.toLowerCase();

  // ── GeoJSON / JSON ──────────────────────────────────────────────────────
  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    const text = await file.text();
    return extractPolygons(JSON.parse(text), file.name);
  }

  // ── KML ─────────────────────────────────────────────────────────────────
  if (name.endsWith('.kml')) {
    const text = await file.text();
    const { kml } = await import('@tmcw/togeojson');
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    return extractPolygons(kml(doc) as GeoJSON.GeoJSON, file.name);
  }

  // ── KMZ (ZIP con KML dentro) ─────────────────────────────────────────────
  if (name.endsWith('.kmz')) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const kmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'));
    if (!kmlFile) throw new Error('No se encontró un archivo KML dentro del KMZ.');
    const text = await kmlFile.async('text');
    const { kml } = await import('@tmcw/togeojson');
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    return extractPolygons(kml(doc) as GeoJSON.GeoJSON, file.name);
  }

  throw new Error(`Formato no soportado: ${file.name}. Usá GeoJSON, KML o KMZ.`);
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function MapaCampoInner({ campo, lotes: initialLotes }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const tileRef       = useRef<L.TileLayer | null>(null);
  const labelsRef     = useRef<L.TileLayer | null>(null);
  const layerMap      = useRef<Map<string, L.Polygon>>(new Map());
  const importLayers  = useRef<Map<number, L.Polygon>>(new Map());
  const activeLoteRef = useRef<string | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [ready,         setReady]         = useState(false);
  const [satellite,     setSatellite]     = useState(true);
  const [lotes,         setLotes]         = useState<LoteConCoords[]>(initialLotes);
  const [activeLoteId,  setActiveLoteId]  = useState<string | null>(null);
  const [editingLoteId, setEditingLoteId] = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [centerDirty,   setCenterDirty]   = useState(false);
  const centerRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  // Geocoder
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<any[]>([]);
  const [geocoding,   setGeocoding]   = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [panelVisible, setPanelVisible] = useState(true);

  // Importar
  const [importing,         setImporting]         = useState(false);
  const [importedPolygons,  setImportedPolygons]  = useState<ImportedPolygon[]>([]);
  const [importError,       setImportError]       = useState('');
  const [savingImport,      setSavingImport]      = useState(false);

  // ── Inicialización manual del mapa ────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Limpiar stale _leaflet_id (Strict Mode / HMR)
    if ((el as any)._leaflet_id != null) delete (el as any)._leaflet_id;

    const initCenter: [number, number] =
      campo.centro_lat != null && campo.centro_lng != null
        ? [campo.centro_lat, campo.centro_lng]
        : ARG_CENTER;

    const map = L.map(el, { center: initCenter, zoom: campo.zoom ?? ARG_ZOOM, zoomControl: true });
    mapRef.current = map;

    // Tile base: satélite por defecto
    tileRef.current = L.tileLayer(TILE_SAT.url, { attribution: TILE_SAT.attribution, maxZoom: 19 }).addTo(map);
    labelsRef.current = L.tileLayer(TILE_LABELS.url, { maxZoom: 19, opacity: 0.8 }).addTo(map);

    // Geoman (solo API programática)
    (map as any).pm.setGlobalOptions({ snappable: true, snapDistance: 20 });

    map.on('pm:create', async (e: any) => {
      const loteId = activeLoteRef.current;
      if (!loteId) { e.layer.remove(); return; }

      const geo = (e.layer as L.Polygon).toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>;
      e.layer.remove();

      const idx = initialLotes.findIndex(l => l.id === loteId);
      addLayerToMap(map, loteId, geo, idx >= 0 ? idx : 0);

      setSaving(true);
      await createClient().from('lotes').update({ coordenadas: geo }).eq('id', loteId);
      setSaving(false);

      setLotes(prev => prev.map(l => l.id === loteId ? { ...l, coordenadas: geo } : l));
      activeLoteRef.current = null;
      setActiveLoteId(null);
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      centerRef.current = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      setCenterDirty(true);
    });

    // Polígonos existentes
    initialLotes.forEach((lote, idx) => {
      if (lote.coordenadas) addLayerToMap(map, lote.id, lote.coordenadas, idx);
    });

    if (!campo.centro_lat && initialLotes.some(l => l.coordenadas)) {
      const all: L.Layer[] = [];
      layerMap.current.forEach(l => all.push(l));
      if (all.length) map.fitBounds(L.featureGroup(all).getBounds(), { padding: [40, 40] });
    }

    setReady(true);

    return () => {
      map.remove();
      delete (el as any)._leaflet_id;
      mapRef.current = null;
      tileRef.current = null;
      labelsRef.current = null;
      layerMap.current.clear();
      importLayers.current.clear();
      activeLoteRef.current = null;
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle satélite / mapa ────────────────────────────────────────────────

  function toggleSatellite() {
    const map = mapRef.current;
    if (!map) return;

    tileRef.current?.remove();
    labelsRef.current?.remove();

    if (satellite) {
      tileRef.current = L.tileLayer(TILE_OSM.url, { attribution: TILE_OSM.attribution, maxZoom: 19 }).addTo(map);
      labelsRef.current = null;
    } else {
      tileRef.current = L.tileLayer(TILE_SAT.url, { attribution: TILE_SAT.attribution, maxZoom: 19 }).addTo(map);
      labelsRef.current = L.tileLayer(TILE_LABELS.url, { maxZoom: 19, opacity: 0.8 }).addTo(map);
    }

    setSatellite(s => !s);
  }

  // ── Capas de lotes ────────────────────────────────────────────────────────

  function addLayerToMap(map: L.Map, loteId: string, geo: GeoJSON.Feature<GeoJSON.Polygon>, colorIdx: number) {
    layerMap.current.get(loteId)?.remove();
    const ring = geo.geometry.coordinates[0];
    const latLngs = ring.map(([lng, lat]) => L.latLng(lat, lng));
    const color = getColor(colorIdx);

    const poly = L.polygon(latLngs, { color, fillColor: color, fillOpacity: 0.18, weight: 2.5 }).addTo(map);

    const nombre = lotes.find(l => l.id === loteId)?.nombre
      ?? initialLotes.find(l => l.id === loteId)?.nombre ?? '';
    if (nombre) poly.bindTooltip(nombre, { permanent: true, direction: 'center', className: 'lote-map-label' });

    poly.bindPopup(`
      <div style="min-width:150px; padding:2px 0;">
        <p style="font-weight:700; font-size:13px; color:#18181b; margin:0 0 6px;">${nombre}</p>
        <a href="/app/cultivos?lote=${loteId}"
           style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#006836;text-decoration:none;">
          Ver cultivos →
        </a>
      </div>
    `, { closeButton: true, maxWidth: 200 });

    layerMap.current.set(loteId, poly);
  }

  // ── Dibujar ───────────────────────────────────────────────────────────────

  function startDraw(loteId: string) {
    const map = mapRef.current;
    if (!map) return;
    cancelAll();
    activeLoteRef.current = loteId;
    setActiveLoteId(loteId);
    (map as any).pm.enableDraw('Polygon');
  }

  function cancelDraw() {
    (mapRef.current as any)?.pm.disableDraw();
    activeLoteRef.current = null;
    setActiveLoteId(null);
  }

  // ── Editar ────────────────────────────────────────────────────────────────

  function startEdit(loteId: string) {
    cancelAll();
    const layer = layerMap.current.get(loteId);
    if (!layer) return;
    (layer as any).pm.enable({ allowSelfIntersection: false });
    setEditingLoteId(loteId);
  }

  async function saveEdit(loteId: string) {
    const layer = layerMap.current.get(loteId);
    if (!layer) return;
    (layer as any).pm.disable();
    const geo = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>;
    setSaving(true);
    await createClient().from('lotes').update({ coordenadas: geo }).eq('id', loteId);
    setSaving(false);
    setLotes(prev => prev.map(l => l.id === loteId ? { ...l, coordenadas: geo } : l));
    setEditingLoteId(null);
  }

  function cancelEdit(loteId: string) {
    const layer = layerMap.current.get(loteId);
    if (layer) (layer as any).pm.disable();
    setEditingLoteId(null);
  }

  async function deleteCoords(loteId: string) {
    const layer = layerMap.current.get(loteId);
    if (layer) { (layer as any).pm.disable(); layer.remove(); layerMap.current.delete(loteId); }
    setSaving(true);
    await createClient().from('lotes').update({ coordenadas: null }).eq('id', loteId);
    setSaving(false);
    setLotes(prev => prev.map(l => l.id === loteId ? { ...l, coordenadas: null } : l));
    setEditingLoteId(null);
  }

  function cancelAll() {
    if (activeLoteId)  cancelDraw();
    if (editingLoteId) cancelEdit(editingLoteId);
  }

  // ── Guardar posición ──────────────────────────────────────────────────────

  async function saveCenter() {
    if (!centerRef.current) return;
    setSaving(true);
    await createClient().from('campos').update({
      centro_lat: centerRef.current.lat,
      centro_lng: centerRef.current.lng,
      zoom:       centerRef.current.zoom,
    }).eq('id', campo.id);
    setSaving(false);
    setCenterDirty(false);
  }

  // ── Geocoder ──────────────────────────────────────────────────────────────

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

  // ── Importar archivo ──────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError('');
    setImporting(true);

    try {
      const polygons = await parseFile(file);
      if (polygons.length === 0) {
        setImportError('No se encontraron polígonos en el archivo.');
        setImporting(false);
        return;
      }

      // Limpiar overlays anteriores
      importLayers.current.forEach(l => l.remove());
      importLayers.current.clear();

      const map = mapRef.current;
      const imported: ImportedPolygon[] = polygons.map((p, i) => ({
        idx: i,
        nombre: p.nombre,
        geo: p.geo,
        asignadoA: lotes.find(l => !l.coordenadas)?.id ?? '',
      }));

      // Dibujar en el mapa en naranja
      imported.forEach((p) => {
        const ring = p.geo.geometry.coordinates[0];
        const latLngs = ring.map(([lng, lat]) => L.latLng(lat, lng));
        const poly = L.polygon(latLngs, {
          color: '#f97316', fillColor: '#f97316', fillOpacity: 0.25, weight: 2, dashArray: '6 4',
        }).addTo(map!);
        poly.bindTooltip(`Importado: ${p.nombre}`, { direction: 'center', className: 'lote-map-label' });
        importLayers.current.set(p.idx, poly);
      });

      // Fit bounds a los importados
      const all: L.Layer[] = [];
      importLayers.current.forEach(l => all.push(l));
      if (all.length && map) map.fitBounds(L.featureGroup(all).getBounds(), { padding: [40, 40] });

      setImportedPolygons(imported);
    } catch (err: any) {
      setImportError(err.message ?? 'Error al procesar el archivo.');
    }

    setImporting(false);
  }

  function updateAsignacion(idx: number, loteId: string) {
    setImportedPolygons(prev => prev.map(p => p.idx === idx ? { ...p, asignadoA: loteId } : p));
  }

  function cancelImport() {
    importLayers.current.forEach(l => l.remove());
    importLayers.current.clear();
    setImportedPolygons([]);
    setImportError('');
  }

  async function applyImport() {
    const map = mapRef.current;
    if (!map) return;
    setSavingImport(true);
    const sb = createClient();

    for (const p of importedPolygons) {
      if (!p.asignadoA) continue;
      const idx = lotes.findIndex(l => l.id === p.asignadoA);
      await sb.from('lotes').update({ coordenadas: p.geo }).eq('id', p.asignadoA);
      addLayerToMap(map, p.asignadoA, p.geo, idx >= 0 ? idx : 0);
      setLotes(prev => prev.map(l => l.id === p.asignadoA ? { ...l, coordenadas: p.geo } : l));
    }

    // Limpiar overlays de importación
    importLayers.current.forEach(l => l.remove());
    importLayers.current.clear();
    setImportedPolygons([]);
    setSavingImport(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Título + controles */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-slate-700">Mapa del campo</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {saving && <span className="text-xs text-slate-400">Guardando…</span>}

          {/* Toggle satélite */}
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

          {/* Importar */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Procesando…' : 'Importar lotes'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,.kml,.kmz"
            className="hidden"
            onChange={handleFileChange}
          />

          {centerDirty && !saving && (
            <button
              onClick={saveCenter}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              Guardar posición
            </button>
          )}
        </div>
      </div>

      {/* Banner de error de importación */}
      {importError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{importError}</span>
          <button onClick={() => setImportError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Banner al dibujar */}
      {activeLoteId && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
          <span className="font-medium">Dibujando lote:</span>
          <span className="flex-1">Hacé clic para agregar vértices · Doble clic para cerrar el polígono</span>
          <button onClick={cancelDraw}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Contenedor del mapa */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ height: 520 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {!ready && (
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-10">
            <p className="text-slate-400 text-sm">Cargando mapa…</p>
          </div>
        )}

        {ready && (<>
          {/* ── Geocoder ── */}
          <div className="absolute top-3 left-14 z-[800] w-72">
            <div className="bg-white rounded-lg shadow-md border border-slate-200">
              <div className="flex items-center gap-2 px-3 py-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar establecimiento, ciudad…"
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

          {/* ── Mi ubicación ── */}
          <div className="absolute top-3 right-3 z-[800]">
            <button onClick={locateMe} title="Usar mi ubicación"
              className="bg-white rounded-lg shadow-md border border-slate-200 p-2 hover:bg-slate-50 transition-colors">
              <Locate className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* ── Panel lotes ── */}
          <div className="absolute bottom-3 right-3 z-[800] w-52 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
            style={{ maxHeight: panelVisible ? 380 : 'auto' }}>
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 tracking-wider">Lotes</p>
              <button
                onClick={() => setPanelVisible(v => !v)}
                title={panelVisible ? 'Ocultar panel' : 'Mostrar panel'}
                className="text-slate-400 hover:text-slate-700 transition-colors ml-2"
              >
                {panelVisible
                  ? <X className="w-3.5 h-3.5" />
                  : <span className="text-xs font-medium text-green-700">Ver</span>}
              </button>
            </div>
            {panelVisible && (
            <div className="overflow-y-auto" style={{ maxHeight: 330 }}>
              {lotes.length === 0
                ? <p className="px-3 py-4 text-xs text-slate-400 text-center">Agregá lotes en la tabla de arriba.</p>
                : (
                  <div className="divide-y divide-slate-50">
                    {lotes.map((lote, idx) => {
                      const color     = getColor(idx);
                      const hasCoord  = !!lote.coordenadas?.geometry?.coordinates?.[0]?.length;
                      const isActive  = activeLoteId  === lote.id;
                      const isEditing = editingLoteId === lote.id;

                      return (
                        <div key={lote.id} className={cn('px-3 py-2.5', (isActive || isEditing) && 'bg-green-50')}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-slate-700 truncate flex-1">{lote.nombre}</span>
                            {hasCoord && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                          </div>

                          {isActive ? (
                            <p className="text-xs text-green-600">Dibujando…</p>
                          ) : isEditing ? (
                            <div className="flex gap-1">
                              <button onClick={() => saveEdit(lote.id)} disabled={saving}
                                className="flex-1 text-xs font-medium py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50">
                                Guardar
                              </button>
                              <button onClick={() => cancelEdit(lote.id)} className="p-0.5 text-slate-400 hover:text-slate-700">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              {hasCoord ? (
                                <>
                                  <button onClick={() => startEdit(lote.id)}
                                    disabled={!!activeLoteId || !!editingLoteId}
                                    className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors">
                                    <Pencil className="w-3 h-3" />Editar
                                  </button>
                                  <button onClick={() => deleteCoords(lote.id)}
                                    disabled={!!activeLoteId || !!editingLoteId}
                                    title="Eliminar polígono"
                                    className="p-0.5 text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => startDraw(lote.id)}
                                  disabled={!!activeLoteId || !!editingLoteId}
                                  className="flex-1 text-xs font-medium py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors">
                                  + Dibujar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
            )}
          </div>
        </>)}
      </div>

      {/* ── Panel de importación ── */}
      {importedPolygons.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-800">
                {importedPolygons.length} polígono{importedPolygons.length !== 1 ? 's' : ''} importado{importedPolygons.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                Asigná cada polígono a un lote. Los lotes ya con polígono serán reemplazados.
              </p>
            </div>
            <button onClick={cancelImport} className="text-orange-400 hover:text-orange-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {importedPolygons.map((p) => (
              <div key={p.idx} className="px-5 py-3 flex items-center gap-4">
                <span
                  className="w-3 h-3 rounded-full shrink-0 border-2"
                  style={{ backgroundColor: '#f97316', borderColor: '#f97316' }}
                />
                <span className="text-sm text-slate-700 flex-1 truncate" title={p.nombre}>
                  {p.nombre || `Polígono ${p.idx + 1}`}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500">→ Asignar a:</span>
                  <select
                    value={p.asignadoA}
                    onChange={e => updateAsignacion(p.idx, e.target.value)}
                    className="text-xs rounded-lg border border-slate-300 px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— Ignorar —</option>
                    {lotes.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button onClick={cancelImport}
              className="text-sm font-medium text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button
              onClick={applyImport}
              disabled={savingImport || importedPolygons.every(p => !p.asignadoA)}
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {savingImport ? 'Guardando…' : 'Aplicar importación'}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Imágenes © Esri &nbsp;·&nbsp;
        Tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">OpenStreetMap</a> contributors
      </p>
    </div>
  );
}
