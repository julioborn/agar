'use client';
import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import AppLoader from '@/components/app-loader';

// ── Logo circular con anillo y sombra verde ────────────────────────────────

function Logo({ size = 88 }: { size?: number }) {
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Anillo exterior con glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 180deg, #006836 0%, #4ade80 40%, #006836 70%, #004d24 100%)',
          padding: 2,
          boxShadow: '0 0 28px 4px rgba(0,104,54,0.45)',
        }}
      >
        <div className="w-full h-full rounded-full bg-zinc-950" />
      </div>

      {/* Imagen */}
      <Image
        src="/agar-final.png"
        alt="agar"
        width={size}
        height={size}
        className="absolute inset-0 rounded-full object-cover"
        style={{ padding: 3 }}
        priority
      />
    </div>
  );
}

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
      <div className="flex flex-col items-center gap-6">
        <Logo />
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[360px] mx-auto">

      {/* Logo + nombre */}
      <div className="flex flex-col items-center mb-8">
        <Logo />
      </div>

      {/* Card de formulario */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
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
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-base text-left transition-all outline-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(74,222,128,0.45)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.10)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid rgba(255,255,255,0.10)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
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
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-base text-left transition-all outline-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(74,222,128,0.45)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.10)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid rgba(255,255,255,0.10)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <label className="flex items-center gap-2 mt-2 select-none cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#4ade80] cursor-pointer"
              />
              <span className="text-xs text-white/50">Mostrar contraseña</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              <p className="text-red-400 text-sm">{error}</p>
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
    <main
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: '#060d08',
        paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))',
      }}
    >
      {/* Orbe verde superior-derecha */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,104,54,0.22) 0%, transparent 70%)',
          top: '-80px',
          right: '-100px',
          filter: 'blur(1px)',
        }}
      />

      {/* Orbe verde inferior-izquierda */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,77,36,0.18) 0%, transparent 70%)',
          bottom: '-60px',
          left: '-80px',
          filter: 'blur(1px)',
        }}
      />

      {/* Línea horizontal decorativa tenue */}
      <div
        className="absolute pointer-events-none"
        style={{
          height: 1,
          width: '100%',
          top: '55%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,104,54,0.12) 30%, rgba(0,104,54,0.12) 70%, transparent 100%)',
        }}
      />

      <Suspense fallback={<AppLoader size="lg" className="py-0" />}>
        <LoginForm />
      </Suspense>
      
    </main>
  );
}
