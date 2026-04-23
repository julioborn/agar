-- =============================================================================
-- AgroSistema - Migración 001: Core organizacional
-- Empresas, unidades de negocio, usuarios, operarios, campos, lotes
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- EMPRESAS
-- =============================================================================
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  cuit TEXT UNIQUE NOT NULL,
  datos_fiscales TEXT,
  subdominio TEXT UNIQUE,
  logo_url TEXT,
  moneda_base TEXT NOT NULL DEFAULT 'ARS',
  fecha_alta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- USUARIOS_EMPRESAS (relación muchos-a-muchos con rol)
-- Los usuarios se autentican vía Supabase Auth (auth.users)
-- Esta tabla vincula un auth.users con una o más empresas y su rol
-- =============================================================================
CREATE TYPE rol_usuario AS ENUM (
  'super_admin',
  'admin_empresa',
  'contador',
  'encargado_campo'
);

CREATE TABLE usuarios_empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rol rol_usuario NOT NULL,
  campo_id_asignado UUID, -- FK se añade después de crear campos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_id)
);

CREATE INDEX idx_usuarios_empresas_usuario ON usuarios_empresas(usuario_id);
CREATE INDEX idx_usuarios_empresas_empresa ON usuarios_empresas(empresa_id);

-- =============================================================================
-- FUNCIÓN HELPER: verifica si el usuario actual tiene acceso a la empresa
-- Se usa en todas las políticas RLS
-- =============================================================================
CREATE OR REPLACE FUNCTION user_has_empresa_access(empresa_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_empresas
    WHERE usuario_id = auth.uid()
      AND empresa_id = empresa_uuid
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol = 'super_admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =============================================================================
-- UNIDADES DE NEGOCIO
-- =============================================================================
CREATE TYPE tipo_unidad_negocio AS ENUM (
  'agricultura', 'ganaderia', 'tambo', 'apicultura', 'forestal', 'otro'
);

CREATE TABLE unidades_negocio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo tipo_unidad_negocio NOT NULL,
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unidades_negocio_empresa ON unidades_negocio(empresa_id);

-- =============================================================================
-- OPERARIOS (peones, no necesariamente usuarios del sistema)
-- =============================================================================
CREATE TABLE operarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  dni TEXT,
  telefono TEXT,
  categoria TEXT,
  valor_hora_ars NUMERIC(12,2),
  usuario_id UUID REFERENCES auth.users(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operarios_empresa ON operarios(empresa_id);

-- =============================================================================
-- CAMPOS
-- =============================================================================
CREATE TABLE campos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  ubicacion GEOGRAPHY(POINT, 4326),
  hectareas_totales NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campos_empresa ON campos(empresa_id);
CREATE INDEX idx_campos_ubicacion ON campos USING GIST(ubicacion);

-- Ahora sí podemos agregar la FK de campo_id_asignado en usuarios_empresas
ALTER TABLE usuarios_empresas
  ADD CONSTRAINT fk_usuarios_empresas_campo
  FOREIGN KEY (campo_id_asignado) REFERENCES campos(id) ON DELETE SET NULL;

-- =============================================================================
-- LOTES (con polígono GeoJSON)
-- =============================================================================
CREATE TABLE lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campo_id UUID NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  hectareas NUMERIC(10,4) NOT NULL,
  poligono GEOGRAPHY(POLYGON, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lotes_campo ON lotes(campo_id);
CREATE INDEX idx_lotes_poligono ON lotes USING GIST(poligono);

-- Helper: obtener empresa_id de un lote (para RLS)
CREATE OR REPLACE FUNCTION empresa_id_de_lote(lote_uuid UUID)
RETURNS UUID AS $$
  SELECT c.empresa_id FROM lotes l
  JOIN campos c ON c.id = l.campo_id
  WHERE l.id = lote_uuid;
$$ LANGUAGE SQL STABLE;

-- =============================================================================
-- TRIGGERS PARA updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_empresas BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_unidades BEFORE UPDATE ON unidades_negocio
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_operarios BEFORE UPDATE ON operarios
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_campos BEFORE UPDATE ON campos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_lotes BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE operarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

-- Empresas: solo ver empresas a las que el usuario pertenece
CREATE POLICY empresas_select ON empresas FOR SELECT
  USING (user_has_empresa_access(id) OR user_is_super_admin());

CREATE POLICY empresas_insert ON empresas FOR INSERT
  WITH CHECK (user_is_super_admin());

CREATE POLICY empresas_update ON empresas FOR UPDATE
  USING (user_has_empresa_access(id) OR user_is_super_admin());

-- usuarios_empresas: el usuario ve sus propias asignaciones
CREATE POLICY usuarios_empresas_select ON usuarios_empresas FOR SELECT
  USING (usuario_id = auth.uid() OR user_is_super_admin());

CREATE POLICY usuarios_empresas_all ON usuarios_empresas FOR ALL
  USING (user_is_super_admin())
  WITH CHECK (user_is_super_admin());

-- Unidades de negocio: scoped por empresa
CREATE POLICY unidades_rls ON unidades_negocio FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

-- Operarios: scoped por empresa
CREATE POLICY operarios_rls ON operarios FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

-- Campos: scoped por empresa
CREATE POLICY campos_rls ON campos FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

-- Lotes: scoped por la empresa del campo padre
CREATE POLICY lotes_rls ON lotes FOR ALL
  USING (user_has_empresa_access(empresa_id_de_lote(id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM campos WHERE campos.id = campo_id
    AND user_has_empresa_access(campos.empresa_id)
  ));
