-- =============================================================================
-- Migración 017: Remito Interno Agrícola (RIA)
-- =============================================================================

-- Nuevos tipos de movimiento para RIA
ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'salida_ria';
ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'entrada_produccion_ria';

-- Actualizar trigger para manejar los nuevos tipos
CREATE OR REPLACE FUNCTION aplicar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE
  delta NUMERIC;
BEGIN
  IF NEW.tipo IN ('entrada_compra', 'entrada_devolucion', 'transferencia_entrada', 'entrada_produccion_ria') THEN
    delta := NEW.cantidad;
  ELSIF NEW.tipo IN ('salida_aplicacion', 'transferencia_salida', 'merma', 'salida_ria') THEN
    delta := -NEW.cantidad;
  ELSIF NEW.tipo = 'ajuste' THEN
    delta := NEW.cantidad;
  ELSE
    delta := 0;
  END IF;

  INSERT INTO stock (deposito_id, producto_id, cantidad_actual)
  VALUES (NEW.deposito_id, NEW.producto_id, delta)
  ON CONFLICT (deposito_id, producto_id)
  DO UPDATE SET
    cantidad_actual = stock.cantidad_actual + delta,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Estado del RIA
CREATE TYPE estado_ria AS ENUM ('borrador', 'confirmado', 'anulado');

-- Unidad de medida para labores del RIA
CREATE TYPE unidad_labor_ria AS ENUM ('has', 'hs', 'tn', 'viaje', 'global', 'km');

-- =============================================================================
-- REMITOS INTERNOS (cabecera)
-- =============================================================================
CREATE TABLE remitos_internos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_anio          INTEGER NOT NULL,
  numero_correlativo   INTEGER NOT NULL,
  numero_ria           TEXT NOT NULL,
  fecha                DATE NOT NULL DEFAULT CURRENT_DATE,
  operador_id          UUID REFERENCES auth.users(id),
  lote_id              UUID NOT NULL REFERENCES lotes(id),
  campania_id          UUID REFERENCES campanias(id),
  cultivo_id           UUID REFERENCES cultivos(id),
  superficie_afectada  NUMERIC(10,2),
  cultivo_descripcion  TEXT,
  estado               estado_ria NOT NULL DEFAULT 'borrador',
  total_insumos        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_labores        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ria            NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_por_ha         NUMERIC(14,2),
  motivo_anulacion     TEXT,
  anulado_por          UUID REFERENCES auth.users(id),
  fecha_anulacion      TIMESTAMPTZ,
  observaciones        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, numero_anio, numero_correlativo)
);

CREATE INDEX idx_ria_empresa  ON remitos_internos(empresa_id);
CREATE INDEX idx_ria_lote     ON remitos_internos(lote_id);
CREATE INDEX idx_ria_fecha    ON remitos_internos(fecha);
CREATE INDEX idx_ria_estado   ON remitos_internos(estado);
CREATE INDEX idx_ria_campania ON remitos_internos(campania_id);

