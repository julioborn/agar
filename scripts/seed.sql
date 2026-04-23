-- =============================================================================
-- Seed inicial para desarrollo
-- Ejecutar en Supabase Studio → SQL Editor
-- Prerrequisito: tener al menos un usuario creado en Supabase Auth
--   (Authentication → Users → Add user)
-- =============================================================================

-- 1. Crear una empresa demo
INSERT INTO empresas (nombre, cuit, subdominio, moneda_base)
VALUES ('Empresa Demo', '30-00000000-0', 'demo', 'ARS')
ON CONFLICT (cuit) DO NOTHING;

-- 2. Asignar al primer usuario de auth.users como super_admin de la empresa
--    REEMPLAZAR el email por el tuyo
DO $$
DECLARE
  v_usuario_id UUID;
  v_empresa_id UUID;
BEGIN
  SELECT id INTO v_usuario_id FROM auth.users
    WHERE email = 'admin@agrosistema.com' LIMIT 1;
  SELECT id INTO v_empresa_id FROM empresas WHERE cuit = '30-00000000-0';

  IF v_usuario_id IS NOT NULL AND v_empresa_id IS NOT NULL THEN
    INSERT INTO usuarios_empresas (usuario_id, empresa_id, rol)
    VALUES (v_usuario_id, v_empresa_id, 'super_admin')
    ON CONFLICT (usuario_id, empresa_id) DO NOTHING;
  END IF;
END $$;

-- 3. Unidad de negocio por defecto
INSERT INTO unidades_negocio (empresa_id, nombre, tipo)
SELECT id, 'Agricultura', 'agricultura' FROM empresas WHERE cuit = '30-00000000-0'
ON CONFLICT DO NOTHING;

-- 4. Depósito central
INSERT INTO depositos (empresa_id, nombre, tipo)
SELECT id, 'Depósito Central', 'central' FROM empresas WHERE cuit = '30-00000000-0'
ON CONFLICT DO NOTHING;

-- 5. Productos de ejemplo
INSERT INTO productos (empresa_id, nombre, categoria, unidad_base, stock_minimo, requiere_trazabilidad)
SELECT id, 'Glifosato 48%', 'agroquimico', 'L', 200, true FROM empresas WHERE cuit = '30-00000000-0'
UNION ALL
SELECT id, 'Urea', 'fertilizante', 'kg', 1000, false FROM empresas WHERE cuit = '30-00000000-0'
UNION ALL
SELECT id, 'Soja DM 4670', 'semilla', 'kg', 500, true FROM empresas WHERE cuit = '30-00000000-0'
ON CONFLICT DO NOTHING;
