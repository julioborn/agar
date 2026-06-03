'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIAS, UNIDADES } from '@/app/app/productos/constants';
import { registrarCargaStock, crearProductoParaStock, crearProveedorParaStock, registrarCompraDesdeImportacion } from './actions';
import type { StockExtraido } from '@/app/api/stock/parsear-stock/route';

interface Producto { id: string; nombre: string; categoria: string; unidad_base: string; principio_activo: string | null; }
interface Deposito { id: string; nombre: string; }
interface Proveedor { id: string; nombre: string; }

interface Props {
  productos: Producto[];
  depositos: Deposito[];
  proveedores: Proveedor[];
}

type Fase = 'upload' | 'analizando' | 'revision' | 'guardando';

interface ItemReview {
  _id: string;
  descripcion_archivo: string;
  cantidad: string;
  unidad: string;
  producto_id: string;
  nuevo_nombre: string;
  nuevo_categoria: string;
  nuevo_unidad_base: string;
  deposito_id: string;
  precio_unitario: string;
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
    .map((p) => ({
      p,
      score: Math.max(
        similaridad(p.nombre, descripcion),
        p.principio_activo ? similaridad(p.principio_activo, descripcion) * 0.8 : 0
      ),
    }))
    .filter(({ score }) => score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ p }) => p);
}

function inferirCategoria(descripcion: string): string {
  const d = normalizar(descripcion);
  if (/herbicida|glifosato|paraquat|glufosinato|2[,.]4[ -]?d|metsulfuron|bromazol|atrazina/.test(d)) return 'agroquimico';
  if (/fungicida|insecticida|acaricida|curasemilla|nematicida/.test(d)) return 'agroquimico';
  if (/semilla|soja|maiz|trigo|girasol|sorgo/.test(d)) return 'semilla';
  if (/fertilizante|urea|fosfato|potasio|nitrato|sulfato/.test(d)) return 'fertilizante';
  if (/inoculante|rhizobium/.test(d)) return 'inoculante';
  if (/gas oil|gasoil|nafta|combustible/.test(d)) return 'combustible';
  return 'agroquimico';
}

function inferirUnidadBase(unidad: string): string {
  const u = unidad.toLowerCase();
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) return 'L';
  if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) return 'kg';
  if (['tn', 'ton', 'tonelada', 'toneladas'].includes(u)) return 'kg';
  if (['sobre', 'sobres', 'bolsa', 'bolsas'].includes(u)) return 'unidad';
  return 'unidad';
}