-- =============================================================================
-- REMITOS INSUMOS (egreso de stock hacia el lote)
-- =============================================================================
CREATE TABLE remitos_insumos (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remito_id              UUID NOT NULL REFERENCES remitos_internos(id) ON DELETE CASCADE,
  deposito_id            UUID NOT NULL REFERENCES depositos(id),
  producto_id            UUID NOT NULL REFERENCES productos(id),
  cantidad               NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  dosis_por_ha           NUMERIC(14,4),
  costo_unitario         NUMERIC(14,4) NOT NULL DEFAULT 0,
  costo_unitario_manual  BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal               NUMERIC(14,2) NOT NULL DEFAULT 0,
  observaciones          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ria_insumos_remito   ON remitos_insumos(remito_id);
CREATE INDEX idx_ria_insumos_producto ON remitos_insumos(producto_id);
CREATE INDEX idx_ria_insumos_deposito ON remitos_insumos(deposito_id);

-- =============================================================================
-- REMITOS LABORES (servicios, labores, aplicaciones)
-- =============================================================================
CREATE TABLE remitos_labores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remito_id         UUID NOT NULL REFERENCES remitos_internos(id) ON DELETE CASCADE,
  tipo_labor_id     UUID REFERENCES tipos_labor(id),
  tipo_labor_nombre TEXT,
  descripcion       TEXT NOT NULL,
  prestador_id      UUID REFERENCES proveedores(id),
  prestador_nombre  TEXT,
  unidad_medida     unidad_labor_ria NOT NULL DEFAULT 'has',
  cantidad          NUMERIC(14,4) NOT NULL DEFAULT 0,
  tarifa            NUMERIC(14,4) NOT NULL DEFAULT 0,
  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_ejecucion   DATE,
  observaciones     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ria_labores_remito ON remitos_labores(remito_id);

-- =============================================================================
-- REMITOS PRODUCCION (ingreso de cosecha al stock)
-- =============================================================================
CREATE TABLE remitos_produccion (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remito_id                 UUID NOT NULL REFERENCES remitos_internos(id) ON DELETE CASCADE,
  producto_id               UUID NOT NULL REFERENCES productos(id),
  deposito_ingreso_id       UUID NOT NULL REFERENCES depositos(id),
  cantidad                  NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  rendimiento_por_ha        NUMERIC(14,4),
  humedad_porcentaje        NUMERIC(5,2),
  calidad_categoria         TEXT,
  precio_referencia         NUMERIC(14,4),
  subtotal_valor            NUMERIC(14,2),
  costo_produccion_unitario NUMERIC(14,4),
  observaciones             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ria_produccion_remito   ON remitos_produccion(remito_id);
CREATE INDEX idx_ria_produccion_producto ON remitos_produccion(producto_id);

-- =============================================================================
-- HELPER FUNCTION para RLS
-- =============================================================================
CREATE OR REPLACE FUNCTION empresa_id_de_ria(ria_uuid UUID)
RETURNS UUID AS $$
  SELECT empresa_id FROM remitos_internos WHERE id = ria_uuid;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: confirmar_ria — operación atómica
-- =============================================================================
CREATE OR REPLACE FUNCTION confirmar_ria(
  p_ria_id     UUID,
  p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ria          remitos_internos%ROWTYPE;
  v_insumo       remitos_insumos%ROWTYPE;
  v_prod         remitos_produccion%ROWTYPE;
  v_stock_actual NUMERIC;
  v_prod_nombre  TEXT;
  v_dep_nombre   TEXT;
  v_total_ins    NUMERIC := 0;
  v_total_lab    NUMERIC := 0;
BEGIN
  SELECT * INTO v_ria FROM remitos_internos WHERE id = p_ria_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RIA no encontrado.');
  END IF;

  -- Verificar acceso del usuario a la empresa del RIA
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_empresas
    WHERE usuario_id = p_usuario_id AND empresa_id = v_ria.empresa_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin acceso a este RIA.');
  END IF;

  IF v_ria.estado != 'borrador' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El RIA no está en estado BORRADOR.');
  END IF;

  -- Validar que tenga al menos una línea
  IF NOT EXISTS (SELECT 1 FROM remitos_insumos   WHERE remito_id = p_ria_id)
     AND NOT EXISTS (SELECT 1 FROM remitos_labores    WHERE remito_id = p_ria_id)
     AND NOT EXISTS (SELECT 1 FROM remitos_produccion WHERE remito_id = p_ria_id)
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El RIA no tiene contenido. Agregue al menos una línea antes de confirmar.');
  END IF;

  -- Validar stock para cada insumo
  FOR v_insumo IN SELECT * FROM remitos_insumos WHERE remito_id = p_ria_id LOOP
    SELECT COALESCE(s.cantidad_actual, 0) INTO v_stock_actual
    FROM stock s
    WHERE s.deposito_id = v_insumo.deposito_id AND s.producto_id = v_insumo.producto_id;

    IF v_stock_actual < v_insumo.cantidad THEN
      SELECT p.nombre INTO v_prod_nombre FROM productos p WHERE p.id = v_insumo.producto_id;
      SELECT d.nombre INTO v_dep_nombre  FROM depositos d WHERE d.id = v_insumo.deposito_id;
      RETURN jsonb_build_object(
        'ok', false,
        'error', format(
          'Stock insuficiente: %s en %s. Disponible: %s. Solicitado: %s.',
          v_prod_nombre, v_dep_nombre,
          round(COALESCE(v_stock_actual, 0)::NUMERIC, 4),
          round(v_insumo.cantidad, 4)
        )
      );
    END IF;
  END LOOP;

  -- Registrar egresos de insumos
  FOR v_insumo IN SELECT * FROM remitos_insumos WHERE remito_id = p_ria_id LOOP
    INSERT INTO movimientos_stock (
      deposito_id, producto_id, tipo, cantidad, fecha,
      usuario_id, referencia_tipo, referencia_id
    ) VALUES (
      v_insumo.deposito_id, v_insumo.producto_id,
      'salida_ria', v_insumo.cantidad, v_ria.fecha,
      p_usuario_id, 'remito_interno', p_ria_id
    );
    v_total_ins := v_total_ins + v_insumo.subtotal;
  END LOOP;

  -- Total labores
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total_lab
  FROM remitos_labores WHERE remito_id = p_ria_id;

  -- Registrar ingresos de producción
  FOR v_prod IN SELECT * FROM remitos_produccion WHERE remito_id = p_ria_id LOOP
    INSERT INTO movimientos_stock (
      deposito_id, producto_id, tipo, cantidad, fecha,
      usuario_id, referencia_tipo, referencia_id
    ) VALUES (
      v_prod.deposito_ingreso_id, v_prod.producto_id,
      'entrada_produccion_ria', v_prod.cantidad, v_ria.fecha,
      p_usuario_id, 'remito_interno', p_ria_id
    );
  END LOOP;

  -- Actualizar totales y confirmar
  UPDATE remitos_internos SET
    estado        = 'confirmado',
    total_insumos = v_total_ins,
    total_labores = v_total_lab,
    total_ria     = v_total_ins + v_total_lab,
    costo_por_ha  = CASE
                      WHEN v_ria.superficie_afectada > 0
                      THEN (v_total_ins + v_total_lab) / v_ria.superficie_afectada
                      ELSE NULL
                    END,
    updated_at    = NOW()
  WHERE id = p_ria_id;

  RETURN jsonb_build_object('ok', true, 'total', v_total_ins + v_total_lab);
END;
$$;

-- =============================================================================
-- FUNCTION: anular_ria — revierte movimientos atómicamente
-- =============================================================================
CREATE OR REPLACE FUNCTION anular_ria(
  p_ria_id     UUID,
  p_usuario_id UUID,
  p_motivo     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ria    remitos_internos%ROWTYPE;
  v_insumo remitos_insumos%ROWTYPE;
  v_prod   remitos_produccion%ROWTYPE;
BEGIN
  SELECT * INTO v_ria FROM remitos_internos WHERE id = p_ria_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RIA no encontrado.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuarios_empresas
    WHERE usuario_id = p_usuario_id AND empresa_id = v_ria.empresa_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin acceso a este RIA.');
  END IF;

  IF v_ria.estado != 'confirmado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo se pueden anular RIA confirmados.');
  END IF;

  -- Revertir egresos de insumos (devolver stock)
  FOR v_insumo IN SELECT * FROM remitos_insumos WHERE remito_id = p_ria_id LOOP
    INSERT INTO movimientos_stock (
      deposito_id, producto_id, tipo, cantidad, fecha,
      usuario_id, referencia_tipo, referencia_id, observaciones
    ) VALUES (
      v_insumo.deposito_id, v_insumo.producto_id,
      'entrada_devolucion', v_insumo.cantidad, CURRENT_DATE,
      p_usuario_id, 'anulacion_ria', p_ria_id,
      'Anulación de ' || v_ria.numero_ria || ': ' || COALESCE(p_motivo, '')
    );
  END LOOP;

  -- Revertir ingresos de producción (sacar del stock)
  FOR v_prod IN SELECT * FROM remitos_produccion WHERE remito_id = p_ria_id LOOP
    INSERT INTO movimientos_stock (
      deposito_id, producto_id, tipo, cantidad, fecha,
      usuario_id, referencia_tipo, referencia_id, observaciones
    ) VALUES (
      v_prod.deposito_ingreso_id, v_prod.producto_id,
      'transferencia_salida', v_prod.cantidad, CURRENT_DATE,
      p_usuario_id, 'anulacion_ria', p_ria_id,
      'Anulación producción ' || v_ria.numero_ria || ': ' || COALESCE(p_motivo, '')
    );
  END LOOP;

  -- Marcar RIA como anulado
  UPDATE remitos_internos SET
    estado           = 'anulado',
    motivo_anulacion = p_motivo,
    anulado_por      = p_usuario_id,
    fecha_anulacion  = NOW(),
    updated_at       = NOW()
  WHERE id = p_ria_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE remitos_internos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE remitos_insumos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE remitos_labores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE remitos_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY ria_all ON remitos_internos FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY ria_insumos_all ON remitos_insumos FOR ALL
  USING (user_has_empresa_access(empresa_id_de_ria(remito_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_ria(remito_id)));

CREATE POLICY ria_labores_all ON remitos_labores FOR ALL
  USING (user_has_empresa_access(empresa_id_de_ria(remito_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_ria(remito_id)));

CREATE POLICY ria_produccion_all ON remitos_produccion FOR ALL
  USING (user_has_empresa_access(empresa_id_de_ria(remito_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_ria(remito_id)));

-- Trigger updated_at
CREATE TRIGGER set_updated_at_ria
  BEFORE UPDATE ON remitos_internos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
