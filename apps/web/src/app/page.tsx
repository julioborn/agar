import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import Link from 'next/link';
import Image from 'next/image';

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
    radial-gradient(ellipse 75% 80% at 18% 55%, transparent 25%, rgba(34,22,9,0.88) 75%),
    linear-gradient(to bottom,
      rgba(34,22,9,0.55) 0%,
      rgba(34,22,9,0.1) 18%,
      rgba(34,22,9,0.1) 72%,
      rgba(34,22,9,0.96) 100%
    );
  pointer-events: none;
}

.l-hero-inner {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 4rem 2rem 4rem;
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
  font-size: clamp(2.5rem, 6.5vw, 4.5rem);
  font-weight: 700;
  line-height: 1.1;
  color: #f6efe2;
  margin: 0 0 2.25rem;
  text-wrap: balance;
  max-width: 720px;
  letter-spacing: -0.02em;
}
.l-headline-accent {
  color: #dbb93a;
}

.l-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.9rem 1.9rem;
  border-radius: 9999px;
  background: #dbb93a;
  color: #160e00;
  font-size: 0.97rem;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 4px 28px rgba(219, 185, 58, 0.28);
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  letter-spacing: -0.01em;
}
.l-cta:hover {
  background: #e8c94a;
  transform: translateY(-2px);
  box-shadow: 0 8px 36px rgba(219, 185, 58, 0.38);
}
.l-cta-arrow {
  width: 16px; height: 16px;
  transition: transform 0.15s;
}
.l-cta:hover .l-cta-arrow { transform: translateX(3px); }

/* Scroll hint */
.l-scroll-hint {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: scroll-bounce 2.5s ease-in-out infinite;
}
@keyframes scroll-bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.2; }
  50%       { transform: translateX(-50%) translateY(6px); opacity: 0.35; }
}
.l-scroll-line {
  width: 1px;
  height: 36px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.3), transparent);
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 600px) {
  .l-hero-inner { padding: 3.5rem 1.25rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
  .l-headline { text-align: left; align-self: flex-start; }
  .l-field { gap: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .l-parcel, .l-cta, .l-scroll-hint { animation: none; transition: none; }
}
`;

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const empresaData = await getEmpresaActiva();
    if (!empresaData) redirect('/login');
    const { rol, todasLasEmpresas } = empresaData;
    const tieneRolAdmin = todasLasEmpresas.some(
      (e) => e.rol === 'super_admin' || e.rol === 'admin_empresa' || e.rol === 'contador',
    );
    if (rol === 'encargado_campo' && !tieneRolAdmin) redirect('/campo');
    redirect('/app');
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="land">

        {/* ── Hero ── */}
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
            <div className="l-logo-circle">
              <Image src="/agar-final.png" alt="agar" width={44} height={44} />
            </div>

            <h1 className="l-headline">
              Sistema de gestión integral<br />
              de <span className="l-headline-accent">agricultura y ganadería</span>.
            </h1>

            <Link href="/login" className="l-cta">
              Iniciar sesión
              <svg className="l-cta-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <div className="l-scroll-hint" aria-hidden="true">
            <div className="l-scroll-line" />
          </div>
        </section>

      </div>
    </>
  );
}
