-- =============================================================================
-- Migración 006: Geolocalización de campos y lotes
-- Copiar y ejecutar en Supabase Studio → SQL Editor
-- =============================================================================

-- Coordenadas del centro del campo (para centrar el mapa)
ALTER TABLE campos
  ADD COLUMN IF NOT EXISTS centro_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS centro_lng  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS zoom        SMALLINT DEFAULT 14;

-- Polígono GeoJSON del lote (Feature<Polygon>)
ALTER TABLE lotes
  ADD COLUMN IF NOT EXISTS coordenadas JSONB;
