import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Props {
  /** Ocupa toda la pantalla (para loading.tsx de ruta) */
  fullscreen?: boolean;
  /** Tamaño del logo */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { px: 48,  cls: 'h-12 w-12' },
  md: { px: 72,  cls: 'h-18 w-18' },
  lg: { px: 96,  cls: 'h-24 w-24' },
};

export default function AppLoader({ fullscreen = false, size = 'md', className }: Props) {
  const { px, cls } = SIZES[size];
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullscreen
          ? 'fixed inset-0 bg-zinc-50 z-50'
          : 'w-full py-20',
        className,
      )}
    >
      <Image
        src="/agar-final.png"
        alt="Cargando…"
        width={px}
        height={px}
        className={cn('rounded-full object-cover animate-logo-pulse', cls)}
        priority
      />
    </div>
  );
}
