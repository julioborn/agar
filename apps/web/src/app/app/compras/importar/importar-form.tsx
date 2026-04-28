'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ChevronDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIAS, UNIDADES } from '@/app/app/productos/constants';
import { crearCompra } from '../actions';
import { guardarCodigosProveedor, crearProductoNuevo } from './actions';
import type { FacturaExtraida } from '@/app/api/compras/parsear-factura/route';

interface Proveedor { id: string; nombre: string; cuit: string | null; }
interface Producto  { id: string; nombre: string; categoria: string; unidad_base: string; principio_activo: string | null; }
interface Presentacion { id: string; producto_id: string; descripcion: string; factor_a_unidad_base: number; }
interface Deposito  { id: string; nombre: string; }
interface CodigoProveedorRaw { nombre_en_factura: string; producto_id: string; proveedor_id: string | null; codigo_externo: string | null; }

interface Props {
  proveedores: Proveedor[];
  productos: Producto[];
  presentaciones: Presentacion[];
  depositos: Deposito[];
  codigosProveedor: CodigoProveedorRaw[];
  empresaId: string;
}

type Fase = 'upload' | 'analizando' | 'revision' | 'guardando';

interface ItemReview {
  _id: string;
  descripcion_factura: string;
  codigo_proveedor_ext: string | null;
  cantidad: string;
  unidad: string;
  precio_unitario_neto: string;
  subtotal_neto: number;

  // Asignación de producto
  producto_id: string;          // '' = sin asignar, '_nuevo_' = crear nuevo
  nuevo_nombre: string;
  nuevo_categoria: string;
  nuevo_unidad_base: string;
  nuevo_principio_activo: string;
  deposito_id: string;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function normalizar(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s%]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function similaridad(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = na.split(' ').filter((w) => w.length > 2);
  const wb = new Set(nb.split(' ').filter((w) => w.length > 2));
  const coincidencias = wa.filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 ? coincidencias / union : 0;
}

function mejoresMatches(descripcion: string, productos: Producto[], topN = 5): Producto[] {
  return productos
    .map((p) => ({ p, score: Math.max(similaridad(p.nombre, descripcion), p.principio_activo ? similaridad(p.principio_activo, descripcion) * 0.8 : 0) }))
    .filter(({ score }) => score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ p }) => p);
}

const UNIDAD_MAP: Record<string, string> = {
  l: 'L', lt: 'L', lts: 'L', litro: 'L', litros: 'L',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  tn: 'kg', ton: 'kg', tonelada: 'kg',
  sobre: 'unidad', sobres: 'unidad', bolsa: 'unidad', bolsas: 'unidad',
  unidad: 'unidad', unidades: 'unidad',
};

function normalizarUnidad(u: string): string {
  return UNIDAD_MAP[u.toLowerCase()] ?? u;
}

