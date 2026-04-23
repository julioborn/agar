-- =============================================================================
-- Migración 005: Campañas, Aplicaciones e ítems
-- Copiar y ejecutar en Supabase Studio → SQL Editor
-- =============================================================================

-- ── CAMPAÑAS ─────────────────────────────────────────────────────────────────
CREATE TYPE estado_campania AS ENUM ('planificada', 'en_curso', 'cosechada', 'cancelada');

CREATE TABLE campanias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  unidad_negocio_id UUID NOT NULL REFERENCES unidades_negocio(id),
  cultivo TEXT NOT NULL,
  fecha_siembra DATE NOT NULL,
  fecha_cosecha_estimada DATE,
  fecha_cosecha_real DATE,
  estado estado_campania NOT NULL DEFAULT 'planificada',
  -- Campos calculados (se actualizan al registrar cosechas y aplicaciones)
  produccion_total_kg NUMERIC(14,2),
  rendimiento_kg_ha NUMERIC(10,4),
  costo_directo_ars NUMERIC(14,2) DEFAULT 0,
  margen_bruto_ars NUMERIC(14,2),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campanias_lote ON campanias(lote_id);
CREATE INDEX idx_campanias_estado ON campanias(estado);

-- ── APLICACIONES ─────────────────────────────────────────────────────────────
CREATE TYPE tipo_aplicacion AS ENUM ('fitosanitaria', 'fertilizacion', 'siembra', 'otro');

CREATE TABLE aplicaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campania_id UUID NOT NULL REFERENCES campanias(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo tipo_aplicacion NOT NULL DEFAULT 'otro',
  usuario_id UUID REFERENCES auth.users(id),
  observaciones TEXT,
  sincronizado BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aplicaciones_campania ON aplicaciones(campania_id);
CREATE INDEX idx_aplicaciones_fecha ON aplicaciones(fecha);

-- ── APLICACIONES_ITEMS ────────────────────────────────────────────────────────
CREATE TABLE aplicaciones_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aplicacion_id UUID NOT NULL REFERENCES aplicaciones(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  deposito_origen_id UUID NOT NULL REFERENCES depositos(id),
  cantidad_retirada NUMERIC(14,4) NOT NULL,
  cantidad_aplicada NUMERIC(14,4) NOT NULL,
  cantidad_devuelta NUMERIC(14,4) NOT NULL DEFAULT 0,
  -- Principio de costos congelados: precio al momento de la compra más reciente
  costo_unitario_ars_momento NUMERIC(14,4) NOT NULL DEFAULT 0,
  costo_imputado_ars NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_aplic_items_aplicacion ON aplicaciones_items(aplicacion_id);
CREATE INDEX idx_aplic_items_producto ON aplicaciones_items(producto_id);

-- ── DEVOLUCIONES_STOCK ────────────────────────────────────────────────────────
CREATE TABLE devoluciones_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aplicacion_item_id UUID NOT NULL REFERENCES aplicaciones_items(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  cantidad NUMERIC(14,4) NOT NULL,
  deposito_destino_id UUID NOT NULL REFERENCES depositos(id),
  usuario_id UUID REFERENCES auth.users(id),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TRIGGERS updated_at ───────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at_campanias BEFORE UPDATE ON campanias
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_aplicaciones BEFORE UPDATE ON aplicaciones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── HELPER FUNCTIONS (SECURITY DEFINER para evitar RLS recursivo) ────────────
CREATE OR REPLACE FUNCTION empresa_id_de_campania(campania_uuid UUID)
RETURNS UUID AS $$
  SELECT c.empresa_id
  FROM campanias camp
  JOIN lotes l ON l.id = camp.lote_id
  JOIN campos c ON c.id = l.campo_id
  WHERE camp.id = campania_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION empresa_id_de_aplicacion(aplicacion_uuid UUID)
RETURNS UUID AS $$
  SELECT empresa_id_de_campania(a.campania_id)
  FROM aplicaciones a
  WHERE a.id = aplicacion_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE campanias ENABLE ROW LEVEL SECURITY;
ALTER TABLE aplicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE aplicaciones_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones_stock ENABLE ROW LEVEL SECURITY;

-- Campañas: JOIN directo en lotes+campos (evita llamar función que consulta campanias)
CREATE POLICY campanias_rls ON campanias FOR ALL
  USING (EXISTS (
    SELECT 1 FROM lotes l JOIN campos c ON c.id = l.campo_id
    WHERE l.id = lote_id AND user_has_empresa_access(c.empresa_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lotes l JOIN campos c ON c.id = l.campo_id
    WHERE l.id = lote_id AND user_has_empresa_access(c.empresa_id)
  ));

-- Aplicaciones: usa la función SECURITY DEFINER (no recursiva)
CREATE POLICY aplicaciones_rls ON aplicaciones FOR ALL
  USING (user_has_empresa_access(empresa_id_de_campania(campania_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_campania(campania_id)));

-- Ítems de aplicaciones
CREATE POLICY aplic_items_rls ON aplicaciones_items FOR ALL
  USING (user_has_empresa_access(empresa_id_de_aplicacion(aplicacion_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_aplicacion(aplicacion_id)));

-- Devoluciones de stock
CREATE POLICY devol_rls ON devoluciones_stock FOR ALL
  USING (user_has_empresa_access(empresa_id_de_aplicacion(
    (SELECT ai.aplicacion_id FROM aplicaciones_items ai WHERE ai.id = aplicacion_item_id)
  )))
  WITH CHECK (user_has_empresa_access(empresa_id_de_aplicacion(
    (SELECT ai.aplicacion_id FROM aplicaciones_items ai WHERE ai.id = aplicacion_item_id)
  )));
