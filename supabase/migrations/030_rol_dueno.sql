-- Agrega el rol 'dueno' al enum rol_usuario
-- Este rol da acceso solo al dashboard visual de estadísticas, sin operaciones.
ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'dueno';
