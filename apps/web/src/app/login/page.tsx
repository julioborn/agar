'use client';
import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import AppLoader from '@/components/app-loader';

// 8 × 6 = 48 parcelas — valores deterministas pseudo-aleatorios
const PARCELS = Array.from({ length: 48 }, (_, i) => {
  const isAmber = i % 7 === 0 || i % 13 === 0;
  const delay    = ((i * 7919 + 31) % 97) / 10;
  const duration = 3.5 + ((i * 6271 + 17) % 45) / 10;
  const sat      = isAmber ? 60 + (i % 3) * 8  : 28 + ((i * 3301) % 34);
  const lit1     = isAmber ? 10 + (i % 4) * 2  :  6 + ((i * 5003) % 10);
  const lit2     = isAmber ? 22 + (i % 5) * 3  : 13 + ((i * 2017) % 16);
  const hue      = isAmber ? 42 + (i % 3) * 4  : 124 + (i % 7) * 3;
  return { delay, duration, sat, lit1, lit2, hue };
});

const CSS = `
body:has(.land) { background: #221609; }

.land {
  min-height: 100svh;
  background: #221609;
  color: #f2ece1;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ── Hero ────────────────────────────────────────────── */
.l-hero {
  position: relative;
  min-height: 100svh;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: #221609;
}

.l-field {
  position: absolute;
  inset: -8%;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 4px;
  transform: rotate(3.5deg) scale(1.18);
  pointer-events: none;
}
.l-parcel {
  border-radius: 5px;
  background: var(--c1);
  animation: parcel-pulse var(--dur) ease-in-out var(--delay) infinite alternate;
}
@keyframes parcel-pulse {
  from { background: var(--c1); }
  to   { background: var(--c2); }
}

.l-veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 85% at 15% 50%, transparent 20%, rgba(34,22,9,0.9) 78%),
    linear-gradient(to bottom,
      rgba(34,22,9,0.6) 0%,
      rgba(34,22,9,0.15) 18%,
      rgba(34,22,9,0.15) 72%,
      rgba(34,22,9,0.96) 100%
    );
  pointer-events: none;
}

.l-hero-inner {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 4rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3rem;
}

.l-hero-text {
  flex: 1 1 480px;
  min-width: 0;
}

.l-login-pane {
  flex: 0 0 400px;
  width: 100%;
  max-width: 400px;
}

/* Logo circular */
.l-logo-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #ffffff;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.08);
}

.l-headline {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: clamp(2.25rem, 4.5vw, 3.5rem);
  font-weight: 700;
  line-height: 1.1;
  color: #f6efe2;
  margin: 0;
  text-wrap: balance;
  max-width: 560px;
  letter-spacing: -0.02em;
}
.l-headline-accent {
  color: #dbb93a;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .l-hero-inner { flex-direction: column; padding: 3rem 1.5rem; gap: 2.5rem; }
  .l-hero-text { text-align: center; display: flex; flex-direction: column; align-items: center; flex-basis: auto; }
  .l-headline { text-align: left; align-self: flex-start; }
  .l-login-pane { flex-basis: auto; }
}
@media (max-width: 600px) {
  .l-hero-inner { padding: 2.5rem 1.25rem; }
  .l-field { gap: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .l-parcel { animation: none; }
}
`;

// ── Formulario ─────────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [recovering, setRecovering] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { router.replace('/'); return; }
      supabase.auth.refreshSession().then(({ data }) => {
        if (data.session) router.replace('/');
        else setRecovering(false);
      }).catch(() => setRecovering(false));
    }).catch(() => setRecovering(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get('error') === 'link_invalido') {
      setError('El link de invitación es inválido o expiró.'); return;
    }
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const desc = params.get('error_description');
      if (desc?.includes('expired') || desc?.includes('invalid'))
        setError('El link de invitación expiró. Pedí que te reenvíen la invitación.');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError('Email o contraseña incorrectos.'); return; }
    router.push('/');
    router.refresh();
  }

  if (recovering) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px] mx-auto">

      {/* Card de formulario */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: '#ffffff',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 rounded-xl text-zinc-900 placeholder-zinc-300 text-base text-left transition-all outline-none"
                style={{
                  background: '#f4f4f5',
                  border: '1px solid #e4e4e7',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid #006836';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,104,54,0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid #e4e4e7';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-zinc-900 placeholder-zinc-300 text-base text-left transition-all outline-none"
                style={{
                  background: '#f4f4f5',
                  border: '1px solid #e4e4e7',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid #006836';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,104,54,0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid #e4e4e7';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <label className="flex items-center gap-2 mt-2 select-none cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#006836] cursor-pointer"
              />
              <span className="text-xs text-zinc-500">Mostrar contraseña</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-200">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-1"
            style={{
              background: loading
                ? '#005228'
                : 'linear-gradient(135deg, #006836 0%, #008040 100%)',
              boxShadow: '0 4px 20px rgba(0,104,54,0.35)',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ingresando…
              </>
            ) : (
              'Ingresar'
            )}
          </button>

        </form>
      </div>

    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="land">
        <section className="l-hero">
          <div className="l-field" aria-hidden="true">
            {PARCELS.map((p, i) => (
              <div
                key={i}
                className="l-parcel"
                style={{
                  '--delay': `${p.delay}s`,
                  '--dur':   `${p.duration}s`,
                  '--c1':    `hsl(${p.hue} ${p.sat}% ${p.lit1}%)`,
                  '--c2':    `hsl(${p.hue} ${p.sat}% ${p.lit2}%)`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          <div className="l-veil" aria-hidden="true" />

          <div className="l-hero-inner">
            <div className="l-hero-text">
              <div className="l-logo-circle">
                <Image src="/agar-final.png" alt="agar" width={44} height={44} />
              </div>

              <h1 className="l-headline">
                Sistema de gestión integral<br />
                de <span className="l-headline-accent">agricultura y ganadería</span>.
              </h1>
            </div>

            <div className="l-login-pane">
              <Suspense fallback={<AppLoader size="lg" className="py-0" />}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
