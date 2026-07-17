-- Agrega la categoría 'produccion' al enum categoria_producto
-- (para productos que representan cosecha/forraje propio, no insumos comprados)
ALTER TYPE categoria_producto ADD VALUE IF NOT EXISTS 'produccion';
