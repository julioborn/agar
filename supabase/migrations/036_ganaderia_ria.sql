-- =============================================================================
-- Migración 036: Stock unificado (Insumos + Producción) y RIA Ganadero
-- Agrega rubro a productos (Agricultura/Ganadería), costo_directo_ars a
-- lotes_hacienda, y el remito ganadero (equivalente al RIA agrícola pero
-- apuntando a un lote de hacienda en vez de un lote/cultivo): consume stock
-- (insumos comprados o producción propia) y lo imputa a ese lote de hacienda.
-- =============================================================================

-- =============================================================================
-- PRODUCTOS: rubro (a qué unidad productiva pertenece)
-- =============================================================================
ALTER TABLE productos
  ADD COLUMN rubro TEXT NOT NULL DEFAULT 'agricultura' CHECK (rubro IN ('agricultura', 'ganaderia'));

-- =============================================================================
-- LOTES_HACIENDA: costo directo acumulado (mismo rol que cultivos.costo_directo_ars)
-- =============================================================================
ALTER TABLE lotes_hacienda
  ADD COLUMN costo_directo_ars NUMERIC(14,2) NOT NULL DEFAULT 0;

-- =============================================================================
-- Redefinir el trigger de stock para incluir el consumo ganadero
-- =============================================================================
CREATE OR REPLACE FUNCTION aplicar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE
  delta NUMERIC;
BEGIN
  IF NEW.tipo IN ('entrada_compra', 'entrada_devolucion', 'transferencia_entrada', 'entrada_produccion_ria') THEN
    delta := NEW.cantidad;
  ELSIF NEW.tipo IN ('salida_aplicacion', 'transferencia_salida', 'merma', 'salida_ria', 'salida_consumo_ganadero') THEN
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

-- =============================================================================
-- REMITOS_GANADEROS (cabecera) — equivalente ganadero del RIA agrícola
-- =============================================================================
CREATE TABLE remitos_ganaderos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_anio        INTEGER NOT NULL,
  numero_correlativo INTEGER NOT NULL,
  numero_rig         TEXT NOT NULL,
  fecha              DATE NOT NULL DEFAULT CURRENT_DATE,
  operador_id        UUID REFERENCES auth.users(id),
  lote_hacienda_id   UUID NOT NULL REFERENCES lotes_hacienda(id),
  estado             estado_ria NOT NULL DEFAULT 'borrador',
  total_insumos      NUMERIC(14,2) NOT NULL DEFAULT 0,
  motivo_anulacion   TEXT,
  anulado_por        UUID REFERENCES auth.users(id),
  fecha_anulacion    TIMESTAMPTZ,
  observaciones      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, numero_anio, numero_correlativo)
);

CREATE INDEX idx_remitos_ganaderos_empresa ON remitos_ganaderos(empresa_id);
CREATE INDEX idx_remitos_ganaderos_lote    ON remitos_ganaderos(lote_hacienda_id);
CREATE INDEX idx_remitos_ganaderos_estado  ON remitos_ganaderos(estado);

-- =============================================================================
-- REMITOS_GANADEROS_INSUMOS (detalle)
-- =============================================================================
CREATE TABLE remitos_ganaderos_insumos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remito_id      UUID NOT NULL REFERENCES remitos_ganaderos(id) ON DELETE CASCADE,
  deposito_id    UUID NOT NULL REFERENCES depositos(id),
  producto_id    UUID NOT NULL REFERENCES productos(id),
  cantidad       NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0,
  observaciones  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_remitos_ganaderos_insumos_remito   ON remitos_ganaderos_insumos(remito_id);
CREATE INDEX idx_remitos_ganaderos_insumos_producto ON remitos_ganaderos_insumos(producto_id);

-- =============================================================================
-- HELPER FUNCTION para RLS
-- =============================================================================
CREATE OR REPLACE FUNCTION empresa_id_de_remito_ganadero(remito_uuid UUID)
RETURNS UUID AS $$
  SELECT empresa_id FROM remitos_ganaderos WHERE id = remito_uuid;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: confirmar_remito_ganadero — operación atómica
