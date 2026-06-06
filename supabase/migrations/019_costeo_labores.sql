-- =============================================================================
-- Migración 019: Costeo de Labores, Aplicaciones y Servicios Agronómicos
-- =============================================================================
-- Introduce tres modos de determinación de costo para labores:
--   Modo A — Maquinaria propia (fórmula agronómica completa)
--   Modo B — Contratista/tercero (tarifa con ajuste por índice)
--   Modo C — Manual/directo (costo global sin desglose)
--
-- Fórmula base (Modo A):
--   CdT = (A × V × Ef) / 10                [ha/h]
--   CH  = Ccomb + Club + Cmo + Crm + Camort + Cint   [$/h]
--   CA  = CH / CdT                          [$/ha]
--   CT  = CH / Rendtn/h                     [$/tn]
--   CM  = CH / Vemb                         [$/m]
-- =============================================================================

-- ─── 1. Expansión de maquinarias ──────────────────────────────────────────────
-- Se agregan todos los parámetros necesarios para el cálculo de costo horario
-- completo (Modo A). Los campos existentes se conservan para retrocompatibilidad.

ALTER TABLE maquinarias
  -- Clasificación de equipo
  ADD COLUMN IF NOT EXISTS es_implemento        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS implemento_asociado_id UUID REFERENCES maquinarias(id),

  -- Parámetros de valor y capital
  ADD COLUMN IF NOT EXISTS valor_reposicion     NUMERIC(14,2),  -- valor a nuevo (base amortiz. y rep.)
  ADD COLUMN IF NOT EXISTS valor_residual       NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vida_util_ha         NUMERIC(10,2),  -- alternativa a horas para implementos

  -- Parámetros operativos (usados en la fórmula de CdT)
  ADD COLUMN IF NOT EXISTS ancho_labor_m        NUMERIC(6,2),   -- ancho efectivo de labor [m]
  ADD COLUMN IF NOT EXISTS velocidad_kmh        NUMERIC(6,2),   -- velocidad de trabajo [km/h]
  ADD COLUMN IF NOT EXISTS eficiencia_campo     NUMERIC(4,3) NOT NULL DEFAULT 0.75,  -- 0–1
  ADD COLUMN IF NOT EXISTS factor_carga         NUMERIC(4,3) NOT NULL DEFAULT 0.70,  -- 0–1 (para estimar consumo)

  -- Parámetros de costo directo
  ADD COLUMN IF NOT EXISTS coef_lubricantes     NUMERIC(4,3) NOT NULL DEFAULT 0.12,  -- fracción sobre comb.
  ADD COLUMN IF NOT EXISTS costo_mano_obra_hora NUMERIC(10,2),   -- jornal operario [$/h]
  ADD COLUMN IF NOT EXISTS coef_rm              NUMERIC(5,4) NOT NULL DEFAULT 0.80,   -- rep. y mant. / vida útil

  -- Parámetros de capital
  ADD COLUMN IF NOT EXISTS uso_anual_horas      NUMERIC(8,2),   -- horas de uso por año
  ADD COLUMN IF NOT EXISTS tasa_interes_anual   NUMERIC(6,4) NOT NULL DEFAULT 0.08,  -- decimal
  ADD COLUMN IF NOT EXISTS seguro_porcentaje    NUMERIC(6,4) NOT NULL DEFAULT 0,     -- % sobre valor reposi.

  -- Para cosecha / embolsado
  ADD COLUMN IF NOT EXISTS rendimiento_tn_h     NUMERIC(8,2),   -- capacidad de cosecha [tn/h]
  ADD COLUMN IF NOT EXISTS velocidad_embolsado_m_h NUMERIC(8,2); -- capacidad embolsado [m/h]

-- ─── 2. Tabla de referencias de precio ───────────────────────────────────────
-- Precios de insumos operativos (gasoil, mano de obra, etc.) con vigencia temporal.
-- Permite actualizar variables sin afectar imputaciones históricas (se usa snapshot).

CREATE TABLE referencias_precio (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,    -- 'gasoil' | 'lubricantes' | 'mano_obra_hora' | 'usd' | 'quintal_soja' | etc.
  nombre         TEXT NOT NULL,    -- descripción legible
  valor          NUMERIC(14,4) NOT NULL CHECK (valor >= 0),
  unidad         TEXT NOT NULL,    -- 'L' | '$/h' | 'ARS/USD' | '$/qq' | etc.
  vigencia_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta DATE,
  observaciones  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_rp_vigencia CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
);

