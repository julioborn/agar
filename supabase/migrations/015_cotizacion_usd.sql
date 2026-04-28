-- =============================================================================
-- Migración 015: Cotización USD manual en configuración de empresa
-- =============================================================================

ALTER TABLE configuracion_empresa
  ADD COLUMN IF NOT EXISTS cotizacion_usd        NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS cotizacion_usd_fecha  DATE;

COMMENT ON COLUMN configuracion_empresa.cotizacion_usd IS
  'Cotización manual USD→ARS. Si es NULL, el sistema usa la tasa publicada por BNA/BCRA en tiempo real.';
COMMENT ON COLUMN configuracion_empresa.cotizacion_usd_fecha IS
  'Fecha en que se cargó la cotización manual.';
