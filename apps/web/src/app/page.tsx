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
body:has(.land) { background: #07120a; }

.land {
  min-height: 100svh;
  background: #07120a;
  color: #eef5f0;
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
  background: #07120a;
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
    radial-gradient(ellipse 75% 80% at 18% 55%, transparent 25%, rgba(7,18,10,0.88) 75%),
    linear-gradient(to bottom,
      rgba(7,18,10,0.55) 0%,
      rgba(7,18,10,0.1) 18%,
      rgba(7,18,10,0.1) 72%,
      rgba(7,18,10,0.96) 100%
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
  background: rgba(255, 255, 255, 0.93);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.08);
}

.l-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: #3fad60;
  padding: 0.28rem 0.8rem;
  border-radius: 9999px;
  background: rgba(63, 173, 96, 0.1);
  border: 1px solid rgba(63, 173, 96, 0.25);
  margin-bottom: 1.6rem;
}
.l-eyebrow-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #3fad60;
  animation: dot-blink 2s ease-in-out infinite;
}
@keyframes dot-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}

.l-headline {
  font-family: Georgia, 'Palatino Linotype', 'Book Antiqua', serif;
  font-size: clamp(3rem, 8vw, 5.75rem);
  font-weight: 400;
  line-height: 1.04;
  color: #f0f8f2;
  margin: 0 0 2.25rem;
  text-wrap: balance;
  max-width: 680px;
  letter-spacing: -0.02em;
}
.l-headline-accent {
  color: #dbb93a;
  font-style: italic;
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

/* ── Features ────────────────────────────────────────── */
.l-features {
  background: #07120a;
  padding: 5rem 2rem 6rem;
}
.l-features-inner {
  max-width: 1120px;
  margin: 0 auto;
}
.l-section-label {
  font-size: 0.67rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2e6e40;
  margin-bottom: 2.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.l-section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.06);
  max-width: 200px;
}
.l-feat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 18px;
  overflow: hidden;
}
.l-feat {
  background: #0b1e0f;
  padding: 2.25rem 2rem;
  transition: background 0.2s;
}
.l-feat:hover { background: #0f2614; }
.l-feat-num {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #2a5c38;
  margin-bottom: 1.5rem;
}
.l-feat-title {
  font-family: Georgia, 'Palatino Linotype', serif;
  font-size: 1.15rem;
  font-weight: 400;
  color: #cce8d4;
  margin: 0 0 0.65rem;
  line-height: 1.3;
}
.l-feat-desc {
  font-size: 0.875rem;
  color: #4a7a58;
  line-height: 1.72;
  margin: 0;
}
.l-feat-tag {
  display: inline-block;
  margin-top: 1.25rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 0.22rem 0.6rem;
  border-radius: 9999px;
  background: rgba(63, 173, 96, 0.1);
  color: #3fad60;
  border: 1px solid rgba(63, 173, 96, 0.2);
}

/* ── CTA Bottom ──────────────────────────────────────── */
.l-bottom {
  background: #061009;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
  padding: 5rem 2rem;
  text-align: center;
}
.l-bottom-title {
  font-family: Georgia, 'Palatino Linotype', serif;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 400;
  color: #d4eedd;
  margin: 0 0 0.75rem;
}
.l-bottom-sub {
  font-size: 0.9rem;
  color: #3d6045;
  margin: 0 0 2rem;
}

/* ── Footer ──────────────────────────────────────────── */
.l-footer {
  padding: 1.25rem 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.l-footer-copy { font-size: 0.72rem; color: #25402c; }
.l-footer-brand {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: #2a5c38;
  font-weight: 500;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .l-feat-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .l-hero-inner { padding: 3.5rem 1.25rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
  .l-headline { text-align: left; align-self: flex-start; }
  .l-features { padding: 4rem 1.25rem 5rem; }
  .l-bottom { padding: 4rem 1.25rem; }
  .l-field { gap: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .l-parcel, .l-eyebrow-dot, .l-cta, .l-scroll-hint { animation: none; transition: none; }
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
              <Image src="/agar-final.png" alt="AGAR" width={44} height={44} />
            </div>

            <div className="l-eyebrow">
              <span className="l-eyebrow-dot" />
              Sistema de gestión agropecuaria
            </div>

            <h1 className="l-headline">
              El campo,<br />
              <span className="l-headline-accent">en un solo</span> sistema.
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

        {/* ── Features ── */}
        <section className="l-features">
          <div className="l-features-inner">
            <p className="l-section-label">Funcionalidades</p>
            <div className="l-feat-grid">

              <div className="l-feat">
                <p className="l-feat-num">01</p>
                <h2 className="l-feat-title">Cultivos y Costos Directos</h2>
                <p className="l-feat-desc">
                  Seguimiento completo por campaña, campo y lote. Registrá siembras,
                  aplicaciones de insumos, labores y cosecha. El costo directo se
                  calcula automáticamente.
                </p>
                <span className="l-feat-tag">Cultivos · Lotes · Cosecha</span>
              </div>

              <div className="l-feat">
                <p className="l-feat-num">02</p>
                <h2 className="l-feat-title">Remitos Internos (RIA)</h2>
                <p className="l-feat-desc">
                  Movimiento de insumos desde el depósito hasta el lote con trazabilidad
                  y costeo automático. Confirmación genera descuento de stock e impacto
                  real en el costo del cultivo.
                </p>
                <span className="l-feat-tag">Stock · Trazabilidad · RIA</span>
              </div>

              <div className="l-feat">
                <p className="l-feat-num">03</p>
                <h2 className="l-feat-title">Reportes y Márgenes</h2>
                <p className="l-feat-desc">
                  Análisis en tiempo real: margen bruto por cultivo, desglose de
                  insumos y labores, costos indirectos por campo y empresa, y
                  producción por campaña.
                </p>
                <span className="l-feat-tag">Márgenes · Análisis · Reportes</span>
              </div>

            </div>
          </div>
        </section>

        {/* ── CTA inferior ── */}
        <div className="l-bottom">
          <h2 className="l-bottom-title">¿Listo para empezar?</h2>
          <p className="l-bottom-sub">Iniciá sesión con tu cuenta para acceder al panel.</p>
          <Link href="/login" className="l-cta">
            Iniciar sesión
            <svg className="l-cta-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* ── Footer ── */}
        <footer className="l-footer">
          <span className="l-footer-copy">© {new Date().getFullYear()} AgroSistema</span>
          <div className="l-footer-brand">
            <Image src="/agar-final.png" alt="" width={14} height={14} />
            AGAR
          </div>
        </footer>

      </div>
    </>
  );
}
