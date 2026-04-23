'use client';

import { useTransition } from 'react';
import { setEmpresaActiva } from '@/lib/actions';
import type { EmpresaConRol } from '@/lib/empresa-actual';

interface Props {
  empresas: EmpresaConRol[];
  empresaActivaId: string;
}

export default function EmpresaSelector({ empresas, empresaActivaId }: Props) {
  const [isPending, startTransition] = useTransition();

  if (empresas.length === 1) {
    return <span className="text-sm font-medium text-slate-800">{empresas[0].nombre}</span>;
  }

  return (
    <select
      value={empresaActivaId}
      disabled={isPending}
      onChange={(e) => {
        startTransition(() => {
          setEmpresaActiva(e.target.value);
        });
      }}
      className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-white bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
    >
      {empresas.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nombre}
        </option>
      ))}
    </select>
  );
}
