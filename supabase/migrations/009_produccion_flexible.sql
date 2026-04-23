-- =============================================================================
-- Migración 009: Producción flexible y cálculo de margen bruto
-- Solo AGREGA columnas nuevas, no renombra las existentes.
-- =============================================================================

-- Nuevos campos (las columnas produccion_total_kg y rendimiento_kg_ha se conservan)
ALTER TABLE cultivos
  ADD COLUMN IF NOT EXISTS producto_final     TEXT,
  ADD COLUMN IF NOT EXISTS unidad_produccion  TEXT NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS precio_venta_ars   NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS ingreso_bruto_ars  NUMERIC(14,2);

COMMENT ON COLUMN cultivos.producto_final    IS 'Producto generado: "Soja grano", "Silaje de maíz", "Trigo pan", etc.';
COMMENT ON COLUMN cultivos.unidad_produccion IS 'Unidad de medida: kg, tn, m3, bolsa_silaje, fardo, litro, unidad';
COMMENT ON COLUMN cultivos.precio_venta_ars  IS 'Precio de venta por unidad al momento de registrar la cosecha';
COMMENT ON COLUMN cultivos.ingreso_bruto_ars IS 'produccion_total_kg × precio_venta_ars';

-- Trigger: recalcular costo_directo_ars y margen_bruto_ars
-- al insertar/actualizar/borrar ítems de aplicación
CREATE OR REPLACE FUNCTION recalcular_costos_cultivo()
RETURNS TRIGGER AS $$
DECLARE
  v_cultivo_id UUID;
  v_costo NUMERIC(14,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT a.cultivo_id INTO v_cultivo_id
    FROM aplicaciones a WHERE a.id = OLD.aplicacion_id;
  ELSE
    SELECT a.cultivo_id INTO v_cultivo_id
    FROM aplicaciones a WHERE a.id = NEW.aplicacion_id;
  END IF;

  IF v_cultivo_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT COALESCE(SUM(ai.costo_imputado_ars), 0) INTO v_costo
  FROM aplicaciones_items ai
  JOIN aplicaciones a ON a.id = ai.aplicacion_id
  WHERE a.cultivo_id = v_cultivo_id;

  UPDATE cultivos SET
    costo_directo_ars = v_costo,
    margen_bruto_ars  = CASE
                          WHEN ingreso_bruto_ars IS NOT NULL
                          THEN ingreso_bruto_ars - v_costo
                          ELSE NULL
                        END
  WHERE id = v_cultivo_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalcular_costos_cultivo ON aplicaciones_items;
CREATE TRIGGER trigger_recalcular_costos_cultivo
  AFTER INSERT OR UPDATE OR DELETE ON aplicaciones_items
  FOR EACH ROW EXECUTE FUNCTION recalcular_costos_cultivo();

-- Trigger: recalcular margen cuando se actualiza ingreso o costo en cultivos
CREATE OR REPLACE FUNCTION recalcular_margen_cultivo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.margen_bruto_ars = CASE
    WHEN NEW.ingreso_bruto_ars IS NOT NULL
    THEN NEW.ingreso_bruto_ars - COALESCE(NEW.costo_directo_ars, 0)
    ELSE NULL
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_margen_cultivo ON cultivos;
CREATE TRIGGER trigger_margen_cultivo
  BEFORE UPDATE OF ingreso_bruto_ars, costo_directo_ars ON cultivos
  FOR EACH ROW EXECUTE FUNCTION recalcular_margen_cultivo();
