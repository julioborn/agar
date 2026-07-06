'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Cuántos px de movimiento táctil real disparan la recarga
const THRESHOLD = 100;

export function PullToRefresh() {
  const startYRef  = useRef(0);
  const activeRef  = useRef(false);
  const rawPullRef = useRef(0);

  const [visualY,   setVisualY]   = useState(0);   // px de desplazamiento visual (amortiguado)
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Solo activar desde el tope absoluto del scroll
      if (window.scrollY > 2) return;
      startYRef.current  = e.touches[0].clientY;
      activeRef.current  = true;
      rawPullRef.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        // Si el usuario mueve hacia arriba, cancelamos
        activeRef.current = false;
        setVisualY(0);
        return;
      }
      rawPullRef.current = dy;
      // Amortiguación: raíz cuadrada para dar sensación elástica, con tope visual en 72px
      setVisualY(Math.min(Math.sqrt(dy) * 5, 72));
      e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!activeRef.current) return;
      activeRef.current = false;

      if (rawPullRef.current >= THRESHOLD) {
        setReloading(true);
        // Breve pausa visual antes de recargar
        setTimeout(() => window.location.reload(), 300);
      } else {
        setVisualY(0);
        rawPullRef.current = 0;
      }
    };

    document.addEventListener('touchstart',  onTouchStart, { passive: true  });
    document.addEventListener('touchmove',   onTouchMove,  { passive: false });
    document.addEventListener('touchend',    onTouchEnd,   { passive: true  });
    document.addEventListener('touchcancel', onTouchEnd,   { passive: true  });

    return () => {
      document.removeEventListener('touchstart',  onTouchStart);
      document.removeEventListener('touchmove',   onTouchMove);
      document.removeEventListener('touchend',    onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  if (visualY === 0 && !reloading) return null;

  const progress = Math.min(visualY / 72, 1);
  const ready    = rawPullRef.current >= THRESHOLD;

  return (
    <div
      style={{
        position: 'fixed',
        top: `calc(${visualY + 16}px + env(safe-area-inset-top))`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000,
        pointerEvents: 'none',
        transition: reloading ? 'top 0.25s ease' : 'none',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          background: 'white',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
          opacity: progress,
          transform: `scale(${0.5 + progress * 0.5})`,
          transition: reloading ? 'transform 0.2s ease' : 'none',
        }}
      >
        <RefreshCw
          size={18}
          color={ready ? '#006836' : '#a1a1aa'}
          style={{
            transform: `rotate(${rawPullRef.current * 3.5}deg)`,
            transition: reloading ? 'transform 0.3s ease' : 'none',
          }}
          className={reloading ? 'animate-spin' : ''}
        />
      </div>
    </div>
  );
}
