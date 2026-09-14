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
    { header: 'Dirección', key: 'direccion', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: `Cantidad (${unidad})`, key: 'cantidad', width: 14, align: 'right', format: (v: number) => nFmt.format(v) },
    { header: 'Depósito', key: 'deposito', width: 18 },
    { header: 'Detalle', key: 'detalle', width: 30 },
    { header: `Saldo antes (${unidad})`, key: 'saldo', width: 16, align: 'right', format: (v: number) => nFmt.format(v) },
  ];

  return <ExportButtons data={data} columns={columns} filename={filename} title={title} />;
}
