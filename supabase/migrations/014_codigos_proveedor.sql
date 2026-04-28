-- =============================================================================
-- Migración 014: Tabla para mapear nombres/códigos de proveedores a productos canónicos
-- Permite que importaciones futuras del mismo proveedor auto-asignen productos
-- =============================================================================

CREATE TABLE codigos_proveedor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  codigo_externo TEXT,
  nombre_en_factura TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, proveedor_id, nombre_en_factura)
);

CREATE INDEX idx_codigos_proveedor_empresa ON codigos_proveedor(empresa_id);
CREATE INDEX idx_codigos_proveedor_producto ON codigos_proveedor(producto_id);

ALTER TABLE codigos_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY codigos_prov_rls ON codigos_proveedor FOR ALL
  USING (user_has_empresa_access(empresa_id))
  WITH CHECK (user_has_empresa_access(empresa_id));
