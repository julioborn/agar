import type { InformeGerencialData } from './types';

const GREEN_RGB: [number, number, number] = [0, 104, 54];
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const money = (v: number) => `$${num.format(Math.round(v))}`;

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

function truncate(s: string, max = 34) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export async function generateInformeGerencialPdf(data: InformeGerencialData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const logoBase64 = await loadCircularLogoBase64();

  const doc = new (jsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 12;

  // ── Encabezado ─────────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN_RGB);
  doc.rect(0, 0, pageW, 30, 'F');
  if (logoBase64) doc.addImage(logoBase64, 'PNG', 8, 4, 18, 18);
  const textX = logoBase64 ? 30 : 12;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME GERENCIAL', textX, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 235, 210);
  doc.text(`${data.empresaNombre}  ·  Período: ${data.periodoLabel}  ·  Campaña: ${data.campaniaLabel}`, textX, 21);

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' });

  // ── Banner de resumen ejecutivo (KPIs) ───────────────────────────────────
  let y = 36;
  const bannerH = 24;
  doc.setFillColor(240, 248, 244);
  doc.setDrawColor(...GREEN_RGB);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, bannerH, 'FD');

  const k = data.kpis;
  const kpiItems: [string, string][] = [
    ['RIA confirmados', num.format(k.riasCount)],
    ['Hectáreas trabajadas', `${num.format(k.hectareas)} ha`],
    ['Lotes distintos', num.format(k.lotesDistintos)],
    ['Cultivos distintos', num.format(k.cultivosDistintos)],
    ['Costo insumos', money(k.costoInsumos)],
    ['Costo labores', money(k.costoLabores)],
    ['Costo total', money(k.costoTotal)],
    ['Costo / ha', k.costoPorHa != null ? money(k.costoPorHa) : '—'],
    ['Ingreso bruto', money(k.ingresoBruto)],
    ['Margen', money(k.margen)],
  ];
  const cols = 5;
  const cellW = (pageW - MARGIN * 2) / cols;
  kpiItems.forEach(([label, value], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = MARGIN + col * cellW + cellW / 2;
    const cy = y + 8 + row * 12;
    doc.setTextColor(...GREEN_RGB);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(value, cx, cy, { align: 'center' });
    doc.setTextColor(90, 100, 95);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, cx, cy + 4.5, { align: 'center' });
  });
  y += bannerH + 8;

  const sectionTitle = (title: string, yPos: number) => {
    if (yPos > pageH - 40) { doc.addPage(); yPos = 18; }
    doc.setFillColor(240, 248, 244);
    doc.rect(MARGIN, yPos, pageW - MARGIN * 2, 7, 'F');
    doc.setTextColor(...GREEN_RGB);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title, MARGIN + 3, yPos + 4.8);
    return yPos + 10;
  };

  // Gráfico de barras horizontal simple, dibujado a mano (sin dependencias nuevas)
  function drawBarChart(startY: number, items: { name: string; value: number }[], color: [number, number, number]): number {
    if (items.length === 0) return startY;
    const barH = 5, gap = 2.2;
    const requiredH = items.length * (barH + gap) + 4;
    if (startY + requiredH > pageH - 16) { doc.addPage(); startY = 18; }
    const labelW = 62, valueW = 26;
    const barAreaX = MARGIN + labelW;
    const barAreaW = pageW - MARGIN * 2 - labelW - valueW;
    const maxVal = Math.max(...items.map((it) => it.value), 1);

    let yy = startY;
    doc.setFontSize(7.5);
    for (const it of items) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(truncate(it.name), MARGIN, yy + barH - 1, { align: 'left' });
      const w = Math.max(0.5, (it.value / maxVal) * barAreaW);
      doc.setFillColor(...color);
      doc.rect(barAreaX, yy, w, barH, 'F');
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'bold');
      doc.text(money(it.value), barAreaX + barAreaW + 2, yy + barH - 1, { align: 'left' });
      yy += barH + gap;
    }
    return yy + 4;
  }

  function sumNumCol(rows: Record<string, any>[], key: string) {
    return rows.reduce((s, r) => s + (typeof r[key] === 'number' ? r[key] : 0), 0);
  }

  function tableSection(
    title: string,
    chartItems: { name: string; value: number }[],
    chartColor: [number, number, number],
    head: string[],
    body: (string | number)[][],
    foot?: (string | number)[],
  ) {
    y = sectionTitle(title, y);
    y = drawBarChart(y, chartItems, chartColor);
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      foot: foot ? [foot] : undefined,
      showFoot: 'lastPage',
      styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 }, overflow: 'linebreak' },
      headStyles: { fillColor: GREEN_RGB, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: GREEN_RGB, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 247, 243] },
      margin: { left: MARGIN, right: MARGIN, bottom: 14 },
      tableLineColor: [210, 230, 218],
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Evolución por campaña ─────────────────────────────────────────────────
  tableSection(
    'EVOLUCIÓN POR CAMPAÑA',
    data.porCampania.map((c) => ({ name: c.nombre, value: c.costoTotal })),
    [0, 104, 54],
    ['Campaña', 'Hectáreas', 'RIA', 'Costo insumos', 'Costo labores', 'Costo total', 'Costo/ha', 'Ingreso bruto', 'Margen'],
    data.porCampania.map((c) => [
      c.nombre, num.format(c.hectareas), c.riasCount, money(c.costoInsumos), money(c.costoLabores),
      money(c.costoTotal), c.costoPorHa != null ? money(c.costoPorHa) : '—', money(c.ingresoBruto), money(c.margen),
    ]),
    ['TOTAL', num.format(sumNumCol(data.porCampania, 'hectareas')), sumNumCol(data.porCampania, 'riasCount'),
      money(sumNumCol(data.porCampania, 'costoInsumos')), money(sumNumCol(data.porCampania, 'costoLabores')),
      money(sumNumCol(data.porCampania, 'costoTotal')), '', money(sumNumCol(data.porCampania, 'ingresoBruto')), money(sumNumCol(data.porCampania, 'margen'))],
  );

  // ── Por cultivo ────────────────────────────────────────────────────────────
  tableSection(
    'POR CULTIVO',
    data.porCultivo.map((c) => ({ name: c.cultivo, value: c.costoPorHa ?? 0 })),
    [5, 150, 105],
    ['Cultivo', 'Hectáreas', 'Lotes', 'Costo insumos', 'Costo labores', 'Costo total', 'Costo/ha', 'Ingreso bruto', 'Margen'],
    data.porCultivo.map((c) => [
      c.cultivo, num.format(c.hectareas), c.lotesCount, money(c.costoInsumos), money(c.costoLabores),
      money(c.costoTotal), c.costoPorHa != null ? money(c.costoPorHa) : '—', money(c.ingresoBruto), money(c.margen),
    ]),
    ['TOTAL', num.format(sumNumCol(data.porCultivo, 'hectareas')), '', money(sumNumCol(data.porCultivo, 'costoInsumos')),
      money(sumNumCol(data.porCultivo, 'costoLabores')), money(sumNumCol(data.porCultivo, 'costoTotal')), '',
      money(sumNumCol(data.porCultivo, 'ingresoBruto')), money(sumNumCol(data.porCultivo, 'margen'))],
  );

  // ── Por lote ───────────────────────────────────────────────────────────────
  tableSection(
    'POR LOTE',
    data.porLote.slice(0, 10).map((l) => ({ name: `${l.campoNombre} › ${l.loteNombre}`, value: l.costoTotal })),
    [217, 119, 6],
    ['Campo', 'Lote', 'Hectáreas', 'Cultivo(s)', 'RIA', 'Costo insumos', 'Costo labores', 'Costo total', 'Costo/ha', 'Margen'],
    data.porLote.map((l) => [
      l.campoNombre, l.loteNombre, num.format(l.hectareas), truncate(l.cultivos || '—', 28), l.riasCount,
      money(l.costoInsumos), money(l.costoLabores), money(l.costoTotal), l.costoPorHa != null ? money(l.costoPorHa) : '—', money(l.margen),
    ]),
    ['TOTAL', '', num.format(sumNumCol(data.porLote, 'hectareas')), '', sumNumCol(data.porLote, 'riasCount'),
      money(sumNumCol(data.porLote, 'costoInsumos')), money(sumNumCol(data.porLote, 'costoLabores')),
      money(sumNumCol(data.porLote, 'costoTotal')), '', money(sumNumCol(data.porLote, 'margen'))],
  );

  // ── Insumos ────────────────────────────────────────────────────────────────
  tableSection(
    'INSUMOS',
    data.insumos.slice(0, 10).map((i) => ({ name: i.nombre, value: i.costoTotal })),
    [37, 99, 235],
    ['Insumo', 'Categoría', 'Cantidad', 'Costo total', '% del total', 'Lotes'],
    data.insumos.map((i) => [i.nombre, i.categoria, `${num.format(i.cantidadTotal)} ${i.unidadBase}`, money(i.costoTotal), `${num.format(i.pctTotal)}%`, i.lotesCount]),
    ['TOTAL', '', '', money(sumNumCol(data.insumos, 'costoTotal')), '100%', ''],
  );

  // ── Labores ────────────────────────────────────────────────────────────────
  tableSection(
    'LABORES',
    data.labores.slice(0, 10).map((l) => ({ name: l.nombre, value: l.costoTotal })),
    [124, 58, 237],
    ['Labor', 'Cantidad', 'Unidad', 'Costo total', '% del total', 'RIA', 'Tarifa prom.'],
    data.labores.map((l) => [l.nombre, num.format(l.cantidadTotal), l.unidad, money(l.costoTotal), `${num.format(l.pctTotal)}%`, l.riasCount, l.tarifaPromedio != null ? money(l.tarifaPromedio) : '—']),
    ['TOTAL', '', '', money(sumNumCol(data.labores, 'costoTotal')), '100%', '', ''],
  );

  // ── Pie de página ──────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GREEN_RGB);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageH - 9, pageW - MARGIN, pageH - 9);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140);
    doc.text(
      `AgroSistema  ·  Informe Gerencial  ·  ${data.empresaNombre}  ·  Página ${p} de ${totalPages}  ·  ${dateStr}`,
      pageW / 2, pageH - 5, { align: 'center' },
    );
  }

  const slug = data.empresaNombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  doc.save(`informe-gerencial-${slug}-${now.toISOString().split('T')[0]}.pdf`);
}
