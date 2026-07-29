export const CATEGORIAS = [
  { value: 'fertilizante',    label: 'Fertilizante' },
  { value: 'semilla',         label: 'Semilla' },
  { value: 'agroquimico',     label: 'Agroquímico' },
  { value: 'combustible',     label: 'Combustible' },
  { value: 'insumo_cosecha',  label: 'Insumo cosecha' },
  { value: 'inoculante',      label: 'Inoculante' },
  { value: 'produccion',      label: 'Producción' },
  { value: 'veterinario',     label: 'Veterinario' },
  { value: 'nucleo_proteico', label: 'Núcleo proteico' },
  { value: 'sal_mineral',     label: 'Sal mineral' },
  { value: 'otro',            label: 'Otro' },
] as const;

export const RUBROS = [
  { value: 'agricultura', label: 'Agricultura' },
  { value: 'ganaderia',   label: 'Ganadería' },
] as const;

// Categorías que por defecto pertenecen al rubro Ganadería al crear un producto nuevo.
const CATEGORIAS_GANADERAS = new Set(['veterinario', 'nucleo_proteico', 'sal_mineral']);
export function inferirRubro(categoria: string): 'agricultura' | 'ganaderia' {
  return CATEGORIAS_GANADERAS.has(categoria) ? 'ganaderia' : 'agricultura';
}

export const UNIDADES = [
  { value: 'kg',     label: 'kg (kilogramos)' },
  { value: 'tn',     label: 'tn (toneladas)' },
  { value: 'L',      label: 'L (litros)' },
  { value: 'sobres', label: 'Sobres/Bolsas' },
  { value: 'unidad', label: 'Unidad' },
] as const;
