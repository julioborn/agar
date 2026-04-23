-- =============================================================================
-- Migración 004: Fix RLS recursivo en lotes
--
-- Problema: la política original llama a empresa_id_de_lote(id), que hace
-- SELECT FROM lotes sin SECURITY DEFINER. Cuando RLS evalúa esa consulta
-- interna, vuelve a llamar la función → recursión → devuelve 0 filas.
--
-- Solución: reemplazar la política para que haga el JOIN en campos
-- directamente, igual que ya lo hace el WITH CHECK original.
-- =============================================================================

DROP POLICY IF EXISTS lotes_rls ON lotes;

CREATE POLICY lotes_rls ON lotes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campos
      WHERE campos.id = campo_id
        AND user_has_empresa_access(campos.empresa_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campos
      WHERE campos.id = campo_id
        AND user_has_empresa_access(campos.empresa_id)
    )
  );

-- Aprovechamos y agregamos SECURITY DEFINER a la función helper
-- para que sea segura si se la usa en otros contextos futuros.
CREATE OR REPLACE FUNCTION empresa_id_de_lote(lote_uuid UUID)
RETURNS UUID AS $$
  SELECT c.empresa_id FROM lotes l
  JOIN campos c ON c.id = l.campo_id
  WHERE l.id = lote_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
