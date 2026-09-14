'use client';

import ExportButtons, { ExportColumn } from '@/components/export-buttons';

interface Props {
  data: Record<string, any>[];
  unidad: string;
  filename: string;
  title: string;
}

const nFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });

export default function HistorialExportButton({ data, unidad, filename, title }: Props) {
  const columns: ExportColumn[] = [
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: `Cantidad (${unidad})`, key: 'cantidad', width: 14, align: 'right', format: (v: number) => nFmt.format(v), total: true },
    { header: 'Depósito', key: 'deposito', width: 18 },
    { header: 'Detalle', key: 'detalle', width: 30 },
    { header: `Saldo antes (${unidad})`, key: 'saldo', width: 16, align: 'right', format: (v: number) => nFmt.format(v) },
  ];

  const entradas = data.filter((d) => d.direccion === 'Entrada');
  const salidas  = data.filter((d) => d.direccion === 'Salida');

  return (
    <ExportButtons
      sections={[
        { title: `Entradas (${entradas.length})`, data: entradas, columns },
        { title: `Salidas (${salidas.length})`, data: salidas, columns },
      ]}
      filename={filename}
      title={title}
    />
  );
}
