-- =============================================================================
-- Migración 033: Tipos de Producción
-- Catálogo de precios de referencia para lo que se cosecha/produce (granos,
-- semillas, silos, rollos), usado como selector predefinido en la sección
-- Producción del RIA. Cada tipo queda vinculado 1:1 a un producto real
-- (categoría 'produccion') para que el ingreso a stock siga funcionando igual.
-- =============================================================================

CREATE TABLE tipos_produccion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  grupo         TEXT NOT NULL CHECK (grupo IN ('grano', 'semilla', 'silo', 'rollo')),
  unidad_medida TEXT NOT NULL,
  unidad_base   unidad_base_producto NOT NULL,
  valor_mercado NUMERIC(14,4) NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  orden         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, nombre)
);

CREATE INDEX idx_tipos_produccion_empresa ON tipos_produccion(empresa_id);

ALTER TABLE tipos_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_produccion_select" ON tipos_produccion FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "tipos_produccion_insert" ON tipos_produccion FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "tipos_produccion_update" ON tipos_produccion FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "tipos_produccion_delete" ON tipos_produccion FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE TRIGGER set_updated_at_tipos_produccion
  BEFORE UPDATE ON tipos_produccion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- Seed: catálogo inicial para Canciani
-- =============================================================================
DO $$
DECLARE
  v_empresa_id UUID := '90733d04-96ae-4ac5-9115-738c64f84b60';
  v_item RECORD;
  v_producto_id UUID;
  v_orden INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE id = v_empresa_id) THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT * FROM (VALUES
      ('GRANO SOJA',              'grano',   'TONELADA',                'tn',     325.00),
      ('GRANO SORGO',             'grano',   'TONELADA',                'tn',     190.00),
      ('GRANO MAIZ',              'grano',   'TONELADA',                'tn',     178.00),
      ('SEMILLA VICIA',           'semilla', 'KG',                      'kg',       2.75),
      ('SEMILLA AVENA',           'semilla', 'KG',                      'kg',       0.65),
      ('SEMILLA SOJA',            'semilla', 'KG',                      'kg',       1.20),
      ('SEMILLA ALFALFA',         'semilla', 'KG',                      'kg',       8.50),
      ('SILO SORGO',              'silo',    'TONELADA MATERIA VERDE',  'tn',      22.00),
      ('SILO ALFALFA',            'silo',    'TONELADA MATERIA VERDE',  'tn',      25.00),
      ('SILO MAIZ',               'silo',    'TONELADA MATERIA VERDE',  'tn',      35.00),
      ('ROLLO ALFALFA',           'rollo',   'UNIDAD (550 KG)',         'unidad',  30.00),
      ('ROLLO MEGATERMICA',       'rollo',   'UNIDAD (550 KG)',         'unidad',  25.00),
      ('ROLLO PASTURA TEMPLADA',  'rollo',   'UNIDAD (550 KG)',         'unidad',  28.00),
      ('ROLLO MOHA',              'rollo',   'UNIDAD (550 KG)',         'unidad',  25.00)
    ) AS t(nombre, grupo, unidad_medida, unidad_base, valor_mercado)
  LOOP
    v_orden := v_orden + 1;

    INSERT INTO productos (empresa_id, nombre, categoria, unidad_base)
    VALUES (v_empresa_id, v_item.nombre, 'produccion', v_item.unidad_base::unidad_base_producto)
    RETURNING id INTO v_producto_id;

    INSERT INTO tipos_produccion (
      empresa_id, producto_id, nombre, grupo, unidad_medida, unidad_base, valor_mercado, orden
    ) VALUES (
      v_empresa_id, v_producto_id, v_item.nombre, v_item.grupo, v_item.unidad_medida,
      v_item.unidad_base::unidad_base_producto, v_item.valor_mercado, v_orden
    );
  END LOOP;
END $$;
