-- =============================================================================
-- Migración 026: Hacer opcionales unidad_negocio_id y fecha_siembra en cultivos
-- =============================================================================
-- Permite crear cultivos desde RIA sin requerir unidad de negocio ni fecha exacta.
-- La empresa se deriva siempre a través de lote → campo → empresa.
-- =============================================================================

ALTER TABLE cultivos
  ALTER COLUMN unidad_negocio_id DROP NOT NULL,
  ALTER COLUMN fecha_siembra     DROP NOT NULL;
