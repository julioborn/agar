-- =============================================================================
-- Migración 025: UTA (Unidad de Trabajo Agrícola) + reset de tipos de labor
-- =============================================================================
-- 1. Agrega litros_por_uta en configuracion_empresa (equiv. litros gasoil / UTA)
-- 2. Agrega uta_equivalencia en tipos_labor
-- 3. Convierte remitos_labores.tipo_labor_id a nullable con ON DELETE SET NULL
-- 4. Reemplaza todos los tipos de labor predefinidos por los 17 del catálogo UTA
-- =============================================================================

-- ── 1. Nueva columna en configuracion_empresa ─────────────────────────────────
ALTER TABLE configuracion_empresa
  ADD COLUMN IF NOT EXISTS litros_por_uta NUMERIC(10, 3) NOT NULL DEFAULT 35;

-- ── 2. Nueva columna en tipos_labor ───────────────────────────────────────────
ALTER TABLE tipos_labor
  ADD COLUMN IF NOT EXISTS uta_equivalencia NUMERIC(10, 4) NOT NULL DEFAULT 0;

-- ── 3. Arreglar FK de remitos_labores para permitir NULL ─────────────────────
-- La columna era NOT NULL con FK sin SET NULL → la convertimos a nullable con SET NULL
ALTER TABLE remitos_labores
  DROP CONSTRAINT IF EXISTS remitos_labores_tipo_labor_id_fkey;

ALTER TABLE remitos_labores
  ALTER COLUMN tipo_labor_id DROP NOT NULL;

ALTER TABLE remitos_labores
  ADD CONSTRAINT remitos_labores_tipo_labor_id_fkey
    FOREIGN KEY (tipo_labor_id) REFERENCES tipos_labor(id) ON DELETE SET NULL;

-- ── 4. Reemplazar todos los tipos de labor por el catálogo UTA ────────────────
-- Los nombres de labor se conservan en tipo_labor_nombre de remitos_labores,
-- por lo que nullear el id no pierde información en remitos históricos.
DELETE FROM tipos_labor;

DO $$
DECLARE
  emp_id UUID;
BEGIN
  FOR emp_id IN SELECT id FROM empresas LOOP
    INSERT INTO tipos_labor (empresa_id, nombre, descripcion, uta_equivalencia)
    VALUES
      (emp_id, 'ARADO CINCEL',                  'Laboreo',       1.00),
      (emp_id, 'RASTRA DESENCONTRADA',           'Laboreo',       1.20),
      (emp_id, 'RASTRA DOBLE ACCION',            'Laboreo',       0.60),
      (emp_id, 'RASTRA LIGERA',                  'Laboreo',       0.60),
      (emp_id, 'CULTIVADOR DE CAMPO',            'Laboreo',       0.55),
      (emp_id, 'ROLO PICADOR',                   'Laboreo',       0.45),
      (emp_id, 'PULVERIZACION TERRESTRE',        'Aplicacion',    0.15),
      (emp_id, 'FERTILIZACION AL VOLEO',         'Fertilizacion', 0.20),
      (emp_id, 'SIEMBRA DIRECTA GRANO FINO',     'Siembra',       0.80),
      (emp_id, 'SIEMBRA DIRECTA GRANO GRUESO',   'Siembra',       1.00),
      (emp_id, 'DESMALEZADORA',                  'Laboreo',       0.60),
      (emp_id, 'ARROLLADORA',                    'Laboreo',       1.20),
      (emp_id, 'COSECHA FINA',                   'Cosecha',       1.50),
      (emp_id, 'COSECHA GRUESA',                 'Cosecha',       2.00),
      (emp_id, 'RASTRA DIENTE + ROLO',           'Laboreo',       0.25),
      (emp_id, 'DESENCONTRADA PESADA',           'Laboreo',       1.50),
      (emp_id, 'SEGADORA',                       'Cosecha',       0.70);
  END LOOP;
END $$;
