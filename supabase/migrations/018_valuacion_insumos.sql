-- =============================================================================
-- Migración 018: Valuación de Insumos e Imputación de Costos a Lotes
-- =============================================================================
-- Distingue dos procesos:
--   1. Criterio de imputación al lote: precio que se carga al lote al aplicar el insumo
--   2. Criterio de valuación del stock: cómo se valoriza el inventario disponible
-- Ambos son configurables por empresa, por categoría o por producto individual.
-- =============================================================================

-- ─── 1. Precio snapshot en movimientos de stock ──────────────────────────────
-- Cada movimiento de egreso registra el precio efectivamente aplicado
-- y el método utilizado (snapshot histórico, no recalculable a posteriori)

ALTER TABLE movimientos_stock
  ADD COLUMN IF NOT EXISTS precio_unitario_aplicado NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS metodo_valuacion TEXT
    CHECK (metodo_valuacion IN ('ultima_compra', 'ppp', 'reposicion', 'manual'));

-- ─── 2. Configuración de criterios de valuación ──────────────────────────────
-- Jerarquía: producto específico > tipo de producto > global de empresa
-- El sistema resuelve la jerarquía buscando de más específico a más general.

CREATE TABLE config_valuacion (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Alcance (mutuamente excluyentes: solo uno puede estar seteado)
  producto_id          UUID REFERENCES productos(id) ON DELETE CASCADE,
  tipo_producto        TEXT,  -- valor del enum categoria_producto

  -- Criterios
  criterio_imputacion  TEXT NOT NULL DEFAULT 'ultima_compra'
    CHECK (criterio_imputacion IN ('ultima_compra', 'ppp', 'reposicion')),
  criterio_stock       TEXT NOT NULL DEFAULT 'ppp'
    CHECK (criterio_stock IN ('ultima_compra', 'ppp', 'reposicion')),

  observaciones        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un solo registro por alcance por empresa
CREATE UNIQUE INDEX uq_config_val_global
  ON config_valuacion (empresa_id)
  WHERE producto_id IS NULL AND tipo_producto IS NULL;

CREATE UNIQUE INDEX uq_config_val_tipo
  ON config_valuacion (empresa_id, tipo_producto)
  WHERE producto_id IS NULL AND tipo_producto IS NOT NULL;

CREATE UNIQUE INDEX uq_config_val_producto
  ON config_valuacion (empresa_id, producto_id)
  WHERE producto_id IS NOT NULL;

CREATE INDEX idx_config_val_empresa ON config_valuacion(empresa_id);

ALTER TABLE config_valuacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY cv_all ON config_valuacion FOR ALL
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ))
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE TRIGGER trg_config_val_updated_at
  BEFORE UPDATE ON config_valuacion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── 3. Precios de reposición ─────────────────────────────────────────────────
-- Precio de mercado / valor a nuevo del insumo, ingresado manualmente.
-- Permite el criterio de valuación por "valor de reposición".
-- Soporta múltiples vigencias históricas por producto.

CREATE TABLE precios_reposicion (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio_ars      NUMERIC(14,4) NOT NULL CHECK (precio_ars >= 0),
  vigencia_desde  DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta  DATE,
  observaciones   TEXT,
  usuario_id      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_vigencia CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
);

CREATE INDEX idx_precios_rep_empresa   ON precios_reposicion(empresa_id);
CREATE INDEX idx_precios_rep_producto  ON precios_reposicion(producto_id);
CREATE INDEX idx_precios_rep_vigencia  ON precios_reposicion(vigencia_desde);

ALTER TABLE precios_reposicion ENABLE ROW LEVEL SECURITY;

CREATE POLICY pr_select ON precios_reposicion FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

CREATE POLICY pr_insert ON precios_reposicion FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY pr_update ON precios_reposicion FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY pr_delete ON precios_reposicion FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

-- =============================================================================
-- FUNCIONES DE VALUACIÓN
-- =============================================================================

-- ─── fn_precio_ultima_compra ──────────────────────────────────────────────────
-- Devuelve el precio unitario en ARS de la compra más reciente del producto
-- para la empresa indicada. Desempate: fecha desc, created_at desc.

CREATE OR REPLACE FUNCTION fn_precio_ultima_compra(
  p_producto_id UUID,
  p_empresa_id  UUID
) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT ci.precio_unitario_ars
  FROM compras_items ci
  JOIN compras c ON c.id = ci.compra_id
  WHERE ci.producto_id = p_producto_id
    AND c.empresa_id   = p_empresa_id
    AND c.estado       = 'confirmada'
  ORDER BY c.fecha DESC, c.created_at DESC
  LIMIT 1;
$$;

-- ─── fn_precio_ppp ────────────────────────────────────────────────────────────
-- Promedio ponderado de las capas (partidas) de compra vigentes en el depósito.
-- Las capas FIFO (partidas_producto) reflejan el inventario remanente por lote.
-- Si no hay capas activas, cae a última compra como fallback.

