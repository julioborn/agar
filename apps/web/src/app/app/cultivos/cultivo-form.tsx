'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CultivoRow {
  id: string;
  lote_id: string;
  unidad_negocio_id: string;
  campania_id: string | null;
  cultivo: string;
  producto_final: string | null;
  unidad_produccion: string;
  fecha_siembra: string;
  fecha_cosecha_estimada: string | null;
  fecha_cosecha_real: string | null;
  estado: 'planificada' | 'en_curso' | 'cosechada' | 'cancelada';
  observaciones: string | null;
}

const UNIDADES_PRODUCCION = [
  { value: 'kg',          label: 'Kilogramos (kg)' },
  { value: 'tn',          label: 'Toneladas (tn)' },
  { value: 'm3',          label: 'Metros cúbicos (m³)' },
  { value: 'bolsa_silaje',label: 'Bolsas de silaje' },
  { value: 'fardo',       label: 'Fardos' },
  { value: 'litro',       label: 'Litros (L)' },
  { value: 'unidad',      label: 'Unidades' },
];

export interface LoteConCampo {
  id: string;
  nombre: string;
  campo_nombre: string;
}

export interface UnidadNegocio {
  id: string;
  nombre: string;
}

export interface CampaniaTemporada {
  id: string;
  nombre: string;
}

// Cultivos más comunes de la región pampeana / Santa Fe
const CULTIVOS_COMUNES = [
  // Granos gruesos
  'Soja 1ra',
  'Soja 2da',
  'Maíz',
  'Maíz tardío',
  'Girasol',
  'Sorgo granífero',
  // Granos finos
  'Trigo',
  'Cebada',
  'Avena',
  'Centeno',
  'Colza / Canola',
  // Forrajes y pasturas
  'Maíz silaje',
  'Sorgo silaje',
  'Alfalfa',
  'Pasturas consociadas',
  'Verdeo de invierno',
  'Verdeo de verano',
  // Ganadería / Tambo
  'Pastizal natural',
  'Verdeo avena-raigrás',
];

const ESTADOS = [
  { value: 'planificada', label: 'Planificada' },
  { value: 'en_curso',    label: 'En curso' },
  { value: 'cosechada',   label: 'Cosechada' },
  { value: 'cancelada',   label: 'Cancelada' },
] as const;

export interface TipoCultivo {
  id: string;
  nombre: string;
}

interface Props {
  lotes: LoteConCampo[];
  unidadesNegocio: UnidadNegocio[];
  campanias: CampaniaTemporada[];
  tiposCultivo?: TipoCultivo[];
  cultivoEditando: CultivoRow | null;
  defaultLoteId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CultivoForm({
  lotes, unidadesNegocio, campanias, tiposCultivo = [], cultivoEditando, defaultLoteId, onSuccess, onCancel,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loteId, setLoteId] = useState('');
  const [unidadNegocioId, setUnidadNegocioId] = useState('');
  const [campaniaId, setCampaniaId] = useState('');
  const [cultivo, setCultivo] = useState('');
  const [tipoCultivoId, setTipoCultivoId] = useState('');
  const [cultivoPersonalizado, setCultivoPersonalizado] = useState(false);
  const [productoFinal, setProductoFinal] = useState('');
  const [unidadProduccion, setUnidadProduccion] = useState('kg');
  const [fechaSiembra, setFechaSiembra] = useState('');
  const [fechaCosechaEstimada, setFechaCosechaEstimada] = useState('');
  const [fechaCosechaReal, setFechaCosechaReal] = useState('');
  const [estado, setEstado] = useState<CultivoRow['estado']>('planificada');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (cultivoEditando) {
      setLoteId(cultivoEditando.lote_id);
      setUnidadNegocioId(cultivoEditando.unidad_negocio_id);
      setCampaniaId(cultivoEditando.campania_id ?? '');
      setCultivo(cultivoEditando.cultivo);
      setTipoCultivoId((cultivoEditando as any).tipo_cultivo_id ?? '');
      const enTipos = tiposCultivo.some((t) => t.nombre === cultivoEditando.cultivo);
      setCultivoPersonalizado(!enTipos && !CULTIVOS_COMUNES.includes(cultivoEditando.cultivo));
      setProductoFinal(cultivoEditando.producto_final ?? '');
      setUnidadProduccion(cultivoEditando.unidad_produccion ?? 'kg');
      setFechaSiembra(cultivoEditando.fecha_siembra);
      setFechaCosechaEstimada(cultivoEditando.fecha_cosecha_estimada ?? '');
      setFechaCosechaReal(cultivoEditando.fecha_cosecha_real ?? '');
      setEstado(cultivoEditando.estado);
      setObservaciones(cultivoEditando.observaciones ?? '');
    } else {
      setLoteId(defaultLoteId ?? (lotes[0]?.id ?? ''));
      setUnidadNegocioId(unidadesNegocio[0]?.id ?? '');
      setCampaniaId(campanias[campanias.length - 1]?.id ?? '');
      setCultivo('');
      setCultivoPersonalizado(false);
      setProductoFinal('');
      setUnidadProduccion('kg');
      setFechaSiembra('');
      setFechaCosechaEstimada('');
      setFechaCosechaReal('');
      setEstado('planificada');
      setObservaciones('');
    }
    setError('');
  }, [cultivoEditando, defaultLoteId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!loteId || !unidadNegocioId || !cultivo.trim() || !fechaSiembra || !campaniaId) {
      setError('Completá lote, unidad de negocio, especie, campaña y fecha de siembra.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const payload = {
      lote_id: loteId,
      unidad_negocio_id: unidadNegocioId,
      campania_id: campaniaId || null,
      cultivo: cultivo.trim(),
      tipo_cultivo_id: tipoCultivoId || null,
      fecha_siembra: fechaSiembra,
      fecha_cosecha_estimada: fechaCosechaEstimada || null,
      fecha_cosecha_real: fechaCosechaReal || null,
      estado,
      observaciones: observaciones.trim() || null,
    };

    let err;
    if (cultivoEditando) {
      ({ error: err } = await supabase.from('cultivos').update(payload).eq('id', cultivoEditando.id));
    } else {
      ({ error: err } = await supabase.from('cultivos').insert(payload));
    }

    setLoading(false);
    if (err) { setError(err.message); return; }
    onSuccess();
  }

