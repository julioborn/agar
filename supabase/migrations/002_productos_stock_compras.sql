-- =============================================================================
-- Migración 002: Catálogo, stock, compras, trazabilidad de partidas
-- =============================================================================

-- PROVEEDORES Y CONTRATISTAS
CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cuit TEXT,
  contacto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_proveedores_empresa ON proveedores(empresa_id);

CREATE TABLE contratistas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cuit TEXT,
  contacto TEXT,
  tipos_servicio JSONB DEFAULT '[]',
  zona_trabajo TEXT,
  observaciones TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contratistas_empresa ON contratistas(empresa_id);

-- PRODUCTOS
CREATE TYPE categoria_producto AS ENUM (
  'fertilizante', 'semilla', 'agroquimico', 'combustible',
  'insumo_cosecha', 'inoculante', 'otro'
);
CREATE TYPE unidad_base_producto AS ENUM ('kg', 'L', 'unidad');

CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  categoria categoria_producto NOT NULL,
  unidad_base unidad_base_producto NOT NULL,
  codigo_barras TEXT,
  codigo_interno TEXT,
  principio_activo TEXT,
  stock_minimo NUMERIC(14,4) DEFAULT 0,
  requiere_trazabilidad BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_productos_empresa ON productos(empresa_id);
CREATE INDEX idx_productos_codigo_barras ON productos(codigo_barras);

CREATE TABLE presentaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  factor_a_unidad_base NUMERIC(14,4) NOT NULL
);
CREATE INDEX idx_presentaciones_producto ON presentaciones(producto_id);

-- DEPÓSITOS
CREATE TYPE tipo_deposito AS ENUM ('central', 'galpon_campo');

CREATE TABLE depositos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo tipo_deposito NOT NULL,
  campo_id UUID REFERENCES campos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_depositos_empresa ON depositos(empresa_id);

-- STOCK (derivado de movimientos)
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deposito_id UUID NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad_actual NUMERIC(14,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deposito_id, producto_id)
);
CREATE INDEX idx_stock_producto ON stock(producto_id);

-- MOVIMIENTOS DE STOCK (fuente única de verdad)
CREATE TYPE tipo_movimiento AS ENUM (
  'entrada_compra',
  'salida_aplicacion',
  'entrada_devolucion',
  'transferencia_entrada',
  'transferencia_salida',
  'merma',
  'ajuste'
);

CREATE TABLE movimientos_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deposito_id UUID NOT NULL REFERENCES depositos(id),
  producto_id UUID NOT NULL REFERENCES productos(id),
  tipo tipo_movimiento NOT NULL,
  cantidad NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id UUID REFERENCES auth.users(id),
  referencia_tipo TEXT,
  referencia_id UUID,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_movimientos_deposito ON movimientos_stock(deposito_id);
CREATE INDEX idx_movimientos_producto ON movimientos_stock(producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_stock(fecha);
CREATE INDEX idx_movimientos_ref ON movimientos_stock(referencia_tipo, referencia_id);

-- Trigger: cada movimiento actualiza el stock automáticamente
CREATE OR REPLACE FUNCTION aplicar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE
  delta NUMERIC;
BEGIN
  IF NEW.tipo IN ('entrada_compra', 'entrada_devolucion', 'transferencia_entrada') THEN
    delta := NEW.cantidad;
  ELSIF NEW.tipo IN ('salida_aplicacion', 'transferencia_salida', 'merma') THEN
    delta := -NEW.cantidad;
  ELSIF NEW.tipo = 'ajuste' THEN
    delta := NEW.cantidad; -- puede ser positivo o negativo; se convierte en la app
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

CREATE TRIGGER trg_movimiento_stock AFTER INSERT ON movimientos_stock
  FOR EACH ROW EXECUTE FUNCTION aplicar_movimiento_stock();

-- COMPRAS
CREATE TYPE estado_compra AS ENUM ('borrador', 'confirmada');
CREATE TYPE moneda_compra AS ENUM ('ARS', 'USD');

CREATE TABLE compras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proveedor_id UUID REFERENCES proveedores(id),
  fecha DATE NOT NULL,
  numero_factura TEXT,
  moneda moneda_compra NOT NULL DEFAULT 'ARS',
  cotizacion_usd NUMERIC(12,4),
  total_moneda_original NUMERIC(14,2),
  total_en_ars NUMERIC(14,2),
  archivo_factura_url TEXT,
  estado estado_compra NOT NULL DEFAULT 'borrador',
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_compras_empresa ON compras(empresa_id);
CREATE INDEX idx_compras_fecha ON compras(fecha);

CREATE TABLE compras_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  presentacion_id UUID REFERENCES presentaciones(id),
  cantidad_presentacion NUMERIC(14,4),
  cantidad_unidad_base NUMERIC(14,4) NOT NULL,
  precio_unitario_moneda_original NUMERIC(14,4) NOT NULL,
  precio_unitario_ars NUMERIC(14,4) NOT NULL,
  subtotal_moneda_original NUMERIC(14,2),
  subtotal_ars NUMERIC(14,2),
  deposito_destino_id UUID REFERENCES depositos(id),
  numero_lote_proveedor TEXT,
  fecha_vencimiento DATE
);
CREATE INDEX idx_compras_items_compra ON compras_items(compra_id);

