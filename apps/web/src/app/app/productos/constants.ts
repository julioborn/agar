export const CATEGORIAS = [
  { value: 'fertilizante',   label: 'Fertilizante' },
  { value: 'semilla',        label: 'Semilla' },
  { value: 'agroquimico',    label: 'Agroquímico' },
  { value: 'combustible',    label: 'Combustible' },
  { value: 'insumo_cosecha', label: 'Insumo cosecha' },
  { value: 'inoculante',     label: 'Inoculante' },
  { value: 'otro',           label: 'Otro' },
] as const;

export const UNIDADES = [
  { value: 'kg',     label: 'kg (kilogramos)' },
  { value: 'tn',     label: 'tn (toneladas)' },
  { value: 'L',      label: 'L (litros)' },
  { value: 'sobres', label: 'Sobres/Bolsas' },
  { value: 'unidad', label: 'Unidad' },
] as const;
