-- =============================================================================
-- Migración 027: fn_precio_ultima_compra incluye precios manuales de RIAs
-- =============================================================================
-- Cuando un producto no tiene compras registradas, el precio ingresado
-- manualmente en un RIA confirmado se usa como fallback de "última compra".
-- Esto permite que aparezca en la valuación de stock aunque no haya factura.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_precio_ultima_compra(
  p_producto_id UUID,
  p_empresa_id  UUID
) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    -- 1. Última compra confirmada con precio > 0 (compras con precio=0 no aplican)
    (
      SELECT ci.precio_unitario_ars
      FROM compras_items ci
      JOIN compras c ON c.id = ci.compra_id
      WHERE ci.producto_id          = p_producto_id
        AND c.empresa_id            = p_empresa_id
        AND c.estado                = 'confirmada'
        AND ci.precio_unitario_ars  > 0
      ORDER BY c.fecha DESC, c.created_at DESC
      LIMIT 1
    ),
    -- 2. Fallback: último precio ingresado en un RIA confirmado
    (
      SELECT ri.costo_unitario
      FROM remitos_insumos ri
      JOIN remitos_internos r ON r.id = ri.remito_id
      WHERE ri.producto_id    = p_producto_id
        AND r.empresa_id      = p_empresa_id
        AND r.estado          = 'confirmado'
        AND ri.costo_unitario IS NOT NULL
        AND ri.costo_unitario  > 0
      ORDER BY r.fecha DESC, r.created_at DESC
      LIMIT 1
    )
  );
$$;
