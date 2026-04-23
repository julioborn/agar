-- =============================================================================
-- Migración 007: Pérdida por desvío en aplicaciones
-- =============================================================================

ALTER TABLE aplicaciones_items
  ADD COLUMN IF NOT EXISTS cantidad_perdida   NUMERIC(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS causa_perdida      TEXT,
  ADD COLUMN IF NOT EXISTS costo_perdida_ars  NUMERIC(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN aplicaciones_items.cantidad_perdida  IS 'Diferencia entre retirado y (aplicado + devuelto)';
COMMENT ON COLUMN aplicaciones_items.causa_perdida     IS 'Causa informada del desvío (derrame, evaporación, etc.)';
COMMENT ON COLUMN aplicaciones_items.costo_perdida_ars IS 'Costo imputado de la pérdida a la campaña';
