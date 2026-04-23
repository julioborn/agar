import { User } from 'lucide-react';
import EmpresaSelector from './empresa-selector';
import LogoutButton from './logout-button';
import type { EmpresaConRol } from '@/lib/empresa-actual';

interface Props {
  userEmail: string;
  empresaActiva: EmpresaConRol;
  todasLasEmpresas: EmpresaConRol[];
}

export default function Header({ userEmail, empresaActiva, todasLasEmpresas }: Props) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Empresa:</span>
        <EmpresaSelector empresas={todasLasEmpresas} empresaActivaId={empresaActiva.id} />
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <User className="w-4 h-4" />
          <span>{userEmail}</span>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
