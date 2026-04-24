'use client';

import { useState } from 'react';
import { Building2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import CrearEmpresaForm from './crear-empresa-form';
import LogoUpload from './logo-upload';

interface EmpresaRow {
  id: string; nombre: string; cuit: string; moneda_base: string; logo_url?: string | null; fecha_alta: string;
}

interface Props { empresas: EmpresaRow[] }

const fmt = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function EmpresasLayout({ empresas }: Props) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{empresas.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Empresas</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-blue-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">
              {empresas.filter((e) => e.moneda_base === 'ARS').length}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">En ARS</p>
          </div>
        </div>
      </div>

      {/* Nueva empresa (collapsible) */}
      <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all',
        formOpen ? 'border-[#006836]/30 shadow-sm' : 'border-zinc-100')}>
        <button type="button" onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              formOpen ? 'bg-[#006836]' : 'bg-[#006836]/10')}>
              <Plus className={cn('w-4 h-4', formOpen ? 'text-white' : 'text-[#006836]')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">Nueva empresa</p>
              <p className="text-xs text-zinc-400">Nombre, CUIT, moneda y logo</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {formOpen && (
          <div className="border-t border-zinc-100 p-5 max-w-md">
            <CrearEmpresaForm />
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        {empresas.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-zinc-200 mx-auto" />
            <p className="text-zinc-400 text-sm">No hay empresas registradas todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Logo</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">CUIT</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Moneda</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {empresas.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-[#006836]/5 transition-colors">
                    <td className="px-4 py-3">
                      <LogoUpload empresaId={empresa.id} logoUrl={empresa.logo_url} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-zinc-800">
                        <Building2 className="w-4 h-4 text-zinc-300 shrink-0" />
                        {empresa.nombre}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{empresa.cuit}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                        {empresa.moneda_base}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{fmt(empresa.fecha_alta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
