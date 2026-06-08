-- =============================================================================
-- Migración 020: Nombre de factura en productos
-- =============================================================================
-- Agrega un segundo nombre a cada producto:
--   nombre          → nombre visible en toda la app (corto, limpio)
--   nombre_factura  → nombre tal como aparece en las facturas del proveedor
--                     (largo, con especificaciones técnicas)
-- El sistema de importación de facturas prioriza la coincidencia con
-- nombre_factura antes de recurrir a la similitud de texto.
-- =============================================================================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS nombre_factura TEXT;

COMMENT ON COLUMN productos.nombre_factura IS
  'Nombre del producto tal como aparece en las facturas del proveedor. '
  'Se usa para el matching automático en la importación de comprobantes.';