CREATE INDEX idx_ref_precio_empresa  ON referencias_precio(empresa_id);
CREATE INDEX idx_ref_precio_tipo     ON referencias_precio(empresa_id, tipo);
CREATE INDEX idx_ref_precio_vigencia ON referencias_precio(vigencia_desde);

ALTER TABLE referencias_precio ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_select ON referencias_precio FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()));

CREATE POLICY rp_insert ON referencias_precio FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY rp_update ON referencias_precio FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE POLICY rp_delete ON referencias_precio FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

-- ─── 3. Templates de costeo por tipo de labor ────────────────────────────────
-- Permiten preconfigurar la unidad de salida y parámetros por defecto
-- para cada tipo de labor, evitando repetir configuración por imputación.

CREATE TABLE templates_costeo_labor (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo_labor_id     UUID REFERENCES tipos_labor(id) ON DELETE SET NULL,  -- NULL = template global
  nombre            TEXT NOT NULL,
  unidad_salida     TEXT NOT NULL CHECK (unidad_salida IN ('ha', 'h', 'tn', 'm', 'unidad')),
  descripcion       TEXT,
  -- Parámetros de campo por defecto (sobreescribibles al imputar)
  ancho_labor_m     NUMERIC(6,2),
  velocidad_kmh     NUMERIC(6,2),
  eficiencia_campo  NUMERIC(4,3),
  factor_carga      NUMERIC(4,3),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE templates_costeo_labor ENABLE ROW LEVEL SECURITY;

CREATE POLICY tcl_all ON templates_costeo_labor FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()))
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas
    WHERE usuario_id = auth.uid() AND rol IN ('admin_empresa', 'super_admin')
  ));

CREATE TRIGGER trg_tcl_updated_at BEFORE UPDATE ON templates_costeo_labor
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── 4. Expansión de la tabla labores ────────────────────────────────────────
-- Se agregan campos para soportar los tres modos de costeo,
-- el snapshot de variables usadas y la trazabilidad completa.

ALTER TABLE labores
  -- Modo de costeo (A, B, C). Si es NULL: usó la lógica pre-019 (legacy).
  ADD COLUMN IF NOT EXISTS modo_costeo          TEXT CHECK (modo_costeo IN ('A_propio', 'B_tercero', 'C_manual')),

  -- Unidad de salida del costo calculado
  ADD COLUMN IF NOT EXISTS unidad_salida        TEXT CHECK (unidad_salida IN ('ha', 'h', 'tn', 'm', 'unidad')),

  -- Magnitud aplicada (ha, horas, tn o metros trabajados)
  ADD COLUMN IF NOT EXISTS magnitud_aplicada    NUMERIC(12,4),

  -- Costo unitario calculado según modo
  ADD COLUMN IF NOT EXISTS costo_unitario_labor NUMERIC(14,4),

  -- Desglose de componentes del costo (Modo A)
  -- JSON: {combustible, lubricantes, mano_obra, reparaciones, amortizacion,
  --        interes, seguro, ch_maquinaria, ch_implemento, ch_total,
  --        cdt_ha_h, costo_unitario, unidad_salida}
  ADD COLUMN IF NOT EXISTS costo_desglose_json  JSONB,

  -- Snapshot de todas las variables usadas al momento del cálculo
  -- JSON: {precio_gasoil, precio_mano_obra, valor_reposicion, tasa_interes,
  --        ancho_m, velocidad_kmh, eficiencia, factor_carga, ...}
  ADD COLUMN IF NOT EXISTS snapshot_variables   JSONB,

  -- Modo B: soporte a tarifa indexada
  ADD COLUMN IF NOT EXISTS tarifa_indice_tipo   TEXT,   -- 'gasoil' | 'usd' | 'quintal_soja' | NULL
  ADD COLUMN IF NOT EXISTS tarifa_indice_valor  NUMERIC(14,4),  -- valor del índice al momento del cálculo
  ADD COLUMN IF NOT EXISTS flete_adicional_ha   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_porcentaje       NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Modo C: costo manual
  ADD COLUMN IF NOT EXISTS es_costo_manual      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS justificacion_modo_c TEXT,  -- origen del valor (obligatorio en Modo C)

  -- Implemento separado del tractor (para el cálculo Modo A conjunto)
  ADD COLUMN IF NOT EXISTS implemento_id        UUID REFERENCES maquinarias(id);

