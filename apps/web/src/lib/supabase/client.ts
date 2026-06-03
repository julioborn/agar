import { createBrowserClient } from '@supabase/ssr';

// cookieOptions asegura que las cookies de sesión persistan en PWA mobile.
// Sin maxAge el browser las trata como session cookies y las borra al cerrar la app.
const COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 365, // 1 año
  sameSite: 'lax' as const,
  path: '/',
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: COOKIE_OPTIONS },
  );
}
