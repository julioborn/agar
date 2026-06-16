import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AGAR',
  description: 'Gestión agropecuaria integral',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/agar-final.png',
  },
  appleWebApp: {
    capable: true,
    title: 'AGAR',
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
