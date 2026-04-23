'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (val: any) => string;
}

interface Props {
  data: Record<string, any>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  className?: string;
}

export default function ExportButtons({ data, columns, filename, title, className }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  async function exportExcel() {
    setLoadingXlsx(true);
    try {
      const XLSX = await import('xlsx');
      const rows = data.map((row) =>
        Object.fromEntries(
          columns.map((col) => [
            col.header,
            col.format ? col.format(row[col.key]) : (row[col.key] ?? ''),
          ])
        )
      );
      const ws = XLSX.utils.json_to_sheet(rows);
      // Ajustar anchos de columna
      ws['!cols'] = columns.map((col) => ({ wch: col.width ?? 20 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } finally {
      setLoadingXlsx(false);
    }
  }

  async function exportPdf() {
    setLoadingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      if (title) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, 16);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(
          `Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}  ·  ${data.length} registros`,
          14, 22
        );
        doc.setTextColor(0);
      }

      autoTable(doc, {
        startY: title ? 26 : 14,
        head: [columns.map((c) => c.header)],
        body: data.map((row) =>
          columns.map((col) =>
            col.format ? col.format(row[col.key]) : (row[col.key] ?? '')
          )
        ),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 80, 40], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 248] },
        margin: { left: 14, right: 14 },
      });

      doc.save(`${filename}.pdf`);
    } finally {
      setLoadingPdf(false);
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={exportExcel}
        disabled={loadingXlsx || data.length === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loadingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        Excel
      </button>
      <button
        onClick={exportPdf}
        disabled={loadingPdf || data.length === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        PDF
      </button>
    </div>
  );
}
