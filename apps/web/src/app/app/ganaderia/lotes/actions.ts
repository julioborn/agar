'use server';

import { createClient } from '@/lib/supabase/server';

// Calca recalcularCostoDirecto (src/app/app/cultivos/actions.ts) para el lado
// ganadero: suma el costo de los remitos ganaderos confirmados de un lote de
// hacienda y lo deja en lotes_hacienda.costo_directo_ars.
export async function recalcularCostoLoteHacienda(loteHaciendaId: string) {
  const supabase = await createClient();

  const { data: remitosIds } = await supabase
    .from('remitos_ganaderos')
    .select('id')
    .eq('lote_hacienda_id', loteHaciendaId)
    .eq('estado', 'confirmado');

  let costoInsumos = 0;
  if (remitosIds && remitosIds.length > 0) {
    const ids = remitosIds.map((r: any) => r.id);
    const { data: insumos } = await supabase
      .from('remitos_ganaderos_insumos')
      .select('subtotal')
      .in('remito_id', ids);
    costoInsumos = (insumos ?? []).reduce((acc: number, i: any) => acc + Number(i.subtotal ?? 0), 0);
  }

  await supabase.from('lotes_hacienda').update({ costo_directo_ars: costoInsumos }).eq('id', loteHaciendaId);
  return costoInsumos;
}
