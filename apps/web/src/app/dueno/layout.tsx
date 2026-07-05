import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import LogoutButton from '@/components/logout-button';

export default async function DuenoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const { empresa, rol } = empresaData;
  if (rol !== 'dueno') redirect('/app');

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-zinc-950 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-14 flex items-center px-4 gap-3">
          <Image
            src="/agar-final.png"
            alt="AGAR"
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{empresa.nombre}</p>
            <p className="text-zinc-400 text-xs">Panel de seguimiento</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
