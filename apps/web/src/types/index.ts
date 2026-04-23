// Tipos base del modelo. Se pueden regenerar desde Supabase con:
// npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Rol = 'super_admin' | 'admin_empresa' | 'contador' | 'encargado_campo';

export interface Empresa {
  id: string;
  nombre: string;
  cuit: string;
  subdominio?: string;
  logo_url?: string;
  moneda_base: string;
  fecha_alta: string;
  created_at: string;
}

export interface UsuarioEmpresa {
  id: string;
  usuario_id: string;
  empresa_id: string;
  rol: Rol;
  campo_id_asignado?: string;
}

export interface Campo {
  id: string;
  empresa_id: string;
  nombre: string;
  hectareas_totales?: number;
  ubicacion?: { type: 'Point'; coordinates: [number, number] };
}

export interface Lote {
  id: string;
  campo_id: string;
  nombre: string;
  hectareas: number;
  poligono?: { type: 'Polygon'; coordinates: number[][][] };
}

export interface Producto {
  id: string;
  empresa_id: string;
  nombre: string;
  categoria: 'fertilizante' | 'semilla' | 'agroquimico' | 'combustible' | 'insumo_cosecha' | 'inoculante' | 'otro';
  unidad_base: 'kg' | 'L' | 'unidad';
  codigo_barras?: string;
  codigo_interno?: string;
  stock_minimo: number;
  requiere_trazabilidad: boolean;
}

export interface Stock {
  id: string;
  deposito_id: string;
  producto_id: string;
  cantidad_actual: number;
}

export type TipoMovimiento =
  | 'entrada_compra'
  | 'salida_aplicacion'
  | 'entrada_devolucion'
  | 'transferencia_entrada'
  | 'transferencia_salida'
  | 'merma'
  | 'ajuste';

export interface MovimientoStock {
  id: string;
  deposito_id: string;
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  fecha: string;
  usuario_id?: string;
  referencia_tipo?: string;
  referencia_id?: string;
  observaciones?: string;
}