export default function ImportarFacturaFlow({ proveedores, productos, presentaciones, depositos, codigosProveedor }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fase, setFase] = useState<Fase>('upload');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [factura, setFactura] = useState<FacturaExtraida | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cabecera editable
  const [proveedorId, setProveedorId] = useState('');
  const [fecha, setFecha] = useState('');
  const [nroFactura, setNroFactura] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [cotizacion, setCotizacion] = useState('');

  // Items revisados
  const [items, setItems] = useState<ItemReview[]>([]);
  const [depositoGlobal, setDepositoGlobal] = useState('');

  const field = 'w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50 bg-white';

  // ── Upload ─────────────────────────────────────────────────────────────────

  function procesarArchivo(f: File) {
    setArchivo(f);
    setError(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) procesarArchivo(f);
  }

  async function analizar() {
    if (!archivo) return;
    setFase('analizando');
    setError(null);

    const form = new FormData();
    form.append('file', archivo);

    try {
      const res = await fetch('/api/compras/parsear-factura', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error ?? 'Error al procesar el archivo');
        setFase('upload');
        return;
      }

      const f: FacturaExtraida = json.factura;
      setFactura(f);

      // Inicializar cabecera
      setFecha(f.fecha ?? '');
      setNroFactura(f.numero_factura ?? '');
      setMoneda(f.moneda ?? 'ARS');
      setCotizacion(f.cotizacion_usd ? String(f.cotizacion_usd) : '');

      // Buscar proveedor por nombre
      const provMatch = proveedores.find(
        (p) => normalizar(p.nombre).includes(normalizar(f.proveedor_nombre)) ||
               normalizar(f.proveedor_nombre).includes(normalizar(p.nombre)) ||
               (f.proveedor_cuit && p.cuit?.replace(/\D/g, '') === f.proveedor_cuit?.replace(/\D/g, ''))
      );
      if (provMatch) setProveedorId(provMatch.id);
      else setProveedorId('');

      // Inicializar items con auto-matching
      const revisados: ItemReview[] = f.items.map((item) => {
        // 1. Buscar en codigos_proveedor (match exacto previo)
        const codigoMatch = codigosProveedor.find(
          (c) => normalizar(c.nombre_en_factura) === normalizar(item.descripcion) &&
                 (!provMatch || c.proveedor_id === null || c.proveedor_id === provMatch.id)
        );

        let productoId = '';
        if (codigoMatch) {
          productoId = codigoMatch.producto_id;
        } else {
          // 2. Auto-match por similitud si score > 0.5
          const tops = mejoresMatches(item.descripcion, productos, 1);
          if (tops.length > 0) {
            const score = similaridad(tops[0].nombre, item.descripcion);
            if (score >= 0.5) productoId = tops[0].id;
          }
        }

        const unidadBase = productoId
          ? (productos.find((p) => p.id === productoId)?.unidad_base ?? 'unidad')
          : normalizarUnidad(item.unidad);

        return {
          _id: uid(),
          descripcion_factura: item.descripcion,
          codigo_proveedor_ext: item.codigo_proveedor,
          cantidad: String(item.cantidad),
          unidad: item.unidad,
          precio_unitario_neto: String(item.precio_unitario_neto),
          subtotal_neto: item.subtotal_neto,
          producto_id: productoId,
          nuevo_nombre: item.descripcion,
          nuevo_categoria: inferirCategoria(item.descripcion),
          nuevo_unidad_base: unidadBase,
          nuevo_principio_activo: '',
          deposito_id: '',
        };
      });

      setItems(revisados);
      setFase('revision');
    } catch (err) {
      setError('Error de red al procesar el archivo');
      setFase('upload');
    }
  }

  function inferirCategoria(descripcion: string): string {
    const d = normalizar(descripcion);
    if (/herbicida|glifosato|paraquat|glufosinato|2[,.]4[ -]?d|metsulfuron|bromazol|atrazina|terbutilazina|bromoxinil/.test(d)) return 'agroquimico';
    if (/fungicida|insecticida|acaricida|curasemilla|nematicida/.test(d)) return 'agroquimico';
    if (/semilla|soja|maiz|trigo|girasol|sorgo/.test(d)) return 'semilla';
    if (/fertilizante|urea|fosfato|potasio|nitrato|sulfato/.test(d)) return 'fertilizante';
    if (/inoculante|rhizobium/.test(d)) return 'inoculante';
    if (/gas oil|gasoil|nafta|combustible/.test(d)) return 'combustible';
    return 'agroquimico';
  }

  // ── Edición de items ───────────────────────────────────────────────────────

  function updateItem(id: string, patch: Partial<ItemReview>) {
    setItems((prev) => prev.map((i) => i._id === id ? { ...i, ...patch } : i));
  }

  function aplicarDepositoGlobal() {
    if (!depositoGlobal) return;
    setItems((prev) => prev.map((i) => ({ ...i, deposito_id: depositoGlobal })));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleConfirmar() {
    setError(null);

    // Validaciones básicas
    if (!fecha) { setError('La fecha es obligatoria'); return; }
    if (moneda === 'USD' && (!cotizacion || parseFloat(cotizacion) <= 0)) {
      setError('Ingresá la cotización del dólar'); return;
    }
    for (const item of items) {
      if (!item.producto_id) { setError(`Asigná un producto a: "${item.descripcion_factura}"`); return; }
      if (item.producto_id === '_nuevo_' && !item.nuevo_nombre.trim()) {
        setError(`Ingresá el nombre del nuevo producto para: "${item.descripcion_factura}"`); return;
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        setError(`La cantidad de "${item.descripcion_factura}" debe ser mayor a cero`); return;
      }
      if (!item.precio_unitario_neto || parseFloat(item.precio_unitario_neto) <= 0) {
        setError(`El precio de "${item.descripcion_factura}" debe ser mayor a cero`); return;
      }
      if (!item.deposito_id) {
        setError(`Seleccioná el depósito para: "${item.descripcion_factura}"`); return;
      }
    }

    setFase('guardando');

    try {
      const cotizNum = parseFloat(cotizacion) || null;

      // 1. Crear productos nuevos si hay
      const productosCreados: Record<string, string> = {};
      for (const item of items.filter((i) => i.producto_id === '_nuevo_')) {
        const result = await crearProductoNuevo({
          nombre: item.nuevo_nombre.trim(),
          categoria: item.nuevo_categoria,
          unidad_base: item.nuevo_unidad_base,
          principio_activo: item.nuevo_principio_activo,
        });
        if (result.error || !result.id) {
          setError(result.error ?? 'Error al crear producto');
          setFase('revision');
          return;
        }
        productosCreados[item._id] = result.id;
      }

      // 2. Construir items de compra
      const resolverProductoId = (item: ItemReview) =>
        item.producto_id === '_nuevo_' ? productosCreados[item._id] : item.producto_id;

      const itemsData = items.map((item) => {
        const pid = resolverProductoId(item);
        const prod = productos.find((p) => p.id === pid);
        const cantNum = parseFloat(item.cantidad);
        const precioNum = parseFloat(item.precio_unitario_neto);
        const cotizReal = cotizNum ?? 1;
        const precio_ars = moneda === 'USD' ? precioNum * cotizReal : precioNum;
        const subtotal_ars = cantNum * precio_ars;

        return {
          producto_id: pid,
          presentacion_id: null,
          cantidad_presentacion: null,
          cantidad_unidad_base: cantNum,
          precio_unitario_moneda_original: precioNum,
          precio_unitario_ars: precio_ars,
          subtotal_moneda_original: cantNum * precioNum,
          subtotal_ars,
          deposito_destino_id: item.deposito_id,
        };
      });

      const totalOrig = itemsData.reduce((s, i) => s + i.subtotal_moneda_original, 0);
      const totalArs = itemsData.reduce((s, i) => s + i.subtotal_ars, 0);

      const result = await crearCompra({
        proveedor_id: proveedorId || null,
        fecha,
        numero_factura: nroFactura || null,
        moneda,
        cotizacion_usd: moneda === 'USD' ? cotizNum : null,
        total_moneda_original: totalOrig,
        total_en_ars: totalArs,
        items: itemsData,
      });

      if (result.error) { setError(result.error); setFase('revision'); return; }

      // 3. Guardar mapeos nombre→producto para futuras importaciones
      const codigos = items
        .filter((i) => i.producto_id !== '_nuevo_' && i.descripcion_factura)
        .map((i) => ({
          producto_id: resolverProductoId(i),
          proveedor_id: proveedorId || null,
          codigo_externo: i.codigo_proveedor_ext,
          nombre_en_factura: i.descripcion_factura,
        }))
        .concat(
          items
            .filter((i) => i.producto_id === '_nuevo_' && productosCreados[i._id])
            .map((i) => ({
              producto_id: productosCreados[i._id],
              proveedor_id: proveedorId || null,
              codigo_externo: i.codigo_proveedor_ext,
              nombre_en_factura: i.descripcion_factura,
            }))
        );

      await guardarCodigosProveedor(codigos);

      router.push(`/app/compras/${result.compraId}`);
    } catch {
      setError('Error inesperado al guardar');
      setFase('revision');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (fase === 'upload' || fase === 'analizando') {
    return (
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors',
            archivo ? 'border-[#006836]/40 bg-[#006836]/3' : 'border-zinc-200 hover:border-[#006836]/40 hover:bg-zinc-50'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && procesarArchivo(e.target.files[0])}
          />
          {archivo ? (
            <div className="space-y-2">
              <FileText className="w-10 h-10 text-[#006836] mx-auto" />
              <p className="font-semibold text-zinc-800">{archivo.name}</p>
              <p className="text-xs text-zinc-400">{(archivo.size / 1024).toFixed(0)} KB · Hacé clic para cambiar</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-10 h-10 text-zinc-300 mx-auto" />
              <div>
                <p className="font-semibold text-zinc-700">Arrastrá tu factura acá</p>
                <p className="text-sm text-zinc-400 mt-1">o hacé clic para seleccionar</p>
              </div>
              <p className="text-xs text-zinc-300">PDF · Excel (.xlsx / .xls) · CSV</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push('/app/compras')}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={analizar}
            disabled={!archivo || fase === 'analizando'}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fase === 'analizando' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analizando con IA…</>
            ) : (
              'Analizar factura'
            )}
          </button>
        </div>
      </div>
    );
  }

  if (fase === 'revision' || fase === 'guardando') {
    const cotizNum = parseFloat(cotizacion) || 1;
    const ars = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
    const num = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(n);

    const totalNeto = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario_neto) || 0), 0);
    const totalArs = moneda === 'USD' ? totalNeto * cotizNum : totalNeto;

    return (
      <div className="space-y-5">
        {/* Cabecera */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#006836]" />
            <h2 className="font-semibold text-zinc-800">Datos extraídos — revisá y corregí si es necesario</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-500">Proveedor</label>
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={field} disabled={fase === 'guardando'}>
                <option value="">Sin proveedor / Crear después</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              {factura?.proveedor_nombre && !proveedorId && (
                <p className="text-xs text-amber-600">Extraído: "{factura.proveedor_nombre}" — seleccioná el proveedor correspondiente</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-500">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={field} disabled={fase === 'guardando'} />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-500">N° de factura</label>
              <input type="text" value={nroFactura} onChange={(e) => setNroFactura(e.target.value)} className={field} disabled={fase === 'guardando'} />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-500">Moneda</label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')} className={field} disabled={fase === 'guardando'}>
                <option value="ARS">ARS — Pesos</option>
                <option value="USD">USD — Dólares</option>
              </select>
            </div>

            {moneda === 'USD' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-500">Cotización (1 USD = X ARS)</label>
                <input type="number" step="0.01" min="0.01" value={cotizacion}
                  onChange={(e) => setCotizacion(e.target.value)} className={field} disabled={fase === 'guardando'} />
              </div>
            )}
          </div>
        </div>

        {/* Depósito global */}
        {depositos.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-amber-700 font-medium shrink-0">Depósito destino para todos:</span>
            <select
              value={depositoGlobal}
              onChange={(e) => setDepositoGlobal(e.target.value)}
              className="text-sm border border-amber-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 flex-1 min-w-[180px]"
              disabled={fase === 'guardando'}
            >
              <option value="">Seleccionar…</option>
              {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <button
              type="button"
              onClick={aplicarDepositoGlobal}
              disabled={!depositoGlobal || fase === 'guardando'}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              Aplicar a todos
            </button>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-800">Productos — {items.length} ítem{items.length !== 1 ? 's' : ''} extraído{items.length !== 1 ? 's' : ''}</h2>
          </div>

          <div className="divide-y divide-zinc-50">
            {items.map((item) => {
              const tops = mejoresMatches(item.descripcion_factura, productos, 5);
              const esNuevo = item.producto_id === '_nuevo_';
              const prodSeleccionado = productos.find((p) => p.id === item.producto_id);
              const cantNum = parseFloat(item.cantidad) || 0;
              const precioNum = parseFloat(item.precio_unitario_neto) || 0;
              const subtotalOrig = cantNum * precioNum;
              const subtotalArs = moneda === 'USD' ? subtotalOrig * cotizNum : subtotalOrig;

              return (
                <div key={item._id} className={cn('p-4 space-y-3', esNuevo && 'bg-blue-50/40')}>
                  {/* Descripción extraída */}
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded mt-0.5 shrink-0">
                      {item.codigo_proveedor_ext ?? '—'}
                    </span>
                    <p className="text-sm font-medium text-zinc-700 leading-tight">{item.descripcion_factura}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Producto */}
                    <div className="space-y-1 lg:col-span-2">
                      <label className="block text-xs font-medium text-zinc-500">Producto en sistema</label>
                      <select
                        value={item.producto_id}
                        onChange={(e) => updateItem(item._id, { producto_id: e.target.value })}
                        className={cn(field, !item.producto_id && 'border-red-300 ring-1 ring-red-200')}
                        disabled={fase === 'guardando'}
                      >
                        <option value="">-- Sin asignar --</option>
                        {tops.length > 0 && (
                          <optgroup label="Coincidencias sugeridas">
                            {tops.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}{p.principio_activo ? ` (${p.principio_activo})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Todos los productos">
                          {productos
                            .filter((p) => !tops.find((t) => t.id === p.id))
                            .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </optgroup>
                        <optgroup label="─────────────">
                          <option value="_nuevo_">+ Crear nuevo producto…</option>
                        </optgroup>
                      </select>
                      {prodSeleccionado?.principio_activo && (
                        <p className="text-xs text-zinc-400">Principio activo: {prodSeleccionado.principio_activo}</p>
                      )}
                    </div>

                    {/* Cantidad */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-500">
                        Cantidad ({item.unidad})
                      </label>
                      <input
                        type="number" step="0.001" min="0"
                        value={item.cantidad}
                        onChange={(e) => updateItem(item._id, { cantidad: e.target.value })}
                        className={field} disabled={fase === 'guardando'}
                      />
                    </div>

                    {/* Precio neto */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-500">
                        Precio neto ({moneda})
                      </label>
                      <input
                        type="number" step="0.01" min="0"
                        value={item.precio_unitario_neto}
                        onChange={(e) => updateItem(item._id, { precio_unitario_neto: e.target.value })}
                        className={field} disabled={fase === 'guardando'}
                      />
                    </div>
                  </div>

                  {/* Mini-form para nuevo producto */}
                  {esNuevo && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-semibold text-blue-700">Definir nuevo producto</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-xs font-medium text-zinc-500">Nombre del producto</label>
                          <input
                            type="text" value={item.nuevo_nombre}
                            onChange={(e) => updateItem(item._id, { nuevo_nombre: e.target.value })}
                            className={field} placeholder="Ej: Glifosato 66%" disabled={fase === 'guardando'}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-500">Categoría</label>
                          <select value={item.nuevo_categoria}
                            onChange={(e) => updateItem(item._id, { nuevo_categoria: e.target.value })}
                            className={field} disabled={fase === 'guardando'}>
                            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-500">Unidad base</label>
                          <select value={item.nuevo_unidad_base}
                            onChange={(e) => updateItem(item._id, { nuevo_unidad_base: e.target.value })}
                            className={field} disabled={fase === 'guardando'}>
                            {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-xs font-medium text-zinc-500">Principio activo (opcional)</label>
                          <input
                            type="text" value={item.nuevo_principio_activo}
                            onChange={(e) => updateItem(item._id, { nuevo_principio_activo: e.target.value })}
                            className={field} placeholder="Ej: Glifosato 66%" disabled={fase === 'guardando'}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Depósito + subtotal */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[180px] space-y-1">
                      <label className="block text-xs font-medium text-zinc-500">Depósito destino</label>
                      <select
                        value={item.deposito_id}
                        onChange={(e) => updateItem(item._id, { deposito_id: e.target.value })}
                        className={cn(field, !item.deposito_id && 'border-amber-300')}
                        disabled={fase === 'guardando'}
                      >
                        <option value="">Seleccionar depósito…</option>
                        {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </div>
                    <div className="text-right shrink-0 pt-5">
                      <p className="text-xs text-zinc-400">{moneda !== 'ARS' ? `${num(subtotalOrig)} ${moneda}` : ''}</p>
                      <p className="text-sm font-bold text-zinc-800">{ars(subtotalArs)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totales */}
          <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-6 text-sm">
            {moneda !== 'ARS' && (
              <span className="text-zinc-500">
                Total neto {moneda}: <strong className="text-zinc-700">{num(totalNeto)}</strong>
              </span>
            )}
            <span className="text-zinc-600">
              Total neto ARS: <strong className="text-lg text-zinc-900">{ars(totalArs)}</strong>
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { setFase('upload'); setError(null); }}
            disabled={fase === 'guardando'}
            className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-40"
          >
            ← Cambiar archivo
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/app/compras')}
              disabled={fase === 'guardando'}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={fase === 'guardando'}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {fase === 'guardando' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</>
              ) : (
                'Confirmar y registrar compra'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
