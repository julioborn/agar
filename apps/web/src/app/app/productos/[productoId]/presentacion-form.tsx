'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface PresentacionRow {
  id: string;
  producto_id: string;
  descripcion: string;
  factor_a_unidad_base: number;
}

interface Props {
  productoId: string;
  unidadBase: string;
  presentacionEditando: PresentacionRow | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PresentacionForm({
  productoId,
  unidadBase,
  presentacionEditando,
  onSuccess,
  onCancel,
}: Props) {
  const [descripcion, setDescripcion] = useState('');
  const [factor, setFactor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDescripcion(presentacionEditando?.descripcion ?? '');
    setFactor(presentacionEditando?.factor_a_unidad_base?.toString() ?? '');
    setError(null);
  }, [presentacionEditando]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim() || !factor) return;

    const factorNum = parseFloat(factor);
    if (isNaN(factorNum) || factorNum <= 0) {
      setError('El factor debe ser un número positivo.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      descripcion: descripcion.trim(),
      factor_a_unidad_base: factorNum,
    };

    const { error: dbError } = presentacionEditando
      ? await supabase.from('presentaciones').update(payload).eq('id', presentacionEditando.id)
      : await supabase.from('presentaciones').insert({ ...payload, producto_id: productoId });

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      if (!presentacionEditando) {
        setDescripcion('');
        setFactor('');
      }
      onSuccess();
    }
  }

  const esEdicion = presentacionEditando !== null;

  return (
    <div>
      <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
        {esEdicion
          ? <><Pencil className="w-4 h-4" />Editar presentación</>
          : <><Plus className="w-4 h-4" />Nueva presentación</>}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="pres-descripcion"
          label="Descripción"
          placeholder={`Ej: Bolsa 50 ${unidadBase}`}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          disabled={loading}
        />

        <Input
          id="pres-factor"
          label={`Factor en ${unidadBase} por unidad de presentación`}
          type="number"
          step="0.0001"
          min="0.0001"
          placeholder={`Ej: 50 (si son 50 ${unidadBase})`}
          value={factor}
          onChange={(e) => setFactor(e.target.value)}
          required
          disabled={loading}
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear presentación'}
          </Button>
          {esEdicion && (
            <Button type="button" variant="secondary" disabled={loading} onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