CREATE OR REPLACE FUNCTION fn_precio_ppp(
  p_producto_id UUID,
  p_deposito_id UUID,
  p_empresa_id  UUID
) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    -- PPP de las capas vigentes en el depósito
    (
      SELECT CASE WHEN SUM(pp.cantidad_actual) > 0
               THEN SUM(pp.cantidad_actual * pp.costo_unitario_ars) / SUM(pp.cantidad_actual)
               ELSE NULL
             END
      FROM partidas_producto pp
      JOIN compras_items ci ON ci.id = pp.compra_item_id
      WHERE pp.producto_id        = p_producto_id
        AND ci.deposito_destino_id = p_deposito_id
        AND pp.estado              = 'activa'
        AND pp.cantidad_actual     > 0
    ),
    -- Fallback: última compra
    fn_precio_ultima_compra(p_producto_id, p_empresa_id)
  );
$$;

-- ─── fn_precio_reposicion ─────────────────────────────────────────────────────
-- Devuelve el precio de reposición vigente a una fecha para el producto.

CREATE OR REPLACE FUNCTION fn_precio_reposicion(
  p_producto_id UUID,
  p_empresa_id  UUID,
  p_fecha       DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT precio_ars
  FROM precios_reposicion
  WHERE producto_id   = p_producto_id
    AND empresa_id    = p_empresa_id
    AND vigencia_desde <= p_fecha
    AND (vigencia_hasta IS NULL OR vigencia_hasta >= p_fecha)
  ORDER BY vigencia_desde DESC
  LIMIT 1;
$$;

-- ─── fn_criterio_imputacion ───────────────────────────────────────────────────
-- Resuelve el criterio de imputación al lote para un producto dado, aplicando
-- la jerarquía: producto-específico > tipo de producto > global > default.

CREATE OR REPLACE FUNCTION fn_criterio_imputacion(
  p_producto_id   UUID,
  p_tipo_producto TEXT,
  p_empresa_id    UUID
) RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT criterio_imputacion FROM config_valuacion
     WHERE empresa_id = p_empresa_id AND producto_id = p_producto_id
     LIMIT 1),
    (SELECT criterio_imputacion FROM config_valuacion
     WHERE empresa_id = p_empresa_id
       AND tipo_producto = p_tipo_producto
       AND producto_id IS NULL
     LIMIT 1),
    (SELECT criterio_imputacion FROM config_valuacion
     WHERE empresa_id = p_empresa_id
       AND producto_id IS NULL
       AND tipo_producto IS NULL
     LIMIT 1),
    'ultima_compra'
  );
$$;

-- ─── fn_criterio_stock ────────────────────────────────────────────────────────
-- Resuelve el criterio de valuación de stock para un producto, misma jerarquía.

CREATE OR REPLACE FUNCTION fn_criterio_stock(
  p_producto_id   UUID,
  p_tipo_producto TEXT,
  p_empresa_id    UUID
) RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT criterio_stock FROM config_valuacion
     WHERE empresa_id = p_empresa_id AND producto_id = p_producto_id
     LIMIT 1),
    (SELECT criterio_stock FROM config_valuacion
     WHERE empresa_id = p_empresa_id
       AND tipo_producto = p_tipo_producto
       AND producto_id IS NULL
     LIMIT 1),
    (SELECT criterio_stock FROM config_valuacion
     WHERE empresa_id = p_empresa_id
       AND producto_id IS NULL
       AND tipo_producto IS NULL
     LIMIT 1),
    'ppp'
  );
$$;

-- ─── fn_precio_imputacion ────────────────────────────────────────────────────
-- Función principal: devuelve el precio a aplicar al imputar un insumo al lote
-- según el criterio configurado. Retorna también el criterio utilizado.

