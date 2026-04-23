import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con service_role key — solo usar en Server Actions / Route Handlers.
 * Nunca exponer al cliente (no usar en 'use client').
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
