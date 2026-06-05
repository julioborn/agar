'use client';

import { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  LoteOpcion, DepositoOpcion, CampaniaOpcion,
  InsumoLine, LaborLine, ProduccionLine,
} from './ria-form';

const GREEN_RGB: [number, number, number] = [0, 104, 54];
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/agar6.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

interface Props {
  numeroRia: string;
  fecha: string;
  estado: string;
  empresaNombre: string;
  lotes: LoteOpcion[];
  loteId: string;
  campanias: CampaniaOpcion[];
  campaniaId: string;
  depositos: DepositoOpcion[];
  superficieAfectada: string;
  cultivoDesc: string;
  observaciones: string;
  insumos: InsumoLine[];
  labores: LaborLine[];
  produccion: ProduccionLine[];
  totalInsumos: number;
  totalLabores: number;
  totalRia: number;
  costoPerHa: number | null;
  className?: string;
}

export default function RiaPdfButton({
  numeroRia, fecha, estado, empresaNombre,
  lotes, loteId, campanias, campaniaId, depositos,
  superficieAfectada, cultivoDesc, observaciones,
  insumos, labores, produccion,
  totalInsumos, totalLabores, totalRia, costoPerHa,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const logoBase64 = await loadLogoBase64();

      const lote = lotes.find((l) => l.id === loteId);
      const campania = campanias.find((c) => c.id === campaniaId);
      const depMap = new Map(depositos.map((d) => [d.id, d.nombre]));
      const sup = parseFloat(superficieAfectada || '0');

      const doc   = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // ── Banda de encabezado ─────────────────────────────────────────────────
      doc.setFillColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
      doc.rect(0, 0, pageW, 34, 'F');

      if (logoBase64) doc.addImage(logoBase64, 'PNG', 8, 5, 28, 16);

      const titleX = logoBase64 ? 42 : 12;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('REMITO INTERNO AGRÍCOLA', titleX, 12);
      doc.setFontSize(11);
      doc.text(numeroRia, titleX, 20);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(190, 235, 210);
      doc.text(empresaNombre, titleX, 27);

      // Estado badge — esquina superior derecha
      const estadoLabel =
        estado === 'confirmado' ? 'CONFIRMADO' :
        estado === 'anulado'    ? 'ANULADO'    : 'BORRADOR';
      const badgeColor: [number, number, number] =
        estado === 'confirmado' ? [0, 160, 90]  :
        estado === 'anulado'    ? [210, 40, 40]  : [210, 140, 20];
      doc.setFillColor(...badgeColor);
      doc.roundedRect(pageW - 44, 9, 36, 13, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(estadoLabel, pageW - 26, 17.5, { align: 'center' });

      // ── Datos generales ─────────────────────────────────────────────────────
      let y = 40;
      const C1 = 12, C2 = 78, C3 = 144;
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8.5);

      const field = (label: string, value: string, x: number, row: number) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, x, row);
        doc.setFont('helvetica', 'normal');
        doc.text(value, x + doc.getTextWidth(label) + 2, row);
      };

      field('Fecha:', fmtDate(fecha), C1, y);
      field('Campaña:', campania?.nombre ?? '—', C2, y);
      field('Emitido:', fmtDate(new Date().toISOString().split('T')[0]), C3, y);

      y += 6;
      const loteDisplay = lote
        ? (lote.campo?.nombre ? `${lote.campo.nombre} › ${lote.nombre}` : lote.nombre)
        : '—';
      field('Lote:', loteDisplay, C1, y);
      if (sup > 0) field('Superficie:', `${sup} ha`, C2, y);
      if (cultivoDesc) field('Cultivo:', cultivoDesc, C3, y);

      if (observaciones) {
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text('Obs.:', C1, y);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(observaciones, pageW - C1 - 16);
        doc.text(lines, C1 + 14, y);
        y += Math.max(0, (lines.length - 1) * 4);
      }

      y += 4;
      doc.setDrawColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
      doc.setLineWidth(0.35);
      doc.line(12, y, pageW - 12, y);
      y += 5;

      const sectionTitle = (title: string, yPos: number) => {
        doc.setFillColor(240, 248, 244);
        doc.rect(12, yPos, pageW - 24, 7, 'F');
        doc.setTextColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 16, yPos + 4.8);
        return yPos + 9;
      };

      // ── Insumos ──────────────────────────────────────────────────────────────
      if (insumos.length > 0) {
        y = sectionTitle('INSUMOS UTILIZADOS', y);
        autoTable(doc, {
          startY: y,
          head: [['Depósito', 'Producto', 'Cantidad', 'Unidad', 'Costo/u $', 'Subtotal $']],
          body: [
            ...insumos.map((i) => [
              depMap.get(i.depositoId) ?? '—',
              i.productoNombre || '—',
              num.format(parseFloat(i.cantidad || '0')),
              i.unidadBase,
              num.format(parseFloat(i.costoUnitario || '0')),
              num.format(i.subtotal),
            ]),
            ['', '', '', '',
              { content: 'TOTAL INSUMOS', styles: { fontStyle: 'bold', halign: 'right' as const } },
              { content: `$${num.format(totalInsumos)}`, styles: { fontStyle: 'bold', halign: 'right' as const } },
            ],
          ],
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: GREEN_RGB, textColor: [255, 255, 255] as [number,number,number], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 32 },
            2: { halign: 'right' as const, cellWidth: 18 },
            3: { cellWidth: 14 },
            4: { halign: 'right' as const, cellWidth: 22 },
            5: { halign: 'right' as const, cellWidth: 24 },
          },
          alternateRowStyles: { fillColor: [240, 247, 243] as [number,number,number] },
          margin: { left: 12, right: 12 },
          tableLineColor: [210, 230, 218] as [number,number,number],
          tableLineWidth: 0.1,
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // ── Labores ──────────────────────────────────────────────────────────────
      if (labores.length > 0) {
        y = sectionTitle('LABORES / SERVICIOS', y);
        autoTable(doc, {
          startY: y,
          head: [['Tipo', 'Descripción', 'Prestador', 'Cant.', 'Unid.', 'Tarifa $', 'Subtotal $']],
          body: [
            ...labores.map((l) => [
              l.tipoLaborNombre || '—',
              l.descripcion,
              l.prestadorNombre || 'Campo propio',
              num.format(parseFloat(l.cantidad || '0')),
              l.unidadMedida,
              num.format(parseFloat(l.tarifa || '0')),
              num.format(l.subtotal),
            ]),
            ['', '', '', '', '',
              { content: 'TOTAL LABORES', styles: { fontStyle: 'bold', halign: 'right' as const } },
              { content: `$${num.format(totalLabores)}`, styles: { fontStyle: 'bold', halign: 'right' as const } },
            ],
          ],
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: GREEN_RGB, textColor: [255, 255, 255] as [number,number,number], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 24 },
            3: { halign: 'right' as const, cellWidth: 14 },
            4: { cellWidth: 12 },
            5: { halign: 'right' as const, cellWidth: 20 },
            6: { halign: 'right' as const, cellWidth: 22 },
          },
          alternateRowStyles: { fillColor: [240, 247, 243] as [number,number,number] },
          margin: { left: 12, right: 12 },
          tableLineColor: [210, 230, 218] as [number,number,number],
          tableLineWidth: 0.1,
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // ── Producción ───────────────────────────────────────────────────────────
      if (produccion.length > 0) {
        y = sectionTitle('PRODUCCIÓN DEL LOTE', y);
        autoTable(doc, {
          startY: y,
          head: [['Producto', 'Depósito destino', 'Cantidad', 'Unidad', 'Hum.%', 'Precio ref. $', 'Valor bruto $']],
          body: produccion.map((p) => {
            const cant = parseFloat(p.cantidad || '0');
            const precio = parseFloat(p.precioReferencia || '0');
            const valorBruto = cant > 0 && precio > 0 ? cant * precio : null;
            return [
              p.productoNombre || '—',
              depMap.get(p.depositoIngresoId) ?? '—',
              num.format(cant),
              p.unidadBase,
              p.humedadPorcentaje ? `${p.humedadPorcentaje}%` : '—',
              precio > 0 ? num.format(precio) : '—',
              valorBruto != null ? num.format(valorBruto) : '—',
            ];
          }),
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [0, 130, 80] as [number,number,number], textColor: [255, 255, 255] as [number,number,number], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            2: { halign: 'right' as const, cellWidth: 18 },
            3: { cellWidth: 14 },
            4: { halign: 'right' as const, cellWidth: 14 },
            5: { halign: 'right' as const, cellWidth: 22 },
            6: { halign: 'right' as const, cellWidth: 24 },
          },
          alternateRowStyles: { fillColor: [240, 247, 243] as [number,number,number] },
          margin: { left: 12, right: 12 },
          tableLineColor: [210, 230, 218] as [number,number,number],
          tableLineWidth: 0.1,
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // ── Totales ──────────────────────────────────────────────────────────────
      const totH = costoPerHa != null ? 24 : 16;
      if (y + totH > pageH - 35) { doc.addPage(); y = 15; }
      doc.setFillColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
      doc.rect(12, y, pageW - 24, totH, 'F');
      const totW = pageW - 24;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total insumos: $${num.format(totalInsumos)}`, 18, y + 7);
      doc.text(`Total labores: $${num.format(totalLabores)}`, 12 + totW / 3, y + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`COSTO TOTAL: $${num.format(totalRia)}`, 12 + (2 * totW) / 3, y + 7);
      if (costoPerHa != null) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Costo por hectárea: $${num.format(costoPerHa)}`, 12 + (2 * totW) / 3, y + 15);
      }
      y += totH + 14;

      // ── Firma ────────────────────────────────────────────────────────────────
      if (y + 28 > pageH - 16) { doc.addPage(); y = 20; }
      doc.setTextColor(60, 60, 60);
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.3);
      doc.line(12, y + 18, 80, y + 18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Firma y aclaración del operador', 12, y + 24);
      doc.line(pageW - 80, y + 18, pageW - 12, y + 18);
      doc.text('Fecha                              Sello', pageW - 80, y + 24);

      // ── Pie de página ────────────────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
        doc.setLineWidth(0.3);
        doc.line(12, pageH - 10, pageW - 12, pageH - 10);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(
          `AgroSistema  ·  ${numeroRia}  ·  ${empresaNombre}  ·  Página ${p} de ${totalPages}`,
          pageW / 2, pageH - 5.5, { align: 'center' },
        );
      }

      doc.save(`${numeroRia}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl',
        'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors',
        className,
      )}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Printer className="w-3.5 h-3.5" />}
      {loading ? 'Generando…' : 'Imprimir / PDF'}
    </button>
  );
}
