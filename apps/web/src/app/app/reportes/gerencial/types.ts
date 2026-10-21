// Formas agregadas que comparten el reporte en pantalla y los generadores de PDF/Excel.

export interface KpiData {
  riasCount: number;
  hectareas: number;
  costoInsumos: number;
  costoLabores: number;
  costoTotal: number;
  costoPorHa: number | null;
  lotesDistintos: number;
  cultivosDistintos: number;
  ingresoBruto: number;
  margen: number;
}

export interface CampaniaAgg {
  nombre: string;
  hectareas: number;
  costoInsumos: number;
  costoLabores: number;
  costoTotal: number;
  costoPorHa: number | null;
  ingresoBruto: number;
  margen: number;
  riasCount: number;
}

export interface CultivoAgg {
  cultivo: string;
  hectareas: number;
  costoInsumos: number;
  costoLabores: number;
  costoTotal: number;
  costoPorHa: number | null;
  ingresoBruto: number;
  margen: number;
  lotesCount: number;
  riasCount: number;
}

export interface LoteAgg {
  loteNombre: string;
  campoNombre: string;
  hectareas: number;
  cultivos: string;
  riasCount: number;
  costoInsumos: number;
  costoLabores: number;
  costoTotal: number;
  costoPorHa: number | null;
  ingresoBruto: number;
  margen: number;
}

export interface InsumoAgg {
  nombre: string;
  categoria: string;
  unidadBase: string;
  cantidadTotal: number;
  costoTotal: number;
  pctTotal: number;
  lotesCount: number;
}

export interface LaborAgg {
  nombre: string;
  cantidadTotal: number;
  unidad: string;
  costoTotal: number;
  pctTotal: number;
  riasCount: number;
  tarifaPromedio: number | null;
}

export interface InformeGerencialData {
  empresaNombre: string;
  periodoLabel: string;
  campaniaLabel: string;
  kpis: KpiData;
  porCampania: CampaniaAgg[];
  porCultivo: CultivoAgg[];
  porLote: LoteAgg[];
  insumos: InsumoAgg[];
  labores: LaborAgg[];
}
