'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle,
  Package, Wrench, Wheat, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { saveRiaBorrador, confirmarRia } from './actions';

// ── Tipos locales ──────────────────────────────────────────────────────────────

export interface LoteOpcion {
  id: string;
  nombre: string;
  hectareas: number;
  campo: { nombre: string } | null;
  cultivo_activo?: string;
}
export interface DepositoOpcion {
  id: string;
  nombre: string;
  tipo: string;
}
export interface ProductoOpcion {
  id: string;
  nombre: string;
  categoria: string;
  unidad_base: string;
}
export interface CampaniaOpcion {
  id: string;
  nombre: string;
}
export interface ProveedorOpcion {
  id: string;
  nombre: string;
}
export interface TipoLaborOpcion {
  id: string;
  nombre: string;
}
export interface CultivoOpcion {
  id: string;
  cultivo: string;
  lote_id: string;
  estado: string;
}

interface InsumoLine {
  _id: string;
  depositoId: string;
  productoId: string;
  cantidad: string;
  dosisPorHa: string;
  costoUnitario: string;
  subtotal: number;
  obs: string;
  productoNombre: string;
  unidadBase: string;
  stockDisponible: number | null;
}

interface LaborLine {
  _id: string;
  tipoLaborId: string;
  tipoLaborNombre: string;
  descripcion: string;
  prestadorId: string;
  prestadorNombre: string;
  unidadMedida: string;
  cantidad: string;
  tarifa: string;
  subtotal: number;
  fechaEjecucion: string;
  obs: string;
}

interface ProduccionLine {
  _id: string;
  productoId: string;
  productoNombre: string;
  unidadBase: string;
  depositoIngresoId: string;
  cantidad: string;
  humedadPorcentaje: string;
  calidadCategoria: string;
  precioReferencia: string;
  obs: string;
}