-- ─── 5. Expansión de costos_cosecha (mismos campos que labores) ──────────────
ALTER TABLE costos_cosecha
  ADD COLUMN IF NOT EXISTS modo_costeo          TEXT CHECK (modo_costeo IN ('A_propio', 'B_tercero', 'C_manual')),
  ADD COLUMN IF NOT EXISTS unidad_salida        TEXT CHECK (unidad_salida IN ('ha', 'h', 'tn', 'm', 'unidad')),
  ADD COLUMN IF NOT EXISTS magnitud_aplicada    NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS costo_unitario_labor NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS costo_desglose_json  JSONB,
  ADD COLUMN IF NOT EXISTS snapshot_variables   JSONB,
  ADD COLUMN IF NOT EXISTS es_costo_manual      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS justificacion_modo_c TEXT,
  ADD COLUMN IF NOT EXISTS implemento_id        UUID REFERENCES maquinarias(id);

-- =============================================================================
-- FUNCIONES DE CÁLCULO
-- =============================================================================

-- ─── fn_precio_gasoil_vigente ─────────────────────────────────────────────────
-- Obtiene el precio de gasoil vigente a una fecha, primero desde referencias_precio,
-- luego desde la configuración de empresa como fallback.

CREATE OR REPLACE FUNCTION fn_precio_gasoil_vigente(
  p_empresa_id UUID,
  p_fecha      DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (
      SELECT valor FROM referencias_precio
      WHERE empresa_id    = p_empresa_id
        AND tipo          = 'gasoil'
        AND vigencia_desde <= p_fecha
        AND (vigencia_hasta IS NULL OR vigencia_hasta >= p_fecha)
      ORDER BY vigencia_desde DESC
      LIMIT 1
    ),
    (SELECT precio_combustible FROM configuracion_empresa WHERE empresa_id = p_empresa_id),
    0
  );
$$;

-- ─── fn_referencia_precio_vigente ─────────────────────────────────────────────
-- Obtiene el valor de cualquier referencia de precio vigente a una fecha.

