-- Función de diagnóstico temporal: lista tablas de public sin RLS habilitado.
-- Se elimina en la migración siguiente una vez usada.
CREATE OR REPLACE FUNCTION fn_debug_tablas_sin_rls()
RETURNS TABLE(tabla text, rls_habilitado boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.relname::text, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relrowsecurity ASC, c.relname;
$$;
