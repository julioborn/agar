'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency-context';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (val: any) => string;
  align?: 'left' | 'center' | 'right';
}

interface Props {
  data: Record<string, any>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  className?: string;
}

const GREEN_HEX  = '006836';
const GREEN_RGB  = [0, 104, 54] as const;
const LIGHT_HEX  = 'F0F7F3';
const TZ = 'America/Argentina/Buenos_Aires';
const DATE_FMT   = (d: Date) =>
  d.toLocaleDateString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const TIME_FMT   = (d: Date) =>
  d.toLocaleTimeString('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/agar-final.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function ExportButtons({ data, columns, filename, title, className }: Props) {
  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const [loadingPdf,  setLoadingPdf]  = useState(false);
  const { currency } = useCurrency();

  const now      = new Date();
  const dateStr  = DATE_FMT(now);
  const timeStr  = TIME_FMT(now);
  const metaLine = `Moneda: ${currency}   ·   ${data.length} registros   ·   Generado: ${dateStr} ${timeStr}`;
  const docTitle = title ?? filename;

  /* ── EXCEL ─────────────────────────────────────────────────────────────── */
  async function exportExcel() {
    setLoadingXlsx(true);
    try {
      const ExcelJS    = await import('exceljs');
      const logoBase64 = await loadLogoBase64();

      const wb = new ExcelJS.Workbook();
      wb.creator  = 'AgroSistema';
      wb.created  = now;

      const ws = wb.addWorksheet('Datos', {
        views: [{ state: 'frozen', ySplit: 6 }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      });

      /* Logo (rows 1-3) */
      if (logoBase64) {
        const logoId = wb.addImage({ base64: logoBase64.replace(/^data:image\/\w+;base64,/, ''), extension: 'png' });
        ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 56, height: 56 } });
      }
      ws.addRow([]); // row 1
      ws.addRow([]); // row 2
      ws.getRow(1).height = 20;
      ws.getRow(2).height = 20;

      /* Row 3: Título */
      const titleRow = ws.addRow([docTitle]);
      titleRow.height = 22;
      const titleCell = titleRow.getCell(1);
      titleCell.value = docTitle;
      titleCell.font  = { bold: true, size: 15, color: { argb: 'FF' + GREEN_HEX } };

      /* Row 4: Meta */
      const metaRow  = ws.addRow([metaLine]);
      metaRow.height = 14;
      metaRow.getCell(1).font  = { size: 8.5, italic: true, color: { argb: 'FF666666' } };

      /* Row 5: separador */
      const sepRow = ws.addRow([]);
      sepRow.height = 6;

      /* Row 6: Encabezados */
      const headRow = ws.addRow(columns.map(c => c.header));
      headRow.height = 20;
      headRow.eachCell((cell, colNum) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GREEN_HEX } };
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 };
        cell.alignment = { vertical: 'middle', horizontal: columns[colNum - 1]?.align ?? 'left', wrapText: false };
        cell.border    = { bottom: { style: 'medium', color: { argb: 'FF004d24' } } };
      });

      /* Anchos de columna */
      columns.forEach((col, i) => { ws.getColumn(i + 1).width = col.width ?? 20; });

      /* Mergear título y meta */
      const colCount = columns.length;
      if (colCount > 1) {
        ws.mergeCells(3, 1, 3, colCount);
        ws.mergeCells(4, 1, 4, colCount);
      }

      /* Auto-filter */
      ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: colCount } };

      /* Filas de datos */
      data.forEach((row, idx) => {
        const values  = columns.map(col => {
          const val = row[col.key];
          return col.format ? col.format(val) : (val ?? '');
        });
        const dataRow = ws.addRow(values);
        dataRow.height = 15;

        if (idx % 2 === 1) {
          dataRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + LIGHT_HEX } };
          });
        }
        dataRow.eachCell((cell, colNum) => {
          cell.alignment = { vertical: 'middle', horizontal: columns[colNum - 1]?.align ?? 'left' };
          cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD4E9DC' } } };
        });
      });

      /* Fila de pie */
      ws.addRow([]);
      const footRow = ws.addRow([`AgroSistema  ·  ${docTitle}  ·  ${dateStr}`]);
      if (colCount > 1) ws.mergeCells(footRow.number, 1, footRow.number, colCount);
      footRow.getCell(1).font  = { size: 8, italic: true, color: { argb: 'FF999999' } };
      footRow.getCell(1).alignment = { horizontal: 'right' };

      /* Descargar */
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement('a');
      a.href       = url;
      a.download   = `${filename}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoadingXlsx(false);
    }
  }

  /* ── PDF ────────────────────────────────────────────────────────────────── */
  async function exportPdf() {
    setLoadingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable          = (await import('jspdf-autotable')).default;
      const logoBase64         = await loadLogoBase64();

      const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      /* Banda verde de encabezado */
      doc.setFillColor(...GREEN_RGB);
      doc.rect(0, 0, pageW, 30, 'F');

      /* Logo */
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 8, 4, 18, 18);
      }

      /* Título */
      const textX = logoBase64 ? 54 : 12;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text(docTitle, textX, 13);

      /* Meta */
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(190, 235, 210);
      doc.text(metaLine, textX, 21);

      /* Tabla */
      autoTable(doc, {
        startY: 35,
        head:   [columns.map(c => c.header)],
        body:   data.map(row =>
          columns.map(col =>
            col.format ? col.format(row[col.key]) : (row[col.key] ?? '')
          )
        ),
        styles: {
          fontSize:    8,
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          overflow:    'linebreak',
        },
        headStyles: {
          fillColor:  [...GREEN_RGB],
          textColor:  [255, 255, 255],
          fontStyle:  'bold',
          fontSize:   8.5,
          minCellHeight: 9,
        },
        alternateRowStyles: { fillColor: [240, 247, 243] },
        margin:             { left: 10, right: 10, bottom: 14 },
        tableLineColor:     [210, 230, 218],
        tableLineWidth:     0.1,
      });

      /* Pie de página en todas las páginas */
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        /* Línea separadora */
        doc.setDrawColor(...GREEN_RGB);
        doc.setLineWidth(0.3);
        doc.line(10, pageH - 9, pageW - 10, pageH - 9);
        /* Texto */
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140);
        doc.text(
          `AgroSistema  ·  ${docTitle}  ·  Página ${p} de ${totalPages}  ·  ${dateStr}`,
          pageW / 2, pageH - 5,
          { align: 'center' }
        );
      }

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