CREATE OR REPLACE FUNCTION fn_precio_imputacion(
  p_producto_id   UUID,
  p_deposito_id   UUID,
  p_tipo_producto TEXT,
  p_empresa_id    UUID,
  p_fecha         DATE DEFAULT CURRENT_DATE
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_criterio TEXT;
  v_precio   NUMERIC;
BEGIN
  v_criterio := fn_criterio_imputacion(p_producto_id, p_tipo_producto, p_empresa_id);

  v_precio := CASE v_criterio
    WHEN 'ultima_compra' THEN fn_precio_ultima_compra(p_producto_id, p_empresa_id)
    WHEN 'ppp'           THEN fn_precio_ppp(p_producto_id, p_deposito_id, p_empresa_id)
    WHEN 'reposicion'    THEN COALESCE(
                                fn_precio_reposicion(p_producto_id, p_empresa_id, p_fecha),
                                fn_precio_ultima_compra(p_producto_id, p_empresa_id)
                              )
    ELSE fn_precio_ultima_compra(p_producto_id, p_empresa_id)
  END;

  RETURN jsonb_build_object(
    'precio',   v_precio,
    'criterio', v_criterio
  );
END;
$$;

-- ─── fn_valuacion_stock ───────────────────────────────────────────────────────
-- Genera la valuación del stock de todos los productos de la empresa
-- bajo los tres criterios simultáneamente (para el informe comparativo).
-- Retorna un conjunto de filas con los tres valores por depósito+producto.

CREATE OR REPLACE FUNCTION fn_valuacion_stock(
  p_empresa_id UUID,
  p_fecha      DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  deposito_id          UUID,
  deposito_nombre      TEXT,
  producto_id          UUID,
  producto_nombre      TEXT,
  categoria            TEXT,
  unidad_base          TEXT,
  cantidad_actual      NUMERIC,
  precio_ultima_compra NUMERIC,
  precio_ppp           NUMERIC,
  precio_reposicion    NUMERIC,
  valor_ultima_compra  NUMERIC,
  valor_ppp            NUMERIC,
  valor_reposicion     NUMERIC,
  criterio_configurado TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    s.deposito_id,
    d.nombre                                                    AS deposito_nombre,
    s.producto_id,
    p.nombre                                                    AS producto_nombre,
    p.categoria::TEXT                                           AS categoria,
    p.unidad_base::TEXT                                         AS unidad_base,
    s.cantidad_actual,
    fn_precio_ultima_compra(s.producto_id, p.empresa_id)        AS precio_ultima_compra,
    fn_precio_ppp(s.producto_id, s.deposito_id, p.empresa_id)   AS precio_ppp,
    fn_precio_reposicion(s.producto_id, p.empresa_id, p_fecha)  AS precio_reposicion,
    s.cantidad_actual * fn_precio_ultima_compra(s.producto_id, p.empresa_id)
                                                                AS valor_ultima_compra,
    s.cantidad_actual * fn_precio_ppp(s.producto_id, s.deposito_id, p.empresa_id)
                                                                AS valor_ppp,
    s.cantidad_actual * COALESCE(
      fn_precio_reposicion(s.producto_id, p.empresa_id, p_fecha),
      fn_precio_ultima_compra(s.producto_id, p.empresa_id))     AS valor_reposicion,
    fn_criterio_stock(s.producto_id, p.categoria::TEXT, p.empresa_id)
                                                                AS criterio_configurado
  FROM stock s
  JOIN depositos d ON d.id = s.deposito_id
  JOIN productos p ON p.id = s.producto_id
  WHERE d.empresa_id    = p_empresa_id
    AND s.cantidad_actual > 0;
$$;

-- =============================================================================
-- ACTUALIZAR confirmar_ria() para registrar precio snapshot en movimientos
-- =============================================================================
-- Se agrega la captura de precio_unitario_aplicado y metodo_valuacion en
-- cada movimiento de salida de insumos, usando la función fn_precio_imputacion.

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
  v_precio_info  JSONB;
  v_precio_snap  NUMERIC;
  v_metodo_snap  TEXT;
  v_tipo_prod    TEXT;
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

  IF v_ria.estado != 'borrador' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El RIA no está en estado BORRADOR.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM remitos_insumos   WHERE remito_id = p_ria_id)
     AND NOT EXISTS (SELECT 1 FROM remitos_labores    WHERE remito_id = p_ria_id)
     AND NOT EXISTS (SELECT 1 FROM remitos_produccion WHERE remito_id = p_ria_id)
  THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'El RIA no tiene contenido. Agregue al menos una línea antes de confirmar.');
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

  -- Registrar egresos de insumos con precio snapshot
  FOR v_insumo IN SELECT * FROM remitos_insumos WHERE remito_id = p_ria_id LOOP
    -- Obtener tipo de producto para la jerarquía de criterios
    SELECT categoria::TEXT INTO v_tipo_prod
    FROM productos WHERE id = v_insumo.producto_id;

    -- Resolver precio e imputación según criterio configurado
    v_precio_info := fn_precio_imputacion(
      v_insumo.producto_id,
      v_insumo.deposito_id,
      v_tipo_prod,
      v_ria.empresa_id,
      v_ria.fecha
    );

    -- Usar el precio del RIA si está definido, si no el calculado
    v_precio_snap := COALESCE(
      v_insumo.costo_unitario,
      (v_precio_info->>'precio')::NUMERIC
    );
    v_metodo_snap := CASE
      WHEN v_insumo.costo_unitario IS NOT NULL AND v_insumo.costo_unitario > 0
      THEN 'manual'
      ELSE (v_precio_info->>'criterio')
    END;

    INSERT INTO movimientos_stock (
      deposito_id, producto_id, tipo, cantidad, fecha,
      usuario_id, referencia_tipo, referencia_id,
      precio_unitario_aplicado, metodo_valuacion
    ) VALUES (
      v_insumo.deposito_id, v_insumo.producto_id,
      'salida_ria', v_insumo.cantidad, v_ria.fecha,
      p_usuario_id, 'remito_interno', p_ria_id,
      v_precio_snap, v_metodo_snap
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
