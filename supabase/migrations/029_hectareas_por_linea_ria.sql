-- Hectáreas afectadas individuales por insumo y labor en RIA
ALTER TABLE remitos_insumos
  ADD COLUMN IF NOT EXISTS hectareas_afectadas NUMERIC(10,2);

ALTER TABLE remitos_labores
  ADD COLUMN IF NOT EXISTS hectareas_afectadas NUMERIC(10,2);
