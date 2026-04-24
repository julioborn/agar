-- Storage bucket para logos de empresas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empresa-logos',
  'empresa-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Cualquiera puede ver los logos (bucket público)
CREATE POLICY "empresa_logos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'empresa-logos');

-- Solo usuarios autenticados pueden subir
CREATE POLICY "empresa_logos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'empresa-logos' AND auth.role() = 'authenticated');

CREATE POLICY "empresa_logos_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'empresa-logos' AND auth.role() = 'authenticated');

CREATE POLICY "empresa_logos_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'empresa-logos' AND auth.role() = 'authenticated');
