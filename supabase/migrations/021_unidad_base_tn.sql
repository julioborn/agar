-- Agrega toneladas al enum de unidades base de productos
ALTER TYPE unidad_base_producto ADD VALUE IF NOT EXISTS 'tn';
