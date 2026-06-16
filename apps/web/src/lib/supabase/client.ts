import { createBrowserClient } from '@supabase/ssr';

// Un año en segundos — las session cookies (sin Max-Age) se borran al cerrar
// la PWA en iOS/Android. Forzamos Max-Age en cada escritura de cookie.
const ONE_YEAR_S = 60 * 60 * 24 * 365;

// Prefijo para las claves de localStorage que usamos como backup.
// iOS borra cookies al matar la PWA del multitasking aunque tengan Max-Age,
// pero localStorage sobrevive el kill del proceso.
const LS_PREFIX = 'sb_pwa_';

function lsGet(name: string): string | undefined {
  try { return localStorage.getItem(LS_PREFIX + name) ?? undefined; } catch { return undefined; }
}
function lsSet(name: string, value: string) {
  try { localStorage.setItem(LS_PREFIX + name, value); } catch {}
}
function lsDel(name: string) {
  try { localStorage.removeItem(LS_PREFIX + name); } catch {}
}

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
  const maxAge = ONE_YEAR_S;
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
          // Primero intentamos la cookie (camino normal).
          // Fallback a localStorage: cuando iOS mata la PWA borra las cookies
          // aunque tengan Max-Age, pero el localStorage persiste.
          return parseCookies()[name] ?? lsGet(name);
        },
        set(name: string, value: string, options: Record<string, any>) {
          writeCookie(name, value, options);
          lsSet(name, value); // backup para sobrevivir kill de PWA
        },
        remove(name: string, options: Record<string, any>) {
          writeCookie(name, '', { ...options, maxAge: 0 });
          lsDel(name);
        },
      },
    },
  );
}
