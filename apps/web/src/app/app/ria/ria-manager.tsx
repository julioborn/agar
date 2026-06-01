'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Plus, Filter, X, ChevronDown, ChevronUp,
  FileText, CheckCircle, AlertCircle, Ban,
  Package, Wrench, Wheat,
} from 'lucide-react';
import { anularRia } from './actions';
import { useRouter } from 'next/navigation';

const ESTADO_STYLE: Record<string, string> = {
  borrador:   'bg-amber-100 text-amber-700',
  confirmado: 'bg-[#006836]/10 text-[#006836]',
  anulado:    'bg-red-100 text-red-600',
};
const ESTADO_LABEL: Record<string, string> = {
  borrador:   'Borrador',
  confirmado: 'Confirmado',
  anulado:    'Anulado',
};

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

interface RiaRow {
  id: string;
  numero_ria: string;
  fecha: string;
  estado: string;
  superficie_afectada: number | null;
  cultivo_descripcion: string | null;
  total_insumos: number;
  total_labores: number;
  total_ria: number;
  costo_por_ha: number | null;
  motivo_anulacion: string | null;
  lote: { id: string; nombre: string; campo: { nombre: string } | null } | null;
  campania: { id: string; nombre: string } | null;
}

interface InsumoRow {
  id: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  observaciones: string | null;
  producto: { nombre: string; unidad_base: string } | null;
  deposito: { nombre: string } | null;
}
interface LaborRow {
  id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  tarifa: number;
  subtotal: number;
  tipo_labor_nombre: string | null;
  prestador_nombre: string | null;
}
interface ProduccionRow {
  id: string;
  cantidad: number;
  humedad_porcentaje: number | null;
  precio_referencia: number | null;
  subtotal_valor: number | null;
  producto: { nombre: string; unidad_base: string } | null;
  deposito_ingreso: { nombre: string } | null;
}

interface Props {
  rias: RiaRow[];
  campanias: { id: string; nombre: string }[];
  lotes: { id: string; nombre: string; campo: { nombre: string } | null }[];
  empresaNombre: string;
}

