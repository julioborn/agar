import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import NuevaCompraForm from './nueva-compra-form';

export default async function NuevaCompraPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  // Cargar datos de referencia para el formulario (en paralelo)
  const [provRes, prodRes, presRes, depRes] = await Promise.all([
    supabase.from('proveedores').select('id, nombre').order('nombre'),
    supabase.from('productos').select('id, nombre, unidad_base').order('nombre'),
    supabase.from('presentaciones').select('id, producto_id, descripcion, factor_a_unidad_base'),
    supabase.from('depositos').select('id, nombre').order('nombre'),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva compra</h1>
        <p className="text-sm text-slate-500 mt-1">
          Al confirmar, el stock se actualiza automáticamente en el depósito seleccionado.
        </p>
      </div>

      <NuevaCompraForm
        proveedores={provRes.data ?? []}
        productos={prodRes.data ?? []}
        presentaciones={(presRes.data ?? []) as any}
        depositos={depRes.data ?? []}
      />
    </div>
  );
}
