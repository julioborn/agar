-- Migración 023: segunda tanda de correcciones de ítems mal importados
-- Facturas: 0007-00052191, 0007-00052190, 0007-00052186

DO $$
DECLARE
  v_compra_id  uuid;
  v_item_id    uuid;
  v_producto_id uuid;
  v_deposito_id uuid;

  PROCEDURE fix_item(
    p_compra_id  uuid,
    p_patron     text,
    p_cantidad   numeric,
    p_precio_ars numeric DEFAULT NULL   -- si es NULL no toca el precio
  ) AS $$
  DECLARE
    li_id uuid; lp_id uuid; ld_id uuid;
    nuevo_subtotal numeric;
  BEGIN
    SELECT ci.id, ci.producto_id, ci.deposito_destino_id
    INTO li_id, lp_id, ld_id
    FROM compras_items ci
    JOIN productos p ON p.id = ci.producto_id
    WHERE ci.compra_id = p_compra_id
      AND p.nombre ILIKE p_patron
    LIMIT 1;

    IF li_id IS NULL THEN
      RAISE WARNING '[023] Ítem no encontrado: compra=%, patrón=%', p_compra_id, p_patron;
      RETURN;
    END IF;

    IF p_precio_ars IS NOT NULL THEN
      nuevo_subtotal := p_precio_ars * p_cantidad;
      UPDATE compras_items
      SET cantidad_unidad_base       = p_cantidad,
          precio_unitario_ars        = p_precio_ars,
          precio_unitario_moneda_original = p_precio_ars,
          subtotal_ars               = nuevo_subtotal,
          subtotal_moneda_original   = nuevo_subtotal
      WHERE id = li_id;
    ELSE
      UPDATE compras_items
      SET cantidad_unidad_base     = p_cantidad,
          subtotal_ars             = precio_unitario_ars             * p_cantidad,
          subtotal_moneda_original = precio_unitario_moneda_original * p_cantidad
      WHERE id = li_id;
    END IF;

    UPDATE movimientos_stock
    SET cantidad = p_cantidad
    WHERE referencia_id   = p_compra_id
      AND referencia_tipo = 'compra'
      AND producto_id     = lp_id;

    UPDATE stock s
    SET cantidad_actual = (
      SELECT COALESCE(SUM(
        CASE WHEN ms.tipo::text LIKE 'entrada%' THEN ms.cantidad ELSE -ms.cantidad END
      ), 0)
      FROM movimientos_stock ms
      WHERE ms.producto_id = lp_id AND ms.deposito_id = ld_id
    )
    WHERE s.producto_id = lp_id AND s.deposito_id = ld_id;

    RAISE NOTICE '[023] OK: patrón=%, qty=%', p_patron, p_cantidad;
  END;
  $$ LANGUAGE plpgsql;

BEGIN

  -- ── Factura 0007-00052191 ──────────────────────────────────────────────────
  SELECT id INTO v_compra_id FROM compras
  WHERE numero_factura ILIKE '%00052191%' LIMIT 1;

  IF v_compra_id IS NULL THEN
    RAISE WARNING '[023] Factura *00052191 no encontrada';
  ELSE
    CALL fix_item(v_compra_id, '%Terbutilazina%',  400);
    CALL fix_item(v_compra_id, '%BROUZ%',           40);

    -- METSULFURON: cambia cantidad, precio Y unidad del producto a 'kg'
    SELECT ci.id, ci.producto_id, ci.deposito_destino_id
    INTO v_item_id, v_producto_id, v_deposito_id
    FROM compras_items ci JOIN productos p ON p.id = ci.producto_id
    WHERE ci.compra_id = v_compra_id AND p.nombre ILIKE '%METSULFURON%' LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE productos SET unidad_base = 'kg' WHERE id = v_producto_id;
      UPDATE compras_items
      SET cantidad_unidad_base            = 3,
          precio_unitario_ars             = 35715.40,
          precio_unitario_moneda_original = 35715.40,
          subtotal_ars                    = 3 * 35715.40,
          subtotal_moneda_original        = 3 * 35715.40
      WHERE id = v_item_id;
      UPDATE movimientos_stock SET cantidad = 3
      WHERE referencia_id = v_compra_id AND referencia_tipo = 'compra' AND producto_id = v_producto_id;
      UPDATE stock s
      SET cantidad_actual = (
        SELECT COALESCE(SUM(CASE WHEN ms.tipo::text LIKE 'entrada%' THEN ms.cantidad ELSE -ms.cantidad END), 0)
        FROM movimientos_stock ms WHERE ms.producto_id = v_producto_id AND ms.deposito_id = v_deposito_id
      )
      WHERE s.producto_id = v_producto_id AND s.deposito_id = v_deposito_id;
      RAISE NOTICE '[023] METSULFURON: 30 sobres → 3 kg, precio → 35715.40';
    ELSE
      RAISE WARNING '[023] METSULFURON no encontrado en factura *00052191';
    END IF;

    UPDATE compras
    SET total_en_ars          = (SELECT COALESCE(SUM(subtotal_ars),             0) FROM compras_items WHERE compra_id = v_compra_id),
        total_moneda_original = (SELECT COALESCE(SUM(subtotal_moneda_original), 0) FROM compras_items WHERE compra_id = v_compra_id)
    WHERE id = v_compra_id;
    RAISE NOTICE '[023] Factura *00052191 totales recalculados';
  END IF;

  -- ── Factura 0007-00052190 ──────────────────────────────────────────────────
  SELECT id INTO v_compra_id FROM compras
  WHERE numero_factura ILIKE '%00052190%' LIMIT 1;

  IF v_compra_id IS NULL THEN
    RAISE WARNING '[023] Factura *00052190 no encontrada';
  ELSE
    CALL fix_item(v_compra_id, '%BROUZ%', 320);
    UPDATE compras
    SET total_en_ars          = (SELECT COALESCE(SUM(subtotal_ars),             0) FROM compras_items WHERE compra_id = v_compra_id),
        total_moneda_original = (SELECT COALESCE(SUM(subtotal_moneda_original), 0) FROM compras_items WHERE compra_id = v_compra_id)
    WHERE id = v_compra_id;
    RAISE NOTICE '[023] Factura *00052190 totales recalculados';
  END IF;

  -- ── Factura 0007-00052186 ──────────────────────────────────────────────────
  SELECT id INTO v_compra_id FROM compras
  WHERE numero_factura ILIKE '%00052186%' LIMIT 1;

  IF v_compra_id IS NULL THEN
    RAISE WARNING '[023] Factura *00052186 no encontrada';
  ELSE
    CALL fix_item(v_compra_id, '%UREA%', 20000);
    UPDATE compras
    SET total_en_ars          = (SELECT COALESCE(SUM(subtotal_ars),             0) FROM compras_items WHERE compra_id = v_compra_id),
        total_moneda_original = (SELECT COALESCE(SUM(subtotal_moneda_original), 0) FROM compras_items WHERE compra_id = v_compra_id)
    WHERE id = v_compra_id;
    RAISE NOTICE '[023] Factura *00052186 totales recalculados';
  END IF;

END $$;
