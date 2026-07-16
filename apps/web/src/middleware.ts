import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Tiempo de vida de las cookies de sesión: 1 año.
// Sin esto, en iOS/Android PWA las cookies se borran al "cerrar" la app
// porque quedan como session cookies (sin maxAge).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function middleware(request: NextRequest) {
  // Exponer el pathname como header para que los Server Components puedan leerlo
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              // Forzar maxAge para que persistan en PWA al cerrar/reabrir la app
              maxAge: COOKIE_MAX_AGE, // Siempre 1 año — ignorar el maxAge corto del JWT
              sameSite: 'lax',
              path: '/',
              secure: process.env.NODE_ENV === 'production',
            }),
          );
        },
      },
    },
  );

  // getUser() valida el JWT y renueva el access token si expiró,
  // usando el refresh token — escribe los nuevos tokens via setAll().
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)',
  ],
};