export interface RiaExistente {
  id: string;
  numero_ria: string;
  fecha: string;
  estado: string;
  lote_id: string;
  campania_id?: string;
  cultivo_id?: string;
  superficie_afectada?: number;
  cultivo_descripcion?: string;
  observaciones?: string;
  total_insumos: number;
  total_labores: number;
  total_ria: number;
  costo_por_ha?: number;
  insumos: {
    id: string; depositoId: string; productoId: string;
    productoNombre: string; unidadBase: string;
    cantidad: number; dosisPorHa?: number;
    costoUnitario: number; subtotal: number; obs?: string;
  }[];
  labores: {
    id: string; tipoLaborId?: string; tipoLaborNombre?: string;
    descripcion: string; prestadorId?: string; prestadorNombre?: string;
    unidadMedida: string; cantidad: number; tarifa: number; subtotal: number;
    fechaEjecucion?: string; obs?: string;
  }[];
  produccion: {
    id: string; productoId: string; productoNombre: string; unidadBase: string;
    depositoIngresoId: string; cantidad: number;
    humedadPorcentaje?: number; calidadCategoria?: string;
    precioReferencia?: number; obs?: string;
  }[];
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  lotes: LoteOpcion[];
  depositos: DepositoOpcion[];
  productos: ProductoOpcion[];
  campanias: CampaniaOpcion[];
  proveedores: ProveedorOpcion[];
  tiposLabor: TipoLaborOpcion[];
  empresaId: string;
  empresaNombre: string;
  usuarioId: string;
  riaExistente?: RiaExistente;
  basePath?: string;
  cultivosActivos?: CultivoOpcion[];
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const UNIDADES_LABOR = [
  { value: 'has', label: 'Hectáreas (ha)' },
  { value: 'hs',  label: 'Horas (hs)' },
  { value: 'tn',  label: 'Toneladas (tn)' },
  { value: 'viaje', label: 'Viaje / unidad' },
  { value: 'global', label: 'Global ($)' },
  { value: 'km', label: 'Kilómetros (km)' },
];

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
let _lineCounter = 0;
const nextId = () => `l-${++_lineCounter}`;
const today = () => new Date().toISOString().split('T')[0];
const calc = (cant: string, costo: string) =>
  Math.round(parseFloat(cant || '0') * parseFloat(costo || '0') * 100) / 100;

// ── Componente principal ───────────────────────────────────────────────────────

export default function RiaForm({
  mode, lotes, depositos, productos, campanias, proveedores,
  tiposLabor, empresaId, empresaNombre, usuarioId, riaExistente,
  basePath = '/app/ria', cultivosActivos = [],
}: Props) {
  const router = useRouter();
  const esReadOnly = mode === 'ver';

  // Header state
  const [fecha, setFecha] = useState(riaExistente?.fecha ?? today());
  const [loteId, setLoteId] = useState(riaExistente?.lote_id ?? '');
  const [campaniaId, setCampaniaId] = useState(riaExistente?.campania_id ?? '');
  const [superficieAfectada, setSuperficieAfectada] = useState(
    riaExistente?.superficie_afectada?.toString() ?? '',
  );
  const [cultivoId, setCultivoIdState] = useState(riaExistente?.cultivo_id ?? '');
  const [cultivoDesc, setCultivoDesc] = useState(riaExistente?.cultivo_descripcion ?? '');
  const [observaciones, setObservaciones] = useState(riaExistente?.observaciones ?? '');

  // Lines state
  const [insumos, setInsumos] = useState<InsumoLine[]>(() =>
    (riaExistente?.insumos ?? []).map((i) => ({
      _id: nextId(),
      depositoId: i.depositoId,
      productoId: i.productoId,
      cantidad: i.cantidad.toString(),
      dosisPorHa: i.dosisPorHa?.toString() ?? '',
      costoUnitario: i.costoUnitario.toString(),
      subtotal: i.subtotal,
      obs: i.obs ?? '',
      productoNombre: i.productoNombre,
      unidadBase: i.unidadBase,
      stockDisponible: null,
    })),
  );

  const [labores, setLabores] = useState<LaborLine[]>(() =>
    (riaExistente?.labores ?? []).map((l) => ({
      _id: nextId(),
      tipoLaborId: l.tipoLaborId ?? '',
      tipoLaborNombre: l.tipoLaborNombre ?? '',
      descripcion: l.descripcion,
      prestadorId: l.prestadorId ?? '',
      prestadorNombre: l.prestadorNombre ?? '',
      unidadMedida: l.unidadMedida,
      cantidad: l.cantidad.toString(),
      tarifa: l.tarifa.toString(),
      subtotal: l.subtotal,
      fechaEjecucion: l.fechaEjecucion ?? '',
      obs: l.obs ?? '',
    })),
  );

  const [produccion, setProduccion] = useState<ProduccionLine[]>(() =>
    (riaExistente?.produccion ?? []).map((p) => ({
      _id: nextId(),
      productoId: p.productoId,
      productoNombre: p.productoNombre,
      unidadBase: p.unidadBase,
      depositoIngresoId: p.depositoIngresoId,
      cantidad: p.cantidad.toString(),
      humedadPorcentaje: p.humedadPorcentaje?.toString() ?? '',
      calidadCategoria: p.calidadCategoria ?? '',
      precioReferencia: p.precioReferencia?.toString() ?? '',
      obs: p.obs ?? '',
    })),
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [secOpen, setSecOpen] = useState({ insumos: true, labores: true, produccion: true });

  // Computed totals
  const totalInsumos = insumos.reduce((s, i) => s + i.subtotal, 0);
  const totalLabores = labores.reduce((s, l) => s + l.subtotal, 0);
  const totalRia = totalInsumos + totalLabores;
  const sup = parseFloat(superficieAfectada || '0');
  const costoPerHa = sup > 0 ? totalRia / sup : null;

  // ── Auto-fill lote ────────────────────────────────────────────────────────────
  // Cultivos filtrados por lote seleccionado
  const cultivosDelLote = cultivosActivos.filter((c) => c.lote_id === loteId);

  useEffect(() => {
    if (!loteId) return;
    const lote = lotes.find((l) => l.id === loteId);
    if (!lote) return;
    if (!superficieAfectada) setSuperficieAfectada(lote.hectareas?.toString() ?? '');
    // Auto-seleccionar el cultivo si hay uno solo activo en el lote
    const cultivosLote = cultivosActivos.filter((c) => c.lote_id === loteId);
    if (cultivosLote.length === 1 && !cultivoId) {
      setCultivoIdState(cultivosLote[0].id);
      setCultivoDesc(cultivosLote[0].cultivo);
    }
  }, [loteId]);

  // ── Stock lookup ──────────────────────────────────────────────────────────────
  const fetchStock = useCallback(async (depositoId: string, productoId: string, lineId: string) => {
    if (!depositoId || !productoId) return;
    const sb = createClient();
    const { data } = await sb
      .from('stock')
      .select('cantidad_actual')
      .eq('deposito_id', depositoId)
      .eq('producto_id', productoId)
      .maybeSingle();
    setInsumos((prev) =>
      prev.map((i) => i._id === lineId ? { ...i, stockDisponible: data?.cantidad_actual ?? 0 } : i),
    );
  }, []);

  // ── Last cost lookup ──────────────────────────────────────────────────────────
  const fetchLastCost = useCallback(async (productoId: string, lineId: string) => {
    if (!productoId) return;
    const sb = createClient();
    const { data } = await sb
      .from('compras_items')
      .select('precio_unitario_ars')
      .eq('producto_id', productoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.precio_unitario_ars) {
      setInsumos((prev) =>
        prev.map((i) => {
          if (i._id !== lineId) return i;
          const cost = data.precio_unitario_ars.toString();
          return { ...i, costoUnitario: cost, subtotal: calc(i.cantidad, cost) };
        }),
      );
    }
  }, []);

  // ── Insumo handlers ───────────────────────────────────────────────────────────
  function addInsumo() {
    setInsumos((p) => [...p, {
      _id: nextId(), depositoId: '', productoId: '', cantidad: '',
      dosisPorHa: '', costoUnitario: '', subtotal: 0, obs: '',
      productoNombre: '', unidadBase: '', stockDisponible: null,
    }]);
  }

  function removeInsumo(id: string) {
    setInsumos((p) => p.filter((i) => i._id !== id));
  }

  function updateInsumo<K extends keyof InsumoLine>(id: string, key: K, val: InsumoLine[K]) {
    setInsumos((prev) => prev.map((i) => {
      if (i._id !== id) return i;
      const updated = { ...i, [key]: val };
      if (key === 'cantidad' || key === 'costoUnitario') {
        updated.subtotal = calc(
          key === 'cantidad' ? val as string : i.cantidad,
          key === 'costoUnitario' ? val as string : i.costoUnitario,
        );
      }
      if (key === 'dosisPorHa' && sup > 0) {
        const dosis = parseFloat(val as string || '0');
        if (dosis > 0) {
          const newCant = (dosis * sup).toString();
          updated.cantidad = newCant;
          updated.subtotal = calc(newCant, i.costoUnitario);
        }
      }
      return updated;
    }));
  }

  function handleInsumoProducto(id: string, productoId: string) {
    const prod = productos.find((p) => p.id === productoId);
    setInsumos((prev) => prev.map((i) => {
      if (i._id !== id) return i;
      return {
        ...i,
        productoId,
        productoNombre: prod?.nombre ?? '',
        unidadBase: prod?.unidad_base ?? '',
        stockDisponible: null,
      };
    }));
    if (productoId) {
      fetchLastCost(productoId, id);
      const line = insumos.find((i) => i._id === id);
      if (line?.depositoId) fetchStock(line.depositoId, productoId, id);
    }
  }

  function handleInsumoDeposito(id: string, depositoId: string) {
    updateInsumo(id, 'depositoId', depositoId);
    const line = insumos.find((i) => i._id === id);
    if (line?.productoId && depositoId) fetchStock(depositoId, line.productoId, id);
  }

  // ── Labor handlers ────────────────────────────────────────────────────────────
  function addLabor() {
    setLabores((p) => [...p, {
      _id: nextId(), tipoLaborId: '', tipoLaborNombre: '', descripcion: '',
      prestadorId: '', prestadorNombre: '', unidadMedida: 'has',
      cantidad: '', tarifa: '', subtotal: 0, fechaEjecucion: '', obs: '',
    }]);
  }

  function removeLabor(id: string) {
    setLabores((p) => p.filter((l) => l._id !== id));
  }

  function updateLabor<K extends keyof LaborLine>(id: string, key: K, val: LaborLine[K]) {
    setLabores((prev) => prev.map((l) => {
      if (l._id !== id) return l;
      const updated = { ...l, [key]: val };
      if (key === 'cantidad' || key === 'tarifa') {
        updated.subtotal = calc(
          key === 'cantidad' ? val as string : l.cantidad,
          key === 'tarifa' ? val as string : l.tarifa,
        );
      }
      return updated;
    }));
  }

  function handleLaborTipo(id: string, tipoId: string) {
    const tipo = tiposLabor.find((t) => t.id === tipoId);
    setLabores((prev) => prev.map((l) =>
      l._id === id ? { ...l, tipoLaborId: tipoId, tipoLaborNombre: tipo?.nombre ?? '' } : l,
    ));
  }

  function handleLaborPrestador(id: string, proveedorId: string) {
    const prov = proveedores.find((p) => p.id === proveedorId);
    setLabores((prev) => prev.map((l) =>
      l._id === id ? { ...l, prestadorId: proveedorId, prestadorNombre: prov?.nombre ?? '' } : l,
    ));
  }

  // ── Produccion handlers ───────────────────────────────────────────────────────
  function addProduccion() {
    setProduccion((p) => [...p, {
      _id: nextId(), productoId: '', productoNombre: '', unidadBase: '',
      depositoIngresoId: '', cantidad: '', humedadPorcentaje: '',
      calidadCategoria: '', precioReferencia: '', obs: '',
    }]);
  }

  function removeProduccion(id: string) {
    setProduccion((p) => p.filter((p) => p._id !== id));
  }

  function updateProduccion<K extends keyof ProduccionLine>(id: string, key: K, val: ProduccionLine[K]) {
    setProduccion((prev) => prev.map((p) => p._id === id ? { ...p, [key]: val } : p));
  }

  function handleProduccionProducto(id: string, productoId: string) {
    const prod = productos.find((p) => p.id === productoId);
    setProduccion((prev) => prev.map((p) =>
      p._id === id
        ? { ...p, productoId, productoNombre: prod?.nombre ?? '', unidadBase: prod?.unidad_base ?? '' }
        : p,
    ));
  }

  // ── Validaciones ──────────────────────────────────────────────────────────────
  function validate() {
    if (!loteId) return 'Debe seleccionar un lote.';
    if (!fecha) return 'La fecha es obligatoria.';
    for (const i of insumos) {
      if (!i.depositoId) return 'Cada insumo debe tener un depósito seleccionado.';
      if (!i.productoId) return 'Cada insumo debe tener un producto seleccionado.';
      if (!i.cantidad || parseFloat(i.cantidad) <= 0) return 'La cantidad de cada insumo debe ser mayor a cero.';
    }
    for (const l of labores) {
      if (!l.descripcion.trim()) return 'Cada labor debe tener una descripción.';
      if (!l.unidadMedida) return 'Cada labor debe tener una unidad de medida.';
    }
    for (const p of produccion) {
      if (!p.productoId) return 'Cada línea de producción debe tener un producto.';
      if (!p.depositoIngresoId) return 'Cada producción debe tener un depósito de ingreso.';
      if (!p.cantidad || parseFloat(p.cantidad) <= 0) return 'La cantidad producida debe ser mayor a cero.';
    }
    return null;
  }

  function buildPayload() {
    return {
      riaId: riaExistente?.id,
      fecha,
      loteId,
      campaniaId: campaniaId || undefined,
      cultivoId: cultivoId || undefined,
      superficieAfectada: sup > 0 ? sup : undefined,
      cultivoDescripcion: cultivoDesc.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      insumos: insumos.map((i) => ({
        depositoId: i.depositoId,
        productoId: i.productoId,
        cantidad: parseFloat(i.cantidad),
        dosisPorHa: i.dosisPorHa ? parseFloat(i.dosisPorHa) : undefined,
        costoUnitario: parseFloat(i.costoUnitario || '0'),
        subtotal: i.subtotal,
        observaciones: i.obs || undefined,
      })),
      labores: labores.map((l) => ({
        tipoLaborId: l.tipoLaborId || undefined,
        tipoLaborNombre: l.tipoLaborNombre || undefined,
        descripcion: l.descripcion,
        prestadorId: l.prestadorId || undefined,
        prestadorNombre: l.prestadorNombre || undefined,
        unidadMedida: l.unidadMedida,
        cantidad: parseFloat(l.cantidad || '0'),
        tarifa: parseFloat(l.tarifa || '0'),
        subtotal: l.subtotal,
        fechaEjecucion: l.fechaEjecucion || undefined,
        observaciones: l.obs || undefined,
      })),
      produccion: produccion.map((p) => ({
        productoId: p.productoId,
        depositoIngresoId: p.depositoIngresoId,
        cantidad: parseFloat(p.cantidad),
        humedadPorcentaje: p.humedadPorcentaje ? parseFloat(p.humedadPorcentaje) : undefined,
        calidadCategoria: p.calidadCategoria || undefined,
        precioReferencia: p.precioReferencia ? parseFloat(p.precioReferencia) : undefined,
        subtotalValor: p.precioReferencia
          ? parseFloat(p.cantidad || '0') * parseFloat(p.precioReferencia || '0')
          : undefined,
        observaciones: p.obs || undefined,
      })),
    };
  }

  async function handleSaveDraft() {
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    setErrorMsg('');
    setSaving(true);
    const result = await saveRiaBorrador(buildPayload());
    setSaving(false);
    if (result.error) { setErrorMsg(result.error); return; }
    if (result.riaId && !riaExistente) {
      router.push(`${basePath}/${result.riaId}`);
    } else {
      router.refresh();
    }
  }

  async function handleConfirm() {
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    if (insumos.length === 0 && labores.length === 0 && produccion.length === 0) {
      setErrorMsg('El RIA no tiene contenido. Agregue al menos una línea.');
      return;
    }
    setErrorMsg('');
    setConfirming(true);

    let riaId = riaExistente?.id;
    if (!riaId) {
      const saveResult = await saveRiaBorrador(buildPayload());
      if (saveResult.error) { setErrorMsg(saveResult.error); setConfirming(false); return; }
      riaId = saveResult.riaId!;
    } else {
      const saveResult = await saveRiaBorrador(buildPayload());
      if (saveResult.error) { setErrorMsg(saveResult.error); setConfirming(false); return; }
    }

    const confirmResult = await confirmarRia(riaId!);
    setConfirming(false);
    if (confirmResult.error) { setErrorMsg(confirmResult.error); return; }
    router.push(`${basePath}/${riaId}`);
    router.refresh();
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const inputCls = (error = false) =>
    cn(
      'w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1',
      error
        ? 'border-red-300 focus:ring-red-400'
        : 'border-zinc-200 focus:ring-[#006836]/40',
      esReadOnly && 'bg-zinc-50 cursor-default',
    );

  const sectionHeader = (
    key: 'insumos' | 'labores' | 'produccion',
    icon: React.ReactNode,
    title: string,
    count: number,
    total?: number,
    onAdd?: () => void,
  ) => (
    <div className="flex items-center justify-between mb-3">
      <button
        type="button"
        onClick={() => setSecOpen((p) => ({ ...p, [key]: !p[key] }))}
        className="flex items-center gap-2 text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <span className="text-sm font-semibold text-zinc-800">{title}</span>
          {count > 0 && <span className="ml-2 text-xs text-zinc-400">{count} {count === 1 ? 'línea' : 'líneas'}</span>}
          {total != null && total > 0 && (
            <span className="ml-2 text-xs font-semibold text-[#006836]">${num.format(total)}</span>
          )}
        </div>
        {secOpen[key]
          ? <ChevronUp className="w-4 h-4 text-zinc-400 ml-1" />
          : <ChevronDown className="w-4 h-4 text-zinc-400 ml-1" />}
      </button>
      {!esReadOnly && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#006836] border border-[#006836]/30 rounded-xl hover:bg-[#006836]/5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  const estadoBadge = riaExistente ? {
    borrador:   'bg-amber-100 text-amber-700',
    confirmado: 'bg-[#006836]/10 text-[#006836]',
    anulado:    'bg-red-100 text-red-600',
  }[riaExistente.estado] ?? '' : 'bg-amber-100 text-amber-700';

  const estadoLabel = riaExistente
    ? { borrador: 'BORRADOR', confirmado: 'CONFIRMADO', anulado: 'ANULADO' }[riaExistente.estado] ?? riaExistente.estado.toUpperCase()
    : 'BORRADOR';

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={basePath} className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900">
                {riaExistente ? riaExistente.numero_ria : 'Nuevo RIA'}
              </h1>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', estadoBadge)}>
                {estadoLabel}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">{empresaNombre}</p>
          </div>
        </div>
      </div>

      {/* Cabecera del remito */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Datos del remito</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Fecha *</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={esReadOnly}
              className={inputCls()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Campaña</label>
            <select
              value={campaniaId}
              onChange={(e) => setCampaniaId(e.target.value)}
              disabled={esReadOnly}
              className={inputCls()}
            >
              <option value="">Sin campaña asignada</option>
              {campanias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Lote *</label>
          <select
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            disabled={esReadOnly}
            className={inputCls(!loteId && !esReadOnly)}
          >
            <option value="">Seleccioná un lote…</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.campo?.nombre ? `${l.campo.nombre} › ` : ''}{l.nombre} — {l.hectareas} ha
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Superficie afectada (ha)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={superficieAfectada}
              onChange={(e) => setSuperficieAfectada(e.target.value)}
              disabled={esReadOnly}
              placeholder="Ej: 150.5"
              className={inputCls()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Cultivo / Actividad</label>
            {cultivosDelLote.length > 0 ? (
              <select
                value={cultivoId}
                onChange={(e) => {
                  const sel = cultivosDelLote.find((c) => c.id === e.target.value);
                  setCultivoIdState(e.target.value);
                  setCultivoDesc(sel?.cultivo ?? '');
                }}
                disabled={esReadOnly}
                className={inputCls()}
              >
                <option value="">Seleccioná un cultivo…</option>
                {cultivosDelLote.map((c) => (
                  <option key={c.id} value={c.id}>{c.cultivo}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={cultivoDesc}
                onChange={(e) => setCultivoDesc(e.target.value)}
                disabled={esReadOnly}
                placeholder={loteId ? 'Sin cultivos activos — escribí la actividad' : 'Seleccioná un lote primero'}
                className={inputCls()}
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Observaciones generales</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            disabled={esReadOnly}
            rows={2}
            placeholder="Opcional…"
            className={cn(inputCls(), 'resize-none')}
          />
        </div>
      </div>

      {/* ── INSUMOS ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        {sectionHeader('insumos', <Package className="w-4 h-4 text-zinc-500" />, 'Insumos utilizados', insumos.length, totalInsumos, addInsumo)}
        {secOpen.insumos && (
          insumos.length === 0 ? (
            <div className="text-center py-6 text-sm text-zinc-400">
              {esReadOnly ? 'Sin insumos registrados.' : 'Sin insumos. Usá "Agregar" para añadir insumos al lote.'}
            </div>
          ) : (
            <div className="space-y-3">
              {insumos.map((ins) => (
                <div key={ins._id} className="border border-zinc-100 rounded-xl p-3 space-y-3 bg-zinc-50/40">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Depósito origen *</label>
                      <select
                        value={ins.depositoId}
                        onChange={(e) => handleInsumoDeposito(ins._id, e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls(!ins.depositoId && !esReadOnly)}
                      >
                        <option value="">Seleccioná…</option>
                        {depositos.map((d) => (
                          <option key={d.id} value={d.id}>{d.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Producto *</label>
                      <select
                        value={ins.productoId}
                        onChange={(e) => handleInsumoProducto(ins._id, e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls(!ins.productoId && !esReadOnly)}
                      >
                        <option value="">Seleccioná…</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                      {ins.stockDisponible != null && (
                        <p className={cn(
                          'text-xs mt-1',
                          ins.stockDisponible < parseFloat(ins.cantidad || '0')
                            ? 'text-red-500 font-medium'
                            : 'text-zinc-400',
                        )}>
                          Stock disponible: {num.format(ins.stockDisponible)} {ins.unidadBase}
                          {ins.stockDisponible < parseFloat(ins.cantidad || '0') && ' ⚠ Insuficiente'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">
                        Cantidad * {ins.unidadBase && <span className="text-zinc-400">({ins.unidadBase})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={ins.cantidad}
                        onChange={(e) => updateInsumo(ins._id, 'cantidad', e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls(!ins.cantidad && !esReadOnly)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Dosis/ha (opc.)</label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={ins.dosisPorHa}
                        onChange={(e) => updateInsumo(ins._id, 'dosisPorHa', e.target.value)}
                        disabled={esReadOnly}
                        placeholder="Calcula cantidad"
                        className={inputCls()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Costo unitario $</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={ins.costoUnitario}
                        onChange={(e) => updateInsumo(ins._id, 'costoUnitario', e.target.value)}
                        disabled={esReadOnly}
                        placeholder="$0.00"
                        className={inputCls()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Subtotal $</label>
                      <div className="text-sm font-semibold text-zinc-900 bg-zinc-100 rounded-lg px-2.5 py-1.5">
                        ${num.format(ins.subtotal)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <label className="block text-xs text-zinc-500 mb-1">Observaciones</label>
                      <input
                        type="text"
                        value={ins.obs}
                        onChange={(e) => updateInsumo(ins._id, 'obs', e.target.value)}
                        disabled={esReadOnly}
                        placeholder="Opcional…"
                        className={inputCls()}
                      />
                    </div>
                    {!esReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeInsumo(ins._id)}
                        className="mt-5 p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Eliminar línea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-1">
                <span className="text-sm font-semibold text-zinc-700">
                  Total insumos: <span className="text-[#006836]">${num.format(totalInsumos)}</span>
                </span>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── LABORES ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        {sectionHeader('labores', <Wrench className="w-4 h-4 text-zinc-500" />, 'Labores / Servicios', labores.length, totalLabores, addLabor)}
        {secOpen.labores && (
          labores.length === 0 ? (
            <div className="text-center py-6 text-sm text-zinc-400">
              {esReadOnly ? 'Sin labores registradas.' : 'Sin labores. Usá "Agregar" para registrar servicios o labores.'}
            </div>
          ) : (
            <div className="space-y-3">
              {labores.map((lab) => (
                <div key={lab._id} className="border border-zinc-100 rounded-xl p-3 space-y-3 bg-zinc-50/40">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Tipo de labor</label>
                      <select
                        value={lab.tipoLaborId}
                        onChange={(e) => handleLaborTipo(lab._id, e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls()}
                      >
                        <option value="">Sin tipo / libre</option>
                        {tiposLabor.map((t) => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">Descripción *</label>
                      <input
                        type="text"
                        value={lab.descripcion}
                        onChange={(e) => updateLabor(lab._id, 'descripcion', e.target.value)}
                        disabled={esReadOnly}
                        placeholder="Ej: Pulverización herbicida pre-emergente…"
                        className={inputCls(!lab.descripcion && !esReadOnly)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Prestador</label>
                      <select
                        value={lab.prestadorId}
                        onChange={(e) => handleLaborPrestador(lab._id, e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls()}
                      >
                        <option value="">Campo propio</option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Unidad *</label>
                      <select
                        value={lab.unidadMedida}
                        onChange={(e) => updateLabor(lab._id, 'unidadMedida', e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls()}
                      >
                        {UNIDADES_LABOR.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Cantidad</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={lab.cantidad}
                        onChange={(e) => updateLabor(lab._id, 'cantidad', e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Tarifa $/{lab.unidadMedida}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={lab.tarifa}
                        onChange={(e) => updateLabor(lab._id, 'tarifa', e.target.value)}
                        disabled={esReadOnly}
                        className={inputCls()}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Subtotal $</label>
                        <div className="text-sm font-semibold text-zinc-900 bg-zinc-100 rounded-lg px-2.5 py-1.5">
                          ${num.format(lab.subtotal)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Fecha de ejecución</label>
                        <input
                          type="date"
                          value={lab.fechaEjecucion}
                          onChange={(e) => updateLabor(lab._id, 'fechaEjecucion', e.target.value)}
                          disabled={esReadOnly}
                          className={inputCls()}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Observaciones</label>
                        <input
                          type="text"
                          value={lab.obs}
                          onChange={(e) => updateLabor(lab._id, 'obs', e.target.value)}
                          disabled={esReadOnly}
                          placeholder="Opcional…"
                          className={inputCls()}
                        />
                      </div>
                    </div>
                    {!esReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeLabor(lab._id)}
                        className="mt-5 p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-1">
                <span className="text-sm font-semibold text-zinc-700">
                  Total labores: <span className="text-[#006836]">${num.format(totalLabores)}</span>
                </span>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── PRODUCCION ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        {sectionHeader('produccion', <Wheat className="w-4 h-4 text-zinc-500" />, 'Producción del lote', produccion.length, undefined, addProduccion)}
        {secOpen.produccion && (
          produccion.length === 0 ? (
            <div className="text-center py-6 text-sm text-zinc-400">
              {esReadOnly ? 'Sin producción registrada.' : 'Sin producción. Usá "Agregar" para registrar cosecha.'}
            </div>
          ) : (
            <div className="space-y-3">
              {produccion.map((prod) => {
                const rend = sup > 0 && parseFloat(prod.cantidad || '0') > 0
                  ? parseFloat(prod.cantidad) / sup : null;
                const valorBruto = prod.precioReferencia
                  ? parseFloat(prod.cantidad || '0') * parseFloat(prod.precioReferencia || '0') : null;
                return (
                  <div key={prod._id} className="border border-zinc-100 rounded-xl p-3 space-y-3 bg-zinc-50/40">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Producto cosechado *</label>
                        <select
                          value={prod.productoId}
                          onChange={(e) => handleProduccionProducto(prod._id, e.target.value)}
                          disabled={esReadOnly}
                          className={inputCls(!prod.productoId && !esReadOnly)}
                        >
                          <option value="">Seleccioná…</option>
                          {productos.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Depósito / Silo de ingreso *</label>
                        <select
                          value={prod.depositoIngresoId}
                          onChange={(e) => updateProduccion(prod._id, 'depositoIngresoId', e.target.value)}
                          disabled={esReadOnly}
                          className={inputCls(!prod.depositoIngresoId && !esReadOnly)}
                        >
                          <option value="">Seleccioná…</option>
                          {depositos.map((d) => (
                            <option key={d.id} value={d.id}>{d.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">
                          Cantidad * {prod.unidadBase && <span className="text-zinc-400">({prod.unidadBase})</span>}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={prod.cantidad}
                          onChange={(e) => updateProduccion(prod._id, 'cantidad', e.target.value)}
                          disabled={esReadOnly}
                          className={inputCls(!prod.cantidad && !esReadOnly)}
                        />
                        {rend != null && (
                          <p className="text-xs text-zinc-400 mt-1">
                            Rend: {num.format(rend)} {prod.unidadBase}/ha
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Humedad %</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={prod.humedadPorcentaje}
                          onChange={(e) => updateProduccion(prod._id, 'humedadPorcentaje', e.target.value)}
                          disabled={esReadOnly}
                          placeholder="Ej: 13.5"
                          className={inputCls()}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Calidad / Categoría</label>
                        <input
                          type="text"
                          value={prod.calidadCategoria}
                          onChange={(e) => updateProduccion(prod._id, 'calidadCategoria', e.target.value)}
                          disabled={esReadOnly}
                          placeholder="Ej: Grado 2, Cat A…"
                          className={inputCls()}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Precio referencia $</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={prod.precioReferencia}
                          onChange={(e) => updateProduccion(prod._id, 'precioReferencia', e.target.value)}
                          disabled={esReadOnly}
                          placeholder="Precio de mercado"
                          className={inputCls()}
                        />
                        {valorBruto != null && valorBruto > 0 && (
                          <p className="text-xs text-zinc-400 mt-1">
                            Valor bruto: ${num.format(valorBruto)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">Observaciones</label>
                        <input
                          type="text"
                          value={prod.obs}
                          onChange={(e) => updateProduccion(prod._id, 'obs', e.target.value)}
                          disabled={esReadOnly}
                          placeholder="Opcional…"
                          className={inputCls()}
                        />
                      </div>
                      {!esReadOnly && (
                        <button
                          type="button"
                          onClick={() => removeProduccion(prod._id)}
                          className="mt-5 p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── TOTALES ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Resumen del remito</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-50 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-500">Total insumos</p>
            <p className="text-lg font-bold text-zinc-800 mt-1">${num.format(totalInsumos)}</p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-500">Total labores</p>
            <p className="text-lg font-bold text-zinc-800 mt-1">${num.format(totalLabores)}</p>
          </div>
          <div className="bg-[#006836]/5 rounded-xl p-3 text-center border border-[#006836]/20">
            <p className="text-xs text-[#006836] font-medium">Costo total RIA</p>
            <p className="text-xl font-bold text-[#006836] mt-1">${num.format(totalRia)}</p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-500">Costo por ha</p>
            <p className="text-lg font-bold text-zinc-800 mt-1">
              {costoPerHa != null ? `$${num.format(costoPerHa)}` : '—'}
            </p>
          </div>
        </div>

        {produccion.length > 0 && (
          <div className="mt-3 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <p className="text-xs font-medium text-emerald-700 mb-1">Producción a registrar</p>
            {produccion.map((p) => {
              const valorBruto = p.precioReferencia
                ? parseFloat(p.cantidad || '0') * parseFloat(p.precioReferencia || '0') : null;
              return (
                <p key={p._id} className="text-sm text-emerald-800">
                  {p.productoNombre || '—'}: {p.cantidad} {p.unidadBase}
                  {valorBruto != null && valorBruto > 0 && ` · Valor bruto: $${num.format(valorBruto)}`}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ACCIONES ──────────────────────────────────────────────────────────── */}
      {!esReadOnly && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
          {errorMsg && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4 border border-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || confirming}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || confirming}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#006836] hover:bg-[#005228] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {confirming ? 'Confirmando…' : 'Confirmar RIA'}
            </button>
          </div>

          <p className="text-xs text-zinc-400 mt-3 text-center">
            Al confirmar, se descuentan los insumos del depósito y se acumulan los costos al lote. Esta acción no se puede deshacer sin anular el remito.
          </p>
        </div>
      )}
    </div>
  );
}
