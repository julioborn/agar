-- =============================================================================
-- Migración 038: rol "lector_insumos"
-- =============================================================================
-- Usuario de solo lectura, restringido únicamente a la sección Insumos
-- (Depósitos, Proveedores, Productos, Compras, Stock, Referencias de Precio,
-- Valuación). No ve ni puede acceder a ninguna otra sección del sistema.
-- =============================================================================

ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'lector_insumos';
