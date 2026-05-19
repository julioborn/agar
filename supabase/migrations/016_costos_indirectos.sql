-- =============================================================================
-- AgroSistema - Migración 016: Costos Indirectos y Comprobantes Internos
-- =============================================================================
-- Jerarquía de márgenes:
--   Margen Bruto Lote  = ingreso_bruto − costos_directos  (ya implementado en cultivos)
--   Margen Campo       = Σ márgenes_lotes − costos_indirectos_campo
--   Margen Empresa     = Σ márgenes_campo − costos_indirectos_empresa
-- =============================================================================

-- ─── Comprobantes Internos ──────────────────────────────────────────────────
-- Voucher generado por cada imputación de costo indirecto
CREATE TABLE comprobantes_internos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero          TEXT NOT NULL,          -- formato: CI-AAAA-NNNN
  tipo            TEXT NOT NULL CHECK (tipo IN ('costo_campo', 'costo_empresa')),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id      UUID REFERENCES auth.users(id),
  usuario_nombre  TEXT,                   -- snapshot del nombre al momento de creación
  descripcion     TEXT NOT NULL,
  monto_ars       NUMERIC(15, 2) NOT NULL,
  datos_json      JSONB,                  -- snapshot completo de la imputación
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, numero)
);

-- ─── Costos Indirectos de Campo ─────────────────────────────────────────────
-- Gastos imputables a un campo pero no a un lote/cultivo específico
CREATE TABLE costos_indirectos_campo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  campo_id        UUID NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
  comprobante_id  UUID REFERENCES comprobantes_internos(id),
  campania_id     UUID REFERENCES campanias(id),   -- asignación opcional a campaña
  fecha           DATE NOT NULL,
  categoria       TEXT NOT NULL CHECK (categoria IN (
                    'impuesto', 'arrendamiento', 'infraestructura',
                    'seguro', 'servicios_campo', 'otros'
                  )),
  descripcion     TEXT NOT NULL,
  proveedor_id    UUID REFERENCES proveedores(id),
  monto_ars       NUMERIC(15, 2) NOT NULL,
  usuario_id      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Costos Indirectos de Empresa ───────────────────────────────────────────
-- Gastos que no pueden imputarse a ningún campo específico
CREATE TABLE costos_indirectos_empresa (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  comprobante_id  UUID REFERENCES comprobantes_internos(id),
  campania_id     UUID REFERENCES campanias(id),   -- asignación opcional a campaña
  fecha           DATE NOT NULL,
  categoria       TEXT NOT NULL CHECK (categoria IN (
                    'administrativo', 'contable', 'bancario',
                    'seguro', 'alquiler', 'personal_admin', 'otros'
                  )),
  descripcion     TEXT NOT NULL,
  proveedor_id    UUID REFERENCES proveedores(id),
  monto_ars       NUMERIC(15, 2) NOT NULL,
  usuario_id      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE comprobantes_internos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE costos_indirectos_campo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE costos_indirectos_empresa ENABLE ROW LEVEL SECURITY;

-- comprobantes_internos: acceso por pertenencia a empresa
CREATE POLICY "ci_select" ON comprobantes_internos FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));
CREATE POLICY "ci_insert" ON comprobantes_internos FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));
CREATE POLICY "ci_delete" ON comprobantes_internos FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

-- costos_indirectos_campo: acceso por pertenencia a empresa
CREATE POLICY "cic_select" ON costos_indirectos_campo FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));
CREATE POLICY "cic_insert" ON costos_indirectos_campo FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));
CREATE POLICY "cic_delete" ON costos_indirectos_campo FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));

-- costos_indirectos_empresa: acceso por pertenencia a empresa
CREATE POLICY "cie_select" ON costos_indirectos_empresa FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));
CREATE POLICY "cie_insert" ON costos_indirectos_empresa FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));
CREATE POLICY "cie_delete" ON costos_indirectos_empresa FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = auth.uid()
  ));
