-- =============================================================================
-- Migración 008: Renombrar campanias → cultivos
-- "Campaña" pasa a ser el período agrícola (2025/2026, 2026/2027)
-- "Cultivo" es cada siembra/producción específica en un lote
-- =============================================================================

-- 1. Renombrar la tabla principal
ALTER TABLE campanias RENAME TO cultivos;

-- 2. Renombrar la columna FK en aplicaciones
ALTER TABLE aplicaciones RENAME COLUMN campania_id TO cultivo_id;

-- 3. Renombrar índices para mantener coherencia
ALTER INDEX IF EXISTS idx_campanias_lote   RENAME TO idx_cultivos_lote;
ALTER INDEX IF EXISTS idx_campanias_estado RENAME TO idx_cultivos_estado;

-- 4. Renombrar trigger
ALTER TRIGGER set_updated_at_campanias ON cultivos RENAME TO set_updated_at_cultivos;

-- 5. Renombrar política RLS
ALTER POLICY campanias_rls ON cultivos RENAME TO cultivos_rls;

-- 6. Recrear funciones helper con nombres actualizados
CREATE OR REPLACE FUNCTION empresa_id_de_cultivo(cultivo_uuid UUID)
RETURNS UUID AS $$
  SELECT c.empresa_id
  FROM cultivos cult
  JOIN lotes l ON l.id = cult.lote_id
  JOIN campos c ON c.id = l.campo_id
  WHERE cult.id = cultivo_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Alias para compatibilidad con código existente
CREATE OR REPLACE FUNCTION empresa_id_de_campania(campania_uuid UUID)
RETURNS UUID AS $$
  SELECT empresa_id_de_cultivo(campania_uuid);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Actualizar función de aplicacion para usar nueva columna
CREATE OR REPLACE FUNCTION empresa_id_de_aplicacion(aplicacion_uuid UUID)
RETURNS UUID AS $$
  SELECT empresa_id_de_cultivo(a.cultivo_id)
  FROM aplicaciones a
  WHERE a.id = aplicacion_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 7. Nueva tabla campanias: períodos/temporadas agrícolas
CREATE TABLE campanias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,           -- ej: "2025/2026", "Campaña de Invierno 2026"
  fecha_inicio DATE,
  fecha_fin    DATE,
  activa       BOOLEAN NOT NULL DEFAULT TRUE,
  observaciones TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campanias_empresa ON campanias(empresa_id);
ALTER TABLE campanias ENABLE ROW LEVEL SECURITY;
CREATE POLICY campanias_rls ON campanias FOR ALL
  USING  (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

-- 8. FK opcional: asociar cultivos a una campaña
ALTER TABLE cultivos
  ADD COLUMN IF NOT EXISTS campania_id UUID REFERENCES campanias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cultivos_campania ON cultivos(campania_id);
