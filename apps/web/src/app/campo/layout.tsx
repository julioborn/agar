import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import BottomNav from './bottom-nav';

export default async function CampoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header fijo — 3 columnas: logo centrado, empresa a la izquierda, espacio a la derecha */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950 h-14 flex items-center px-4 gap-3">
        <span className="text-zinc-500 text-xs truncate max-w-[100px]">{empresaData.empresa.nombre}</span>
        <div className="flex-1 flex justify-center pointer-events-none select-none">
          <img src="/agar-final.png" alt="AGAR" className="h-8 w-auto" />
        </div>
        <div className="w-[100px]" />
      </header>

      {/* Contenido con padding para header y bottom nav */}
      <main className="flex-1 pt-14 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Navegación inferior */}
      <BottomNav />
    </div>
  );
}
