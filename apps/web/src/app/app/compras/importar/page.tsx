import { redirect } from 'next/navigation';
import { FileUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmpresaActiva } from '@/lib/empresa-actual';
import ImportarFacturaFlow from './importar-form';

export default async function ImportarFacturaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const empresaData = await getEmpresaActiva();
  if (!empresaData) redirect('/login');

  const [provRes, prodRes, presRes, depRes, codRes] = await Promise.all([
    supabase.from('proveedores').select('id, nombre, cuit').order('nombre'),
    supabase.from('productos').select('id, nombre, categoria, unidad_base, principio_activo').order('nombre'),
    supabase.from('presentaciones').select('id, producto_id, descripcion, factor_a_unidad_base'),
    supabase.from('depositos').select('id, nombre').order('nombre'),
    supabase.from('codigos_proveedor').select('nombre_en_factura, producto_id, proveedor_id, codigo_externo'),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#006836]/10 flex items-center justify-center">
          <FileUp className="w-5 h-5 text-[#006836]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Importar factura</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Subí un PDF o Excel para cargar una compra automáticamente · {empresaData.empresa.nombre}
          </p>
        </div>
      </div>

      <ImportarFacturaFlow
        proveedores={provRes.data ?? []}
        productos={prodRes.data ?? []}
        presentaciones={presRes.data ?? []}
        depositos={depRes.data ?? []}
        codigosProveedor={codRes.data ?? []}
        empresaId={empresaData.empresa.id}
      />
    </div>
  );
}