  const titulo = cultivoEditando ? 'Editar cultivo' : 'Nuevo cultivo';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold text-slate-700">{titulo}</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Lote</label>
        <select value={loteId} onChange={(e) => setLoteId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Seleccioná un lote…</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>{l.campo_nombre} › {l.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Unidad de negocio</label>
        <select value={unidadNegocioId} onChange={(e) => setUnidadNegocioId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Seleccioná una unidad…</option>
          {unidadesNegocio.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
      </div>

      {campanias.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Campaña * (temporada)</label>
          <select value={campaniaId} onChange={(e) => setCampaniaId(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 ${!campaniaId ? 'border-red-300' : 'border-slate-300'}`}>
            <option value="">Seleccioná una campaña…</option>
            {campanias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Especie / cultivo</label>
        {tiposCultivo.length > 0 ? (
          // Si hay tipos definidos, usar solo esa lista
          <select
            value={tipoCultivoId}
            onChange={(e) => {
              const tid = e.target.value;
              setTipoCultivoId(tid);
              const tipo = tiposCultivo.find((t) => t.id === tid);
              setCultivo(tipo?.nombre ?? '');
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Seleccioná un tipo de cultivo…</option>
            {tiposCultivo.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        ) : !cultivoPersonalizado ? (
          <select
            value={cultivo}
            onChange={(e) => {
              if (e.target.value === '_otro_') {
                setCultivoPersonalizado(true);
                setCultivo('');
              } else {
                setCultivo(e.target.value);
              }
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Seleccioná un cultivo…</option>
            {CULTIVOS_COMUNES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="_otro_">+ Escribir otro cultivo…</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={cultivo}
              onChange={(e) => setCultivo(e.target.value)}
              placeholder="Ej: Lino, Garbanzo, Poroto…"
              autoFocus
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={() => { setCultivoPersonalizado(false); setCultivo(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 whitespace-nowrap"
            >
              ← Ver lista
            </button>
          </div>
        )}
      </div>

      <Input label="Fecha de siembra" type="date" value={fechaSiembra}
        onChange={(e) => setFechaSiembra(e.target.value)} />

      <Input label="Fecha cosecha estimada" type="date" value={fechaCosechaEstimada}
        onChange={(e) => setFechaCosechaEstimada(e.target.value)} />

      <Input label="Fecha cosecha real" type="date" value={fechaCosechaReal}
        onChange={(e) => setFechaCosechaReal(e.target.value)} />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
        <select value={estado} onChange={(e) => setEstado(e.target.value as CultivoRow['estado'])}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500">
          {ESTADOS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
          rows={2} placeholder="Opcional…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Guardando…' : cultivoEditando ? 'Guardar cambios' : 'Crear cultivo'}
        </Button>
        {cultivoEditando && (
          <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        )}
      </div>
    </form>
  );
}