CREATE OR REPLACE FUNCTION fn_referencia_precio_vigente(
  p_empresa_id UUID,
  p_tipo       TEXT,
  p_fecha      DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT valor FROM referencias_precio
  WHERE empresa_id    = p_empresa_id
    AND tipo          = p_tipo
    AND vigencia_desde <= p_fecha
    AND (vigencia_hasta IS NULL OR vigencia_hasta >= p_fecha)
  ORDER BY vigencia_desde DESC
  LIMIT 1;
$$;

-- ─── fn_calcular_costo_labor ──────────────────────────────────────────────────
-- Motor de cálculo de costo de labor/aplicación/servicio.
-- Implementa la fórmula agronómica completa (Modo A).
-- Retorna JSONB con costo unitario, desglose y parámetros usados.
--
-- Parámetros:
--   p_maquinaria_id  : tractor o equipo principal
--   p_implemento_id  : implemento asociado (opcional; agrega sus costos de capital)
--   p_empresa_id     : para obtener precios de referencia vigentes
--   p_unidad_salida  : 'ha' | 'h' | 'tn' | 'm' | 'unidad'
--   p_fecha          : fecha de imputación (para precios vigentes)
--   p_ancho_m        : override del ancho de labor (NULL = usar el del equipo)
--   p_velocidad_kmh  : override de velocidad (NULL = usar el del equipo)
--   p_eficiencia     : override de eficiencia (NULL = usar el del equipo)
--   p_factor_carga   : override de factor de carga (NULL = usar el del equipo)
--   p_rend_tn_h      : rendimiento en tn/h para salida en tn (cosecha/acarreo)
--   p_veloc_emb_m_h  : velocidad de embolsado en m/h para salida en m

CREATE OR REPLACE FUNCTION fn_calcular_costo_labor(
  p_maquinaria_id UUID,
  p_implemento_id UUID,
  p_empresa_id    UUID,
  p_unidad_salida TEXT,
  p_fecha         DATE DEFAULT CURRENT_DATE,
  p_ancho_m       NUMERIC DEFAULT NULL,
  p_velocidad_kmh NUMERIC DEFAULT NULL,
  p_eficiencia    NUMERIC DEFAULT NULL,
  p_factor_carga  NUMERIC DEFAULT NULL,
  p_rend_tn_h     NUMERIC DEFAULT NULL,
  p_veloc_emb_m_h NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  -- Maquinaria
  v_maq_nombre    TEXT;
  v_maq_hp        NUMERIC;
  v_consumo_h     NUMERIC;
  v_val_rep       NUMERIC;
  v_val_res       NUMERIC;
  v_vida_h        NUMERIC;
  v_eficiencia    NUMERIC;
  v_factor_carga  NUMERIC;
  v_coef_lub      NUMERIC;
  v_cmo_hora      NUMERIC;
  v_coef_rm       NUMERIC;
  v_uso_anual     NUMERIC;
  v_tasa          NUMERIC;
  v_seguro_pct    NUMERIC;
  v_ancho         NUMERIC;
  v_velocidad     NUMERIC;
  v_rend_tn_h     NUMERIC;
  v_veloc_emb     NUMERIC;

  -- Implemento
  v_imp_val_rep   NUMERIC;
  v_imp_val_res   NUMERIC;
  v_imp_vida_h    NUMERIC;
  v_imp_coef_rm   NUMERIC;
  v_imp_uso_anual NUMERIC;
  v_imp_tasa      NUMERIC;

  -- Precios de referencia
  v_precio_gasoil NUMERIC;
  v_precio_mo     NUMERIC;

  -- Componentes del costo horario
  v_ccomb     NUMERIC;
  v_club      NUMERIC;
  v_cmo       NUMERIC;
  v_crm       NUMERIC;
  v_camort    NUMERIC;
  v_cint      NUMERIC;
  v_cseg      NUMERIC;
  v_ch_maq    NUMERIC;

  -- Implemento
  v_imp_crm   NUMERIC;
  v_imp_amort NUMERIC;
  v_imp_cint  NUMERIC;
  v_ch_imp    NUMERIC;

  -- Total y conversión
  v_ch_total      NUMERIC;
  v_cdt           NUMERIC;
  v_costo_unit    NUMERIC;
BEGIN
  -- Cargar datos de la maquinaria
  SELECT
    nombre,
    COALESCE(hp, 0),
    COALESCE(consumo_combustible_hora, 0),
    COALESCE(valor_reposicion, valor_adquisicion, 0),
    COALESCE(valor_residual, 0),
    COALESCE(vida_util_horas, 0),
    COALESCE(eficiencia_campo, 0.75),
    COALESCE(factor_carga, 0.70),
    COALESCE(coef_lubricantes, 0.12),
    COALESCE(costo_mano_obra_hora, 0),
    COALESCE(coef_rm, 0.80),
    COALESCE(uso_anual_horas, 0),
    COALESCE(tasa_interes_anual, 0.08),
    COALESCE(seguro_porcentaje, 0),
    COALESCE(ancho_labor_m, 0),
    COALESCE(velocidad_kmh, 0),
    COALESCE(rendimiento_tn_h, 0),
    COALESCE(velocidad_embolsado_m_h, 0)
  INTO
    v_maq_nombre, v_maq_hp, v_consumo_h,
    v_val_rep, v_val_res, v_vida_h,
    v_eficiencia, v_factor_carga, v_coef_lub, v_cmo_hora,
    v_coef_rm, v_uso_anual, v_tasa, v_seguro_pct,
    v_ancho, v_velocidad, v_rend_tn_h, v_veloc_emb
  FROM maquinarias
  WHERE id = p_maquinaria_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Maquinaria no encontrada', 'ok', false);
  END IF;

  -- Aplicar overrides de parámetros
  IF p_ancho_m       IS NOT NULL THEN v_ancho       := p_ancho_m;       END IF;
  IF p_velocidad_kmh IS NOT NULL THEN v_velocidad   := p_velocidad_kmh; END IF;
  IF p_eficiencia    IS NOT NULL THEN v_eficiencia  := p_eficiencia;    END IF;
  IF p_factor_carga  IS NOT NULL THEN v_factor_carga := p_factor_carga; END IF;
  IF p_rend_tn_h     IS NOT NULL THEN v_rend_tn_h   := p_rend_tn_h;    END IF;
  IF p_veloc_emb_m_h IS NOT NULL THEN v_veloc_emb   := p_veloc_emb_m_h;END IF;

  -- Obtener precios de referencia vigentes
  v_precio_gasoil := fn_precio_gasoil_vigente(p_empresa_id, p_fecha);
  v_precio_mo     := COALESCE(
    fn_referencia_precio_vigente(p_empresa_id, 'mano_obra_hora', p_fecha),
    v_cmo_hora
  );

  -- ── Combustible ──
  -- Si el equipo tiene consumo cargado, lo usa; si no, estima desde HP
  IF v_consumo_h <= 0 AND v_maq_hp > 0 THEN
    v_consumo_h := 0.163 * v_maq_hp * v_factor_carga;
  END IF;
  v_ccomb := v_consumo_h * v_precio_gasoil;

  -- ── Lubricantes ──
  v_club := v_ccomb * v_coef_lub;

  -- ── Mano de obra ──
  v_cmo := COALESCE(v_precio_mo, 0);

  -- ── Reparaciones y mantenimiento ──
  v_crm := CASE WHEN v_vida_h > 0
    THEN v_val_rep * v_coef_rm / v_vida_h
    ELSE 0
  END;

  -- ── Amortización (lineal) ──
  v_camort := CASE WHEN v_vida_h > 0
    THEN (v_val_rep - v_val_res) / v_vida_h
    ELSE 0
  END;

  -- ── Costo de oportunidad (interés sobre capital medio) ──
  v_cint := CASE WHEN v_uso_anual > 0
    THEN ((v_val_rep + v_val_res) / 2.0) * v_tasa / v_uso_anual
    ELSE 0
  END;

  -- ── Seguro ──
  v_cseg := CASE WHEN v_uso_anual > 0
    THEN v_val_rep * v_seguro_pct / v_uso_anual
    ELSE 0
  END;

  v_ch_maq := v_ccomb + v_club + v_cmo + v_crm + v_camort + v_cint + v_cseg;

  -- ── Costos del implemento (solo capital) ──
  v_ch_imp := 0;
  IF p_implemento_id IS NOT NULL THEN
    SELECT
      COALESCE(valor_reposicion, valor_adquisicion, 0),
      COALESCE(valor_residual, 0),
      COALESCE(vida_util_horas, 0),
      COALESCE(coef_rm, 0.80),
      COALESCE(uso_anual_horas, v_uso_anual, 0),
      COALESCE(tasa_interes_anual, v_tasa)
    INTO v_imp_val_rep, v_imp_val_res, v_imp_vida_h, v_imp_coef_rm, v_imp_uso_anual, v_imp_tasa
    FROM maquinarias WHERE id = p_implemento_id;

    v_imp_crm   := CASE WHEN v_imp_vida_h > 0
      THEN v_imp_val_rep * v_imp_coef_rm / v_imp_vida_h ELSE 0 END;
    v_imp_amort := CASE WHEN v_imp_vida_h > 0
      THEN (v_imp_val_rep - v_imp_val_res) / v_imp_vida_h ELSE 0 END;
    v_imp_cint  := CASE WHEN v_imp_uso_anual > 0
      THEN ((v_imp_val_rep + v_imp_val_res) / 2.0) * v_imp_tasa / v_imp_uso_anual ELSE 0 END;
    v_ch_imp := v_imp_crm + v_imp_amort + v_imp_cint;
  END IF;

  v_ch_total := v_ch_maq + v_ch_imp;

  -- ── Capacidad de trabajo (CdT) = A × V × Ef / 10 ──
  v_cdt := CASE WHEN v_ancho > 0 AND v_velocidad > 0
    THEN v_ancho * v_velocidad * v_eficiencia / 10.0
    ELSE 0
  END;

  -- ── Costo unitario según unidad de salida ──
  v_costo_unit := CASE p_unidad_salida
    WHEN 'ha'    THEN CASE WHEN v_cdt > 0 THEN v_ch_total / v_cdt ELSE 0 END
    WHEN 'h'     THEN v_ch_total
    WHEN 'tn'    THEN CASE WHEN v_rend_tn_h > 0 THEN v_ch_total / v_rend_tn_h ELSE 0 END
    WHEN 'm'     THEN CASE WHEN v_veloc_emb > 0 THEN v_ch_total / v_veloc_emb ELSE 0 END
    ELSE              v_ch_total
  END;

  RETURN jsonb_build_object(
    'ok',             true,
    'costo_unitario', ROUND(v_costo_unit, 4),
    'unidad_salida',  p_unidad_salida,
    'desglose', jsonb_build_object(
      'combustible',          ROUND(v_ccomb, 4),
      'lubricantes',          ROUND(v_club, 4),
      'mano_obra',            ROUND(v_cmo, 4),
      'reparaciones',         ROUND(v_crm, 4),
      'amortizacion',         ROUND(v_camort, 4),
      'interes',              ROUND(v_cint, 4),
      'seguro',               ROUND(v_cseg, 4),
      'ch_maquinaria',        ROUND(v_ch_maq, 4),
      'ch_implemento',        ROUND(v_ch_imp, 4),
      'ch_total',             ROUND(v_ch_total, 4)
    ),
    'parametros', jsonb_build_object(
      'maquinaria',           v_maq_nombre,
      'ancho_m',              v_ancho,
      'velocidad_kmh',        v_velocidad,
      'eficiencia',           v_eficiencia,
      'factor_carga',         v_factor_carga,
      'cdt_ha_h',             ROUND(v_cdt, 4),
      'rend_tn_h',            v_rend_tn_h,
      'veloc_emb_m_h',        v_veloc_emb,
      'precio_gasoil',        v_precio_gasoil,
      'consumo_combustible_h',ROUND(v_consumo_h, 4),
      'fecha',                p_fecha::TEXT
    )
  );
END;
$$;

-- ─── fn_costo_tercero ─────────────────────────────────────────────────────────
-- Calcula costo Modo B (contratista), con soporte a tarifa indexada e IVA.

CREATE OR REPLACE FUNCTION fn_costo_tercero(
  p_tarifa_base   NUMERIC,
  p_unidad_salida TEXT,
  p_magnitud      NUMERIC,
  p_flete_ha      NUMERIC DEFAULT 0,
  p_iva_pct       NUMERIC DEFAULT 0,
  p_indice_tipo   TEXT DEFAULT NULL,
  p_empresa_id    UUID DEFAULT NULL,
  p_fecha         DATE DEFAULT CURRENT_DATE,
  p_indice_base   NUMERIC DEFAULT NULL  -- valor del índice al momento de pactar la tarifa
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_indice_actual  NUMERIC;
  v_tarifa_ajust   NUMERIC;
  v_costo_unit     NUMERIC;
  v_costo_total    NUMERIC;
BEGIN
  -- Ajuste por índice si corresponde
  IF p_indice_tipo IS NOT NULL AND p_empresa_id IS NOT NULL
     AND p_indice_base IS NOT NULL AND p_indice_base > 0 THEN
    v_indice_actual := fn_referencia_precio_vigente(p_empresa_id, p_indice_tipo, p_fecha);
    v_tarifa_ajust  := CASE WHEN v_indice_actual IS NOT NULL
      THEN p_tarifa_base * v_indice_actual / p_indice_base
      ELSE p_tarifa_base
    END;
  ELSE
    v_tarifa_ajust  := p_tarifa_base;
    v_indice_actual := NULL;
  END IF;

  v_costo_unit  := (v_tarifa_ajust + COALESCE(p_flete_ha, 0)) * (1 + COALESCE(p_iva_pct, 0) / 100.0);
  v_costo_total := v_costo_unit * COALESCE(p_magnitud, 0);

  RETURN jsonb_build_object(
    'ok',            true,
    'costo_unitario', ROUND(v_costo_unit, 4),
    'costo_total',    ROUND(v_costo_total, 4),
    'unidad_salida',  p_unidad_salida,
    'desglose', jsonb_build_object(
      'tarifa_base',    p_tarifa_base,
      'tarifa_ajust',   ROUND(v_tarifa_ajust, 4),
      'flete_ha',       p_flete_ha,
      'iva_pct',        p_iva_pct,
      'indice_tipo',    p_indice_tipo,
      'indice_base',    p_indice_base,
      'indice_actual',  v_indice_actual
    )
  );
END;
$$;
