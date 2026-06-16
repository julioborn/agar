'use client';
import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  // Mientras intentamos recuperar la sesión desde localStorage mostramos spinner
  const [recovering, setRecovering] = useState(true);

  // Recuperación silenciosa de sesión para PWA en iOS/Android.
  // Cuando iOS mata el proceso de la PWA borra las cookies aunque tengan
  // Max-Age, pero el localStorage sobrevive. El cliente de Supabase lee
  // primero la cookie y cae en el fallback de localStorage, por lo que
  // refreshSession() puede renovar el token sin pedirle al usuario que
  // vuelva a loguearse.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/');
        return;
      }
      // No hay sesión en memoria/cookies. Intentamos renovar usando el
      // refresh token que puede estar en localStorage (backup de la PWA).
      supabase.auth.refreshSession().then(({ data }) => {
        if (data.session) {
          // ¡Sesión recuperada! Las cookies ya fueron escritas por el cliente.
          router.replace('/');
        } else {
          setRecovering(false); // sin sesión recuperable → mostrar form
        }
      }).catch(() => setRecovering(false));
    }).catch(() => setRecovering(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get('error') === 'link_invalido') {
      setError('El link de invitación es inválido o expiró.');
      return;
    }
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const desc = params.get('error_description');
      if (desc?.includes('expired') || desc?.includes('invalid')) {
        setError('El link de invitación expiró. Pedí que te reenvíen la invitación.');
      }
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Email o contraseña incorrectos.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (recovering) {
    return (
      <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
        <Image src="/agar-final.png" alt="AGAR" width={140} height={56} className="h-14 w-auto" priority />
        <Loader2 className="w-6 h-6 text-white/40 animate-spin mt-4" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Image src="/agar-final.png" alt="AGAR" width={140} height={56} className="h-14 w-auto" priority />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ade80]/40 focus:border-[#4ade80]/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Contraseña
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ade80]/40 focus:border-[#4ade80]/40"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#006836] hover:bg-[#005228] active:bg-[#004020] text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
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
  );
}

export default function LoginPage() {
  return (
    <main
      className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-12"
      style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}
    >
      <Suspense fallback={
        <div className="w-full max-w-sm space-y-4">
          <div className="h-14 bg-white/5 rounded-xl animate-pulse mx-auto w-36" />
          <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  );
}
