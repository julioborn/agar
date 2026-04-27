-- =============================================================================
-- AgroSistema - Migración 011: Maquinarias, Tipos de Labor y Labores
-- =============================================================================

-- Función updated_at (idempotente, puede existir de migraciones anteriores)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CONFIGURACIÓN POR EMPRESA (precio combustible, etc.)
-- =============================================================================
CREATE TABLE configuracion_empresa (
  empresa_id            UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  precio_combustible    NUMERIC(10, 3) NOT NULL DEFAULT 0,
  tipo_combustible      TEXT NOT NULL DEFAULT 'gasoil',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_configuracion_empresa_updated_at
  BEFORE UPDATE ON configuracion_empresa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE configuracion_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conf_empresa_select" ON configuracion_empresa FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "conf_empresa_upsert" ON configuracion_empresa FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "conf_empresa_update" ON configuracion_empresa FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

-- =============================================================================
-- TIPOS DE LABOR
-- =============================================================================
CREATE TABLE tipos_labor (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tipos_labor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_labor_select" ON tipos_labor FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "tipos_labor_insert" ON tipos_labor FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "tipos_labor_update" ON tipos_labor FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "tipos_labor_delete" ON tipos_labor FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

-- =============================================================================
-- MAQUINARIAS / EQUIPOS
-- =============================================================================
CREATE TABLE maquinarias (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id               UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre                   TEXT NOT NULL,
  tipo                     TEXT NOT NULL DEFAULT 'tractor',
  marca                    TEXT,
  modelo                   TEXT,
  anio                     INTEGER,
  hp                       INTEGER,
  consumo_combustible_hora NUMERIC(6, 3) NOT NULL DEFAULT 0,  -- litros/hora
  costo_mantenimiento_hora NUMERIC(10, 2) NOT NULL DEFAULT 0, -- $/hora
  valor_adquisicion        NUMERIC(14, 2),
  vida_util_horas          INTEGER,
  activa                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_maquinarias_updated_at
  BEFORE UPDATE ON maquinarias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE maquinarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maquinarias_select" ON maquinarias FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "maquinarias_insert" ON maquinarias FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "maquinarias_update" ON maquinarias FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "maquinarias_delete" ON maquinarias FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

-- =============================================================================
-- MANTENIMIENTO DE MAQUINARIA (bitácora)
-- =============================================================================
CREATE TABLE mantenimiento_maquinaria (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  maquinaria_id    UUID NOT NULL REFERENCES maquinarias(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL,
  tipo             TEXT NOT NULL DEFAULT 'preventivo', -- preventivo | correctivo
  descripcion      TEXT NOT NULL,
  costo            NUMERIC(12, 2),
  horas_al_momento NUMERIC(8, 1),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mantenimiento_maquinaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mantenimiento_select" ON mantenimiento_maquinaria FOR SELECT
  USING (maquinaria_id IN (
    SELECT m.id FROM maquinarias m
    JOIN usuarios_empresas ue ON ue.empresa_id = m.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));

CREATE POLICY "mantenimiento_insert" ON mantenimiento_maquinaria FOR INSERT
  WITH CHECK (maquinaria_id IN (
    SELECT m.id FROM maquinarias m
    JOIN usuarios_empresas ue ON ue.empresa_id = m.empresa_id
    WHERE ue.usuario_id = auth.uid() AND ue.rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "mantenimiento_delete" ON mantenimiento_maquinaria FOR DELETE
  USING (maquinaria_id IN (
    SELECT m.id FROM maquinarias m
    JOIN usuarios_empresas ue ON ue.empresa_id = m.empresa_id
    WHERE ue.usuario_id = auth.uid() AND ue.rol IN ('admin_empresa', 'super_admin')
  ));

-- =============================================================================
-- LABORES (operaciones de campo por cultivo)
-- =============================================================================
CREATE TABLE labores (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cultivo_id       UUID NOT NULL REFERENCES cultivos(id) ON DELETE CASCADE,
  tipo_labor_id    UUID NOT NULL REFERENCES tipos_labor(id),
  fecha            DATE NOT NULL,
  tipo_ejecucion   TEXT NOT NULL CHECK (tipo_ejecucion IN ('propio', 'tercero')),
  observaciones    TEXT,

  -- Si es con equipo propio:
  maquinaria_id       UUID REFERENCES maquinarias(id),
  horas_trabajadas    NUMERIC(6, 2),

  -- Si es servicio de tercero:
  proveedor_id        UUID REFERENCES proveedores(id),
  modalidad_cobro     TEXT CHECK (modalidad_cobro IN ('por_ha', 'total')),
  precio_unitario     NUMERIC(12, 2),
  hectareas_trabajadas NUMERIC(8, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_labores_updated_at
  BEFORE UPDATE ON labores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE labores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labores_select" ON labores FOR SELECT
  USING (cultivo_id IN (
    SELECT c.id FROM cultivos c
    JOIN lotes l ON l.id = c.lote_id
    JOIN campos ca ON ca.id = l.campo_id
    JOIN usuarios_empresas ue ON ue.empresa_id = ca.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));

CREATE POLICY "labores_insert" ON labores FOR INSERT
  WITH CHECK (cultivo_id IN (
    SELECT c.id FROM cultivos c
    JOIN lotes l ON l.id = c.lote_id
    JOIN campos ca ON ca.id = l.campo_id
    JOIN usuarios_empresas ue ON ue.empresa_id = ca.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));

CREATE POLICY "labores_update" ON labores FOR UPDATE
  USING (cultivo_id IN (
    SELECT c.id FROM cultivos c
    JOIN lotes l ON l.id = c.lote_id
    JOIN campos ca ON ca.id = l.campo_id
    JOIN usuarios_empresas ue ON ue.empresa_id = ca.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));

CREATE POLICY "labores_delete" ON labores FOR DELETE
  USING (cultivo_id IN (
    SELECT c.id FROM cultivos c
    JOIN lotes l ON l.id = c.lote_id
    JOIN campos ca ON ca.id = l.campo_id
    JOIN usuarios_empresas ue ON ue.empresa_id = ca.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));
