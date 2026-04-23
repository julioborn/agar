import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import NuevaAplicacionForm from './nueva-aplicacion-form';

interface Props {
  params: Promise<{ campaniaId: string }>;
}

export default async function NuevaAplicacionPage({ params }: Props) {
  const { campaniaId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  // Tras migración 008 la tabla se llama "cultivos"
  const { data: cultivo } = await supabase
    .from('cultivos')
    .select('id, cultivo, estado, lote:lotes(nombre)')
    .eq('id', campaniaId)
    .single();

  if (!cultivo) notFound();

  const [prodRes, depRes, preciosRes] = await Promise.all([
    supabase.from('productos').select('id, nombre, unidad_base').order('nombre'),
    supabase.from('depositos').select('id, nombre').order('nombre'),
    // Último precio de compra por producto+depósito (compras confirmadas, más reciente primero)
    supabase
      .from('compras_items')
      .select('producto_id, deposito_destino_id, precio_unitario_ars, compra:compras!inner(fecha, estado)')
      .eq('compra.estado', 'confirmada')
      .order('fecha', { referencedTable: 'compras', ascending: false }),
  ]);

  // Construir mapa producto_id:deposito_id → último precio ARS
  const preciosMap: Record<string, number> = {};
  for (const row of (preciosRes.data ?? []) as any[]) {
    const key = `${row.producto_id}:${row.deposito_destino_id}`;
    if (!(key in preciosMap)) {
      preciosMap[key] = Number(row.precio_unitario_ars);
    }
  }
  // También mapa por solo producto_id (para cuando no hay depósito seleccionado aún)
  const preciosPorProducto: Record<string, number> = {};
  for (const row of (preciosRes.data ?? []) as any[]) {
    if (!(row.producto_id in preciosPorProducto)) {
      preciosPorProducto[row.producto_id] = Number(row.precio_unitario_ars);
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/app/cultivos" className="hover:text-slate-800 transition-colors">Cultivos</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/app/cultivos/${campaniaId}`} className="hover:text-slate-800 transition-colors">
          {cultivo.cultivo}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-800 font-medium">Nueva aplicación</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva aplicación</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cultivo: <span className="font-medium">{cultivo.cultivo}</span>
          {(cultivo.lote as any)?.nombre && (
            <> · Lote: <span className="font-medium">{(cultivo.lote as any).nombre}</span></>
          )}
        </p>
      </div>

      <NuevaAplicacionForm
        campaniaId={campaniaId}
        productos={prodRes.data ?? []}
        depositos={depRes.data ?? []}
        preciosMap={preciosMap}
        preciosPorProducto={preciosPorProducto}
        todayISO={todayISO}
      />
    </div>
  );
}
