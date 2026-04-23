'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Plus, ChevronDown, ChevronUp, Check, X, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crearUsuario, actualizarRol, eliminarUsuario } from './actions';

type RolUsuario = 'super_admin' | 'admin_empresa' | 'contador' | 'encargado_campo';

export interface UsuarioRow {
  usuario_id: string;
  email: string;
  rol: RolUsuario;
  confirmado: boolean;
}

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'admin_empresa',   label: 'Admin empresa' },
  { value: 'contador',        label: 'Contador' },
  { value: 'encargado_campo', label: 'Encargado de campo' },
];

const ROL_BADGE: Record<RolUsuario, string> = {
  super_admin:     'bg-red-100 text-red-700',
  admin_empresa:   'bg-purple-100 text-purple-700',
  contador:        'bg-amber-100 text-amber-700',
  encargado_campo: 'bg-[#006836]/10 text-[#006836]',
};

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

interface Props { usuarios: UsuarioRow[]; miUsuarioId: string }

export default function UsuariosManager({ usuarios, miUsuarioId }: Props) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [nuevoEmail,    setNuevoEmail]    = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol,      setNuevoRol]      = useState<RolUsuario>('encargado_campo');
  const [showPass,      setShowPass]      = useState(false);
  const [crearLoading,  setCrearLoading]  = useState(false);
  const [crearError,    setCrearError]    = useState('');
  const [crearOk,       setCrearOk]       = useState(false);

  const [editId,      setEditId]      = useState<string | null>(null);
  const [editRol,     setEditRol]     = useState<RolUsuario>('encargado_campo');
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState('');

  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setCrearError(''); setCrearOk(false);
    if (!nuevoEmail.trim()) { setCrearError('Ingresá el email.'); return; }
    if (nuevoPassword.length < 6) { setCrearError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setCrearLoading(true);
    const res = await crearUsuario(nuevoEmail.trim(), nuevoPassword, nuevoRol);
    setCrearLoading(false);
    if (res.error) { setCrearError(res.error); return; }
    setCrearOk(true);
    setNuevoEmail(''); setNuevoPassword('');
    router.refresh();
  }

  async function handleEditGuardar(usuarioId: string) {
    setEditError(''); setEditLoading(true);
    const res = await actualizarRol(usuarioId, editRol);
    setEditLoading(false);
    if (res.error) { setEditError(res.error); return; }
    setEditId(null); router.refresh();
  }

  async function handleEliminar(usuarioId: string) {
    setDeleteLoading(true);
    await eliminarUsuario(usuarioId);
    setDeleteLoading(false); setDeleteId(null); router.refresh();
  }

  const admins    = usuarios.filter((u) => u.rol === 'admin_empresa').length;
  const contadores = usuarios.filter((u) => u.rol === 'contador').length;

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{usuarios.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Usuarios</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-purple-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{admins}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Admins</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">{contadores}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Contadores</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#006836]/40" />
          <div>
            <p className="text-xl font-bold text-zinc-900 leading-none">
              {usuarios.filter((u) => u.rol === 'encargado_campo').length}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">Encargados</p>
          </div>
        </div>
      </div>

      {/* Agregar usuario (collapsible) */}
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
              <p className="text-sm font-semibold text-zinc-800">Agregar usuario</p>
              <p className="text-xs text-zinc-400">Email, contraseña y rol</p>
            </div>
          </div>
          {formOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {formOpen && (
          <div className="border-t border-zinc-100 p-5">
            <form onSubmit={handleCrear} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email</label>
                  <input type="email" value={nuevoEmail}
                    onChange={(e) => { setNuevoEmail(e.target.value); setCrearOk(false); }}
                    placeholder="email@ejemplo.com" disabled={crearLoading} className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Contraseña inicial</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={nuevoPassword}
                      onChange={(e) => setNuevoPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres" disabled={crearLoading}
                      className={`${field} pr-9`} />
                    <button type="button" onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Rol</label>
                  <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value as RolUsuario)}
                    disabled={crearLoading} className={field}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              {crearError && <p className="text-xs text-red-500">{crearError}</p>}
              {crearOk && (
                <p className="text-xs text-[#006836] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Usuario creado. Ya puede ingresar con su email y contraseña.
                </p>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={crearLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors">
                  <UserPlus className="w-4 h-4" />
                  {crearLoading ? 'Creando...' : 'Crear usuario'}
                </button>
                <button type="button" onClick={() => setFormOpen(false)}
                  className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                  Cancelar
                </button>
              </div>
              <p className="text-xs text-zinc-400">
                El usuario puede cambiar su contraseña desde su perfil una vez que ingrese.
              </p>
            </form>
          </div>
        )}
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-400" />
          <h2 className="font-semibold text-zinc-800 text-sm">Usuarios de la empresa</h2>
        </div>

        {usuarios.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-zinc-200 mx-auto" />
            <p className="text-zinc-400 text-sm">No hay usuarios vinculados todavía.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Rol</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {usuarios.map((u) => (
                <tr key={u.usuario_id} className="hover:bg-[#006836]/5 transition-colors">
                  <td className="px-5 py-3 text-zinc-800 font-medium">{u.email}</td>

                  <td className="px-4 py-3">
                    {editId === u.usuario_id ? (
                      <div className="flex items-center gap-2">
                        <select value={editRol} onChange={(e) => setEditRol(e.target.value as RolUsuario)}
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#006836]/40">
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button onClick={() => handleEditGuardar(u.usuario_id)} disabled={editLoading}
                          className="text-[#006836] hover:text-[#005228] p-0.5" title="Guardar">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditId(null); setEditError(''); }}
                          className="text-zinc-400 hover:text-zinc-600 p-0.5" title="Cancelar">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className={cn('inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full',
                        ROL_BADGE[u.rol] ?? 'bg-zinc-100 text-zinc-600')}>
                        {ROLES.find((r) => r.value === u.rol)?.label ?? u.rol}
                      </span>
                    )}
                    {editError && editId === u.usuario_id && (
                      <p className="text-xs text-red-500 mt-1">{editError}</p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {u.usuario_id !== miUsuarioId && (
                      <div className="flex items-center gap-1 justify-end">
                        {deleteId === u.usuario_id ? (
                          <>
                            <span className="text-xs text-zinc-500 mr-1">¿Quitar?</span>
                            <button onClick={() => handleEliminar(u.usuario_id)} disabled={deleteLoading}
                              className="text-red-500 hover:text-red-700 p-1 text-xs font-semibold">Sí</button>
                            <button onClick={() => setDeleteId(null)}
                              className="text-zinc-400 hover:text-zinc-600 p-1 text-xs">No</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(u.usuario_id); setEditRol(u.rol); setEditError(''); }}
                              className="text-zinc-400 hover:text-zinc-700 p-1 transition-colors" title="Cambiar rol">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteId(u.usuario_id)}
                              className="text-zinc-400 hover:text-red-500 p-1 transition-colors" title="Quitar de la empresa">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