-- TRAZABILIDAD DE PARTIDAS
CREATE TABLE partidas_producto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id),
  compra_item_id UUID REFERENCES compras_items(id) ON DELETE CASCADE,
  numero_lote_proveedor TEXT,
  fecha_vencimiento DATE,
  cantidad_inicial NUMERIC(14,4) NOT NULL,
  cantidad_actual NUMERIC(14,4) NOT NULL,
  costo_unitario_ars NUMERIC(14,4) NOT NULL,
  fecha_alta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado TEXT NOT NULL DEFAULT 'activa'
);
CREATE INDEX idx_partidas_producto ON partidas_producto(producto_id);
CREATE INDEX idx_partidas_vencimiento ON partidas_producto(fecha_vencimiento);

-- Helper: empresa_id de un producto (para RLS)
CREATE OR REPLACE FUNCTION empresa_id_de_producto(producto_uuid UUID)
RETURNS UUID AS $$
  SELECT empresa_id FROM productos WHERE id = producto_uuid;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION empresa_id_de_deposito(deposito_uuid UUID)
RETURNS UUID AS $$
  SELECT empresa_id FROM depositos WHERE id = deposito_uuid;
$$ LANGUAGE SQL STABLE;

-- Triggers updated_at
CREATE TRIGGER set_updated_at_productos BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_compras BEFORE UPDATE ON compras
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- RLS
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidas_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY prov_rls ON proveedores FOR ALL
  USING (user_has_empresa_access(empresa_id)) WITH CHECK (user_has_empresa_access(empresa_id));
CREATE POLICY contr_rls ON contratistas FOR ALL
  USING (user_has_empresa_access(empresa_id)) WITH CHECK (user_has_empresa_access(empresa_id));
CREATE POLICY prod_rls ON productos FOR ALL
  USING (user_has_empresa_access(empresa_id)) WITH CHECK (user_has_empresa_access(empresa_id));
CREATE POLICY pres_rls ON presentaciones FOR ALL
  USING (user_has_empresa_access(empresa_id_de_producto(producto_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_producto(producto_id)));
CREATE POLICY dep_rls ON depositos FOR ALL
  USING (user_has_empresa_access(empresa_id)) WITH CHECK (user_has_empresa_access(empresa_id));
CREATE POLICY stock_rls ON stock FOR ALL
  USING (user_has_empresa_access(empresa_id_de_deposito(deposito_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_deposito(deposito_id)));
CREATE POLICY mov_rls ON movimientos_stock FOR ALL
  USING (user_has_empresa_access(empresa_id_de_deposito(deposito_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_deposito(deposito_id)));
CREATE POLICY compras_rls ON compras FOR ALL
  USING (user_has_empresa_access(empresa_id)) WITH CHECK (user_has_empresa_access(empresa_id));
CREATE POLICY compras_items_rls ON compras_items FOR ALL
  USING (EXISTS (SELECT 1 FROM compras c WHERE c.id = compra_id AND user_has_empresa_access(c.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM compras c WHERE c.id = compra_id AND user_has_empresa_access(c.empresa_id)));
CREATE POLICY partidas_rls ON partidas_producto FOR ALL
  USING (user_has_empresa_access(empresa_id_de_producto(producto_id)))
  WITH CHECK (user_has_empresa_access(empresa_id_de_producto(producto_id)));
