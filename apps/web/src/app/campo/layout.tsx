import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import BottomNav from './bottom-nav';
import LogoutButton from '@/components/logout-button';
import Image from 'next/image';

export default async function CampoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <Image
            src="/agar-final.png"
            alt="AGAR"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover"
          />
          <span className="text-white text-sm font-semibold truncate max-w-[180px]">
            {empresaData.empresa.nombre}
          </span>
        </div>
        <LogoutButton />
      </header>

      <main className="flex-1 pt-14 pb-20 overflow-y-auto">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
