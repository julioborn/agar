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

// ── RIA (Remito Interno Agrícola) ──────────────────────────────────────────────

export type EstadoRia = 'borrador' | 'confirmado' | 'anulado';
export type UnidadLaborRia = 'has' | 'hs' | 'tn' | 'viaje' | 'global' | 'km';

export interface RemitoInterno {
  id: string;
  empresa_id: string;
  numero_ria: string;
  numero_anio: number;
  numero_correlativo: number;
  fecha: string;
  operador_id?: string;
  lote_id: string;
  campania_id?: string;
  cultivo_id?: string;
  superficie_afectada?: number;
  cultivo_descripcion?: string;
  estado: EstadoRia;
  total_insumos: number;
  total_labores: number;
  total_ria: number;
  costo_por_ha?: number;
  motivo_anulacion?: string;
  anulado_por?: string;
  fecha_anulacion?: string;
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

export interface RemitoInsumo {
  id: string;
  remito_id: string;
  deposito_id: string;
  producto_id: string;
  cantidad: number;
  dosis_por_ha?: number;
  costo_unitario: number;
  costo_unitario_manual: boolean;
  subtotal: number;
  observaciones?: string;
}

export interface RemitoLabor {
  id: string;
  remito_id: string;
  tipo_labor_id?: string;
  tipo_labor_nombre?: string;
  descripcion: string;
  prestador_id?: string;
  prestador_nombre?: string;
  unidad_medida: UnidadLaborRia;
  cantidad: number;
  tarifa: number;
  subtotal: number;
  fecha_ejecucion?: string;
  observaciones?: string;
}

export interface RemitoProduccion {
  id: string;
  remito_id: string;
  producto_id: string;
  deposito_ingreso_id: string;
  cantidad: number;
  rendimiento_por_ha?: number;
  humedad_porcentaje?: number;
  calidad_categoria?: string;
  precio_referencia?: number;
  subtotal_valor?: number;
  costo_produccion_unitario?: number;
  observaciones?: string;
}