export default function RiaManager({ rias, campanias, lotes, empresaNombre }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState('');
  const [campaniaId, setCampaniaId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, { insumos: InsumoRow[]; labores: LaborRow[]; produccion: ProduccionRow[] }>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulError, setAnulError] = useState('');

  const filtradas = useMemo(() => rias.filter((r) => {
    if (estado && r.estado !== estado) return false;
    if (campaniaId && r.campania?.id !== campaniaId) return false;
    return true;
  }), [rias, estado, campaniaId]);

  const totales = filtradas.reduce(
    (acc, r) => ({ ins: acc.ins + r.total_insumos, lab: acc.lab + r.total_labores, tot: acc.tot + r.total_ria }),
    { ins: 0, lab: 0, tot: 0 },
  );

  async function handleToggle(ria: RiaRow) {
    if (expandedId === ria.id) { setExpandedId(null); return; }
    setExpandedId(ria.id);
    if (detailCache[ria.id]) return;
    setLoadingId(ria.id);

    const sb = createClient();
    const [{ data: ins }, { data: lab }, { data: prod }] = await Promise.all([
      sb.from('remitos_insumos').select(`
        id, cantidad, costo_unitario, subtotal, observaciones,
        producto:productos(nombre, unidad_base),
        deposito:depositos(nombre)
      `).eq('remito_id', ria.id),
      sb.from('remitos_labores').select(`
        id, descripcion, unidad_medida, cantidad, tarifa, subtotal,
        tipo_labor_nombre, prestador_nombre
      `).eq('remito_id', ria.id),
      sb.from('remitos_produccion').select(`
        id, cantidad, humedad_porcentaje, precio_referencia, subtotal_valor,
        producto:productos(nombre, unidad_base),
        deposito_ingreso:depositos!deposito_ingreso_id(nombre)
      `).eq('remito_id', ria.id),
    ]);

    setDetailCache((prev) => ({
      ...prev,
      [ria.id]: {
        insumos: (ins as any) ?? [],
        labores: (lab as any) ?? [],
        produccion: (prod as any) ?? [],
      },
    }));
    setLoadingId(null);
  }

  async function handleAnular(riaId: string) {
    if (!motivoAnulacion.trim()) { setAnulError('El motivo es obligatorio.'); return; }
    setAnulError('');
    const result = await anularRia(riaId, motivoAnulacion.trim());
    if (result.error) { setAnulError(result.error); return; }
    setAnulando(null);
    setMotivoAnulacion('');
    router.refresh();
  }

  const filtrosActivos = [estado, campaniaId].filter(Boolean).length;

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Remitos', val: filtradas.length.toString(), color: 'bg-[#006836]' },
          { label: 'Confirmados', val: filtradas.filter((r) => r.estado === 'confirmado').length.toString(), color: 'bg-blue-400' },
          { label: 'Total insumos', val: `$${num.format(totales.ins)}`, color: 'bg-amber-400' },
          { label: 'Total labores', val: `$${num.format(totales.lab)}`, color: 'bg-violet-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color)} />
            <div>
              <p className="text-lg font-bold text-zinc-900 leading-none">{val}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors',
              showFilters || filtrosActivos > 0
                ? 'border-[#006836]/40 text-[#006836] bg-[#006836]/5'
                : 'border-zinc-200 text-zinc-500 bg-white hover:bg-zinc-50',
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {filtrosActivos > 0 && (
              <span className="w-4 h-4 bg-[#006836] text-white rounded-full text-xs leading-none flex items-center justify-center">
                {filtrosActivos}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            {filtrosActivos > 0 && (
              <button
                onClick={() => { setEstado(''); setCampaniaId(''); }}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500"
              >
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
            <Link
              href="/app/ria/nuevo"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] hover:bg-[#005228] text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo RIA
            </Link>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-100 mt-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
              >
                <option value="">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="confirmado">Confirmado</option>
                <option value="anulado">Anulado</option>
              </select>
            </div>
            {campanias.length > 0 && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Campaña</label>
                <select
                  value={campaniaId}
                  onChange={(e) => setCampaniaId(e.target.value)}
                  className="w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40"
                >
                  <option value="">Todas</option>
                  {campanias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
        {filtradas.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <FileText className="w-10 h-10 text-zinc-200 mx-auto" />
            <p className="text-zinc-400 text-sm">
              {rias.length === 0 ? 'No hay remitos registrados todavía.' : 'Sin resultados con los filtros aplicados.'}
            </p>
            {rias.length === 0 && (
              <Link
                href="/app/ria/nuevo"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006836] text-white text-sm rounded-xl"
              >
                <Plus className="w-4 h-4" /> Crear primer RIA
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtradas.map((ria) => {
              const isOpen = expandedId === ria.id;
              const isLoading = loadingId === ria.id;
              const detail = detailCache[ria.id];
              const isAnulado = ria.estado === 'anulado';

              return (
                <div key={ria.id}>
                  {/* Fila principal */}
                  <button
                    type="button"
                    onClick={() => handleToggle(ria)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors',
                      isAnulado && 'opacity-60',
                      isOpen ? 'bg-[#006836]/5' : 'hover:bg-zinc-50',
                    )}
                  >
                    {/* Número RIA */}
                    <div className="w-36 shrink-0">
                      <p className={cn('text-sm font-mono font-semibold text-zinc-800', isAnulado && 'line-through')}>
                        {ria.numero_ria}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">{fmt(ria.fecha)}</p>
                    </div>

                    {/* Lote */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-700 truncate font-medium">
                        {ria.lote?.campo?.nombre && (
                          <span className="text-zinc-400 font-normal">{ria.lote.campo.nombre} › </span>
                        )}
                        {ria.lote?.nombre ?? '—'}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {ria.cultivo_descripcion ?? ria.campania?.nombre ?? ''}
                        {ria.superficie_afectada ? ` · ${ria.superficie_afectada} ha` : ''}
                      </p>
                    </div>

                    {/* Total */}
                    <div className="w-28 shrink-0 text-right">
                      <p className="text-sm font-bold text-zinc-900">${num.format(ria.total_ria)}</p>
                      {ria.costo_por_ha != null && (
                        <p className="text-xs text-zinc-400">${num.format(ria.costo_por_ha)}/ha</p>
                      )}
                    </div>

                    {/* Estado */}
                    <div className="w-24 shrink-0">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium', ESTADO_STYLE[ria.estado])}>
                        {ESTADO_LABEL[ria.estado]}
                      </span>
                    </div>

                    <ChevronDown className={cn('w-4 h-4 text-zinc-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                  </button>

                  {/* Panel expandido */}
                  {isOpen && (
                    <div className="border-t border-[#006836]/10 bg-zinc-50/50 px-4 py-4 space-y-4">
                      {isLoading ? (
                        <p className="text-xs text-zinc-400 py-4 text-center">Cargando detalle…</p>
                      ) : (
                        <>
                          {/* Acciones */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {ria.estado === 'borrador' && (
                              <Link
                                href={`/app/ria/${ria.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors"
                              >
                                Editar borrador
                              </Link>
                            )}
                            {ria.estado === 'confirmado' && (
                              <>
                                <Link
                                  href={`/app/ria/${ria.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors"
                                >
                                  Ver detalle
                                </Link>
                                <button
                                  onClick={() => { setAnulando(ria.id); setMotivoAnulacion(''); setAnulError(''); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Anular
                                </button>
                              </>
                            )}
                          </div>

                          {/* Modal de anulación */}
                          {anulando === ria.id && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                              <p className="text-sm font-semibold text-red-700">Anular {ria.numero_ria}</p>
                              <p className="text-xs text-red-600">Esta acción revertirá todos los movimientos de stock. Es irreversible.</p>
                              <div>
                                <label className="block text-xs font-medium text-red-700 mb-1">Motivo de anulación *</label>
                                <textarea
                                  value={motivoAnulacion}
                                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                                  rows={2}
                                  className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white resize-none"
                                />
                              </div>
                              {anulError && <p className="text-xs text-red-600">{anulError}</p>}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAnular(ria.id)}
                                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Confirmar anulación
                                </button>
                                <button
                                  onClick={() => setAnulando(null)}
                                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          {ria.estado === 'anulado' && ria.motivo_anulacion && (
                            <div className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
                              <p className="text-xs text-red-600">
                                <strong>Motivo de anulación:</strong> {ria.motivo_anulacion}
                              </p>
                            </div>
                          )}

                          {/* Insumos */}
                          {detail?.insumos && detail.insumos.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5" /> Insumos
                              </p>
                              <div className="rounded-xl border border-zinc-100 overflow-hidden bg-white">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs min-w-[480px]">
                                    <thead className="bg-zinc-50 border-b border-zinc-100">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-medium text-zinc-500">Producto</th>
                                        <th className="text-left px-3 py-2 font-medium text-zinc-500">Depósito</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">Cant.</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">$/u</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                      {detail.insumos.map((i) => (
                                        <tr key={i.id} className="hover:bg-zinc-50">
                                          <td className="px-3 py-2 font-medium text-zinc-800">{i.producto?.nombre}</td>
                                          <td className="px-3 py-2 text-zinc-500">{i.deposito?.nombre ?? '—'}</td>
                                          <td className="px-3 py-2 text-right text-zinc-700">{num.format(i.cantidad)} {i.producto?.unidad_base}</td>
                                          <td className="px-3 py-2 text-right text-zinc-600">${num.format(i.costo_unitario)}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">${num.format(i.subtotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Labores */}
                          {detail?.labores && detail.labores.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5" /> Labores / Servicios
                              </p>
                              <div className="rounded-xl border border-zinc-100 overflow-hidden bg-white">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs min-w-[480px]">
                                    <thead className="bg-zinc-50 border-b border-zinc-100">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-medium text-zinc-500">Descripción</th>
                                        <th className="text-left px-3 py-2 font-medium text-zinc-500">Prestador</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">Cant.</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">Tarifa</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                      {detail.labores.map((l) => (
                                        <tr key={l.id} className="hover:bg-zinc-50">
                                          <td className="px-3 py-2 text-zinc-800">
                                            {l.tipo_labor_nombre && <span className="text-zinc-400">{l.tipo_labor_nombre} · </span>}
                                            {l.descripcion}
                                          </td>
                                          <td className="px-3 py-2 text-zinc-500">{l.prestador_nombre ?? 'Campo propio'}</td>
                                          <td className="px-3 py-2 text-right text-zinc-700">{num.format(l.cantidad)} {l.unidad_medida}</td>
                                          <td className="px-3 py-2 text-right text-zinc-600">${num.format(l.tarifa)}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">${num.format(l.subtotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Produccion */}
                          {detail?.produccion && detail.produccion.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <Wheat className="w-3.5 h-3.5" /> Producción
                              </p>
                              <div className="rounded-xl border border-zinc-100 overflow-hidden bg-white">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs min-w-[480px]">
                                    <thead className="bg-zinc-50 border-b border-zinc-100">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-medium text-zinc-500">Producto cosechado</th>
                                        <th className="text-left px-3 py-2 font-medium text-zinc-500">Destino</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">Cantidad</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">Hum.%</th>
                                        <th className="text-right px-3 py-2 font-medium text-zinc-500">P.Ref</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                      {detail.produccion.map((p) => (
                                        <tr key={p.id} className="hover:bg-zinc-50">
                                          <td className="px-3 py-2 font-medium text-zinc-800">{p.producto?.nombre}</td>
                                          <td className="px-3 py-2 text-zinc-500">{p.deposito_ingreso?.nombre ?? '—'}</td>
                                          <td className="px-3 py-2 text-right text-zinc-700">{num.format(p.cantidad)} {p.producto?.unidad_base}</td>
                                          <td className="px-3 py-2 text-right text-zinc-500">{p.humedad_porcentaje != null ? `${p.humedad_porcentaje}%` : '—'}</td>
                                          <td className="px-3 py-2 text-right text-zinc-600">{p.precio_referencia != null ? `$${num.format(p.precio_referencia)}` : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Totales */}
                          <div className="flex flex-wrap gap-4 text-xs border-t border-zinc-100 pt-3">
                            <span className="text-zinc-500">Insumos: <strong className="text-zinc-800">${num.format(ria.total_insumos)}</strong></span>
                            <span className="text-zinc-500">Labores: <strong className="text-zinc-800">${num.format(ria.total_labores)}</strong></span>
                            <span className="text-zinc-600 font-medium">Costo total: <strong className="text-zinc-900 text-sm">${num.format(ria.total_ria)}</strong></span>
                            {ria.costo_por_ha != null && (
                              <span className="text-zinc-500">Costo/ha: <strong className="text-zinc-800">${num.format(ria.costo_por_ha)}</strong></span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
