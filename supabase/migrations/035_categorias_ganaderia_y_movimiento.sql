-- Agrega categorías de producto para insumos de ganadería y el tipo de
-- movimiento de stock para su consumo. Archivo propio (sin usarlos todavía)
-- porque Postgres no permite usar un valor de enum nuevo en la misma
-- transacción que lo crea.
ALTER TYPE categoria_producto ADD VALUE IF NOT EXISTS 'veterinario';
ALTER TYPE categoria_producto ADD VALUE IF NOT EXISTS 'nucleo_proteico';
ALTER TYPE categoria_producto ADD VALUE IF NOT EXISTS 'sal_mineral';

ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'salida_consumo_ganadero';
