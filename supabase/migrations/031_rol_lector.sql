-- Agrega el rol 'lector' al enum rol_usuario
ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'lector';
