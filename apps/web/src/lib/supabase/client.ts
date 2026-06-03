import { createBrowserClient } from '@supabase/ssr';

// Un año en segundos — las session cookies (sin Max-Age) se borran al cerrar
// la PWA en iOS/Android. Forzamos Max-Age en cada escritura de cookie.
const ONE_YEAR_S = 60 * 60 * 24 * 365;

function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  return Object.fromEntries(
    document.cookie.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );
}

function writeCookie(name: string, value: string, options: Record<string, any> = {}) {
  const maxAge = options.maxAge ?? options['max-age'] ?? ONE_YEAR_S;
  const path   = options.path     ?? '/';
  const same   = options.sameSite ?? 'lax';
  const parts  = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    `Path=${path}`,
    `SameSite=${same}`,
  ];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.secure ?? (typeof location !== 'undefined' && location.protocol === 'https:')) {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return parseCookies()[name];
        },
        set(name: string, value: string, options: Record<string, any>) {
          writeCookie(name, value, options);
        },
        remove(name: string, options: Record<string, any>) {
          writeCookie(name, '', { ...options, maxAge: 0 });
        },
      },
    },
  );
}
