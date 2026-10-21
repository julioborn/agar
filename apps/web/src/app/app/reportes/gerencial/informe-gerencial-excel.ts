import type { InformeGerencialData } from './types';

const GREEN_HEX = '006836';
const LIGHT_HEX = 'F0F7F3';
const ARS_FMT = '"$" #,##0';
const NUM_FMT = '#,##0.00';
const PCT_FMT = '0.0"%"';

async function loadCircularLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/agar-final.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -(img.width - size) / 2, -(img.height - size) / 2);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')); };
      img.src = url;
    });
  } catch { return null; }
}

interface Col { header: string; key: string; width?: number; numFmt?: string; align?: 'left' | 'center' | 'right'; }

function addDataSheet(
  wb: any, logoBase64: string | null, name: string, title: string, subtitle: string,
  columns: Col[], rows: Record<string, any>[],
) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  if (logoBase64) {
    const logoId = wb.addImage({ base64: logoBase64.replace(/^data:image\/\w+;base64,/, ''), extension: 'png' });
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 44, height: 44 } });
  }
  ws.addRow([]); ws.getRow(1).height = 16;
  const titleRow = ws.addRow([title]); titleRow.height = 20;
  titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF' + GREEN_HEX } };
  const subRow = ws.addRow([subtitle]); subRow.height = 14;
  subRow.getCell(1).font = { size: 8.5, italic: true, color: { argb: 'FF666666' } };
  const sep = ws.addRow([]); sep.height = 6;

  columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width ?? 18; });
  if (columns.length > 1) {
    ws.mergeCells(2, 1, 2, columns.length);
    ws.mergeCells(3, 1, 3, columns.length);
  }

  const headRow = ws.addRow(columns.map((c) => c.header));
  headRow.height = 18;
  headRow.eachCell((cell: any, colNum: number) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GREEN_HEX } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 };
    cell.alignment = { vertical: 'middle', horizontal: columns[colNum - 1]?.align ?? 'left' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF004d24' } } };
  });
  ws.autoFilter = { from: { row: headRow.number, column: 1 }, to: { row: headRow.number, column: columns.length } };

  rows.forEach((row, idx) => {
    const values = columns.map((c) => row[c.key] ?? '');
    const dataRow = ws.addRow(values);
    dataRow.height = 15;
    if (idx % 2 === 1) {
      dataRow.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + LIGHT_HEX } }; });
    }
    dataRow.eachCell((cell: any, colNum: number) => {
      const col = columns[colNum - 1];
      if (col?.numFmt) cell.numFmt = col.numFmt;
      cell.alignment = { vertical: 'middle', horizontal: col?.align ?? 'left' };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD4E9DC' } } };
    });
  });

  if (rows.length === 0) {
    const emptyRow = ws.addRow(['Sin datos para este bloque.']);
    emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF999999' } };
  }

  return ws;
}

