-- Migración 022: corrección de ítems de compras mal importados
-- Actualiza compras_items + movimientos_stock + recalcula stock y totales de compra

DO $$
DECLARE
  v_compra_id  uuid;
  v_item_id    uuid;
  v_producto_id uuid;
  v_deposito_id uuid;
  v_old_qty    numeric;

  -- (factura, patrón producto ILIKE, cantidad correcta)
  type_correction RECORD;
  mets_rec     RECORD;
BEGIN

  FOR type_correction IN
    SELECT *
    FROM (VALUES
      ('0004-00012075-A', '%SULFATO%CALCIO%',   43.98::numeric),
      ('0004-00012076-A', '%CARBONATO%CALCIO%', 15.58::numeric),
      ('0005-00006329-A', '%IMAZETAPYR%',        100::numeric),
      ('0005-00006328-A', '%IMAZETAPYR%',        200::numeric),
      ('00007-00052190',  '%BROUZ%',             320::numeric),
      ('00007-00052191',  '%BROUZ%',              40::numeric),
      ('0042-00003097',   '%ATANOR%',            320::numeric),
      ('0005-00000324',   '%FOSFATO%TRIPLE%',  60000::numeric)
    ) AS t(factura, patron, nueva_qty)
  LOOP
    -- Buscar compra por número de factura
    SELECT id INTO v_compra_id
    FROM compras
    WHERE numero_factura = type_correction.factura
    LIMIT 1;

    IF v_compra_id IS NULL THEN
      RAISE WARNING '[022] Factura no encontrada: %', type_correction.factura;
      CONTINUE;
    END IF;

    -- Buscar ítem dentro de esa compra por nombre de producto
    SELECT ci.id, ci.producto_id, ci.deposito_destino_id, ci.cantidad_unidad_base
    INTO v_item_id, v_producto_id, v_deposito_id, v_old_qty
    FROM compras_items ci
    JOIN productos p ON p.id = ci.producto_id
    WHERE ci.compra_id = v_compra_id
      AND p.nombre ILIKE type_correction.patron
    LIMIT 1;

    IF v_item_id IS NULL THEN
      RAISE WARNING '[022] Ítem no encontrado: factura=%, patrón=%',
        type_correction.factura, type_correction.patron;
      CONTINUE;
    END IF;

    -- 1. Actualizar cantidad y subtotales en compras_items
    UPDATE compras_items
    SET
      cantidad_unidad_base       = type_correction.nueva_qty,
      subtotal_ars               = precio_unitario_ars               * type_correction.nueva_qty,
      subtotal_moneda_original   = precio_unitario_moneda_original   * type_correction.nueva_qty
    WHERE id = v_item_id;

    -- 2. Actualizar movimiento de stock asociado a esta compra
    UPDATE movimientos_stock
    SET cantidad = type_correction.nueva_qty
    WHERE referencia_id   = v_compra_id
      AND referencia_tipo = 'compra'
      AND producto_id     = v_producto_id
      AND deposito_id     = v_deposito_id;

    -- 3. Recalcular stock desde la suma de todos los movimientos del producto+depósito
    --    (entrada* = suma positiva, salida* = suma negativa)
    UPDATE stock s
    SET cantidad_actual = (
      SELECT COALESCE(SUM(
        CASE WHEN ms.tipo::text LIKE 'entrada%' THEN ms.cantidad ELSE -ms.cantidad END
      ), 0)
      FROM movimientos_stock ms
      WHERE ms.deposito_id  = v_deposito_id
        AND ms.producto_id  = v_producto_id
    )
    WHERE s.deposito_id  = v_deposito_id
      AND s.producto_id  = v_producto_id;

    -- 4. Recalcular totales de la compra (por si cambió el subtotal)
    UPDATE compras
    SET
      total_en_ars             = (SELECT COALESCE(SUM(subtotal_ars),             0) FROM compras_items WHERE compra_id = v_compra_id),
      total_moneda_original    = (SELECT COALESCE(SUM(subtotal_moneda_original), 0) FROM compras_items WHERE compra_id = v_compra_id)
    WHERE id = v_compra_id;

    RAISE NOTICE '[022] OK: factura=%, producto_pattern=%, qty: % → %',
      type_correction.factura, type_correction.patron, v_old_qty, type_correction.nueva_qty;

  END LOOP;

  -- ── METSULFURON 60% SUPERMET AGROTERRUM: unidad 'sobre' + cantidad 30 ──────
  -- Sin número de factura conocido: se busca por nombre de producto en todas las compras.
  -- Si hay más de una compra de este producto, se corrigen TODAS.
  BEGIN
    -- 1. Actualizar unidad_base del producto a 'sobre'
    UPDATE productos
    SET unidad_base = 'sobre'
    WHERE nombre ILIKE '%METSULFURON%SUPERMET%';

    FOR mets_rec IN
      SELECT ci.id   AS item_id,
             ci.compra_id,
             ci.producto_id,
             ci.deposito_destino_id AS deposito_id,
             ci.cantidad_unidad_base AS old_qty
      FROM compras_items ci
      JOIN productos p ON p.id = ci.producto_id
      WHERE p.nombre ILIKE '%METSULFURON%SUPERMET%'
    LOOP
      -- 2. Actualizar cantidad del ítem
      UPDATE compras_items
      SET cantidad_unidad_base     = 30,
          subtotal_ars             = precio_unitario_ars             * 30,
          subtotal_moneda_original = precio_unitario_moneda_original * 30
      WHERE id = mets_rec.item_id;

      -- 3. Actualizar movimiento de stock
      UPDATE movimientos_stock
      SET cantidad = 30
      WHERE referencia_id   = mets_rec.compra_id
        AND referencia_tipo = 'compra'
        AND producto_id     = mets_rec.producto_id
        AND deposito_id     = mets_rec.deposito_id;

      -- 4. Recalcular stock
      UPDATE stock s
      SET cantidad_actual = (
        SELECT COALESCE(SUM(
          CASE WHEN ms.tipo::text LIKE 'entrada%' THEN ms.cantidad ELSE -ms.cantidad END
        ), 0)
        FROM movimientos_stock ms
        WHERE ms.deposito_id = mets_rec.deposito_id
          AND ms.producto_id = mets_rec.producto_id
      )
      WHERE s.deposito_id = mets_rec.deposito_id
        AND s.producto_id = mets_rec.producto_id;

      -- 5. Recalcular total de la compra
      UPDATE compras
      SET total_en_ars           = (SELECT COALESCE(SUM(subtotal_ars),             0) FROM compras_items WHERE compra_id = mets_rec.compra_id),
          total_moneda_original  = (SELECT COALESCE(SUM(subtotal_moneda_original), 0) FROM compras_items WHERE compra_id = mets_rec.compra_id)
      WHERE id = mets_rec.compra_id;

      RAISE NOTICE '[022] METSULFURON OK: compra=%, qty: % → 30 sobres', mets_rec.compra_id, mets_rec.old_qty;
    END LOOP;
  END;

END $$;