export default function ImportarStockForm({ productos, depositos, proveedores }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fase, setFase] = useState<Fase>('upload');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [proveedorNombreIA, setProveedorNombreIA] = useState('');
  const [nuevoProvNombre, setNuevoProvNombre] = useState('');
  const [nuevoProvCuit, setNuevoProvCuit] = useState('');
  const [depositoGlobal, setDepositoGlobal] = useState(() => depositos[0]?.id ?? '');
  const [unidadGlobal, setUnidadGlobal] = useState('');
  const [items, setItems] = useState<ItemReview[]>([]);

  const field = 'w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50 bg-white';

  function procesarArchivo(f: File) { setArchivo(f); setError(null); }

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
      const res = await fetch('/api/stock/parsear-stock', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error ?? 'Error al procesar el archivo');
        setFase('upload');
        return;
      }

      const extraido: StockExtraido = json.stock;

      // ── Auto-match proveedor ────────────────────────────────────────────
      if (extraido.proveedor_nombre) {
        const nombreIA = extraido.proveedor_nombre.trim();
        setProveedorNombreIA(nombreIA);
        // 1. Buscar en memoria guardada (localStorage)
        let matchId = '';
        try {
          const mapa: Record<string, string> = JSON.parse(localStorage.getItem('agro_proveedor_map') ?? '{}');
          const key = normalizar(nombreIA);
          matchId = mapa[key] ?? '';
        } catch { /* ignorar */ }

        // 2. Si no hay en memoria, fuzzy match contra lista
        if (!matchId) {
          const mejor = proveedores
            .map((p) => ({ id: p.id, score: similaridad(p.nombre, nombreIA) }))
            .sort((a, b) => b.score - a.score)[0];
          if (mejor && mejor.score >= 0.5) matchId = mejor.id;
        }

        if (matchId) setProveedorId(matchId);
      }

      // ── Auto-fill N° factura ────────────────────────────────────────────
      if (extraido.numero_factura) setNumeroFactura(extraido.numero_factura);

      const revisados: ItemReview[] = extraido.items.map((item) => {
        const tops = mejoresMatches(item.descripcion, productos, 1);
        const productoId = (tops.length > 0 && similaridad(tops[0].nombre, item.descripcion) >= 0.5)
          ? tops[0].id
          : '_nuevo_';

        return {
          _id: uid(),
          descripcion_archivo: item.descripcion,
          cantidad: String(item.cantidad),
          unidad: item.unidad,
          producto_id: productoId,
          nuevo_nombre: item.descripcion,
          nuevo_categoria: inferirCategoria(item.descripcion),
          nuevo_unidad_base: productoId
            ? (productos.find((p) => p.id === productoId)?.unidad_base ?? inferirUnidadBase(item.unidad))
            : inferirUnidadBase(item.unidad),
          deposito_id: depositos[0]?.id ?? '',
          precio_unitario: item.precio_unitario_neto != null ? String(item.precio_unitario_neto) : '',
        };
      });

      setItems(revisados);
      setFase('revision');
    } catch {
      setError('Error de red al procesar el archivo');
      setFase('upload');
    }
  }

  function updateItem(id: string, patch: Partial<ItemReview>) {
    setItems((prev) => prev.map((i) => i._id === id ? { ...i, ...patch } : i));
  }

  function aplicarDepositoGlobal() {
    if (!depositoGlobal) return;
    setItems((prev) => prev.map((i) => ({ ...i, deposito_id: depositoGlobal })));
  }

  function aplicarUnidadGlobal() {
    if (!unidadGlobal) return;
    const base = inferirUnidadBase(unidadGlobal);
    setItems((prev) => prev.map((i) => ({ ...i, unidad: unidadGlobal, nuevo_unidad_base: base })));
  }

  async function handleConfirmar() {
    setError(null);

    if (!fecha) { setError('La fecha es obligatoria'); return; }
    for (const item of items) {
      if (!item.producto_id) { setError(`Asigná un producto a: "${item.descripcion_archivo}"`); return; }
      if (item.producto_id === '_nuevo_' && !item.nuevo_nombre.trim()) {
        setError(`Ingresá el nombre del nuevo producto para: "${item.descripcion_archivo}"`); return;
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        setError(`La cantidad de "${item.descripcion_archivo}" debe ser mayor a cero`); return;
      }
      if (!item.deposito_id) {
        setError(`Seleccioná el depósito para: "${item.descripcion_archivo}"`); return;
      }
    }

    // Validar nuevo proveedor si se seleccionó esa opción
    if (proveedorId === '_nuevo_' && !nuevoProvNombre.trim()) {
      setError('Ingresá el nombre del nuevo proveedor.');
      return;
    }

    setFase('guardando');

    try {
      // Crear proveedor nuevo si corresponde
      let proveedorIdFinal = proveedorId === '_nuevo_' ? '' : proveedorId;
      if (proveedorId === '_nuevo_') {
        const res = await crearProveedorParaStock({
          nombre: nuevoProvNombre.trim(),
          cuit: nuevoProvCuit.trim() || undefined,
        });
        if (res.error || !res.id) { setError(res.error ?? 'Error al crear proveedor'); setFase('revision'); return; }
        proveedorIdFinal = res.id;
      }

      const productosCreados: Record<string, string> = {};
      for (const item of items.filter((i) => i.producto_id === '_nuevo_')) {
        const result = await crearProductoParaStock({
          nombre: item.nuevo_nombre.trim(),
          categoria: item.nuevo_categoria,
          unidad_base: item.nuevo_unidad_base,
        });
        if (result.error || !result.id) {
          setError(result.error ?? 'Error al crear producto');
          setFase('revision');
          return;
        }
        productosCreados[item._id] = result.id;
      }

      const resolverProductoId = (item: ItemReview) =>
        item.producto_id === '_nuevo_' ? productosCreados[item._id] : item.producto_id;

      const resolvedItems = items.map((item) => ({
        producto_id: resolverProductoId(item),
        cantidad: parseFloat(item.cantidad),
        deposito_id: item.deposito_id,
        precio_unitario: parseFloat(item.precio_unitario || '0'),
      }));

      const result = proveedorIdFinal || numeroFactura.trim()
        ? await registrarCompraDesdeImportacion({
            proveedor_id: proveedorIdFinal || undefined,
            numero_factura: numeroFactura.trim() || undefined,
            fecha,
            observaciones: observaciones.trim() || undefined,
            items: resolvedItems,
          })
        : await registrarCargaStock({
            fecha,
            observaciones: observaciones.trim() || undefined,
            items: resolvedItems,
          });

      if (result.error) { setError(result.error); setFase('revision'); return; }

      // Guardar mapeo nombre-IA → proveedor_id para futuros análisis
      if (proveedorIdFinal && proveedorNombreIA) {
        try {
          const mapa: Record<string, string> = JSON.parse(localStorage.getItem('agro_proveedor_map') ?? '{}');
          mapa[normalizar(proveedorNombreIA)] = proveedorIdFinal;
          localStorage.setItem('agro_proveedor_map', JSON.stringify(mapa));
        } catch { /* ignorar */ }
      }

      router.push('/app/stock');
    } catch {
      setError('Error inesperado al guardar');
      setFase('revision');
    }
  }

  // ── Upload / Analizando ────────────────────────────────────────────────────

  if (fase === 'upload' || fase === 'analizando') {
    return (
      <div className="space-y-4">
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
                <p className="font-semibold text-zinc-700">Arrastrá tu archivo acá</p>
                <p className="text-sm text-zinc-400 mt-1">Excel con columnas de producto y cantidad, o PDF de inventario</p>
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
            onClick={() => router.push('/app/stock')}
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
              'Analizar archivo'
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Revisión / Guardando ───────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#006836]" />
          <h2 className="font-semibold text-zinc-800">
            {items.length} producto{items.length !== 1 ? 's' : ''} extraído{items.length !== 1 ? 's' : ''} — revisá y corregí si es necesario
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-500">Fecha del relevamiento</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={field}
              disabled={fase === 'guardando'}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-500">Observaciones (opcional)</label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Inventario inicial, conteo físico mayo…"
              className={field}
              disabled={fase === 'guardando'}
            />
          </div>
        </div>

        {/* Proveedor y factura — si se completan, el movimiento queda como Compra con trazabilidad */}
        <div className="border-t border-zinc-100 pt-4 space-y-3">
          <p className="text-xs font-medium text-zinc-500">
            Proveedor / factura <span className="text-zinc-400 font-normal">(opcional — si lo completás, el historial muestra el proveedor)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-zinc-400">
                Proveedor
                {proveedorNombreIA && (
                  <span className="ml-2 text-[#006836] font-medium">
                    · IA detectó: "{proveedorNombreIA}"
                  </span>
                )}
              </label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className={field}
                disabled={fase === 'guardando'}
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
                <option value="_nuevo_">+ Crear nuevo proveedor…</option>
              </select>

              {/* Panel inline para crear nuevo proveedor */}
              {proveedorId === '_nuevo_' && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700">Nuevo proveedor</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={nuevoProvNombre}
                        onChange={(e) => setNuevoProvNombre(e.target.value)}
                        placeholder="Ej: Agroquímicos Del Sur"
                        className={field}
                        disabled={fase === 'guardando'}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">CUIT (opcional)</label>
                      <input
                        type="text"
                        value={nuevoProvCuit}
                        onChange={(e) => setNuevoProvCuit(e.target.value)}
                        placeholder="30-12345678-9"
                        className={field}
                        disabled={fase === 'guardando'}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-zinc-400">N° de factura</label>
              <input
                type="text"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                placeholder="Ej: 0001-00012345"
                className={field}
                disabled={fase === 'guardando'}
              />
            </div>
          </div>
          {(proveedorId || numeroFactura.trim()) && (
            <p className="text-xs text-[#006836] bg-[#006836]/5 rounded-lg px-3 py-2">
              ✓ Se registrará como <strong>Compra</strong> — el historial de cada producto mostrará el proveedor y la factura.
              {proveedorId === '_nuevo_' && nuevoProvNombre.trim() && (
                <span> Se creará el proveedor <strong>"{nuevoProvNombre}"</strong>.</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Selectores globales */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-3">
        {/* Unidad global */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-amber-700 font-medium shrink-0 w-36">Unidad para todos:</span>
          <select
            value={unidadGlobal}
            onChange={(e) => setUnidadGlobal(e.target.value)}
            className="text-sm border border-amber-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 flex-1 min-w-[140px]"
            disabled={fase === 'guardando'}
          >
            <option value="">Seleccionar…</option>
            <option value="L">L — Litros</option>
            <option value="kg">kg — Kilogramos</option>
            <option value="tn">tn — Toneladas</option>
            <option value="unidad">Unidad</option>
            <option value="sobre">Sobre</option>
            <option value="bolsa">Bolsa</option>
          </select>
          <button
            type="button"
            onClick={aplicarUnidadGlobal}
            disabled={!unidadGlobal || fase === 'guardando'}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            Aplicar a todos
          </button>
        </div>

        {/* Depósito global */}
        {depositos.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap border-t border-amber-200 pt-3">
            <span className="text-sm text-amber-700 font-medium shrink-0 w-36">Depósito para todos:</span>
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
      </div>

      {/* Items — grilla de cards */}
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const tops = mejoresMatches(item.descripcion_archivo, productos, 5);
          const esNuevo = item.producto_id === '_nuevo_';
          const esSinAsignar = item.producto_id === '';
          const prodSeleccionado = productos.find((p) => p.id === item.producto_id);

          return (
            <div
              key={item._id}
              className={cn(
                'rounded-2xl border p-4 space-y-3 transition-colors',
                esNuevo ? 'bg-blue-50/60 border-blue-200' :
                esSinAsignar ? 'bg-white border-red-200' :
                'bg-white border-zinc-100'
              )}
            >
              {/* Header: descripción del archivo + badge */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-800 leading-tight">{item.descripcion_archivo}</p>
                {esNuevo && (
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Nuevo</span>
                )}
                {!esNuevo && !esSinAsignar && (
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[#006836]/10 text-[#006836]">Asignado</span>
                )}
                {esSinAsignar && (
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">Sin asignar</span>
                )}
              </div>

              {/* Selector de producto */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-500">Producto en sistema</label>
                <select
                  value={item.producto_id}
                  onChange={(e) => updateItem(item._id, { producto_id: e.target.value })}
                  className={cn(field, esSinAsignar && 'border-red-300 ring-1 ring-red-200')}
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
                  <p className="text-xs text-zinc-400">P.A.: {prodSeleccionado.principio_activo}</p>
                )}
              </div>

              {/* Cantidad + unidad | Depósito | Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-500">Cantidad</label>
                  <div className="flex gap-1">
                    <input
                      type="number" step="0.001" min="0"
                      value={item.cantidad}
                      onChange={(e) => updateItem(item._id, { cantidad: e.target.value })}
                      className="w-0 flex-1 text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50 bg-white"
                      disabled={fase === 'guardando'}
                    />
                    <select
                      value={item.unidad}
                      onChange={(e) => updateItem(item._id, { unidad: e.target.value, nuevo_unidad_base: inferirUnidadBase(e.target.value) })}
                      className="text-sm border border-zinc-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50 bg-white"
                      disabled={fase === 'guardando'}
                    >
                      <option value="L">L</option>
                      <option value="kg">kg</option>
                      <option value="tn">tn</option>
                      <option value="unidad">und</option>
                      <option value="sobre">sob</option>
                      <option value="bolsa">bol</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-500">Depósito</label>
                  <select
                    value={item.deposito_id}
                    onChange={(e) => updateItem(item._id, { deposito_id: e.target.value })}
                    className={cn(field, !item.deposito_id && 'border-amber-300')}
                    disabled={fase === 'guardando'}
                  >
                    <option value="">Seleccionar…</option>
                    {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
              </div>

              {/* Precio unitario — solo visible si hay proveedor/factura */}
              {((proveedorId && proveedorId !== '_nuevo_') || (proveedorId === '_nuevo_' && nuevoProvNombre.trim()) || numeroFactura.trim()) && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-500">Precio unitario $ <span className="text-zinc-400 font-normal">(opcional)</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.precio_unitario}
                    onChange={(e) => updateItem(item._id, { precio_unitario: e.target.value })}
                    placeholder="0.00"
                    className={field}
                    disabled={fase === 'guardando'}
                  />
                </div>
              )}

              {/* Nuevo producto */}
              {esNuevo && (
                <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-blue-400" />
                    <p className="text-xs font-semibold text-blue-700">Definir nuevo producto</p>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-zinc-500">Nombre</label>
                    <input
                      type="text" value={item.nuevo_nombre}
                      onChange={(e) => updateItem(item._id, { nuevo_nombre: e.target.value })}
                      className={field} disabled={fase === 'guardando'}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen */}
      <p className="text-xs text-zinc-400 text-right">
        {items.length} producto{items.length !== 1 ? 's' : ''} · {items.filter(i => i.producto_id === '_nuevo_').length} nuevo{items.filter(i => i.producto_id === '_nuevo_').length !== 1 ? 's' : ''} · {items.filter(i => i.producto_id === '').length} sin asignar
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

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
            onClick={() => router.push('/app/stock')}
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
              'Confirmar y cargar stock'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
