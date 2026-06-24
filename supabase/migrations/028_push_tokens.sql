-- =============================================================================
-- Migración 028: Tokens de notificaciones push
-- Guarda el token de Firebase Cloud Messaging de cada dispositivo, ligado al
-- usuario. Por ahora solo se registra el token (conexión lista); el envío de
-- notificaciones se implementará a futuro.
-- =============================================================================

CREATE TABLE push_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  plataforma  TEXT NOT NULL DEFAULT 'android',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token)
);

CREATE INDEX idx_push_tokens_usuario ON push_tokens(usuario_id);

CREATE TRIGGER trg_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_select ON push_tokens FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY push_tokens_insert ON push_tokens FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY push_tokens_update ON push_tokens FOR UPDATE
  USING (usuario_id = auth.uid());

CREATE POLICY push_tokens_delete ON push_tokens FOR DELETE
  USING (usuario_id = auth.uid());
