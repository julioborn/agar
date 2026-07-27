-- =============================================================================
-- Migración 034: Ganadería — Etapa 1 (registro base)
-- Categorías de hacienda, corrales, potreros, lotes de hacienda y animales.
-- Reutiliza la jerarquía campos -> lotes ya existente: corral/potrero son
-- subdivisiones de un lote, y un lote de hacienda (equivalente ganadero de un
-- cultivo) vive en uno de los dos. Sin costeo/movimientos todavía — eso es la
-- etapa siguiente (RIA ganadero + stock de ganadería vía Compras).
-- =============================================================================

-- =============================================================================
-- CATEGORIAS_HACIENDA (maestro editable por empresa)
-- =============================================================================
CREATE TABLE categorias_hacienda (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  orden      INTEGER NOT NULL DEFAULT 0,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, nombre)
);

CREATE INDEX idx_categorias_hacienda_empresa ON categorias_hacienda(empresa_id);

ALTER TABLE categorias_hacienda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_hacienda_select" ON categorias_hacienda FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "categorias_hacienda_insert" ON categorias_hacienda FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "categorias_hacienda_update" ON categorias_hacienda FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY "categorias_hacienda_delete" ON categorias_hacienda FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

-- =============================================================================
-- CORRALES (uso intensivo / feedlot) — subdivisión de un lote
-- =============================================================================
CREATE TABLE corrales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_id           UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  capacidad_cabezas NUMERIC(10,0),
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_corrales_empresa ON corrales(empresa_id);
CREATE INDEX idx_corrales_lote    ON corrales(lote_id);

ALTER TABLE corrales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corrales_select" ON corrales FOR SELECT
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "corrales_insert" ON corrales FOR INSERT
  WITH CHECK (
    user_has_empresa_access(empresa_id)
    AND empresa_id_de_lote(lote_id) = empresa_id
  );

CREATE POLICY "corrales_update" ON corrales FOR UPDATE
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "corrales_delete" ON corrales FOR DELETE
  USING (user_has_empresa_access(empresa_id));

CREATE TRIGGER set_updated_at_corrales
  BEFORE UPDATE ON corrales
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- POTREROS (uso extensivo / campo abierto) — subdivisión de un lote
-- =============================================================================
CREATE TABLE potreros (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_id           UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  superficie_ha     NUMERIC(10,2),
  capacidad_cabezas NUMERIC(10,0),
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_potreros_empresa ON potreros(empresa_id);
CREATE INDEX idx_potreros_lote    ON potreros(lote_id);

ALTER TABLE potreros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "potreros_select" ON potreros FOR SELECT
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "potreros_insert" ON potreros FOR INSERT
  WITH CHECK (
    user_has_empresa_access(empresa_id)
    AND empresa_id_de_lote(lote_id) = empresa_id
  );

CREATE POLICY "potreros_update" ON potreros FOR UPDATE
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "potreros_delete" ON potreros FOR DELETE
  USING (user_has_empresa_access(empresa_id));

CREATE TRIGGER set_updated_at_potreros
  BEFORE UPDATE ON potreros
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- LOTES_HACIENDA (equivalente ganadero de un "cultivo")
-- =============================================================================
CREATE TABLE lotes_hacienda (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  corral_id                 UUID REFERENCES corrales(id) ON DELETE SET NULL,
  potrero_id                UUID REFERENCES potreros(id) ON DELETE SET NULL,
  categoria_hacienda_id     UUID REFERENCES categorias_hacienda(id),
  etapa_productiva          TEXT NOT NULL CHECK (etapa_productiva IN ('cria', 'recria_invernada', 'terminacion')),
  nombre                    TEXT NOT NULL,
  fecha_ingreso             DATE NOT NULL DEFAULT CURRENT_DATE,
  origen                    TEXT NOT NULL CHECK (origen IN ('compra', 'cria_propia')),
  peso_promedio_ingreso_kg  NUMERIC(10,2),
  estado                    TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cerrado')),
  observaciones             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_lotes_hacienda_una_ubicacion CHECK (NOT (corral_id IS NOT NULL AND potrero_id IS NOT NULL))
);

CREATE INDEX idx_lotes_hacienda_empresa ON lotes_hacienda(empresa_id);
CREATE INDEX idx_lotes_hacienda_corral  ON lotes_hacienda(corral_id);
CREATE INDEX idx_lotes_hacienda_potrero ON lotes_hacienda(potrero_id);

ALTER TABLE lotes_hacienda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lotes_hacienda_all" ON lotes_hacienda FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

CREATE TRIGGER set_updated_at_lotes_hacienda
  BEFORE UPDATE ON lotes_hacienda
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- ANIMALES (registro individual, identificado por caravana)
-- =============================================================================
CREATE TABLE animales (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_hacienda_id   UUID NOT NULL REFERENCES lotes_hacienda(id) ON DELETE CASCADE,
  caravana           TEXT NOT NULL,
  categoria_hacienda_id UUID REFERENCES categorias_hacienda(id),
  sexo               TEXT CHECK (sexo IN ('macho', 'hembra')),
  fecha_nacimiento   DATE,
  peso_ingreso_kg    NUMERIC(10,2),
  estado             TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'vendido', 'muerto', 'trasladado')),
  observaciones      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, caravana)
);

CREATE INDEX idx_animales_empresa       ON animales(empresa_id);
CREATE INDEX idx_animales_lote_hacienda ON animales(lote_hacienda_id);

ALTER TABLE animales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "animales_all" ON animales FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

-- =============================================================================
-- Seed: categorías estándar para Canciani
-- =============================================================================
DO $$
DECLARE
  v_empresa_id UUID := '90733d04-96ae-4ac5-9115-738c64f84b60';
  v_nombre TEXT;
  v_orden INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE id = v_empresa_id) THEN
    RETURN;
  END IF;

  FOR v_nombre IN
    SELECT unnest(ARRAY['TERNERO/A', 'NOVILLITO', 'NOVILLO', 'VAQUILLONA', 'VACA', 'TORO'])
  LOOP
    v_orden := v_orden + 1;
    INSERT INTO categorias_hacienda (empresa_id, nombre, orden)
    VALUES (v_empresa_id, v_nombre, v_orden);
  END LOOP;
END $$;