-- =============================================================================
CREATE OR REPLACE FUNCTION confirmar_remito_ganadero(
  p_remito_id  UUID,
  p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remito       remitos_ganaderos%ROWTYPE;
  v_insumo       remitos_ganaderos_insumos%ROWTYPE;
  v_stock_actual NUMERIC;
  v_prod_nombre  TEXT;
  v_dep_nombre   TEXT;
  v_total        NUMERIC := 0;
BEGIN
  SELECT * INTO v_remito FROM remitos_ganaderos WHERE id = p_remito_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Remito no encontrado.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuarios_empresas
    WHERE usuario_id = p_usuario_id AND empresa_id = v_remito.empresa_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin acceso a este remito.');
  END IF;

  IF v_remito.estado != 'borrador' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El remito no está en estado BORRADOR.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM remitos_ganaderos_insumos WHERE remito_id = p_remito_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El remito no tiene insumos. Agregue al menos una línea antes de confirmar.');
  END IF;

  FOR v_insumo IN SELECT * FROM remitos_ganaderos_insumos WHERE remito_id = p_remito_id LOOP
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

  FOR v_insumo IN SELECT * FROM remitos_ganaderos_insumos WHERE remito_id = p_remito_id LOOP
    INSERT INTO movimientos_stock (
      deposito_id, producto_id, tipo, cantidad, fecha,
      usuario_id, referencia_tipo, referencia_id
    ) VALUES (
      v_insumo.deposito_id, v_insumo.producto_id,
      'salida_consumo_ganadero', v_insumo.cantidad, v_remito.fecha,
      p_usuario_id, 'remito_ganadero', p_remito_id
    );
    v_total := v_total + v_insumo.subtotal;
  END LOOP;

  UPDATE remitos_ganaderos SET
    estado        = 'confirmado',
    total_insumos = v_total,
    updated_at    = NOW()
  WHERE id = p_remito_id;

  RETURN jsonb_build_object('ok', true, 'total', v_total);
END;
$$;

-- =============================================================================
-- FUNCTION: anular_remito_ganadero — revierte movimientos atómicamente
-- =============================================================================
CREATE OR REPLACE FUNCTION anular_remito_ganadero(
  p_remito_id  UUID,
  p_usuario_id UUID,
  p_motivo     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remito remitos_ganaderos%ROWTYPE;
  v_insumo remitos_ganaderos_insumos%ROWTYPE;
BEGIN
  SELECT * INTO v_remito FROM remitos_ganaderos WHERE id = p_remito_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Remito no encontrado.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuarios_empresas
    WHERE usuario_id = p_usuario_id AND empresa_id = v_remito.empresa_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin acceso a este remito.');
  END IF;

  IF v_remito.estado != 'confirmado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo se pueden anular remitos confirmados.');
  END IF;

  FOR v_insumo IN SELECT * FROM remitos_ganaderos_insumos WHERE remito_id = p_remito_id LOOP
    INSERT INTO movimientos_stock (
      deposito_id, producto_id, tipo, cantidad, fecha,
      usuario_id, referencia_tipo, referencia_id, observaciones
    ) VALUES (
      v_insumo.deposito_id, v_insumo.producto_id,
      'entrada_devolucion', v_insumo.cantidad, CURRENT_DATE,
      p_usuario_id, 'anulacion_remito_ganadero', p_remito_id,
      'Anulación de ' || v_remito.numero_rig || ': ' || COALESCE(p_motivo, '')
    );
  END LOOP;

  UPDATE remitos_ganaderos SET
    estado           = 'anulado',
    motivo_anulacion = p_motivo,
    anulado_por      = p_usuario_id,
    fecha_anulacion  = NOW(),
    updated_at       = NOW()
  WHERE id = p_remito_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE remitos_ganaderos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE remitos_ganaderos_insumos  ENABLE ROW LEVEL SECURITY;

CREATE POLICY remitos_ganaderos_all ON remitos_ganaderos FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY remitos_ganaderos_insumos_all ON remitos_ganaderos_insumos FOR ALL
  USING (user_has_empresa_access(empresa_id_de_remito_ganadero(remito_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_remito_ganadero(remito_id)));

CREATE TRIGGER set_updated_at_remitos_ganaderos
  BEFORE UPDATE ON remitos_ganaderos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