export async function exportInformeGerencialExcel(data: InformeGerencialData, filename: string): Promise<void> {
  const ExcelJS = await import('exceljs');
  const logoBase64 = await loadCircularLogoBase64();
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' });
  const subtitle = `${data.empresaNombre}  ·  Período: ${data.periodoLabel}  ·  Campaña: ${data.campaniaLabel}  ·  Generado: ${dateStr}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'AgroSistema';
  wb.created = now;

  // ── Resumen ──────────────────────────────────────────────────────────────
  const wsResumen = wb.addWorksheet('Resumen', { pageSetup: { paperSize: 9, orientation: 'portrait' } });
  if (logoBase64) {
    const logoId = wb.addImage({ base64: logoBase64.replace(/^data:image\/\w+;base64,/, ''), extension: 'png' });
    wsResumen.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 56, height: 56 } });
  }
  wsResumen.addRow([]); wsResumen.getRow(1).height = 20;
  const t = wsResumen.addRow(['Informe Gerencial']); t.height = 24;
  t.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF' + GREEN_HEX } };
  const s = wsResumen.addRow([subtitle]); s.height = 16;
  s.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF666666' } };
  wsResumen.addRow([]);
  wsResumen.getColumn(1).width = 30;
  wsResumen.getColumn(2).width = 22;

  const kpiRows: [string, string | number][] = [
    ['RIA confirmados en el período', data.kpis.riasCount],
    ['Hectáreas trabajadas', data.kpis.hectareas],
    ['Lotes distintos trabajados', data.kpis.lotesDistintos],
    ['Cultivos distintos', data.kpis.cultivosDistintos],
    ['Costo insumos', data.kpis.costoInsumos],
    ['Costo labores', data.kpis.costoLabores],
    ['Costo total', data.kpis.costoTotal],
    ['Costo por hectárea', data.kpis.costoPorHa ?? ''],
    ['Ingreso bruto', data.kpis.ingresoBruto],
    ['Margen', data.kpis.margen],
  ];
  for (const [label, value] of kpiRows) {
    const row = wsResumen.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: 'FF333333' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + LIGHT_HEX } };
    if (typeof value === 'number' && label !== 'RIA confirmados en el período' && label !== 'Lotes distintos trabajados' && label !== 'Cultivos distintos') {
      row.getCell(2).numFmt = label === 'Hectáreas trabajadas' ? NUM_FMT : ARS_FMT;
    }
    row.getCell(2).alignment = { horizontal: 'right' };
  }

  // ── Evolución por Campaña ───────────────────────────────────────────────
  addDataSheet(wb, logoBase64, 'Evolución por Campaña', 'Evolución por Campaña', subtitle, [
    { header: 'Campaña', key: 'nombre', width: 22 },
    { header: 'Hectáreas', key: 'hectareas', width: 14, numFmt: NUM_FMT, align: 'right' },
    { header: 'RIA', key: 'riasCount', width: 10, align: 'right' },
    { header: 'Costo insumos', key: 'costoInsumos', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo labores', key: 'costoLabores', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo total', key: 'costoTotal', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo / ha', key: 'costoPorHa', width: 16, numFmt: ARS_FMT, align: 'right' },
    { header: 'Ingreso bruto', key: 'ingresoBruto', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Margen', key: 'margen', width: 18, numFmt: ARS_FMT, align: 'right' },
  ], data.porCampania);

  // ── Por Cultivo ──────────────────────────────────────────────────────────
  addDataSheet(wb, logoBase64, 'Por Cultivo', 'Por Cultivo', subtitle, [
    { header: 'Cultivo', key: 'cultivo', width: 22 },
    { header: 'Hectáreas', key: 'hectareas', width: 14, numFmt: NUM_FMT, align: 'right' },
    { header: 'Lotes', key: 'lotesCount', width: 10, align: 'right' },
    { header: 'Costo insumos', key: 'costoInsumos', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo labores', key: 'costoLabores', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo total', key: 'costoTotal', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo / ha', key: 'costoPorHa', width: 16, numFmt: ARS_FMT, align: 'right' },
    { header: 'Ingreso bruto', key: 'ingresoBruto', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Margen', key: 'margen', width: 18, numFmt: ARS_FMT, align: 'right' },
  ], data.porCultivo);

  // ── Por Lote ─────────────────────────────────────────────────────────────
  addDataSheet(wb, logoBase64, 'Por Lote', 'Por Lote', subtitle, [
    { header: 'Campo', key: 'campoNombre', width: 20 },
    { header: 'Lote', key: 'loteNombre', width: 20 },
    { header: 'Hectáreas', key: 'hectareas', width: 14, numFmt: NUM_FMT, align: 'right' },
    { header: 'Cultivo(s)', key: 'cultivos', width: 26 },
    { header: 'RIA', key: 'riasCount', width: 10, align: 'right' },
    { header: 'Costo insumos', key: 'costoInsumos', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo labores', key: 'costoLabores', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo total', key: 'costoTotal', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Costo / ha', key: 'costoPorHa', width: 16, numFmt: ARS_FMT, align: 'right' },
    { header: 'Ingreso bruto', key: 'ingresoBruto', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: 'Margen', key: 'margen', width: 18, numFmt: ARS_FMT, align: 'right' },
  ], data.porLote);

  // ── Insumos ──────────────────────────────────────────────────────────────
  addDataSheet(wb, logoBase64, 'Insumos', 'Insumos', subtitle, [
    { header: 'Insumo', key: 'nombre', width: 28 },
    { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Unidad', key: 'unidadBase', width: 10 },
    { header: 'Cantidad total', key: 'cantidadTotal', width: 16, numFmt: NUM_FMT, align: 'right' },
    { header: 'Costo total', key: 'costoTotal', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: '% del total', key: 'pctTotal', width: 12, numFmt: PCT_FMT, align: 'right' },
    { header: 'Lotes', key: 'lotesCount', width: 10, align: 'right' },
  ], data.insumos);

  // ── Labores ──────────────────────────────────────────────────────────────
  addDataSheet(wb, logoBase64, 'Labores', 'Labores', subtitle, [
    { header: 'Labor', key: 'nombre', width: 28 },
    { header: 'Cantidad total', key: 'cantidadTotal', width: 16, numFmt: NUM_FMT, align: 'right' },
    { header: 'Unidad', key: 'unidad', width: 10 },
    { header: 'Costo total', key: 'costoTotal', width: 18, numFmt: ARS_FMT, align: 'right' },
    { header: '% del total', key: 'pctTotal', width: 12, numFmt: PCT_FMT, align: 'right' },
    { header: 'RIA', key: 'riasCount', width: 10, align: 'right' },
    { header: 'Tarifa promedio', key: 'tarifaPromedio', width: 16, numFmt: ARS_FMT, align: 'right' },
  ], data.labores);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
