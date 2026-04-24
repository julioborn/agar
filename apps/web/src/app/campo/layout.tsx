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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header fijo */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-green-700 text-white h-14 flex items-center px-4 shadow-md">
        <div className="flex items-center gap-2">
          <img src="/agar6.png" alt="agar" className="h-8 w-auto brightness-0 invert" />
          <span className="text-green-300 text-sm font-normal">· {empresaData.empresa.nombre}</span>
        </div>
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
