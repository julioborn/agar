'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export function AppSplash() {
  // 'show' → 'fading' → 'gone'
  const [phase, setPhase] = useState<'show' | 'fading' | 'gone'>('show');

  useEffect(() => {
    // Pequeño delay para dejar que el contenido debajo se pinte
    const t1 = setTimeout(() => setPhase('fading'), 150);
    const t2 = setTimeout(() => setPhase('gone'), 650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#09090b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }}
    >
      <Image
        src="/agar-final.png"
        alt="AGAR"
        width={88}
        height={88}
        priority
        className="rounded-full object-cover animate-logo-pulse"
        style={{ boxShadow: '0 0 28px 6px rgba(0,104,54,0.5)' }}
      />
    </div>
  );
}
