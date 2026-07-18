import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppSplash } from '@/components/app-splash';
import { PullToRefresh } from '@/components/pull-to-refresh';

export const metadata: Metadata = {
  title: 'agar',
  description: 'Gestión agropecuaria integral',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/agar-final.png',
  },
  appleWebApp: {
    capable: true,
    title: 'agar',
    // black-translucent: el contenido se extiende bajo el status bar (Dynamic Island).
    // El header negro se ve a través del área transparente → looks seamless en iOS.
    // Sin esto el área sobre la isla queda blanca.
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  // viewport-fit=cover es la clave: extiende el viewport detrás de la
  // Dynamic Island/notch en iOS para que el header negro cubra esa área.
  // Sin esto, env(safe-area-inset-top) siempre devuelve 0 y el black-translucent
  // no tiene efecto sobre el fondo del safe area.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <AppSplash />
        <PullToRefresh />
        {children}
      </body>
    </html>
  );
}
