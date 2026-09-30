-- spatial_ref_sys pertenece a la extensión PostGIS y no puede alterarse desde acá
-- (el rol de las migraciones no es owner de esa tabla en Supabase). Es una alerta
-- conocida/no accionable por el usuario; se deja documentada, no se toca la tabla.

-- Función de diagnóstico temporal (migración 039), ya no hace falta.
DROP FUNCTION IF EXISTS fn_debug_tablas_sin_rls();
