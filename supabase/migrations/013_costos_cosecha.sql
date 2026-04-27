-- =============================================================================
-- AgroSistema - Migración 013: Costo de cosecha/trilla/recolección
-- =============================================================================
CREATE TABLE costos_cosecha (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cultivo_id            UUID NOT NULL REFERENCES cultivos(id) ON DELETE CASCADE,
  fecha                 DATE NOT NULL,
  tipo_ejecucion        TEXT NOT NULL CHECK (tipo_ejecucion IN ('propio', 'tercero')),
  observaciones         TEXT,

  -- Si es equipo propio:
  maquinaria_id         UUID REFERENCES maquinarias(id),
  horas_trabajadas      NUMERIC(6, 2),

  -- Si es servicio de tercero:
  proveedor_id          UUID REFERENCES proveedores(id),
  modalidad_cobro       TEXT CHECK (modalidad_cobro IN ('por_ha', 'por_tonelada', 'total')),
  precio_unitario       NUMERIC(12, 2),
  hectareas_trabajadas  NUMERIC(8, 2),
  toneladas_trabajadas  NUMERIC(10, 3),

  costo_total_calculado NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE costos_cosecha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "costos_cosecha_select" ON costos_cosecha FOR SELECT
  USING (cultivo_id IN (
    SELECT c.id FROM cultivos c
    JOIN lotes l    ON l.id  = c.lote_id
    JOIN campos ca  ON ca.id = l.campo_id
    JOIN usuarios_empresas ue ON ue.empresa_id = ca.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));

CREATE POLICY "costos_cosecha_insert" ON costos_cosecha FOR INSERT
  WITH CHECK (cultivo_id IN (
    SELECT c.id FROM cultivos c
    JOIN lotes l    ON l.id  = c.lote_id
    JOIN campos ca  ON ca.id = l.campo_id
    JOIN usuarios_empresas ue ON ue.empresa_id = ca.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));

CREATE POLICY "costos_cosecha_delete" ON costos_cosecha FOR DELETE
  USING (cultivo_id IN (
    SELECT c.id FROM cultivos c
    JOIN lotes l    ON l.id  = c.lote_id
    JOIN campos ca  ON ca.id = l.campo_id
    JOIN usuarios_empresas ue ON ue.empresa_id = ca.empresa_id
    WHERE ue.usuario_id = auth.uid()
  ));
