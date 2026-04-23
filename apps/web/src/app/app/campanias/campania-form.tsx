'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CampaniaRow {
  id: string;
  lote_id: string;
  unidad_negocio_id: string;
  cultivo: string;
  fecha_siembra: string;
  fecha_cosecha_estimada: string | null;
  fecha_cosecha_real: string | null;
  estado: 'planificada' | 'en_curso' | 'cosechada' | 'cancelada';
  observaciones: string | null;
}

export interface LoteConCampo {
  id: string;
  nombre: string;
  campo_nombre: string;
}

export interface UnidadNegocio {
  id: string;
  nombre: string;
}

const ESTADOS = [
  { value: 'planificada', label: 'Planificada' },
  { value: 'en_curso',    label: 'En curso' },
  { value: 'cosechada',   label: 'Cosechada' },
  { value: 'cancelada',   label: 'Cancelada' },
] as const;

interface Props {
  lotes: LoteConCampo[];
  unidadesNegocio: UnidadNegocio[];
  campaniaEditando: CampaniaRow | null;
  defaultLoteId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CampaniaForm({
  lotes,
  unidadesNegocio,
  campaniaEditando,
  defaultLoteId,
  onSuccess,
  onCancel,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loteId, setLoteId] = useState('');
  const [unidadNegocioId, setUnidadNegocioId] = useState('');
  const [cultivo, setCultivo] = useState('');
  const [fechaSiembra, setFechaSiembra] = useState('');
  const [fechaCosechaEstimada, setFechaCosechaEstimada] = useState('');
  const [fechaCosechaReal, setFechaCosechaReal] = useState('');
  const [estado, setEstado] = useState<CampaniaRow['estado']>('planificada');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (campaniaEditando) {
      setLoteId(campaniaEditando.lote_id);
      setUnidadNegocioId(campaniaEditando.unidad_negocio_id);
      setCultivo(campaniaEditando.cultivo);
      setFechaSiembra(campaniaEditando.fecha_siembra);
      setFechaCosechaEstimada(campaniaEditando.fecha_cosecha_estimada ?? '');
      setFechaCosechaReal(campaniaEditando.fecha_cosecha_real ?? '');
      setEstado(campaniaEditando.estado);
      setObservaciones(campaniaEditando.observaciones ?? '');
    } else {
      setLoteId(defaultLoteId ?? (lotes[0]?.id ?? ''));
      setUnidadNegocioId(unidadesNegocio[0]?.id ?? '');
      setCultivo('');
      setFechaSiembra('');
      setFechaCosechaEstimada('');
      setFechaCosechaReal('');
      setEstado('planificada');
      setObservaciones('');
    }
    setError('');
  }, [campaniaEditando, defaultLoteId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!loteId || !unidadNegocioId || !cultivo.trim() || !fechaSiembra) {
      setError('Completá lote, unidad de negocio, cultivo y fecha de siembra.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const payload = {
      lote_id: loteId,
      unidad_negocio_id: unidadNegocioId,
      cultivo: cultivo.trim(),
      fecha_siembra: fechaSiembra,
      fecha_cosecha_estimada: fechaCosechaEstimada || null,
      fecha_cosecha_real: fechaCosechaReal || null,
      estado,
      observaciones: observaciones.trim() || null,
    };

    let err;
    if (campaniaEditando) {
      ({ error: err } = await supabase.from('campanias').update(payload).eq('id', campaniaEditando.id));
    } else {
      ({ error: err } = await supabase.from('campanias').insert(payload));
    }

    setLoading(false);
    if (err) { setError(err.message); return; }
    onSuccess();
  }

  const titulo = campaniaEditando ? 'Editar campaña' : 'Nueva campaña';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold text-slate-700">{titulo}</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Lote</label>
        <select
          value={loteId}
          onChange={(e) => setLoteId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Seleccioná un lote…</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.campo_nombre} › {l.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Unidad de negocio</label>
        <select
          value={unidadNegocioId}
          onChange={(e) => setUnidadNegocioId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Seleccioná una unidad…</option>
          {unidadesNegocio.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
      </div>

      <Input
        label="Cultivo"
        value={cultivo}
        onChange={(e) => setCultivo(e.target.value)}
        placeholder="Ej: Soja, Maíz, Trigo…"
      />

      <Input
        label="Fecha de siembra"
        type="date"
        value={fechaSiembra}
        onChange={(e) => setFechaSiembra(e.target.value)}
      />

      <Input
        label="Fecha cosecha estimada"
        type="date"
        value={fechaCosechaEstimada}
        onChange={(e) => setFechaCosechaEstimada(e.target.value)}
      />

      <Input
        label="Fecha cosecha real"
        type="date"
        value={fechaCosechaReal}
        onChange={(e) => setFechaCosechaReal(e.target.value)}
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as CampaniaRow['estado'])}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {ESTADOS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          placeholder="Opcional…"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Guardando…' : campaniaEditando ? 'Guardar cambios' : 'Crear campaña'}
        </Button>
        {campaniaEditando && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
