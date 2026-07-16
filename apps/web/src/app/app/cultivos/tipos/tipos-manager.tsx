'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Check, X, Download, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  crearTipoCultivo, actualizarTipoCultivo, eliminarTipoCultivo,
  importarTiposDesdeExistentes, vincularCultivosExistentes,
} from './actions';
import { useReadOnly } from '@/lib/readonly-context';

interface TipoCultivo {
  id: string;
  nombre: string;
}

interface Props {
  tipos: TipoCultivo[];
}

export default function TiposManager({ tipos }: Props) {
  const router = useRouter();
  const esLector = useReadOnly();
  const [nuevo, setNuevo] = useState('');
  const [creando, setCreando] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [vinculando, setVinculando] = useState(false);
  const [vincMsg, setVincMsg] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function handleCrear() {
    if (!nuevo.trim()) return;
    setCreando(true);
    setErrorNuevo('');
    const res = await crearTipoCultivo(nuevo.trim());
    setCreando(false);
    if (res.error) { setErrorNuevo(res.error); return; }
    setNuevo('');
    router.refresh();
  }

  async function handleGuardarEdicion() {
    if (!editandoId || !editNombre.trim()) return;
    setGuardando(true);
    const res = await actualizarTipoCultivo(editandoId, editNombre.trim());
    setGuardando(false);
    if (res.error) { setErrorNuevo(res.error); return; }
    setEditandoId(null);
    router.refresh();
  }

  async function handleEliminar() {
    if (!deleteId) return;
    setBorrando(true);
    await eliminarTipoCultivo(deleteId);
    setBorrando(false);
    setDeleteId(null);
    router.refresh();
  }

  async function handleImportar() {
    setImportando(true);
    setImportMsg('');
    const res = await importarTiposDesdeExistentes();
    setImportando(false);
    if (res.error) { setImportMsg(`Error: ${res.error}`); return; }
    setImportMsg(res.creados > 0 ? `${res.creados} tipos importados.` : 'No se encontraron nombres nuevos.');
    router.refresh();
  }

  async function handleVincular() {
    setVinculando(true);
    setVincMsg('');
    const res = await vincularCultivosExistentes();
    setVinculando(false);
    if (res.error) { setVincMsg(`Error: ${res.error}`); return; }
    setVincMsg(`${res.vinculados} cultivo${res.vinculados !== 1 ? 's' : ''} vinculado${res.vinculados !== 1 ? 's' : ''} al tipo correspondiente.`);
  }

  return (
    <div className="space-y-5">
      {/* Herramientas de migración — ocultas para lector */}
      {!esLector && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Migración de datos existentes</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleImportar}
            disabled={importando}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-amber-300 text-amber-800 rounded-xl hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {importando ? 'Importando…' : 'Importar tipos desde cultivos existentes'}
          </button>
          <button
            onClick={handleVincular}
            disabled={vinculando}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-amber-300 text-amber-800 rounded-xl hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            {vinculando ? 'Vinculando…' : 'Vincular cultivos existentes a sus tipos'}
          </button>
        </div>
        {importMsg && <p className="text-xs text-amber-700">{importMsg}</p>}
        {vincMsg && <p className="text-xs text-amber-700">{vincMsg}</p>}
        <p className="text-xs text-amber-600 leading-relaxed">
          "Importar" lee todos los cultivos activos y crea tipos con sus nombres normalizados. "Vincular" asocia cultivos existentes al tipo que les corresponde por nombre.
        </p>
      </div>}

      {/* Formulario nuevo tipo — oculto para lector */}
      {!esLector && <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold text-zinc-800">Agregar tipo de cultivo</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCrear()}
            placeholder="Ej: Vicia, Soja 1ra, Cebadilla, Melilotus, Ray Grass…"
            className="flex-1 text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
          />
          <button
            onClick={handleCrear}
            disabled={creando || !nuevo.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] text-white text-sm font-medium rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {creando ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
        {errorNuevo && <p className="text-xs text-red-600">{errorNuevo}</p>}
      </div>}

      {/* Lista */}
      {tipos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
          <p className="text-sm text-zinc-400">No hay tipos de cultivo definidos todavía.</p>
          <p className="text-xs text-zinc-300 mt-1">Usá "Importar" para traer los que ya existen, o agregá uno nuevo arriba.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm divide-y divide-zinc-100">
          {tipos.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              {editandoId === t.id ? (
                <>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGuardarEdicion(); if (e.key === 'Escape') setEditandoId(null); }}
                    className="flex-1 text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
                    autoFocus
                  />
                  <button
                    onClick={handleGuardarEdicion}
                    disabled={guardando}
                    className="p-1.5 rounded-lg text-[#006836] hover:bg-[#006836]/10 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-medium text-zinc-800">{t.nombre}</p>
                  {!esLector && (
                    <>
                      <button
                        onClick={() => { setEditandoId(t.id); setEditNombre(t.nombre); setErrorNuevo(''); }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(t.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-xs p-6 space-y-4">
            <p className="font-semibold text-zinc-900">¿Eliminar tipo?</p>
            <p className="text-sm text-zinc-500">Los cultivos vinculados a este tipo perderán la referencia, pero no se eliminarán.</p>
            <div className="flex gap-2">
              <button
                onClick={handleEliminar}
                disabled={borrando}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {borrando ? 'Eliminando…' : 'Eliminar'}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
