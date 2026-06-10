-- Migración 024: agregar tipo_documento a compras ('factura' | 'remito')
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'factura'
    CHECK (tipo_documento IN ('factura', 'remito'));
